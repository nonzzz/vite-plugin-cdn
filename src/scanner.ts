import fsp from 'fs/promises'
import worker_threads from 'worker_threads'
import { createConcurrentQueue, createVM, MAX_CONCURRENT } from './vm'
import { is, lookup, uniq } from './shared'
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
  // record thread id
  const id = 0
  const run = () => {
    worker.postMessage({ id })
    return new Promise((resolve, reject) => {
      mainPort.on('message', (message) => {
        if (message.id !== id) reject(new Error(`Internal error: Expected id ${id} but got id ${message.id}`))
        if (message.error) {
          reject(message.error)
        } else {
          resolve(message.bindings)
        }
        worker.terminate()
      })
    })
  }
  return run() as Promise<Record<string, ModuleInfo>>
}

async function tryResolveModule(
  module: TrackModule,
  dependenciesMap:Map<string, ModuleInfo>
) {
  const { name: moduleName, ...rest } = module

  try {
    const modulePath = require.resolve(moduleName)
    const packageJsonPath = lookup(modulePath, 'package.json')
    const str = await fsp.readFile(packageJsonPath, 'utf8')
    const packageJSON:IIFEModuleInfo & { browser: string } = JSON.parse(str)
    //  https://docs.npmjs.com/cli/v9/configuring-npm/package-json#browser
    const { version, name, unpkg, jsdelivr, browser } = packageJSON
    if (rest.global) {
      dependenciesMap.set(name, { name, version, unpkg, jsdelivr, bindings: new Set(), ...rest  })
    } else {
      const iifeRelativePath = typeof browser === 'string' ? browser : jsdelivr ?? unpkg
      if (!iifeRelativePath) return
      const iifeFilePath = lookup(packageJsonPath, iifeRelativePath)
      const code = await fsp.readFile(iifeFilePath, 'utf8')
      dependenciesMap.set(name, { name, version, unpkg, jsdelivr, code, bindings: new Set(), ...rest })
    }
    const pkg = await import(moduleName)
    const keys = Object.keys(pkg)
    if (keys.includes('default')) {
      const pos = keys.findIndex((k) => k === 'default')
      keys.splice(pos, 1)
      keys.push(...Object.keys(pkg.default))
    }

    if (dependenciesMap.has(name)) {
      dependenciesMap.get(name).bindings = new Set(keys.filter((k) => k !== '__esModule'))
    }
  } catch (error) {
    throw new Error(`try resolve ${moduleName} failed.`)
  }
}

function startAsyncThreads() {
  if (!worker_threads.workerData.internalThread) return
  const { workerPort, scannerModule } = worker_threads.workerData as WorkerData
  const { parentPort } = worker_threads
  const vm = createVM()
  const dependenciesMap: Map<string, ModuleInfo> = new Map()
  parentPort?.on('message', (msg) => {
    (async () => {
      const { id } = msg
      // An Idea. We won't need ensure the task order.
      // We only need two tasks. First is the import module.(Node.js has implement  `import('module')`)
      // The second is find the global name of umd or iife file. (If user pass the global. Skip find global name)
      // If this process is ok. we don't need collect bindings in trasnform stage. :)
      try {
        const queue = createConcurrentQueue(MAX_CONCURRENT)
        for (const module of scannerModule) {
          queue.enqueue(() => tryResolveModule(module, dependenciesMap))
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
            vm.run(code, rest, (info) => {
              if (!info.unpkg && !info.jsdelivr) return null
              return info
            })
          }
        }
        dependenciesMap.clear()
        workerPort.postMessage({ bindings: vm.bindings, id  })
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
  constructor(modules: Array<TrackModule | string>) {
    this.modules = this.serialization(modules)
    this.dependencies = {}
  }

  public async scanAllDependencies() {
    this.dependencies = await createWorkerThreads(this.modules)
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
    const failedModules:string[] = []
    this.modules.forEach((module) => {
      if (module.name in this.dependencies) return
      failedModules.push(module.name)
    })
    return failedModules
  }
}

export function createScanner(modules: Array<TrackModule | string>) {
  return new Scanner(modules)
}
