import fsp from 'fs/promises'
import { createConcurrentQueue, createVM, MAX_CONCURRENT } from './vm'
import { lookup, uniq } from './shared'
import type { MessagePort } from 'worker_threads'
import type { PresetDomain, TrackModule, IIFEModuleInfo } from './interface'

interface WorkerData {
  scannerContext: Scanner
  workerPort: MessagePort
  internalThread: boolean
}

function createWorkerThreads(worker_threads: typeof import('worker_threads'), scannerContext: Scanner) {
  const { port1: mainPort, port2: workerPort } = new worker_threads.MessageChannel()

  const worker = new worker_threads.Worker(__filename, {
    workerData: { workerPort, internalThread: true },
    transferList: [workerPort],
    execArgv: []
  })

  const id = 0

  const runSync = () => {
    worker.postMessage({ id, scannerContext })
    const message = worker_threads.receiveMessageOnPort(mainPort)
    // worker.terminate()
    console.log(message)
  }

  runSync()
  // const runSync = () => {
  //   const sharedBuffer = new SharedArrayBuffer(8)
  //   const sharedBufferView = new Int32Array(sharedBuffer)
  //   // worker.postMessage()

  //   const status = Atomics.wait(sharedBufferView, 0, 0)
  //   if (status !== 'ok' && status !== 'not-equal') throw new Error('Internal error: Atomics.wait() failed: ' + status)
  //   // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  //   const { message } = worker_threads.receiveMessageOnPort(mainPort)!
  // }
  // worker.unref()
}

async function tryRequireIIFEModule(moduleName: string, mode: PresetDomain, vm: ReturnType<typeof createVM>) {
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
  vm.run(code, { version, name, unpkg, jsdelivr, mode })
}

function startSyncThreads(worker_threads: typeof import('worker_threads')) {
  if (!worker_threads.workerData.internalThread) return
  const { workerPort } = worker_threads.workerData as WorkerData
  const { parentPort } = worker_threads
  parentPort?.on('message', (msg) => {
    ;(async () => {
      try {
        const { id, scannerContext } = msg
        const queue = createConcurrentQueue(MAX_CONCURRENT)
        for (const module of scannerContext.modules) {
          queue.enqueue(() => tryRequireIIFEModule(module.name, scannerContext.mode, scannerContext.vm))
        }
        await queue.wait()
        workerPort.postMessage({ resolved: scannerContext.vm.bindings, id })
      } catch (error) {
        //
      }
    })()
  })
}

class Scanner {
  mode: PresetDomain
  modules: Array<TrackModule>
  vm: ReturnType<typeof createVM>
  constructor(modules: Array<TrackModule | string>, mode: PresetDomain) {
    this.mode = mode
    this.modules = this.serialization(modules)
    this.vm = createVM()
  }
  public async scanAllDependencies() {
    // const worker_threads = await import('worker_threads')
    // createWorkerThreads(worker_threads, this)
    // if (worker_threads.parentPort) {
    //   startSyncThreads(worker_threads)
    // }
    const queue = createConcurrentQueue(MAX_CONCURRENT)
    for (const module of this.modules) {
      queue.enqueue(() => tryRequireIIFEModule(module.name, this.mode, this.vm))
    }
    await queue.wait()
  }
  private serialization(modules: Array<TrackModule | string>) {
    return uniq(modules).map((module) => {
      if (typeof module === 'string') return { name: module }
      return module
    })
  }

  get bindings() {
    return this.vm.bindings
  }
}

export function createScanner(modules: Array<TrackModule | string>, mode: PresetDomain) {
  return new Scanner(modules, mode)
}
