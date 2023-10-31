import { transform as babelTransform, types as t } from '@babel/core'
import type { PluginTarget, Visitor } from '@babel/core'
import type { ModuleInfo } from './interface'

export interface TransformWithBabelOptions {
  dependency: Record<string, ModuleInfo>
  dependencyWithAlias: Record<string, string>
}

function isTopLevelCalled(p: NodePath) {
  return t.isProgram(p.parent) || t.isExportDefaultDeclaration(p.parent) || t.isExportNamedDeclaration(p.parent)
}

function externalGlobals(options: TransformWithBabelOptions): PluginTarget {
  return function ({ types: t }: { types: typeof t }): Visitor {
    return {
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
    }
  }
}

export async function transformWithBabel(code: string, options: any) {
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
