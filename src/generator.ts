import { parse as esModuleLexer } from 'rs-module-lexer'
import escodegen from 'escodegen'
import MagicString from 'magic-string'
import { attachScopes } from '@rollup/pluginutils'
import { len } from './shared'
import { walk, isReference  } from './ast'
import type { ExportAllDeclaration, ExportNamedDeclaration, ImportDeclaration, Node, Program } from 'estree'
import type { WalkerContext } from './ast'
import type{ RollupTransformHookContext, ModuleInfo } from './interface'


const PLUGIN_GLOBAL_NAME = '__vite__plugin__cdn2__global__'

class Generator {
  private dependencies: Record<string, ModuleInfo>
  constructor() {
    this.dependencies = {}
  }

  injectDependencies(dependencies: Record<string, ModuleInfo>) {
    this.dependencies = dependencies
  }

  // using es-module lexer skip unnecessary file.
  filter(code:string, id:string) {
    const { output } = esModuleLexer({ input: [{ filename: id, code }] })
    if (!len(output)) return false
    const { imports } = output[0]
    const modules = new Set([...imports.map(i => i.n)])
    for (const dep in this.dependencies) {
      if (modules.has(dep)) return true
    }
    return false
  }

  // overwrite all exprot declaration 
  private overwriteAllExportDeclaration(node:ExportAllDeclaration, options:{
    rollupTransformHookContext: RollupTransformHookContext,
    walkContext:WalkerContext,
  }) {
    const ref = node.source.value
    if (typeof ref !== 'string') return
    if (ref in this.dependencies) {
      const { rollupTransformHookContext, walkContext } = options
      const { bindings: _bindings, global } = this.dependencies[ref]
      const bindings = new Set([..._bindings])
      bindings.delete('default')
      const code = node.exported
        ?  `export const ${node.exported.name} = { ${Array.from(bindings).map(dep => `${dep}: ${global}.${dep}`)} };\n`
        : `export {${Array.from(bindings).map(dep => dep)} } from '${ref}';\n`
      const newNode = (rollupTransformHookContext.parse(code) as Node as Program).body[0] 
      walkContext.replace(newNode)
    }
  }

  private overwriteAllNamedExportsWithSource(node:ExportNamedDeclaration, options:{
    rollupTransformHookContext: RollupTransformHookContext,
    walkContext:WalkerContext,
    program:Program,
  }) {
    const ref = node.source.value as string
    if (ref in this.dependencies) {
      const { global, bindings } =  this.dependencies[ref]
      const { rollupTransformHookContext, walkContext, program  } = options
      const exports:string[] = []
      const writeContent:string[] = []
      // export { default } from 'module-name'
      // export { default as A } from 'module-name'
      // export { B as default } from 'module-name'
      // export { A, B } from 'module-name'
      for (const specifier of node.specifiers) {
        const { local, exported } = specifier
        if (local.name === exported.name) {
          if (local.name === 'default') {
            writeContent.push(`const ${PLUGIN_GLOBAL_NAME} = { ${Array.from(bindings).map(dep => `${dep}: ${global}.${dep}`)} };`)
            writeContent.push(`export default ${PLUGIN_GLOBAL_NAME};`)
          } else {
            exports.push(local.name)
          }
        } else {
          if (local.name === 'default') {
            writeContent.push(`export const ${exported.name} = { ${Array.from(bindings).map(dep => `${dep}: ${global}.${dep}`)} };`)
          }
          if (exported.name === 'default') {
            writeContent.push(`const ${PLUGIN_GLOBAL_NAME} = ${global}.${specifier.local.name};`)
            writeContent.push(`export default ${PLUGIN_GLOBAL_NAME};`)
          }
        }
      }
      if (len(exports)) {
        writeContent.push(`const { ${exports.map(module => module)} } = ${global};`, `export {${exports.map(module => module)} }`)
      }
      if (!len(writeContent)) return
      const [n1, ...rest] = (rollupTransformHookContext.parse(writeContent.join('\n')) as Node as Program).body
      walkContext.replace(n1)
      program.body.push(...rest)
    }
  }

  private scanForImportAndRecord(node:ImportDeclaration, bindings:Map<string, string>) {
    const ref = node.source.value
    if (typeof ref !== 'string') return
    if (ref in this.dependencies) {
      const { global } = this.dependencies[ref]
      for (const specifier of node.specifiers) {
        // import module from 'module-name'
        // import * as module from 'module-name'
        if (specifier.type === 'ImportDefaultSpecifier' || specifier.type === 'ImportNamespaceSpecifier') {
          bindings.set(specifier.local.name, global)
        }
        // import { a1, b2 } from 'module-name'
        // import {s as S } from 'module-name'
        if (specifier.type === 'ImportSpecifier') {
          bindings.set(specifier.local.name,  `${global}.${specifier.imported.name}`)
        }
      }
    }
  }

  overwrite(code:string, rollupTransformHookContext:RollupTransformHookContext) {
    const ast = rollupTransformHookContext.parse(code) as Node
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const ctx:Generator = this
    const bindings:Map<string, string> = new Map()
    // -  reocrd the reference.
    // -  overwrite exports. to export { x, z, y } from 'module'
    // -  erase named exports

    // I decide don't support dynamic import case

    // handle reference and rewrite identifier
    // remove importer node
    // overwrite named exports
    // syntax analyze
    let scope = attachScopes(ast, 'scope')
    walk(ast, {
      enter(node, parent) {
        switch (node.type) {
          case 'ImportDeclaration':
            ctx.scanForImportAndRecord(node, bindings)
            break
          case 'ExportAllDeclaration':
            ctx.overwriteAllExportDeclaration(node, { rollupTransformHookContext, walkContext: this })
            break
        }
        if (node.scope) {
          // eslint-disable-next-line prefer-destructuring
          scope = node.scope
        }
        if (node.type !== 'Program') {
          if (isReference(node, parent)) {
            switch (node.type) {
              case 'Identifier':
                // Even if it's handle `importDeclaration`. It will be remove at leave.
                if (bindings.has(node.name) && !scope.contains(node.name)) {
                  node.name = bindings.get(node.name)
                }
            }
          }
        }
      },
      leave(node, parent) {
        if (node.scope) {
          scope = node.scope.parent
        } 
        if (node.type === 'ExportNamedDeclaration') {
          if (node.source) {
            ctx.overwriteAllNamedExportsWithSource(node, {
              walkContext: this,
              program: parent as Program, 
              rollupTransformHookContext
            })
            this.skip()
          }
        }
        if (node.type === 'ImportDeclaration') {
          const ref = node.source.value
          if (typeof ref !== 'string') return
          if (ref in ctx.dependencies) this.remove()
        }
      }
    })
    const magicStr = new MagicString(escodegen.generate(ast))
    return { code: magicStr.toString(), map: magicStr.generateMap() }
  }
}



export function createGenerator() {
  return new Generator()
}
