import fsp from 'fs/promises'
import worker_threads from 'worker_threads'
import { createConcurrentQueue, createVM, MAX_CONCURRENT } from './vm'
import { is, len, lookup  } from './shared'
import type { MessagePort } from 'worker_threads'
import type { TrackModule, IIFEModuleInfo, ModuleInfo, IModule, ResolverFunction } from './interface'

// This file is a simply dependencies scanner.
// We won't throw any error unless it's an internal thread error(such as pid not equal)
// we consume all expection modules in the plugin itself.
// Notice. This file don't handle any logic with script inject.

interface WorkerData {
    scannerModule: IModule[]
    workerPort: MessagePort
    internalThread: boolean
}

interface ScannerModule {
  modules: Array<TrackModule>
  resolvers: Record<string, string | ResolverFunction>
}

interface ThreadMessage {
  bindings: Map<string, ModuleInfo>, 
  failedModules: Map<string, string>
  id: number
  error: Error
}

function createWorkerThreads(scannerModule: ScannerModule) {
  const { port1: mainPort, port2: workerPort } = new worker_threads.MessageChannel()
  const worker = new worker_threads.Worker(__filename, {
    workerData: { workerPort, internalThread: true, scannerModule: scannerModule.modules },
    transferList: [workerPort],
    execArgv: []
  })
  const id = 0
  const run = () => {
    worker.postMessage({ id })
    return new Promise((resolve, reject) => {
      mainPort.on('message', (message: ThreadMessage) => {
        if (message.id !== id) reject(new Error(`Internal error: Expected id ${id} but got id ${message.id}`))
        if (message.error) {
          reject(message.error)
        } else {
          // Can't copy function reference. So we should bind it again from resolvers
          message.bindings.forEach((meta, moduleName) => {
            if (scannerModule.resolvers[moduleName]) {
              meta.resolve = scannerModule.resolvers[moduleName]
            }
          })
          resolve({ dependencies: message.bindings, failedModules: message.failedModules })
        }
        worker.terminate()
      })
    })
  }
  return run() as Promise<{dependencies: Map<string, ModuleInfo>, failedModules: Map<string, string>}>
}

async function tryResolveModule(
  module: IModule,
  dependenciesMap: Map<string, ModuleInfo>,
  failedModules: Map<string, string>
) {
  const { name: moduleName, relativeModule, ...rest } = module
  try {
    const modulePath = require.resolve(moduleName)
    const packageJsonPath = lookup(modulePath, 'package.json')
    const str = await fsp.readFile(packageJsonPath, 'utf8')
    const packageJSON: IIFEModuleInfo = JSON.parse(str)
    const { version, name, unpkg, jsdelivr } = packageJSON
    const meta: ModuleInfo = Object.create(null)
    // Most of package has jsdelivr or unpkg field
    // but a small part is not. so we should accept user define.
    const iifeRelativePath = jsdelivr || unpkg || relativeModule
    if (!iifeRelativePath) throw new Error('try resolve file failed.')
    if (rest.global) {
      Object.assign(meta, { name, version, relativeModule: iifeRelativePath, ...rest })
    } else {
      const iifeFilePath = lookup(packageJsonPath, iifeRelativePath)
      const code = await fsp.readFile(iifeFilePath, 'utf8')
      Object.assign(meta, { name, version, code, relativeModule: iifeRelativePath, ...rest })
    }
    const pkg = await import(moduleName)
    const keys = Object.keys(pkg)
    // If it's only exports by default
    if (keys.includes('default') && len(keys) !== 1) {
      const pos = keys.findIndex((k) => k === 'default')
      keys.splice(pos, 1)
      keys.push(...Object.keys(pkg.default))
    }
    const bindings = new Set(keys.filter(v => v !== '__esModule'))
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

function startAsyncThreads() {
  if (!worker_threads.workerData.internalThread) return
  const { workerPort, scannerModule } = worker_threads.workerData as WorkerData
  const { parentPort } = worker_threads
  const vm = createVM()
  const dependenciesMap: Map<string, ModuleInfo> = new Map()
  const failedModules: Map<string, string> = new Map()
  parentPort?.on('message', (msg) => {
    (async () => {
      const { id } = msg
      try {
        const queue = createConcurrentQueue(MAX_CONCURRENT)
        for (const module of scannerModule) {
          queue.enqueue(() => tryResolveModule(module, dependenciesMap, failedModules))
        }
        await queue.wait()
        for (const module of scannerModule) {
          const { name } = module
          if (dependenciesMap.has(name)) {
            const { code, ...rest } =  dependenciesMap.get(name)
            if (!code) {
              vm.bindings.set(name, rest)
              continue
            }
            vm.run(code, rest, (err: Error) => {
              failedModules.set(err.message, 'try resolve global name failed.')
            })
          }
        }
        dependenciesMap.clear()
        workerPort.postMessage({ bindings: vm.bindings, id, failedModules })
      } catch (error) {
        workerPort.postMessage({ error, id })
      }
    })()
  })
}

if (worker_threads.workerData?.internalThread) {
  startAsyncThreads()
}

class Scanner {
  modules: Array<IModule | string>
  dependencies: Map<string, ModuleInfo>
  failedModules: Map<string, string>
  constructor(modules: Array<IModule | string>) {
    this.modules = modules
    this.dependencies = new Map()
    this.failedModules = new Map()
  }

  public async scanAllDependencies() {
    // we won't throw any exceptions inside this task.
    const res = await createWorkerThreads(this.serialization(this.modules))
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
