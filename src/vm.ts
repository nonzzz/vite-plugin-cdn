import os from 'os'
import vm from 'vm'
import { Window } from 'happy-dom'
import type { IIFEModuleInfo } from './interface'

// v0.4.0
// I notice using happy-dom as vm context may casue some bug.
// some modules don't work. Called syntax error.
// Maybe we can define a replacement env.

// This is a temporary solution.
export function createVM() {
  const bindings: Record<string, IIFEModuleInfo> = {}
  const window = new Window()
  const context = Object.create(null)
  vm.createContext(context)
  const run = (code: string, opt: IIFEModuleInfo, invoke: (info: IIFEModuleInfo) => IIFEModuleInfo | null) => {
    let failed = false
    try {
      window.eval(code)
    } catch (_) {
      vm.runInContext(code, context)
      failed = true
    }
    const globalName = failed ? Object.keys(context).pop() : Object.keys(window).pop()
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
