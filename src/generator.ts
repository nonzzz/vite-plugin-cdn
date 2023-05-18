import { parse as esModuleLexer } from 'rs-module-lexer'
import escodegen from 'escodegen'
import MagicString from 'magic-string'
import { attachScopes } from '@rollup/pluginutils'
import { len } from './shared'
import { walk, isReference, LocRange } from './ast'
import type { ExportAllDeclaration, ExportNamedDeclaration, Identifier, ImportDeclaration, Node, Program } from 'estree'
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
  //  walkContext:WalkerContext,
  private overwriteAllExportDeclaration(node:ExportAllDeclaration, options:{
    rollupTransformHookContext: RollupTransformHookContext,
    parent: Program,
    pos:number
  }) {
    const { rollupTransformHookContext, parent, pos } = options
    const ref = node.source.value
    if (typeof ref !== 'string') return
    if (ref in this.dependencies) {
      const { bindings, global } = this.dependencies[ref]
      const code = node.exported
        ?  `export const ${node.exported.name} = { ${Array.from(bindings).map(dep => `${dep}: ${global}.${dep}`)} };\n`
        : `export {${Array.from(bindings).map(dep => dep)} } from '${ref}';\n`
      const newNode = (rollupTransformHookContext.parse(code) as Node as Program).body[0] 
      parent.body[pos] = newNode
    }
  }

  // erase all export keywords without 'source' type and remove duplicate declarations
  private eraseExportKeyword(node:ExportNamedDeclaration, options:{exports:Map<string, LocRange>, parent:Program, pos:number}) {
    if (node.source) return
    if (node.declaration) {
      const { exports, parent, pos } = options
      const name = node.declaration.type === 'VariableDeclaration' ? (node.declaration.declarations[0].id as Identifier).name : node.declaration.id.name
      exports.set(name, { start: node.start })
      // node = node.declaration as any
      parent.body[pos] = node.declaration
    }
  }

  private overwriteAllNamedExportsWithSource(node:ExportNamedDeclaration, program:Program, exportRecords:Map<string, LocRange>, walkContext:WalkerContext, rollupTransformHookContext:RollupTransformHookContext) {
    const ref = node.source.value as string
    if (ref in this.dependencies) {
      const { global, bindings } =  this.dependencies[ref]
      const exports = []
      const writeContent:string[] = []
      for (const specifier of node.specifiers) {
        // export { default as A } from 'module-name'
        // export { B as default } from 'module-name'
        if (specifier.exported.name === 'default') {
          if (specifier.local.name === 'default') {
            const code = `const ${PLUGIN_GLOBAL_NAME} = { ${Array.from(bindings).map(dep => `${dep}: ${global}.${dep}`)} };\n export default ${PLUGIN_GLOBAL_NAME};\n`
            const [n1, n2] =  (rollupTransformHookContext.parse(code) as Node as Program).body
            walkContext.replace(n1)
            program.body.push(n2)
          } else {
            const code  = `const ${PLUGIN_GLOBAL_NAME} = ${global}.${specifier.local.name};\n export default ${PLUGIN_GLOBAL_NAME};\n`
            const [n1, n2] =  (rollupTransformHookContext.parse(code) as Node as Program).body
            walkContext.replace(n1)
            program.body.push(n2)
          }
        } else {
          // export { A, B } from 'module-name'
          const filed = specifier.exported.name
          // if (!exportRecords.has(filed)) {
          //   if (exportRecords.get(filed).start > node.start) return
          // }
          exports.push(filed)
        }
      }
      if (len(exports)) {
        // console.log(exportRecords)
        writeContent.push(`const { ${exports.map(module => module)} } = ${global};\n`, `export {${exports.map(module => module)} }`)
        if (len(writeContent)) {
          const [n1, n2] = (rollupTransformHookContext.parse(writeContent.join('\n'))as Node as Program).body
          walkContext.replace(n1)
          program.body.push(n2)
        }
      }
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
    const exports:Map<string, LocRange > = new Map()
    const bindings:Map<string, string> = new Map()

    // -  reocrd the reference.
    // -  overwrite exports. to export { x, z, y } from 'module'
    // -  erase named exports

    // I decide don't support dynamic import case

    if (ast.type === 'Program') {
      const program = ast
      program.body.forEach((node, pos) => {
        switch (node.type) {
          case 'ImportDeclaration':
            this.scanForImportAndRecord(node, bindings)
            return
          case 'ExportAllDeclaration':
            this.overwriteAllExportDeclaration(node, { rollupTransformHookContext, parent: program, pos })
            return
          case 'ExportNamedDeclaration':
            this.eraseExportKeyword(node, { exports, parent: program, pos })
        }
      })
    }
    // handle reference and rewrite identifier
    // remove importer node
    // overwrite named exports
    // syntax analyze
    let scope = attachScopes(ast, 'scope')
    walk(ast, {
      enter(node, parent) {
        if (node.type === 'ExportAllDeclaration') {
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
      leave(node, parent) {
        if (node.scope) {
          scope = node.scope.parent
        } 
        if (node.type === 'ExportNamedDeclaration') {
          if (node.source) {
            ctx.overwriteAllNamedExportsWithSource(node, parent as Program, exports, this, rollupTransformHookContext)
            this.skip()
          }
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
    // analysisExports(ast, exports)
    const magicStr = new MagicString(escodegen.generate(ast))
    // concat all exports 
    if (exports.size) {
      magicStr.append(`export { ${[...exports.keys()].join(' , ')} }`)
    }
    return { code: magicStr.toString(), map: magicStr.generateMap() }
  }
}



export function createGenerator() {
  return new Generator()
}
