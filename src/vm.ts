import os from 'os'
import { parse as babelParse, types as t, traverse } from '@babel/core'
import { len } from './shared'

// After weighing it. I found that it's more efficient to 
// use ast hit.

export async function tryScannGlobalName(code: string) {
  const ast = await babelParse(code, { babelrc: false, configFile: false })
  const { body } = ast.program
  if (!len(body)) return
  // It's enough to extract only the first node
  const node = body[0]
  // iife only return the first 
  if (t.isVariableDeclaration(node)) {
    const identifier = node.declarations[0].id
    if (t.isIdentifier(identifier)) return identifier.name
  }
  const bucket = new Set<string>()
  let globalName = ''
  // umd
  traverse(ast, {
    ExpressionStatement: (path) => {
      if (t.isCallExpression(path.node.expression)) {
        if (t.isFunctionExpression(path.node.expression.callee)) {
          const params = path.node.expression.callee.params
          if (len(params)) {
            params.forEach((i) => {
              if (i.type === 'Identifier') {
                bucket.add(i.name)
              }
            })
          }
        }
      }
    },
    AssignmentExpression: (path) => {
      const op = path.get('left')
      if (
        op.node.type === 'MemberExpression' &&
        (path.parent.type === 'CallExpression' || path.parent.type === 'ConditionalExpression' || path.parent.type === 'ExpressionStatement')
      ) {
        if (!globalName) {
          if (t.isIdentifier(op.node.object) && !bucket.has(op.node.object.name)) return
          if (!t.isIdentifier(op.node.property)) return
          if (op.node.property.name === 'exports') return
          globalName = op.node.property.name
        }
      }
      path.skip()
    }
  })
  return globalName
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
