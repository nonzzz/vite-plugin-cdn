import { parse as esModuleLexer } from 'rs-module-lexer'
import { parse as babelParse, traverse, transformFromAstAsync, types as t  } from '@babel/core'
import { len } from './shared'
import type { NodePath } from '@babel/core'
import type { ModuleInfo } from './interface'

export class CodeGen {
  private dependencies:Map<string, ModuleInfo>
  injectDependencies(dependencies:Map<string, ModuleInfo>) {
    this.dependencies = dependencies
  }

  filter(code:string, id:string) {
    const { output } = esModuleLexer({ input: [{ filename: id, code }] })
    if (!len(output)) return false
    const { imports } = output[0]
    const modules = Array.from(new Set([...imports.map(i => i.n)]))
    for (const m of modules) {
      if (this.dependencies.has(m)) return true
      return false
    }
    return false
  }

  private scanImportDeclarationAndRecord(path:NodePath<t.ImportDeclaration>, references:Map<string, string>) {
    const { global: globalName } = this.dependencies.get(path.node.source.value)
    for (const specifier of path.node.specifiers) {
      switch (specifier.type) {
        case 'ImportDefaultSpecifier':
        case 'ImportNamespaceSpecifier':
          references.set(specifier.local.name, globalName)
          break
        case 'ImportSpecifier':
          if (specifier.imported.type === 'Identifier') {
            references.set(specifier.local.name, `${globalName}.${specifier.imported.name}`)
          }
      }
    }
  }

  private overWriteExportNamedDeclaration(path:NodePath<t.ExportNamedDeclaration>, references:Map<string, string>) {
    const nodes = []
    const needNewLine = false
    // export { default } from 'module'
    // export {default as A } from 'module'
    // export { B as default } from 'module'
    // export { A , B } from 'module'
    for (const specifier of path.node.specifiers) {
      if (specifier.type === 'ExportSpecifier') {
        const { local, exported } = specifier
        if (exported.type !== 'Identifier') continue
        if (local.name === exported.name) {
          // 
        } else {
          if (local.name === 'default') {
            // 
          }
          if (exported.name === 'default') {
            // 
          }
        }
      }
    }
  }

  async transform(code:string) {
    const ast = await babelParse(code, { babelrc: false, configFile: false })
    const references:Map<string, string> = new Map()
    traverse(ast, {
      ImportDeclaration: {
        enter: (path) => {
          if (this.dependencies.has(path.node.source.value)) {
            this.scanImportDeclarationAndRecord(path, references)
          }
        },
        exit: (path) => {
          if (this.dependencies.has(path.node.source.value)) {
            path.remove()
            path.skip()
          }
        }
      },
      ExportDeclaration: {
        enter: (path) => {
          switch (path.node.type) {
            case 'ExportDefaultDeclaration':
              if (path.node.declaration.type === 'Identifier' && this.dependencies.has(path.node.declaration.name)) {
                path.remove()
              }
              break
            case 'ExportNamedDeclaration':
              // export { x } from 'module';
              // export { y }
              if (this.dependencies.has(path.node.source?.value) || !path.node.declaration) {
                this.overWriteExportNamedDeclaration(path as NodePath<t.ExportNamedDeclaration>, references)
              }
              break
            case 'ExportAllDeclaration':
          }
          path.skip()
        },
        exit: (path) => {
          // 
        }
      },
      Identifier: (path) => {
        if (t.isReferenced(path.node, path.parent) && references.has(path.node.name)) {
          if (!path.scope.hasBinding(path.node.name)) {
            path.node.name = references.get(path.node.name)
            path.skip()
          }
        }
      }
    })
    const result = await transformFromAstAsync(ast, '', { babelrc: false, configFile: false, sourceMaps: true })
    return {
      code: result.code,
      map: result.map
    }
  }
}


export function createCodeGenerator() {
  return new CodeGen() 
}
