import fsp from 'fs/promises'
import worker_threads from 'worker_threads'
import { createConcurrentQueue, createVM, MAX_CONCURRENT } from './vm'
import { is, lookup, uniq } from './shared'
import type { MessagePort } from 'worker_threads'
import type { TrackModule, IIFEModuleInfo } from './interface'

interface WorkerData {
  scannerModule: TrackModule[]
  workerPort: MessagePort
  internalThread: boolean
}

type DependenciesGraph = Record<string, string[]>

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
        resolve({ bindings: message.bindings, dependenciesGraph: message.dependenciesGraph })
        worker.terminate()
      })
    })
  }
  return run() as Promise<{
    bindings: Record<string, IIFEModuleInfo>
    dependenciesGraph: DependenciesGraph
  }>
}

async function tryResolveModule(
  module: TrackModule,
  vm: ReturnType<typeof createVM>,
  dependenciesGraph: DependenciesGraph
) {
  const { name: moduleName, ...rest } = module

  const packageJson: IIFEModuleInfo & { browser: string } = Object.create(null)
  let packageJsonPath = ''
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    Object.assign(packageJson, require(`${moduleName}/package.json`))
    packageJsonPath = require.resolve(`${moduleName}/package.json`)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    // handle esm package
    if (error.code === 'ERR_PACKAGE_PATH_NOT_EXPORTED') {
      const modulePath = require.resolve(moduleName)
      packageJsonPath = lookup(modulePath, 'package.json')
      const str = await fsp.readFile(packageJsonPath, 'utf8')
      Object.assign(packageJson, JSON.parse(str))
    } else {
      throw new Error('Internal error:' + error)
    }
  }
  // // https://docs.npmjs.com/cli/v9/configuring-npm/package-json#browser
  const { version, name, unpkg, jsdelivr, browser } = packageJson
  if (rest.global) {
    vm.bindings[name] = {
      name,
      version,
      unpkg,
      jsdelivr,
      ...rest
    }
    // if user prvoide the global name . Skip eval script
  } else {
    const iifeRelativePath = typeof browser === 'string' ? browser : jsdelivr ?? unpkg
    if (!iifeRelativePath) return
    const iifeFilePath = lookup(packageJsonPath, iifeRelativePath)
    const code = await fsp.readFile(iifeFilePath, 'utf8')
    vm.run(code, { version, name, unpkg, jsdelivr, ...rest }, (info) => {
      if (!info.unpkg && !info.jsdelivr) return null
      return info
    })
  }
  const pkg = await import(moduleName)
  const keys = Object.keys(pkg)
  if (keys.includes('default')) {
    const pos = keys.findIndex((k) => k === 'default')
    keys.splice(pos, 1)
    keys.push(...Object.keys(pkg.default))
  }
  dependenciesGraph[name] = uniq(keys.sort())
}

function startAsyncThreads() {
  if (!worker_threads.workerData.internalThread) return
  const { workerPort, scannerModule } = worker_threads.workerData as WorkerData
  const { parentPort } = worker_threads
  const vm = createVM()
  const dependenciesGraph: DependenciesGraph = Object.create(null)
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
          queue.enqueue(() => tryResolveModule(module, vm, dependenciesGraph))
        }
        await queue.wait()
        workerPort.postMessage({ bindings: vm.bindings, id, dependenciesGraph })
      } catch (error) {
        //
      }
    })()
  })
}

if (worker_threads.workerData?.internalThread) {
  startAsyncThreads()
}

class Scanner {
  modules: Array<TrackModule>
  dependencies: Record<string, IIFEModuleInfo>
  dependenciesGraph: DependenciesGraph
  constructor(modules: Array<TrackModule | string>) {
    this.modules = this.serialization(modules)
    this.dependencies = {}
  }

  public async scanAllDependencies() {
    const { bindings, dependenciesGraph } = await createWorkerThreads(this.modules)
    this.dependencies = bindings
    this.dependenciesGraph = dependenciesGraph
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
