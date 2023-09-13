import { parse as esModuleLexer } from 'rs-module-lexer'
import { parse as babelParse, types as t, transformFromAstAsync, traverse  } from '@babel/core'
import type { NodePath } from '@babel/core'
import { len } from './shared'
import type { ModuleInfo } from './interface'


function isTopLevelCalled(p: NodePath) {
  return t.isProgram(p.parent) || t.isExportDefaultDeclaration(p.parent) || t.isExportNamedDeclaration(p.parent)
}

export class CodeGen {
  dependencies: Map<string, ModuleInfo>
  aliasesToDependencies: Map<string, string>
  injectDependencies(dependencies: Map<string, ModuleInfo>) {
    this.dependencies = dependencies
    this.aliasesToDependencies = new Map()
    this.dependencies.forEach(({ name, aliases }) => {
      this.aliasesToDependencies.set(name, name)
      if (len(aliases)) {
        aliases.forEach((aliase) => this.aliasesToDependencies.set(aliase, name))
      }
    })
  }

  filter(code: string, id: string) {
    // I trust rs-module-lexer
    // BTW, vite-plugin-external depends on es-module-lexer(v0.4) It doesn't handle 
    // the correct depenedencies.
    // eg:
    // import ReactDOM from 'react-dom/client' => "n" be react-dom
    // The truth should be react-dom/client 
    const { output } = esModuleLexer({ input: [{ filename: id, code }] })
    if (!len(output)) return false
    const { imports } = output[0]
    const modules = Array.from(new Set([...imports.map(i => i.n)]))
    for (const m of modules) {
      if (this.aliasesToDependencies.has(m)) return true
      continue
    }
    return false
  }

  private scanImportDeclarationAndRecord(path: NodePath<t.ImportDeclaration>, references: Map<string, string>) {
    const aliase = this.aliasesToDependencies.get(path.node.source.value)
    const { global: globalName } = this.dependencies.get(aliase)
    for (const specifier of path.node.specifiers) {
      switch (specifier.type) {
        case 'ImportDefaultSpecifier':
        case 'ImportNamespaceSpecifier':
          references.set(specifier.local.name, `${globalName}.${specifier.type}.${aliase}`)
          break
        case 'ImportSpecifier':
          if (specifier.imported.type === 'Identifier') {
            references.set(specifier.local.name, `${globalName}.${specifier.imported.name}.${aliase}`)
          }
      }
    }
  }

