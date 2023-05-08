import vm from 'vm'
import os from 'os'
import type { IIFEModuleInfo } from './interface'

export function createVM() {
  const context = Object.create(null)
  const bindings: Record<string, IIFEModuleInfo> = {}
  vm.createContext(context)
  const run = (code: string, opt: IIFEModuleInfo, invoke: (info: IIFEModuleInfo) => IIFEModuleInfo | null) => {
    try {
      vm.runInContext(code, context)
    } catch (_) {}
    const globalName = Object.keys(context).pop()
    if (!globalName) return
    if (!bindings[opt.name]) {
      const re = invoke({ ...opt, global: globalName })
      if (!re) return
      bindings[opt.name] = re
    }
  }
  return { run, bindings }
}

export const MAX_CONCURRENT = (() => {
  //  https://github.com/nodejs/node/issues/19022
  const cpus = os.cpus() || { length: 1 }
  return Math.max(1, cpus.length - 1)
})()

class Queue {
  maxConcurrent: number
  queue: Array<() => Promise<void>>
  running: number
  constructor(maxConcurrent: number) {
    this.maxConcurrent = maxConcurrent
    this.queue = []
    this.running = 0
  }
  enqueue(task: () => Promise<void>) {
    this.queue.push(task)
    this.run()
  }
  async run() {
    while (this.running < this.maxConcurrent && this.queue.length) {
      const task = this.queue.shift()
      this.running++
      try {
        await task?.()
      } finally {
        this.running--
        this.run()
      }
    }
  }
  async wait() {
    while (this.running) {
      await new Promise((resolve) => setTimeout(resolve, 0))
    }
  }
}

export function createConcurrentQueue(max: number) {
  return new Queue(max)
}
