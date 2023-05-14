import os from 'os'
import vm from 'vm'
import { Window } from 'happy-dom'
import type { ModuleInfo } from './interface'

export function createVM() {
  const bindings: Record<string, ModuleInfo> = {}
  const window = new Window()
  const context = Object.create(null)
  vm.createContext(context)
  let _opt:ModuleInfo = null
  let _invoke:(info: ModuleInfo) => ModuleInfo | null
  let _id = 0

  const updateBindgs = (opt:ModuleInfo, globalName:string, invoke:(info: ModuleInfo) => ModuleInfo | null) => {
    if (opt && !bindings[opt.name]) {
      const re = invoke({ ...opt, global: globalName })
      if (!re) return
      bindings[opt.name] = re
    }
  }

  const shadow = new Proxy(window, {
    set(target, key:string, value, receiver) {
      updateBindgs(_opt, key, _invoke)
      Reflect.set(target, key, value, receiver)
      return true
    }
  })
  const run = (code: string, opt: ModuleInfo, invoke: (info: ModuleInfo) => ModuleInfo | null) => {
    let id = 0
    _opt = opt
    _invoke = invoke
    try {
      vm.runInContext(code, context)
      _id++
    } catch (_) {
    // If can't process. 
      shadow.eval(code)
      updateBindgs(opt, Object.keys(shadow).pop(), invoke)
    }
    id++
   
    if (id === _id) {
      const latest  = Object.keys(context).pop()
      if (latest) {
        shadow[latest] = context[latest]
      }
      _id--
    }
    _opt = null
    _invoke = null
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
