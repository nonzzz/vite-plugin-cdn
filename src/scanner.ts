import fsp from 'fs/promises'
import url from 'url'
import module from 'module'
import path from 'path'
import worker_threads from 'worker_threads'
import type { MessagePort } from 'worker_threads'
import { tryScanGlobalName } from './transform'
import { MAX_CONCURRENT, _import, createConcurrentQueue, is, len, lookup } from './shared'
import type { IModule, Module, ModuleInfo } from './interface'

// TODO
// https://github.com/nodejs/node/issues/43304
// I'm not sure what's happened on Node Js. It can work well with javascript file. :(
// If we upgrade CI and local development versions it can be solved.(Maybe)
// Don't forget remove it.

// tsup provide shims for different platforms but the cjs shims full of noise.
// https://github.com/egoist/tsup/blob/dev/assets/cjs_shims.js
// We only need node shims.(Patch it)

const _require = module.createRequire(import.meta.url)
const ___filename = url.fileURLToPath(import.meta.url)

interface WorkerData {
  scannerModule: IModule[]
  workerPort: MessagePort
  internalThread: boolean
  defaultWd: string
}

interface ScannerModule {
  modules: Array<IModule>
}

interface ThreadMessage {
  bindings: Map<string, ModuleInfo>, 
  failedMessages: string[]
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
    const { message }: { message: ThreadMessage } = worker_threads.receiveMessageOnPort(mainPort)
    if (message.id !== id) throw new Error(`Internal error: Expected id ${id} but got id ${message.id}`)
    if (message.error) throw message.error
    const { bindings, failedMessages } = message
    return { dependencies: bindings, failedMessages }
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
      if (typeof module !== 'object') throw new Error('Invalid type')
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

async function tryResolvePackage(module: IModule, defaultWd: string, handler: (moduleInfo: ModuleInfo, errorMessage: string) => void) {
  const { name: pkgName, ...rest } = module
  let errorMessage = ''
  const moduleInfo: ModuleInfo = Object.create(null)
  try {
    const pkgPath = _require.resolve(pkgName, { paths: [defaultWd] })
    const pkgJsonPath = _require.resolve(path.join(pkgName, 'package.json'), { paths: [defaultWd] })
    const { version, name, unpkg, jsdelivr } = _require(pkgJsonPath)
    const iifeRelativePath = rest.relativeModule || jsdelivr || unpkg
    is(!!iifeRelativePath, `[scanner error]: can't find any iife file from package '${pkgName}',please check it.`, 'normal')
    if ('global' in rest) {
      Object.assign(moduleInfo, { ...rest, name, version, relativeModule: iifeRelativePath, aliases: serializationExportsFields(name, rest.aliases) })
    } else {
      const iifeFilePath = lookup(pkgJsonPath, iifeRelativePath)
      const code = await fsp.readFile(iifeFilePath, 'utf8')
      const global = await tryScanGlobalName(code)
      is(!!global, `[scanner error]: unable to guess the global name form '${pkgName}', please enter manually.`, 'normal')
      Object.assign(moduleInfo, { ...rest, name, version, relativeModule: iifeRelativePath, aliases: serializationExportsFields(name, rest.aliases), global })
    }
    moduleInfo.bindings = await getPackageExports(pkgPath)
  } catch (error) {
    errorMessage = `[scanner error]: invalid package '${pkgName}'.`
    if (error instanceof Error && 'code' in error) {
      if (error.code === 'normal') errorMessage = error.message
    }
  }
  handler(moduleInfo, errorMessage)
}

function startSyncThreads() {
  if (!worker_threads.workerData.internalThread) return
  const { workerPort, scannerModule, defaultWd } = worker_threads.workerData as WorkerData
  const { parentPort } = worker_threads
  const bindings: Map<string, ModuleInfo> = new Map()
  const failedMessages: string[] = []
  parentPort?.on('message', (msg) => {
    (async () => {
      const { id, sharedBuffer } = msg
      const sharedBufferView = new Int32Array(sharedBuffer)
      const queue = createConcurrentQueue(MAX_CONCURRENT)
      try {
        for (const module of scannerModule) {
          queue.enqueue(() => tryResolvePackage(module, defaultWd, (info, msg) => {
            if (msg) return failedMessages.push(msg)
            bindings.set(info.name, info)
          }))
        }
        await queue.wait()
        workerPort.postMessage({ bindings, id, failedMessages })
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
  failedMessages: string[]
  private defaultWd: string
  constructor(modules: Array<IModule | string>) {
    this.modules = modules
    this.dependencies = new Map()
    this.failedMessages = []
    this.defaultWd = process.cwd()
  }

  public setDefaultWd(defaultWd) {
    this.defaultWd = defaultWd
  }

  public scanAllDependencies() {
    // we won't throw any exceptions inside this task.
    const { failedMessages, dependencies } = createWorkerThreads(this.serialization(this.modules), this.defaultWd)
    this.dependencies = dependencies
    this.failedMessages = failedMessages
  }

  private serialization(input: Array<IModule | string>) {
    is(Array.isArray(input), 'vite-plugin-cdn2: option module must be array')
    const modules: Array<IModule> = []
    const bucket = new Set<string>()
    for (const module of input) {
      if (typeof module === 'string') {
        if (bucket.has(module) || !module) continue
        modules.push({ name: module })
        bucket.add(module)
        continue
      }
      if (!module.name || bucket.has(module.name)) continue
      modules.push(module)
      bucket.add(module.name)
    }
    return { modules }
  }
}

export function createScanner(modules: Array<IModule | string>) {
  return new Scanner(modules)
}
