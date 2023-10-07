import fsp from 'fs/promises'
import url from 'url'
import module from 'module'
import path from 'path'
import worker_threads from 'worker_threads'
import type { MessagePort } from 'worker_threads'
import { tryScanGlobalName } from './code-gen'
import { MAX_CONCURRENT, _import, createConcurrentQueue, is, len, lookup } from './shared'
import type { IIFEModuleInfo, IModule, Module, ModuleInfo, ResolverFunction, TrackModule } from './interface'

// This file is a simply dependencies scanner.
// We won't throw any error unless it's an internal thread error(such as pid not equal)
// we consume all expection modules in the plugin itself.
// Notice. This file don't handle any logic with script inject.

// TODO
// We pack this file just to make the test pass. If we migrate to other test framework
// Don't forget remove it.

// https://github.com/evanw/esbuild/issues/859
// however i can't want break currently export strategy. 
// So we transform each import.meta.url and inejct banner for it.
// But it just a temporary solution.
// import.meta.url will be transform as 
// const __meta = { url: require('url').pathToFileURL(__filename).href }


const _require = module.createRequire(import.meta.url)

const ___filename = url.fileURLToPath(import.meta.url)

interface WorkerData {
    scannerModule: IModule[]
    workerPort: MessagePort
    internalThread: boolean
    defaultWd: string
}

interface ScannerModule {
  modules: Array<TrackModule>
  resolvers: Record<string, string | ResolverFunction>
}

interface ThreadMessage {
  bindings: Map<string, ModuleInfo>, 
  failedModules: Map<string, string>
  id: number
  error: Error | AggregateError
}

function createWorkerThreads(scannerModule: ScannerModule, defaultWd: string) {
  const { port1: mainPort, port2: workerPort } = new worker_threads.MessageChannel()
  const worker = new worker_threads.Worker(___filename, {
    workerData: { workerPort, internalThread: true, scannerModule: scannerModule.modules, defaultWd },
    transferList: [workerPort],
    execArgv: []
  })
  const id = 0
  worker.unref()
  const runSync = () => {
    const sharedBuffer = new SharedArrayBuffer(4)
    const sharedBufferView = new Int32Array(sharedBuffer)
    worker.postMessage({ sharedBuffer, id })
    const status = Atomics.wait(sharedBufferView, 0, 0)
    if (status !== 'ok' && status !== 'not-equal') throw new Error('Internal error: Atomics.wait() failed: ' + status)
    const { message }: {message: ThreadMessage} = worker_threads.receiveMessageOnPort(mainPort)
    if (message.id !== id) throw new Error(`Internal error: Expected id ${id} but got id ${message.id}`)
    if (message.error) throw message.error
    const { bindings, failedModules } = message
    // Can't copy function reference. So we should bind it again from resolvers
    bindings.forEach((meta, moduleName) => {
      if (scannerModule.resolvers[moduleName]) {
        meta.resolve = scannerModule.resolvers[moduleName]
      }
    })
    return { dependencies: bindings, failedModules }
  }
  return runSync()
}


export function serializationExportsFields(moduleName: string, aliases = []) {
  return aliases.filter(v => v !== '.').map(v => path.posix.join(moduleName, v))
}

export function getPackageExports(modulePath: string): Promise<Set<string>>
export function getPackageExports(module: Module, defaultWd: string): Promise<Set<string>>
export async function getPackageExports(...argvs: [string | Module, string?]) {
  let pkg: Record<string, unknown>
  switch (len(argvs)) {
    case 1: {
      const modulePath = argvs[0]
      if (typeof modulePath !== 'string') throw new Error('Invalid type')
      pkg = await _import(url.pathToFileURL(modulePath))
      break
    }
    case 2: {
      const [module, defaultWd] = argvs
      if (typeof module !== 'object')  throw new Error('Invalid type')
      const modulePath = _require.resolve(module.name, { paths: [defaultWd] })
      pkg = await _import(url.pathToFileURL(modulePath))
      break
    }
  }
  const keys = Object.keys(pkg)
  if (keys.includes('default') && len(keys) !== 1) {
    const pos = keys.findIndex((k) => k === 'default')
    keys.splice(pos, 1)
    keys.push(...Object.keys(pkg.default))
  }
  const bindings = new Set(keys.filter(v => v !== '__esModule'))
  return bindings
}

