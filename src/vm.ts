import os from 'os'
import { parse as babelParse, types as t } from '@babel/core'
import { len } from './shared'

// After weighing it. I found that it's more efficient to 
// use ast hit.

export async function tryScannGlobalName(code: string) {
  const ast = await babelParse(code, { babelrc: false, configFile: false })
  const { body } = ast.program
  if (!len(body)) return
  // It's enough to extract only the first node
  let caller = len(body)
  let node = body[0]
  // iife only return the first 
  if (t.isVariableDeclaration(node)) {
    const identifier = node.declarations[0].id
    if (t.isIdentifier(identifier)) return identifier.name
  }
  // umd
  while (caller) {
    if (t.isExpressionStatement(node)) {
      // TODO
      // using babel traverse
      if (!t.isCallExpression(node.expression) && !t.isUnaryExpression(node.expression)) return
      let _node = node.expression
      if (_node.type === 'UnaryExpression') {
        if (t.isCallExpression(_node.argument)) {
          _node = _node.argument
        }
      }
      const n = _node as t.CallExpression
      if (t.isFunctionExpression(n.callee)) {
        const statement = n.callee.body.body.find(v => t.isExpressionStatement(v))
        if (!statement) return
        if (statement.type === 'ExpressionStatement' && 'alternate' in statement.expression) {
          const { alternate } = statement.expression.alternate as any
          if (t.isAssignmentExpression(alternate)) {
            if (t.isMemberExpression(alternate.left)) {
              const prop = alternate.left.property
              if (prop.type === 'Identifier') return prop.name
            }
          }
          if (t.isSequenceExpression(alternate)) {
            const { expressions } = alternate
            if (len(expressions)) {
              let expr = expressions.pop()
              while (!t.isCallExpression(expr)) {
                expr = expressions.pop()
              }
              const assignNode = expr.arguments.find(v => t.isAssignmentExpression(v))
              if (assignNode && t.isAssignmentExpression(assignNode)) {
                if (t.isMemberExpression(assignNode.left)) {
                  const prop = assignNode.left.property
                  if (prop.type === 'Identifier') return prop.name
                }
              }
            }
          }
        }
      }
      return 
    }
    caller--
    node = body[caller]
  }
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
