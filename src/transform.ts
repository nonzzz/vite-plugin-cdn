import { parse as babelParse, transform as babelTransform, types as t, traverse } from '@babel/core'
import type { NodePath, PluginTarget, Visitor } from '@babel/core'
import { len } from './shared'
import type { ModuleInfo } from './interface'

export interface TransformWithBabelOptions {
  dependency: Record<string, ModuleInfo>
  dependencyWithAlias: Record<string, string>
}

function isTopLevelCalled(p: NodePath) {
  return t.isProgram(p.parent) || t.isExportDefaultDeclaration(p.parent) || t.isExportNamedDeclaration(p.parent)
}

function externalGlobals(options: TransformWithBabelOptions): PluginTarget {
  return function () {
    const { dependency, dependencyWithAlias } = options
    const references: Map<string, string> = new Map()
    const declarations: Map<string, NodePath<t.Declaration | t.Node>> = new Map()
    
    const scanImportDeclarationAndRecord = (path: NodePath<t.ImportDeclaration>) => {
      const aliase = dependencyWithAlias[path.node.source.value]
      const { global: globalName } = dependency[aliase]
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

    const overWriteExportNamedDeclaration = (path: NodePath<t.ExportNamedDeclaration>) => {
      const nodes: Array<t.VariableDeclarator | t.ObjectExpression | t.MemberExpression | t.Identifier> = []
      const natives: Array<t.ExportSpecifier> = []
      const hasBindings = path.node.source
      const aliase = hasBindings ? dependencyWithAlias[path.node.source.value] : ''
      const globalName = hasBindings && aliase ? dependency[aliase].global : ''
      const bindings: Set<string> = hasBindings && aliase ? dependency[aliase].bindings : new Set()
  
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
              return t.objectExpression([...dependency[a].bindings.keys()].map(p => t.objectProperty(t.identifier(p), memberExpression(p))))
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

    const overWriteExportAllDeclaration = (path: NodePath<t.ExportAllDeclaration>) => {
      const nodes: Array<t.ExportSpecifier> = []
      const aliase = dependencyWithAlias[path.node.source.value]
      const { bindings } = dependency[aliase]
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

    const eraseDuplicatedVariableDeclaration = (paths: NodePath<t.Node> | NodePath<t.Node>[], declarations: Map<string, NodePath<t.Declaration | t.Node>>) => {
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

    return {
      visitor: <Visitor>{
        ImportDeclaration: {
          enter: (path) => {
            if (dependencyWithAlias[path.node.source.value]) scanImportDeclarationAndRecord(path)
          },
          exit: (path) => {
            if (dependencyWithAlias[path.node.source.value]) {
              path.remove()
              path.skip()
            }
          }
        },
        ExportDeclaration: {
          enter: (path) => {
            switch (path.node.type) {
              case 'ExportDefaultDeclaration':
                // Only process identifier 
                if (t.isIdentifier(path.node.declaration) && references.has(path.node.declaration.name)) {
                  // eslint-disable-next-line no-unused-vars
                  const [_, __, a] = references.get(path.node.declaration.name).split('.')
                  const { global: globalName } = dependency[a]
                  const id = `__external__${globalName}__`
                  const variableDeclaration = t.variableDeclaration('var', [t.variableDeclarator(t.identifier(id), t.identifier(globalName))])
                  path.insertBefore(variableDeclaration)
                  path.replaceWith(t.exportDefaultDeclaration(t.identifier(id)))
                }
                break
              case 'ExportNamedDeclaration':
                if (dependencyWithAlias[path.node.source?.value] || !path.node.declaration) {
                  overWriteExportNamedDeclaration(path as NodePath<t.ExportNamedDeclaration>)
                }
                break
              case 'ExportAllDeclaration':
                if (dependencyWithAlias[path.node.source.value]) {
                  overWriteExportAllDeclaration(path as NodePath<t.ExportAllDeclaration>)
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
            eraseDuplicatedVariableDeclaration(path.get('declarations'), declarations)
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
      }
    }
  }
}

export async function transformWithBabel(code: string, options: TransformWithBabelOptions) {
  const result = await babelTransform(code,
    { babelrc: false,
      configFile: false,
      sourceMaps: true,
      plugins: [[externalGlobals(options)]]
    })
  return {
    code: result.code,
    map: result.map
  }
}

export async function tryScanGlobalName(code: string) {
  const ast = await babelParse(code, { babelrc: false, configFile: false })
  const { body } = ast.program
  if (!len(body)) return
  const node = body[0]
  // iife only return the first 
  // @ts-ignore
  if (t.isVariableDeclaration(node)) {
    const identifier = node.declarations[0].id
    if (t.isIdentifier(identifier)) return identifier.name
  }
  const bucket = new Set<string>()
  let globalName = ''
  // umd
  // @ts-ignore
  traverse(ast, {
    ExpressionStatement: (path) => {
      if (t.isCallExpression(path.node.expression)) {
        if (t.isFunctionExpression(path.node.expression.callee)) {
          const params = path.node.expression.callee.params
          if (len(params)) {
            params.forEach((i) => {
              if (i.type === 'Identifier') {
                bucket.add(i.name)
              }
            })
          }
        }
      }
    },
    AssignmentExpression: (path) => {
      const op = path.get('left')
      if (
        op.node.type === 'MemberExpression' &&
        (path.parent.type === 'CallExpression' || path.parent.type === 'ConditionalExpression' || path.parent.type === 'ExpressionStatement')
      ) {
        if (!globalName) {
          if (t.isIdentifier(op.node.object) && !bucket.has(op.node.object.name)) return
          if (!t.isIdentifier(op.node.property)) return
          if (op.node.property.name === 'exports') return
          globalName = op.node.property.name
        }
      }
      path.skip()
    }
  })
  return globalName
}
