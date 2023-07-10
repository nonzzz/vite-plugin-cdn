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
    const nodes:Array<t.VariableDeclarator | t.ObjectExpression | t.MemberExpression> = []
    const natives:Array<t.ExportSpecifier> = []
    const hasBindings = path.node.source
    const globalName = hasBindings ? this.dependencies.get(path.node.source.value).global : ''
    const bindings:Set<string> = hasBindings ? this.dependencies.get(path.node.source.value).bindings : new Set()

    const scanNamedExportsWithSource = (l:t.Identifier, e:t.Identifier, specifier:t.ExportSpecifier) => {
      if (!bindings.size) return
      if (l.name === 'default' && l.name !== e.name) {
        const memberExpression = (p) => t.memberExpression(t.identifier(globalName), t.identifier(p))
        const objectExpression = [...bindings.keys()].map(p => t.objectProperty(t.identifier(p), memberExpression(p)))
        const node = t.variableDeclarator(t.identifier(e.name), t.objectExpression(objectExpression))
        nodes.push(node)
        return
      }
      if (e.name === 'default' && l.name !== e.name) {
        const node = t.memberExpression(t.identifier(globalName), t.identifier(l.name))
        nodes.push(node)
        return
      }
      if (l.name === e.name) {
        if (l.name === 'default') {
          const memberExpression = (p) => t.memberExpression(t.identifier(globalName), t.identifier(p))
          const objectExpression = [...bindings.keys()].map(p => t.objectProperty(t.identifier(p), memberExpression(p)))
          const node = t.objectExpression(objectExpression)
          nodes.push(node) 
          return
        }
        if (bindings.has(l.name)) {
          const memberExpression = t.memberExpression(t.identifier(globalName), t.identifier(l.name))
          const node = t.variableDeclarator(t.identifier(l.name), memberExpression)
          nodes.push(node)
          return
        }
      }
      natives.push(specifier)
    }

    const scanNamedExportsWithoutSource = (l:t.Identifier, e:t.Identifier, specifier:t.ExportSpecifier) => {
      if (references.has(l.name)) {
        const [o, p] = references.get(l.name).split('.')
        if (e.name === 'default') {
          const node = t.memberExpression(t.identifier(o), t.identifier(p))
          nodes.push(node)
          return
        }
        const memberExpression = t.memberExpression(t.identifier(o), t.identifier(p))
        const node = t.variableDeclarator(t.identifier(l.name), memberExpression)
        nodes.push(node)
        return 
      }
      natives.push(specifier)
    }

    for (const specifier of path.node.specifiers) {
      if (specifier.type === 'ExportSpecifier') {
        const { local, exported } = specifier
        if (exported.type !== 'Identifier') continue
        if (hasBindings) {
          scanNamedExportsWithSource(local, exported, specifier)
        } else {
          scanNamedExportsWithoutSource(local, exported, specifier)
        }
      }
      if (specifier.type === 'ExportNamespaceSpecifier') {
        const e = specifier.exported
        if (e.name === 'default') {
          const memberExpression = (p) => t.memberExpression(t.identifier(globalName), t.identifier(p))
          const objectExpression = [...bindings.keys()].map(p => t.objectProperty(t.identifier(p), memberExpression(p)))
          const node = t.objectExpression(objectExpression)
          nodes.push(node)
        } else {
          const memberExpression = (p) => t.memberExpression(t.identifier(globalName), t.identifier(p))
          const objectExpression = [...bindings.keys()].map(p => t.objectProperty(t.identifier(p), memberExpression(p)))
          const node = t.variableDeclarator(t.identifier(e.name), t.objectExpression(objectExpression))
          nodes.push(node)
        }
      }
    }

    // export { default } from 'module'
    // export {default as A } from 'module'
    // export { B as default } from 'module'
    // export { A , B } from 'module'
    // export * as default from 'module'
    // export * as xx from 'module'
    const variableDeclaratorNodes = nodes.filter((node):node is t.VariableDeclarator => node.type === 'VariableDeclarator')
    const objectOrMemberExpression = nodes.filter((node):node is t.ObjectExpression | t.MemberExpression => node.type !== 'VariableDeclarator')
    if (len(objectOrMemberExpression)) {
      const exportDefaultDeclaration = t.exportDefaultDeclaration(objectOrMemberExpression[0])
      if (len(variableDeclaratorNodes) || len(natives)) {
        path.insertAfter(exportDefaultDeclaration)
      } else {
        path.replaceWith(exportDefaultDeclaration)
      }
    }
    if (len(variableDeclaratorNodes)) {
      const variableDeclaration = t.variableDeclaration('const', variableDeclaratorNodes)
      if (len(natives)) {
        const exportNamedDeclaration = t.exportNamedDeclaration(null, natives)
        path.replaceWith(exportNamedDeclaration)
        path.insertAfter(variableDeclaration)
      } else {
        path.replaceWith(t.exportNamedDeclaration(variableDeclaration, []))
      }
    }
  }

  private overWriteExportAllDeclaration(path:NodePath<t.ExportAllDeclaration>) {
    const nodes:Array<t.ExportSpecifier> = []
    const { bindings } = this.dependencies.get(path.node.source.value)
    bindings.forEach((binding) => {
      const identifier = t.identifier(binding)
      const node = t.exportSpecifier(identifier, identifier)
      nodes.push(node)
    })
    if (len(nodes)) {
      const exportNamedDeclaration = t.exportNamedDeclaration(null, nodes, t.stringLiteral(path.node.source.value))
      path.replaceWith(exportNamedDeclaration)
    }
  }

  async transform(code:string) {
    const ast = await babelParse(code, { babelrc: false, configFile: false })
    const references:Map<string, string> = new Map()
    const declarations:Map<string, NodePath<t.ClassDeclaration | t.VariableDeclaration | t.VariableDeclarator | t.FunctionDeclaration>> = new Map()
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
              if (this.dependencies.has(path.node.source?.value) || !path.node.declaration) {
                this.overWriteExportNamedDeclaration(path as NodePath<t.ExportNamedDeclaration>, references)
              }
              break
            case 'ExportAllDeclaration':
              if (this.dependencies.has(path.node.source.value)) {
                this.overWriteExportAllDeclaration(path as NodePath<t.ExportAllDeclaration>)
              }
          }
        }
      },
      FunctionDeclaration: (path) => {
        if (path.parent.type === 'Program' || path.parent.type === 'ExportNamedDeclaration' || path.parent.type === 'ExportDefaultDeclaration') {
          const def = path.node.id.name
          if (declarations.has(def)) {
            const p = declarations.get(def)
            p.remove()
          } else {
            declarations.set(def, path)
          }
        }
      },
      ClassDeclaration: (path) => {
        if (path.parent.type === 'Program' || path.parent.type === 'ExportNamedDeclaration' || path.parent.type === 'ExportDefaultDeclaration') {
          const def = path.node.id.name
          if (declarations.has(def)) {
            const p = declarations.get(def)
            p.remove()
          } else {
            declarations.set(def, path)
          }
        }
      },
      VariableDeclaration: (path) => {
        if (path.parent.type === 'Program' || path.parent.type === 'ExportNamedDeclaration' || path.parent.type === 'ExportDefaultDeclaration') {
          const _declarations = path.get('declarations')
          for (const desc of _declarations) {
            const declarator = desc.node
            if (t.isIdentifier(declarator.id)) {
              const def = declarator.id.name
              if (declarations.has(def)) {
                const p = declarations.get(def)
                p.remove()
              } else {
                declarations.set(def, desc)
              }
            }
  
            if (t.isObjectPattern(declarator.id)) {
              for (const prop of declarator.id.properties) {
                if (prop.type === 'ObjectProperty') {
                  if (prop.key.type === 'Identifier') {
                    const def = prop.key.name
                    if (declarations.has(def)) {
                      const p = declarations.get(def)
                      p.remove()
                    } else {
                      declarations.set(def, desc)
                    }
                  }
                } else {
                  if (prop.argument.type === 'Identifier') {
                    const def = prop.argument.name
                    if (declarations.has(def)) {
                      const p = declarations.get(def)
                      p.remove()
                    } else {
                      declarations.set(def, desc)
                    }
                  }
                }
              }
            }

            if (t.isArrayPattern(declarator.id)) {
              for (const prop of declarator.id.elements) {
                if (prop.type === 'Identifier') {
                  const def = prop.name
                  if (declarations.has(def)) {
                    const p = declarations.get(def)
                    p.remove()
                  } else {
                    declarations.set(def, desc)
                  }
                }
                if (prop.type === 'RestElement') {
                  if (prop.argument.type === 'Identifier') {
                    const def = prop.argument.name
                    if (declarations.has(def)) {
                      const p = declarations.get(def)
                      p.remove()
                    } else {
                      declarations.set(def, desc)
                    }
                  }
                  if (prop.argument.type === 'ArrayPattern') {
                    for (const p of prop.argument.elements) {
                      if (p.type === 'Identifier') {
                        const def = p.name
                        if (declarations.has(def)) {
                          const p = declarations.get(def)
                          p.remove()
                        } else {
                          declarations.set(def, desc)
                        }
                      }
                    }
                  }
                }
              }
            }
          }
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
