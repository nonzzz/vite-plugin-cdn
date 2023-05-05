import { createVM } from './vm'
import type { PresetDomain, TrackModule } from './interface'

function createWorkerThreads(worker_threads: typeof import('worker_threads'), modules: Array<TrackModule>) {
  const { port1: mainPort, port2: workerPort } = new worker_threads.MessageChannel()
  const worker = new worker_threads.Worker(__filename, {})

  const runSync = () => {
    const sharedBuffer = new SharedArrayBuffer(8)
    const sharedBufferView = new Int32Array(sharedBuffer)
    worker.postMessage(modules)

    const status = Atomics.wait(sharedBufferView, 0, 0)
    if (status !== 'ok' && status !== 'not-equal') throw new Error('Internal error: Atomics.wait() failed: ' + status)
    const { message } = worker_threads.receiveMessageOnPort(mainPort)!
  }

  return runSync()
}

class Scanner {
  mode: PresetDomain
  modules: Array<TrackModule>
  private vm: ReturnType<typeof createVM>
  constructor(modules: Array<TrackModule | string>, mode: PresetDomain) {
    this.mode = mode
    this.modules = this.serialization(modules)
    this.vm = createVM()
  }
  public async scanAllDependencies() {
    const worker_threads = await import('worker_threads')
    createWorkerThreads(worker_threads, this.modules)
  }
  private serialization(modules: Array<TrackModule | string>) {
    // return []
    return modules.map((module) => {
      if (typeof module === 'string') return { name: module }
      return module
    })
  }
}

export function createScanner(modules: Array<TrackModule | string>, mode: PresetDomain) {
  return new Scanner(modules, mode)
}
