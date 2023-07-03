import os from 'os'
import vm from 'vm'
import { Window } from 'happy-dom'
import { len } from './shared'
import type { ModuleInfo } from './interface'

export function createVM() {
  const bindings:Map<string, ModuleInfo>  = new Map()
  const window = new Window()
  const context = vm.createContext({})
  let _meta:ModuleInfo = null
  let id = 0
  let callerId = 0

  const updateBindings  = (name:string, meta:ModuleInfo) => {
    bindings.set(meta.name, { ...meta, global: name }) 
  }
  const shadow = new Proxy(window, {
    set(target, key: string, value, receiver) {
      callerId++
      if (id === callerId) updateBindings(key, _meta)
      Reflect.set(target, key, value, receiver)
      return true
    }
  })

  const run = (code: string, meta: ModuleInfo, handler:(err:Error)=>void) => {
    _meta = meta
    try {
      vm.runInContext(code, context)
      // TODO
      // This is a temporary solution.
      // when vm run script it can't run others logic in threads it will directly
      // end the function.
      // So we need to get the last one using the tag.
      // https://github.com/nodejs/help/issues/1378
      id = len(Object.keys(context))
      Object.assign(shadow, context)
      // context free
      for (const key in context) {
        Reflect.deleteProperty(context, key)
      }
      _meta = null
      callerId = 0
      id = 0
    } catch (error) {
      try {
        // In most cases there will only be one variable
        window.eval(code)
        updateBindings(Object.keys(shadow).pop(), meta)
      } catch (error) {
        const err = new Error()
        err.message = meta.name
        handler(err)        
      }
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
  errors: Error[]
  constructor(maxConcurrent: number) {
    this.maxConcurrent = maxConcurrent
    this.queue = []
    this.running = 0
    this.errors = []
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
      } catch (err) {
        this.errors.push(err)
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
    if (len(this.errors)) {
      const message  = this.errors.reduce((acc, cur) => acc += cur.message, '')
      throw new Error(message)
    }
  }
}

export function createConcurrentQueue(max: number) {
  return new Queue(max)
}
