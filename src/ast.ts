// refer https://astexplorer.net/
import MagicString from 'magic-string'
import { attachScopes } from '@rollup/pluginutils'
import { parse as esModuleLexer } from 'rs-module-lexer'
import { len } from './shared'
import type { AttachedScope } from '@rollup/pluginutils'
import type { Node as EsNode, ExportNamedDeclaration, ExportAllDeclaration, Identifier  } from 'estree'
import type { TransformPluginContext } from 'vite'
import type { ModuleInfo } from './interface'

const IMPORT_DECLARATION = 'ImportDeclaration'
const EXPORT_NAMED_DECLARATION = 'ExportNamedDeclaration'
const EXPORT_ALL_DECLARATION = 'ExportAllDeclaration'

type Node = EsNode & {
  scope?: AttachedScope
}

// es-walker is implement from https://github.com/Rich-Harris/estree-walker
// MIT LICENSE

interface WalkerContext {
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

function walk(ast: Node, handle: WalkOptions) {
  const instance = new Walker(handle)
  return instance.visit(ast, null)
}

// isReference is implement from  https://github.com/Rich-Harris/is-reference
// MIT LICENSE
function isReference(node: Node, parent: Node) {
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

function scanNamedExportsAndRewrite(code: string, rollupTransformPluginContext: TransformPluginContext) {
  const exports:string[] = []
  const ast = rollupTransformPluginContext.parse(code) as Node
  const magicStr = new MagicString(code)
  walk(ast, {
    enter(node) {
      if (node.type === 'ExportNamedDeclaration') {
        if (!node.source) {
          const exportKeyWordStart = node.start
          let exportKeyWordEnd: number
          if (node.declaration) {
            if (node.declaration.type === 'VariableDeclaration') {
              if (node.declaration.declarations[0].type === 'VariableDeclarator') {
                exports.push((node.declaration.declarations[0].id as Identifier).name)
              }
              exportKeyWordEnd = node.declaration.start
            }
            if (node.declaration.type === 'FunctionDeclaration') {
              exports.push(node.declaration.id.name)
              exportKeyWordEnd = node.declaration.start
            }
            if (node.declaration.type === 'ClassDeclaration') {
              exports.push(node.declaration.id.name)
              exportKeyWordEnd = node.declaration.start
            }
            const code = magicStr.slice(exportKeyWordEnd, node.declaration.end)
            magicStr.overwrite(exportKeyWordStart, node.end, code, { contentOnly: true })
          }
        }
      }
    }
  })
  return { exports, code: magicStr.toString() }
}

// overwrite source code imports and exports
// record bindings in current code

function scanForImportsAndExports(
  node: Node,
  magicStr: MagicString,
  deps: Record<string, ModuleInfo>
) {
  const bindings: Map<string, { alias: string }> = new Map()
  if (node.type !== 'Program') return bindings
  for (const n of node.body) {
    switch (n.type) {
      case 'ImportDeclaration': {
        const ref = n.source.value as string
        if (ref in deps) {
          magicStr.remove(n.start, n.end)
          const globalName = deps[ref].global
          for (const specifier of n.specifiers) {
            // import module from 'module-name'
            // import * as module from 'module-name'
            if (specifier.type === 'ImportDefaultSpecifier' || specifier.type === 'ImportNamespaceSpecifier') {
              bindings.set(specifier.local.name, {
                alias: globalName
              })
            }
            // import { a1, b2 } from 'module-name'
            // import {s as S } from 'module-name'
            if (specifier.type === 'ImportSpecifier') {
              bindings.set(specifier.local.name, {
                alias: `${globalName}.${specifier.imported.name}`
              })
            }
          }
        }
        break
      }
      case 'ExportAllDeclaration':
        overWriteExportAllDeclaration(n, magicStr,  deps)
        break
      case 'ExportNamedDeclaration':
        if (n.source) overWriteExportNamedDeclaration(n, magicStr, deps)
    }
  }

  return bindings
}

function overWriteIdentifier(node: Node, magicStr: MagicString, alias: string) {
  if (node.type === 'Identifier') {
    magicStr.overwrite(node.start, node.end, alias, { contentOnly: true })
  }
}

function overWriteExportAllDeclaration(
  node: ExportAllDeclaration,
  magicStr: MagicString,
  deps: Record<string, ModuleInfo>
) {
  const ref = node.source.value as string
  if (ref in deps) {
    const { bindings, global: globalName } = deps[ref]
    const writeContent = node.exported
      ? `export const ${node.exported.name} = { ${Array.from(bindings).map(dep => `${dep}: ${globalName}.${dep}`)} };`
      : Array.from(bindings).map((dep) => `export const ${dep}= ${globalName}.${dep};`).join('\n')
    magicStr.overwrite(node.start, node.end, writeContent, { contentOnly: true })
  }
}

// export { default as A } from 'module-name'
// export { B as default } from 'module-name'
function overWriteExportNamedDeclaration(
  node: ExportNamedDeclaration,
  magicStr: MagicString,
  deps: Record<string, ModuleInfo>
) {
  const ref = node.source.value as string
  const bindings: Record<string, string> = {}
  if (ref in deps) {
    const { global: globalName } = deps[ref]
    for (const specifier of node.specifiers) {
      if (specifier.local.name) {
        if (specifier.local.name === 'default') {
          bindings.__inject__export__default__ = globalName
        } else {
          if (specifier.exported.name === 'default') {
            bindings.__inject__export__default__ = `${globalName}.${specifier.local.name}`
          } else {
            bindings[specifier.local.name] = `${globalName}.${specifier.local.name}`
          }
        }
      }
    }
  }
  const writeContent = []
  for (const binding in bindings) {
    const value = bindings[binding]
    if (binding === '__inject__export__default__') {
      writeContent.push(`const ${binding} = ${value} `, `export default ${binding};`)
      continue
    }
    writeContent.push(`export const ${binding} = ${value};`)
  }
  magicStr.overwrite(node.start, node.end, writeContent.join('\n'), { contentOnly: true })
}

// Why not using rollup-plugin-external-globals
// It can't resolve many edge case for application.

// rs-module-lexer only prcoess js file.

export class Parse {
  private dependencies: Record<string, ModuleInfo>
  constructor() {
    this.dependencies = {}
  }

  injectDependencies(dependencies: Record<string, ModuleInfo>) {
    this.dependencies = dependencies
  }

  filter(code: string, id: string) {
    const { output } = esModuleLexer({
      input: [
        {
          filename: id,
          code
        }
      ]
    })

    if (!len(output)) return false
    // eslint-disable-next-line prefer-destructuring
    const { imports } = output[0]
    const modules = new Set([...imports.map((i) => i.n)]).values()
    for (const module of modules) {
      if (!module) continue
      if (module in this.dependencies) return true
    }
    return false
  }

  // We should implement a mini module parser that record 
  // export * from 'module'
  // export const { version } from 'anothr-module'
  overWrite(code: string, rollupTransformPluginContext: TransformPluginContext) {
    const { exports, code: serialzedCode } = scanNamedExportsAndRewrite(code, rollupTransformPluginContext)
    const ast = rollupTransformPluginContext.parse(serialzedCode) as Node
    const magicStr = new MagicString(serialzedCode)
    const bindings = scanForImportsAndExports(ast, magicStr, this.dependencies)
    // We get all dependencies grpah in scanner stage.
    // According dependencies graph we can infer the referernce.
    let scope = attachScopes(ast, 'scope')
    walk(ast as Node, {
      enter(node, parent) {
        if (
          node.type === IMPORT_DECLARATION ||
          node.type === EXPORT_ALL_DECLARATION ||
          node.type === EXPORT_NAMED_DECLARATION
        ) {
          this.skip()
          return
        }
        if (node.scope) {
          // eslint-disable-next-line prefer-destructuring
          scope = node.scope
        }
        if (node.type !== 'Program') {
          if (isReference(node, parent)) {
            switch (node.type) {
              case 'Identifier':
                if (bindings.has(node.name) && !scope.contains(node.name)) {
                  overWriteIdentifier(node, magicStr, bindings.get(node.name).alias)
                }
            }
          }
        }
      },
      leave(node) {
        if (node.scope) {
          scope = node.scope.parent
        }
      }
    })
    if (len(exports)) {
      magicStr.append(`export { ${exports.join(' , ')} }`)
    }
    return { code: magicStr.toString(), map: magicStr.generateMap() }
  }
}

export function createParse() {
  return new Parse()
}
