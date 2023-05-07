import fsp from 'fs/promises'
import worker_threads from 'worker_threads'
import { createConcurrentQueue, createVM, MAX_CONCURRENT } from './vm'
import { is, lookup, uniq } from './shared'
import type { MessagePort } from 'worker_threads'
import type { PresetDomain, TrackModule, IIFEModuleInfo } from './interface'

interface WorkerData {
  scannerModule: TrackModule[]
  mode: PresetDomain
  workerPort: MessagePort
  internalThread: boolean
  sharedBuffer: SharedArrayBuffer
}

function createWorkerThreads(scannerModule: TrackModule[], mode: PresetDomain) {
  const { port1: mainPort, port2: workerPort } = new worker_threads.MessageChannel()

  const worker = new worker_threads.Worker(__filename, {
    workerData: { workerPort, internalThread: true, mode, scannerModule },
    transferList: [workerPort],
    execArgv: []
  })

  // record thread id
  const id = 0

  const runSync = () => {
    const sharedBuffer = new SharedArrayBuffer(8)
    const sharedBufferView = new Int32Array(sharedBuffer)
    worker.postMessage({ id, sharedBuffer })
    const status = Atomics.wait(sharedBufferView, 0, 0)
    if (status !== 'ok' && status !== 'not-equal') throw new Error('Internal error: Atomics.wait() failed: ' + status)
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const { message } = worker_threads.receiveMessageOnPort(mainPort)!
    if (message.id !== id) throw new Error(`Internal error: Expected id ${id} but got id ${message.id}`)
    return message.resolved
  }
  worker.unref()
  return runSync()
}

async function tryRequireIIFEModule(module: TrackModule, mode: PresetDomain, vm: ReturnType<typeof createVM>) {
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
  vm.run(code, { version, name, unpkg, jsdelivr, mode, ...rest })
}

function startSyncThreads() {
  if (!worker_threads.workerData.internalThread) return
  const { workerPort, mode, scannerModule } = worker_threads.workerData as WorkerData
  const { parentPort } = worker_threads
  const vm = createVM()
  parentPort?.on('message', (msg) => {
    ;(async () => {
      const { id, sharedBuffer } = msg
      const sharedBufferView = new Int32Array(sharedBuffer)
      try {
        const queue = createConcurrentQueue(MAX_CONCURRENT)
        for (const module of scannerModule) {
          queue.enqueue(() => tryRequireIIFEModule(module, mode, vm))
        }
        await queue.wait()
        workerPort.postMessage({ resolved: vm.bindings, id })
      } catch (error) {
        //
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
  mode: PresetDomain
  modules: Array<TrackModule>
  dependencies: Record<string, IIFEModuleInfo>
  constructor(modules: Array<TrackModule | string>, mode: PresetDomain) {
    this.mode = mode
    this.modules = this.serialization(modules)
    this.dependencies = {}
  }
  public scanAllDependencies() {
    this.dependencies = createWorkerThreads(this.modules, this.mode)
  }
  private serialization(modules: Array<TrackModule | string>) {
    is(!Array.isArray(modules), 'vite-plugin-cdn2: option module must be array')
    return uniq(modules).map((module) => {
      if (typeof module === 'string') return { name: module }
      return module
    })
  }

  get moduleNames() {
    return Object.keys(this.dependencies)
  }
}

export function createScanner(modules: Array<TrackModule | string>, mode: PresetDomain) {
  return new Scanner(modules, mode)
}
