// refer https://astexplorer.net/
import MagicString from 'magic-string'
import { attachScopes } from '@rollup/pluginutils'
import { parse as esModuleLexer } from 'rs-module-lexer'
import { len } from './shared'
import type { Node } from 'estree-walker'
import type { TransformPluginContext } from 'vite'
import { IIFEModuleInfo } from './interface'

const IMPORT_DECLARATION = 'ImportDeclaration'
const EXPORT_NAMED_DECLARATION = 'ExportNamedDeclaration'
const EXPORT_ALL_DECLARATION = 'ExportAllDeclaration'

// overwrite source code imports and exports
// record bindings in current code

function scanForImportsAndExports(node: Node, magicStr: MagicString, deps: Record<string, IIFEModuleInfo>) {
  const bindings: Map<string, { alias: string }> = new Map()
  if (node.type !== 'Program') return bindings
  for (const n of node.body) {
    switch (n.type) {
      case 'ImportDeclaration':
        const ref = n.source.value as string
        if (ref in deps) {
          const globalName = deps[ref].global
          // only process ImportDeclaration & ExportNamedDeclaration
          for (const specifier of n.specifiers) {
            // import module from 'module-name'
            // import * as module from 'module-name'
            if (specifier.type === 'ImportDefaultSpecifier' || specifier.type === 'ImportNamespaceSpecifier') {
              bindings.set(specifier.local.name, {
                alias: globalName
              })
            }
            // import { a1, b2 } from 'module'
            if (specifier.type === 'ImportSpecifier') {
              bindings.set(specifier.imported.name, {
                alias: `${globalName}.${specifier.imported.name}`
              })
            }
          }
        }
        // case 'ExportAllDeclaration':
        // case 'ExportNamedDeclaration':
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        magicStr.remove(n.start, n.end)
    }
  }
  return bindings
}

// isRefernce is implement from  https://github.com/Rich-Harris/is-reference
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

function overWriteIdentifier(node: Node, magicStr: MagicString, alias: string) {
  if (node.type === 'Identifier') {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    magicStr.overwrite(node.start, node.end, alias, { contentOnly: true })
  }
}

function overWriteExportAllDeclaration(
  node: Node,
  magicStr: MagicString,
  depsGraph: Record<string, string[]>,
  deps: Record<string, IIFEModuleInfo>
) {
  if (node.type === 'ExportAllDeclaration') {
    const ref = node.source.value as string
    if (ref in depsGraph) {
      const dependencies = depsGraph[ref]
      const { global: globalName } = deps[ref]
      // TODO
      // I can't find a good way to solve the duplicate name problem.
      const writeContent = node.exported
        ? `export const ${node.exported.name} = window.${globalName};`
        : dependencies.map((dep) => `export const ${dep} = ${globalName}.${dep};`).join('\n')
      magicStr.overwrite(
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        node.start,
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        node.end,
        writeContent,
        { contentOnly: true }
      )
    }
  }
}

// export { default as A } from 'module-name'
// export { B as default } from 'module-name'
function overWriteExportNamedDeclaration(node: Node, magicStr: MagicString, deps: Record<string, IIFEModuleInfo>) {
  if (node.type === 'ExportNamedDeclaration') {
    const ref = node.source.value as string
    const bindings: Record<string, string> = {}
    if (ref in deps) {
      const { global: globalName } = deps[ref]
      for (const specifier of node.specifiers) {
        if (specifier.local.name) {
          if (specifier.local.name === 'default') {
            bindings['__inject__export__default__'] = globalName
          } else {
            if (specifier.exported.name === 'default') {
              bindings['__inject__export__default__'] = `${globalName}.${specifier.local.name}`
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
    magicStr.overwrite(
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      node.start,
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      node.end,
      writeContent.join('\n'),
      { contentOnly: true }
    )
  }
}

// Why not using rollup-plugin-external-globals
// It can't resolve many edge case for application.

// rs-module-lexer only prcoess js file.

export class Parse {
  private dependencies: Record<string, IIFEModuleInfo>
  private dependenciesGraph: Record<string, string[]>
  private walker: typeof import('estree-walker').walk
  constructor() {
    this.dependencies = {}
  }
  async injectDependencies(dependenciesGraph: Record<string, string[]>, dependencies: Record<string, IIFEModuleInfo>) {
    this.dependencies = dependencies
    this.dependenciesGraph = dependenciesGraph
    const { walk } = await import('estree-walker')
    this.walker = walk
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
  overWrite(code: string, rollupTransformPluginContext: TransformPluginContext) {
    const ast = rollupTransformPluginContext.parse(code) as Node
    let scope = attachScopes(ast, 'scope')
    const magicStr = new MagicString(code)
    const bindings = scanForImportsAndExports(ast, magicStr, this.dependencies)
    // We get all dependencies grpah in scanner stage.
    // According dependencies graph we can infer the referernce.
    const parseContext = this
    this.walker(ast as Node, {
      enter(node, parent) {
        if (node.type === IMPORT_DECLARATION) {
          this.skip()
          return
        }
        if (node.type === EXPORT_ALL_DECLARATION) {
          this.skip()
          overWriteExportAllDeclaration(node, magicStr, parseContext.dependenciesGraph, parseContext.dependencies)
          return
        }
        if (node.type === EXPORT_NAMED_DECLARATION) {
          this.skip()
          overWriteExportNamedDeclaration(node, magicStr, parseContext.dependencies)
          // overWriteExportAllDeclaration(node, magicStr, parseContext.dependenciesGraph, parseContext.dependencies)
          return
        }
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        if (node.scope) {
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore
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
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        if (node.scope) {
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore
          // eslint-disable-next-line prefer-destructuring
          scope = node.scope.parent
        }
      }
    })
    return { code: magicStr.toString(), map: magicStr.generateMap() }
  }
}

export function createParse() {
  return new Parse()
}
