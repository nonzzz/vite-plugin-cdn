import fsp from 'fs/promises'
import worker_threads from 'worker_threads'
import { createConcurrentQueue, createVM, MAX_CONCURRENT } from './vm'
import { is, len, lookup, uniq } from './shared'
import type { MessagePort } from 'worker_threads'
import type { TrackModule, IIFEModuleInfo, ModuleInfo } from './interface'

  interface WorkerData {
    scannerModule: TrackModule[]
    workerPort: MessagePort
    internalThread: boolean
  }

function createWorkerThreads(scannerModule: TrackModule[]) {
  const { port1: mainPort, port2: workerPort } = new worker_threads.MessageChannel()

  const worker = new worker_threads.Worker(__filename, {
    workerData: { workerPort, internalThread: true, scannerModule },
    transferList: [workerPort],
    execArgv: []
  })
  const id = 0
  const run = () => {
    worker.postMessage({ id })
    return new Promise((resolve, reject) => {
      mainPort.on('message', (message) => {
        if (message.id !== id) reject(new Error(`Internal error: Expected id ${id} but got id ${message.id}`))
        if (message.error) {
          reject(message.error)
        } else {
          resolve({ dependencies: message.bindings, failedModule: message.failedModule })
        }
        worker.terminate()
      })
    })
  }
  return run() as Promise<{dependencies:Record<string, ModuleInfo>, failedModule:Set<string>}>
}

async function tryResolveModule(
  module: TrackModule,
  dependenciesMap: Map<string, ModuleInfo>,
  failedModule: Set<string>
) {
  const { name: moduleName, ...rest } = module
  try {
    const modulePath = require.resolve(moduleName)
    const packageJsonPath = lookup(modulePath, 'package.json')
    const str = await fsp.readFile(packageJsonPath, 'utf8')
    const packageJSON:IIFEModuleInfo = JSON.parse(str)
    const { version, name, unpkg, jsdelivr  } = packageJSON
    const meta:ModuleInfo = Object.create(null)
    if (rest.global) {
      Object.assign(meta, { name, version, ...rest })
    } else {
      const iifeRelativePath = jsdelivr || unpkg
      if (!iifeRelativePath) throw new Error('try resolve file failed.')
      const iifeFilePath = lookup(packageJsonPath, iifeRelativePath)
      const code = await fsp.readFile(iifeFilePath, 'utf8')
      Object.assign(meta, { name, version, code, ...rest })
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
    failedModule.add(moduleName)
  }
}

function startAsyncThreads() {
  if (!worker_threads.workerData.internalThread) return
  const { workerPort, scannerModule } = worker_threads.workerData as WorkerData
  const { parentPort } = worker_threads
  const vm = createVM()
  const dependenciesMap: Map<string, ModuleInfo> = new Map()
  const failedModule: Set<string> = new Set()
  parentPort?.on('message', (msg) => {
    (async () => {
      const { id } = msg
      try {
        const queue = createConcurrentQueue(MAX_CONCURRENT)
        for (const module of scannerModule) {
          queue.enqueue(() => tryResolveModule(module, dependenciesMap, failedModule))
        }
        await queue.wait()
        for (const module of scannerModule) {
          const { name } = module
          if (dependenciesMap.has(name)) {
            const { code, ...rest } =  dependenciesMap.get(name)
            if (!code) {
              vm.bindings[name] = rest
              continue
            }
            vm.run(code, rest, (err:Error) => {
              failedModule.add(err.message)
            })
          }
        }
        dependenciesMap.clear()
        workerPort.postMessage({ bindings: vm.bindings, id, failedModule })
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
  modules: Array<TrackModule>
  dependencies: Record<string, ModuleInfo>
  failedModule: Set<string>
  constructor(modules: Array<TrackModule | string>) {
    this.modules = this.serialization(modules)
    this.dependencies = {}
  }

  public async scanAllDependencies() {
    // we won't throw any exceptions inside this task.
    const res = await createWorkerThreads(this.modules)
    this.dependencies = res.dependencies
    this.failedModule = res.failedModule
  }

  private serialization(modules: Array<TrackModule | string>) {
    is(Array.isArray(modules), 'vite-plugin-cdn2: option module must be array')
    return uniq(modules)
      .map((module) => {
        if (typeof module === 'string') return { name: module }
        return module
      })
      .filter((v) => v.name)
  }

  // ensure the order
  get dependModuleNames() {
    const deps = Object.keys(this.dependencies)
    return this.modules.map((v) => v.name).filter((v) => deps.includes(v))
  }

  get failedModuleNames() {
    return [...this.failedModule.keys()]
  }
}

export function createScanner(modules: Array<TrackModule | string>) {
  return new Scanner(modules)
}