async function tryResolveModule(
  module: IModule,
  dependenciesMap: Map<string, ModuleInfo>,
  failedModules: Map<string, string>,
  defaultWd: string
) {
  const { name: moduleName, relativeModule, aliases, ...rest } = module
  try {
    const modulePath = _require.resolve(moduleName, { paths: [defaultWd] })
    const packageJsonPath = lookup(modulePath, 'package.json')
    const str = await fsp.readFile(packageJsonPath, 'utf8')
    const packageJSON: IIFEModuleInfo = JSON.parse(str)
    const { version, name, unpkg, jsdelivr  } = packageJSON
    const meta: ModuleInfo = Object.create(null)
    // Most of package has jsdelivr or unpkg field
    // but a small part is not. so we should accept user define.
    const iifeRelativePath = relativeModule || jsdelivr || unpkg 
    if (!iifeRelativePath) throw new Error('try resolve file failed.')
    if (rest.global) {
      Object.assign(meta, { name, version, relativeModule: iifeRelativePath, aliases: serializationExportsFields(name,  aliases), ...rest })
    } else {
      const iifeFilePath = lookup(packageJsonPath, iifeRelativePath)
      const code = await fsp.readFile(iifeFilePath, 'utf8')
      Object.assign(meta, { name, version, code, relativeModule: iifeRelativePath, aliases: serializationExportsFields(name, aliases), ...rest })
    }
    const bindings = await getPackageExports(modulePath)
    dependenciesMap.set(name, { ...meta, bindings })
  } catch (error) {
    const message = (() => {
      if (error instanceof Error) {
        if ('code' in error) {
          if (error.code === 'MODULE_NOT_FOUND') return 'can\'t find module.'
        }
        return error.message
      }
      return error
    })()
    failedModules.set(moduleName, message)
  }
}

function startSyncThreads() {
  if (!worker_threads.workerData.internalThread) return
  const { workerPort, scannerModule, defaultWd } = worker_threads.workerData as WorkerData
  const { parentPort } = worker_threads
  const dependenciesMap: Map<string, ModuleInfo> = new Map()
  const failedModules: Map<string, string> = new Map()
  parentPort?.on('message', (msg) => {
    (async () => {
      const { id, sharedBuffer } = msg
      const sharedBufferView = new Int32Array(sharedBuffer)
      try {
        const bindings: Map<string, ModuleInfo>  = new Map()
        const queue = createConcurrentQueue(MAX_CONCURRENT)
        for (const module of scannerModule) {
          queue.enqueue(() => tryResolveModule(module, dependenciesMap, failedModules, defaultWd))
        }
        await queue.wait()
        for (const module of scannerModule) {
          const { name } = module
          if (dependenciesMap.has(name)) {
            const { code, ...rest } =  dependenciesMap.get(name)
            if (!code) {
              bindings.set(name, rest)
              continue
            }
            const globalName = await tryScanGlobalName(code)
            if (!globalName) {
              failedModules.set(name, 'try resolve global name failed.')
            } else {
              bindings.set(name, { ...rest, global: globalName })
            }
          }
        }
        dependenciesMap.clear()
        workerPort.postMessage({ bindings, id, failedModules })
      } catch (error) {
        workerPort.postMessage({ error, id })
      }
      Atomics.add(sharedBufferView, 0, 1)
      Atomics.notify(sharedBufferView, 0, Infinity)
    })()
  })
}

if (worker_threads.workerData?.internalThread) {
  startSyncThreads()
}

class Scanner {
  modules: Array<IModule | string>
  dependencies: Map<string, ModuleInfo>
  failedModules: Map<string, string>
  private defaultWd: string
  constructor(modules: Array<IModule | string>) {
    this.modules = modules
    this.dependencies = new Map()
    this.failedModules = new Map()
    this.defaultWd = process.cwd()
  }

  public setDefaultWd(defaultWd) {
    this.defaultWd = defaultWd
  }

  public scanAllDependencies() {
    // we won't throw any exceptions inside this task.
    const res = createWorkerThreads(this.serialization(this.modules), this.defaultWd)
    this.dependencies = res.dependencies
    this.failedModules = res.failedModules
  }

  private serialization(input: Array<IModule | string>) {
    is(Array.isArray(input), 'vite-plugin-cdn2: option module must be array')
    const modules: Array<IModule> = []
    const resolvers: Record<string, string | ResolverFunction> = {}
    const bucket = new Set<string>()
    for (const module of input) {
      if (typeof module === 'string') {
        if (bucket.has(module) || !module) continue
        modules.push({ name: module })
        bucket.add(module)
        continue
      }
      if (!module.name || bucket.has(module.name)) continue
      const { resolve, ...rest } = module
      if (resolve) {
        resolvers[rest.name] = resolve
      }
      modules.push(rest)
      bucket.add(module.name)
    }
    return { modules, resolvers }
  }
}

export function createScanner(modules: Array<IModule | string>) {
  return new Scanner(modules)
}
