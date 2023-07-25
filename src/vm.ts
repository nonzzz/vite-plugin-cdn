import os from 'os'
import vm from 'vm'
import { Window } from 'happy-dom'
import { len } from './shared'
import type { ModuleInfo } from './interface'

// Normal. Each umd of iife library only export one module. But some libraries don't 
// follow this principle. They export some variable starting with __ like `Vue`,`Element-Plus`
// Variables staring with an underscore are private variables by convention and we shouldn't 
// parse them. If they are mulitple variables then we only take the last.

export function createVM() {
  const bindings: Map<string, ModuleInfo>  = new Map()
  const window = new Window()
  const context = vm.createContext({})

  const updateBindings  = (name: string, meta: ModuleInfo) => {
    bindings.set(meta.name, { ...meta, global: name }) 
  }
  const shadow = new Proxy(window, {
    set(target, key: string, value, receiver) {
      Reflect.set(target, key, value, receiver)
      return true
    }
  })

  const run = (code: string, meta: ModuleInfo, handler: (err: Error)=> void) => {
    try {
      vm.runInContext(code, context)
      // https://github.com/nodejs/help/issues/1378
      const c = Object.keys(context)
      Object.assign(shadow, context)
      let last = c.pop()
      while (last.startsWith('__')) {
        last = c.pop()
      }
      updateBindings(last, meta)
      // context free
      for (const key in context) {
        Reflect.deleteProperty(context, key)
      }
    } catch (error) {
      try {
        // In most cases there will only be one variable
        window.eval(code)
        const c = Object.keys(shadow)
        let last = c.pop()
        while (last.startsWith('__')) {
          last = c.pop()
        }
        updateBindings(last, meta)
      } catch (_) {
        handler(new Error(meta.name))        
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
  queue: Array<()=> Promise<void>>
  running: number
  errors: Error[]
  constructor(maxConcurrent: number) {
    this.maxConcurrent = maxConcurrent
    this.queue = []
    this.running = 0
    this.errors = []
  }

  enqueue(task: ()=> Promise<void>) {
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
