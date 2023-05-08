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
        resolve(message.resolved)
        worker.terminate()
      })
    })
  }
  return run()
}

async function tryRequireIIFEModule(module: TrackModule, vm: ReturnType<typeof createVM>) {
  const { name: moduleName, ...rest } = module
  const packageJson: IIFEModuleInfo & { browser: string } = Object.create(null)
  let packageJsonPath = ''
  try {
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
    }
    throw new Error('Internal error:' + error)
  }
  // https://docs.npmjs.com/cli/v9/configuring-npm/package-json#browser
  const { version, name, unpkg, jsdelivr, browser } = packageJson
  const iifeRelativePath = typeof browser === 'string' ? browser : jsdelivr ?? unpkg
  if (!iifeRelativePath) return
  const iifeFilePath = lookup(packageJsonPath, iifeRelativePath)
  const code = await fsp.readFile(iifeFilePath, 'utf8')
  vm.run(code, { version, name, unpkg, jsdelivr, ...rest }, (info) => {
    if (!info.unpkg && !info.jsdelivr) return null
    return info
  })
}

function startSyncThreads() {
  if (!worker_threads.workerData.internalThread) return
  const { workerPort, scannerModule } = worker_threads.workerData as WorkerData
  const { parentPort } = worker_threads
  const vm = createVM()
  parentPort?.on('message', (msg) => {
    ;(async () => {
      const { id } = msg
      try {
        const queue = createConcurrentQueue(MAX_CONCURRENT)
        for (const module of scannerModule) {
          queue.enqueue(() => tryRequireIIFEModule(module, vm))
        }
        await queue.wait()
        workerPort.postMessage({ resolved: vm.bindings, id })
      } catch (error) {
        //
      }
    })()
  })
}

if (worker_threads.workerData?.internalThread) {
  startSyncThreads()
}

class Scanner {
  modules: Array<TrackModule>
  dependencies: Record<string, IIFEModuleInfo>
  constructor(modules: Array<TrackModule | string>) {
    this.modules = this.serialization(modules)
    this.dependencies = {}
  }
  public async scanAllDependencies() {
    this.dependencies = (await createWorkerThreads(this.modules)) as Record<string, IIFEModuleInfo>
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
  // TODO
  // Record can't be resolved module.
}

export function createScanner(modules: Array<TrackModule | string>) {
  return new Scanner(modules)
}
