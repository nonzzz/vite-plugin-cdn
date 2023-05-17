// This is an experimental module
// I think using ast as full process is better
// In past. we using ast and magicStr. According ast loc range to update or remove string by magicStr
// It's not a good way.
// escodegen 

// I think using ast as once is enough.

import { parse as esModuleLexer } from 'rs-module-lexer'
import escodegen from 'escodegen'
import MagicString from 'magic-string'
import { attachScopes } from '@rollup/pluginutils'
import { len } from './shared'
import { walk, isReference } from './ast'
import type { ExportAllDeclaration, ExportNamedDeclaration, Identifier, ImportDeclaration, Node, Program } from 'estree'
import type { WalkerContext } from './ast'
import type{ RollupTransformHookContext, ModuleInfo } from './interface'

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
  private overwriteAllExportDeclaration(node:ExportAllDeclaration, walkContext:WalkerContext, rollupTransformHookContext:RollupTransformHookContext) {
    const ref = node.source.value
    if (typeof ref !== 'string') return
    if (ref in this.dependencies) {
      const { bindings, global } = this.dependencies[ref]
      const code = node.exported
        ?  `export const ${node.exported.name} = { ${Array.from(bindings).map(dep => `${dep}: ${global}.${dep}`)} };\n`
        : `export {${Array.from(bindings).map(dep => dep)} } from '${ref}';\n`
      const newNode = (rollupTransformHookContext.parse(code) as Node as Program).body[0]
      walkContext.replace(newNode)
    }
  }

  // erase all export keywords without 'source' type and remove duplicate declarations
  private overwriteAllNamedDeclaration(node:ExportNamedDeclaration, program:Program, walkContext:WalkerContext, exports:string[]) {
    if (node.source) {
      // export { default as A } from 'module-name'
      // export { B as default } from 'module-name'
      const ref = node.source.value 
      if (typeof ref !== 'string') return
      if (ref in this.dependencies) {
        const { global } = this.dependencies[ref]
        for (const specifier of node.specifiers) {
          if (specifier.local.name) {
            if (specifier.local.name === 'default') {
              // 
            }
          }
          // import module from 'module-name'
          // import * as module from 'module-name'
          // if (specifier.type === 'ImportDefaultSpecifier' || specifier.type === 'ImportNamespaceSpecifier') {
          //   bindings.set(specifier.local.name, global)
          // }
          // import { a1, b2 } from 'module-name'
          // import {s as S } from 'module-name'
          // if (specifier.type === 'ImportSpecifier') {
          //   bindings.set(specifier.local.name,  `${global}.${specifier.imported.name}`)
          // }
        }
      }

      return
    }
    if (node.declaration) {
      const name = node.declaration.type === 'VariableDeclaration' ? (node.declaration.declarations[0].id as Identifier).name : node.declaration.id.name
      // const exportsWithSource =  program.body.filter(n => n.type === 'ExportNamedDeclaration' && n.source)
      // specifier 
      // for (const exports of exportsWithSource) {
      //   for (const specifier in specifier) {
      //     // 
      //   }
      // }
      walkContext.replace(node.declaration)
      // program.body.push(name)
      exports.push(name)
    }
  }

  private overwriteAllImportDeclaration(node:ImportDeclaration, bindings:Map<string, string>) {
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
    const exports:string[] = []
    const bindings:Map<string, string> = new Map()
    walk(ast, {
      enter(node, parent) {
        switch (node.type) {
          case 'ExportAllDeclaration':
            ctx.overwriteAllExportDeclaration(node, this, rollupTransformHookContext)
            this.skip()
            break
          case 'ExportNamedDeclaration':
            ctx.overwriteAllNamedDeclaration(node, parent as Program, this, exports)
            this.skip()
            break
          case 'ImportDeclaration':
            ctx.overwriteAllImportDeclaration(node, bindings)
            this.skip()
            break
        }
      }
    })

    let scope = attachScopes(ast, 'scope')
    walk(ast, {
      enter(node, parent) {
        if (node.type === 'ExportAllDeclaration' || node.type === 'ExportNamedDeclaration') {
          this.skip()
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
                  node.name = bindings.get(node.name)
                }
            }
          }
        }
      },
      leave(node) {
        if (node.scope) {
          scope = node.scope.parent
        }
        if (node.type === 'ImportDeclaration') {
          const ref = node.source.value
          if (typeof ref !== 'string') return
          if (ref in ctx.dependencies) {
            this.remove()
          }
        }
      }
    })
    const magicStr = new MagicString(escodegen.generate(ast))
    // concat all exports 
    if (len(exports)) {
      magicStr.append(`export { ${exports.join(' , ')} }`)
    }
    return { code: magicStr.toString(), map: magicStr.generateMap() }
  }
}



export function createGenerator() {
  return new Generator()
}