  private overWriteExportNamedDeclaration(path: NodePath<t.ExportNamedDeclaration>, references: Map<string, string>) {
    const nodes: Array<t.VariableDeclarator | t.ObjectExpression | t.MemberExpression | t.Identifier> = []
    const natives: Array<t.ExportSpecifier> = []
    const hasBindings = path.node.source
    const aliase = hasBindings ? this.aliasesToDependencies.get(path.node.source.value) : ''
    const globalName = hasBindings && aliase ? this.dependencies.get(aliase).global : ''
    const bindings: Set<string> = hasBindings && aliase ? this.dependencies.get(aliase).bindings : new Set()

    const scanNamedExportsWithSource = (l: t.Identifier, e: t.Identifier, specifier: t.ExportSpecifier) => {
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

    const scanNamedExportsWithoutSource = (l: t.Identifier, e: t.Identifier, specifier: t.ExportSpecifier) => {
      if (references.has(l.name)) {
        const [o, p, a] = references.get(l.name).split('.')
        const memberExpression = (() => {
          if (p === 'ImportNamespaceSpecifier') {
            const memberExpression = (p) => t.memberExpression(t.identifier(o), t.identifier(p))
            return t.objectExpression([...this.dependencies.get(a).bindings.keys()].map(p => t.objectProperty(t.identifier(p), memberExpression(p))))
          }
          return t.memberExpression(t.identifier(o), t.identifier(p))
        })()
        if (e.name === 'default') {
          nodes.push(memberExpression)
        } else {
          nodes.push(t.variableDeclarator(t.identifier(l.name), memberExpression))
        }
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
    const variableDeclaratorNodes = nodes.filter((node): node is t.VariableDeclarator => node.type === 'VariableDeclarator')
    const objectOrMemberExpression = nodes.filter((node): node is t.ObjectExpression | t.MemberExpression => node.type !== 'VariableDeclarator')
    if (len(objectOrMemberExpression)) {
      const exportDefaultDeclaration = t.exportDefaultDeclaration(objectOrMemberExpression[0])
      if (len(variableDeclaratorNodes) || len(natives)) {
        path.insertAfter(exportDefaultDeclaration)
      } else {
        path.replaceWith(exportDefaultDeclaration)
      }
    }
    if (len(variableDeclaratorNodes)) {
      const variableDeclaration = t.variableDeclaration('var', variableDeclaratorNodes)
      if (len(natives)) {
        const exportNamedDeclaration = t.exportNamedDeclaration(null, natives)
        path.replaceWith(exportNamedDeclaration)
        path.insertAfter(t.exportNamedDeclaration(variableDeclaration, []))
      } else {
        path.replaceWith(t.exportNamedDeclaration(variableDeclaration, []))
      }
    }
  }

  private overWriteExportAllDeclaration(path: NodePath<t.ExportAllDeclaration>) {
    const nodes: Array<t.ExportSpecifier> = []
    const aliase = this.aliasesToDependencies.get(path.node.source.value)
    const { bindings } = this.dependencies.get(aliase)
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

  private eraseDuplicatedVariableDeclaration(paths: NodePath<t.Node> | NodePath<t.Node>[], declarations: Map<string, NodePath<t.Declaration | t.Node>>) {
    if (!Array.isArray(paths)) return
    const traverseNode = (path: NodePath<t.Node> | Array<NodePath<t.Node>>) => {
      if (Array.isArray(path)) return
      if (t.isVariableDeclarator(path.node)) {
        if (t.isObjectPattern(path.node.id) || t.isArrayPattern(path.node.id)) {
          traverseNode(path.get('id'))
        }
        if (t.isRestElement(path.node.id)) {
          traverseNode(path.get('id.argument'))
        }
        if (t.isIdentifier(path.node.id)) {
          const def = path.node.id.name
          if (declarations.has(def)) {
            const p = declarations.get(def)
            p.remove()
          }
          declarations.set(def, path)
          return
        }
      }
      if (t.isObjectPattern(path.node)) {
        for (const prop of path.get('properties') as Array<NodePath<t.Node>>) {
          traverseNode(prop)
        }
      }
      if (t.isArrayPattern(path.node)) {
        for (const element of path.get('elements') as Array<NodePath<t.Node>>) {
          traverseNode(element)
        }
      }
    }
    for (const path of paths) {
      traverseNode(path)
    }
  }

  // NodeJs "exports" fields seem to be getting more popular.
  // So we should find a balance way to solve those problem.
  // If the submodule exists in the module.it can be processed.

  async transform(code: string) {
    const ast = await babelParse(code, { babelrc: false, configFile: false })
    const references: Map<string, string> = new Map()
    const declarations: Map<string, NodePath<t.Declaration | t.Node>> = new Map()
    traverse(ast, {
      ImportDeclaration: {
        enter: (path) => {
          if (this.aliasesToDependencies.has(path.node.source.value)) {
            this.scanImportDeclarationAndRecord(path, references)
          }
        },
        exit: (path) => {
          if (this.aliasesToDependencies.has(path.node.source.value)) {
            path.remove()
            path.skip()
          }
        }
      },
      ExportDeclaration: {
        enter: (path) => {
          switch (path.node.type) {
            case 'ExportDefaultDeclaration':
              if (t.isIdentifier(path.node.declaration) && this.aliasesToDependencies.has(path.node.declaration.name)) {
                path.remove()
              }
              break
            case 'ExportNamedDeclaration':
              if (this.aliasesToDependencies.has(path.node.source?.value) || !path.node.declaration) {
                this.overWriteExportNamedDeclaration(path as NodePath<t.ExportNamedDeclaration>, references)
              }
              break
            case 'ExportAllDeclaration':
              if (this.aliasesToDependencies.has(path.node.source.value)) {
                this.overWriteExportAllDeclaration(path as NodePath<t.ExportAllDeclaration>)
              }
          }
        }
      },
      Declaration: (path) => {
        if (!isTopLevelCalled(path)) return
        if (t.isClassDeclaration(path.node) || t.isFunctionDeclaration(path.node)) {
          const def = path.node.id.name
          if (declarations.has(def)) {
            const p = declarations.get(def)
            p.remove()
          }
          declarations.set(def, path)
        }
        if (t.isVariableDeclaration(path.node)) {
          this.eraseDuplicatedVariableDeclaration(path.get('declarations'), declarations)
        }
      },
      Identifier: (path) => {
        if (t.isReferenced(path.node, path.parent) && references.has(path.node.name)) {
          if (!path.scope.hasBinding(path.node.name)) {
            const [o, p] = references.get(path.node.name).split('.')
            if (p === 'ImportNamespaceSpecifier' || p === 'ImportDefaultSpecifier') {
              path.node.name = o
            } else {
              path.node.name = [o, p].join('.')
            }

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
