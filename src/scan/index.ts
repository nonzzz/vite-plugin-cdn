import worker_threads from 'worker_threads'
import { resolvePackageInfo } from './scan'

export interface AcceptDependModule {
  module: string[]
}

interface PostMessage {
  sharedBuffer: SharedArrayBuffer
  id: number
}

interface InternalWorkerData extends AcceptDependModule {
  isInternal: boolean
  workerPort: worker_threads.MessagePort
}

export function scanAllDependencies(options: AcceptDependModule) {
  const { module } = options
  const { port1: mainPort, port2: workerPort } = new worker_threads.MessageChannel()
  const worker = new worker_threads.Worker(__filename, {
    workerData: <InternalWorkerData> { isInternal: true, workerPort, module },
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
    if (status !== 'ok' && status !== 'not-equal') { throw new Error('Internal error: Atomics.wait() failed: ' + status) }
    const message = worker_threads.receiveMessageOnPort(mainPort)?.message as PostMessage
    if (message.id !== id) { throw new Error(`Internal error: Expected id ${id} but got id ${message.id}`) }
  }
  runSync()
}

function startSyncThreads() {
  const workerData = worker_threads.workerData as InternalWorkerData
  if (!workerData.isInternal) {
    return
  }
  const { workerPort, module } = workerData
  worker_threads.parentPort?.on('message', (msg: PostMessage) => {
    const { id, sharedBuffer } = msg
    const sharedBufferView = new Int32Array(sharedBuffer)
    for (const mod of module) {
      resolvePackageInfo(mod)
    }
    workerPort.postMessage({ id })
    Atomics.add(sharedBufferView, 0, 1)
    Atomics.notify(sharedBufferView, 0, Infinity)
  })
}

if ((worker_threads.workerData as InternalWorkerData)?.isInternal) {
  startSyncThreads()
}
