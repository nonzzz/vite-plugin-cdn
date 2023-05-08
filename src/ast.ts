// refer https://astexplorer.net/
import MagicString from 'magic-string'
import { attachScopes } from '@rollup/pluginutils'
import { parse as esModuleLexer } from 'rs-module-lexer'
import { len } from './shared'
import type { Node } from 'estree-walker'
import type { TransformPluginContext } from 'vite'
import type { AcornNode } from './interface'

const IMPORT_DECLARATION = 'ImportDeclaration'
const EXPORT_NAMED_DECLARATION = 'ExportNamedDeclaration'
const EXPORT_ALL_DECLARATION = 'ExportAllDeclaration'

type AnalyzeType = typeof IMPORT_DECLARATION | typeof EXPORT_ALL_DECLARATION | typeof EXPORT_NAMED_DECLARATION

function scanForImportsAndExports(node: AcornNode & { type: AnalyzeType }, magicStr: MagicString) {
  switch (node.type) {
    case 'ImportDeclaration':
    case 'ExportAllDeclaration':
    case 'ExportNamedDeclaration':
      magicStr.remove(node.start, node.end)
  }
}

// Why not using rollup-plugin-external-globals
// It can't resolve many edge case for application.

// rs-module-lexer only prcoess js file.

// Transform is a collection of static methods
export class Transform {
  private dependencies: Record<string, string[]>
  private walker: typeof import('estree-walker').walk
  constructor() {
    this.dependencies = {}
  }
  async injectDependencies(dependencies: Record<string, string[]>) {
    this.dependencies = dependencies
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
  replace(code: string, rollupTransformPluginContext: TransformPluginContext) {
    const ast = rollupTransformPluginContext.parse(code) as AcornNode
    const scoped = attachScopes(ast, 'scope')
    const magicStr = new MagicString(code)
    const document = ast.body as AcornNode[]
    for (const node of document) {
      scanForImportsAndExports(node as AcornNode & { type: AnalyzeType }, magicStr)
    }
    // we get all dependencies grpah in scanner stage.
    this.walker(ast as Node, {
      enter(node) {
        console.log(node)
      }
    })
    return { code: magicStr.toString(), map: magicStr.generateMap() }
  }
}

export function createTransform() {
  return new Transform()
}
