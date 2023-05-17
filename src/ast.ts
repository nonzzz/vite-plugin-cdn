// refer https://astexplorer.net/
import type { AttachedScope } from '@rollup/pluginutils'
import type { Node as EsNode  } from 'estree'

export type Node = EsNode & {
  scope?: AttachedScope
}

// es-walker is implement from https://github.com/Rich-Harris/estree-walker
// MIT LICENSE

export interface WalkerContext {
  skip: () => void
  remove: () => void
  replace: (node: Node) => void
}
type WalkerHandler = (
  this: WalkerContext,
  node: Node,
  parentNode: Node | null,
  key: string | number | symbol | null | undefined,
  index: number | null | undefined
) => void

interface WalkOptions {
  enter?: WalkerHandler
  leave?: WalkerHandler
}

function isNode(value): value is Node {
  return value !== null && typeof value === 'object' && 'type' in value && typeof value.type === 'string'
}

class Walker {
  should_skip: boolean
  should_remove: boolean
  replacement: Node | null
  context: WalkerContext
  enter: WalkerHandler
  leave: WalkerHandler
  constructor(handle: WalkOptions = {}) {
    this.should_skip = false
    this.should_remove = false
    this.replacement = null
    this.enter = handle.enter
    this.leave = handle.leave
    this.context = {
      skip: () => (this.should_skip = true),
      remove: () => (this.should_remove = true),
      replace: (node) => (this.replacement = node)
    }
  }

  private replace(parent, prop, index, node) {
    if (parent && prop) {
      // eslint-disable-next-line eqeqeq
      if (index != null) {
        parent[prop][index] = node
      } else {
        parent[prop] = node
      }
    }
  }

  private remove(parent, prop, index) {
    if (parent && prop) {
      if (index !== null && index !== undefined) {
        parent[prop].splice(index, 1)
      } else {
        delete parent[prop]
      }
    }
  }

  visit(
    node: Node,
    parent: Node | null,
    prop?: string | number | symbol | null | undefined,
    index?: number | null | undefined
  ): Node | null {
    if (node) {
      if (this.enter) {
        const _should_skip = this.should_skip
        const _should_remove = this.should_remove
        const _replacement = this.replacement
        this.should_skip = false
        this.should_remove = false
        this.replacement = null

        this.enter.call(this.context, node, parent, prop, index)

        if (this.replacement) {
          node = this.replacement
          this.replace(parent, prop, index, node)
        }

        if (this.should_remove) {
          this.remove(parent, prop, index)
        }

        const skipped = this.should_skip
        const removed = this.should_remove

        this.should_skip = _should_skip
        this.should_remove = _should_remove
        this.replacement = _replacement

        if (skipped) return node
        if (removed) return null
      }

      let key: keyof Node

      for (key in node) {
        const value = node[key]

        if (value && typeof value === 'object') {
          if (Array.isArray(value)) {
            const nodes = value
            for (let i = 0; i < nodes.length; i += 1) {
              const item = nodes[i]
              if (isNode(item)) {
                if (!this.visit(item, node, key, i)) {
                  // removed
                  i--
                }
              }
            }
          } else if (isNode(value)) {
            this.visit(value, node, key, null)
          }
        }
      }

      if (this.leave) {
        const _replacement = this.replacement
        const _should_remove = this.should_remove
        this.replacement = null
        this.should_remove = false

        this.leave.call(this.context, node, parent, prop, index)

        if (this.replacement) {
          node = this.replacement
          this.replace(parent, prop, index, node)
        }

        if (this.should_remove) {
          this.remove(parent, prop, index)
        }

        const removed = this.should_remove

        this.replacement = _replacement
        this.should_remove = _should_remove

        if (removed) return null
      }
    }

    return node
  }
}

export function walk(ast: Node, handle: WalkOptions) {
  const instance = new Walker(handle)
  return instance.visit(ast, null)
}

// isReference is implement from  https://github.com/Rich-Harris/is-reference
// MIT LICENSE
export function isReference(node: Node, parent: Node) {
  if (node.type === 'MemberExpression') {
    return !node.computed && isReference(node.object, node)
  }
  if (node.type === 'Identifier') {
    if (!parent) return true
    switch (parent.type) {
      case 'MemberExpression':
        return parent.computed || node === parent.object
      case 'MethodDefinition':
        return parent.computed
      case 'PropertyDefinition':
        return parent.computed || node === parent.value
      case 'Property':
        return parent.computed || node === parent.value
      case 'ExportSpecifier':
      case 'ImportSpecifier':
        return node === parent.local
      case 'LabeledStatement':
      case 'BreakStatement':
      case 'ContinueStatement':
        return false
      default:
        return true
    }
  }
}
