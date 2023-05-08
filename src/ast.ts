// refer https://astexplorer.net/
import MagicString from 'magic-string'
import { attachScopes } from '@rollup/pluginutils'
import { parse as esModuleLexer } from 'rs-module-lexer'
import { len } from './shared'
import type { TransformPluginContext } from 'vite'
import type { AcornNode, IIFEModuleInfo } from './interface'

const IMPORT_DECLARATION = 'ImportDeclaration'
const EXPORT_NAMED_DECLARATION = 'ExportNamedDeclaration'
const EXPORT_ALL_DECLARATION = 'ExportAllDeclaration'

type AnalyzeType = typeof IMPORT_DECLARATION | typeof EXPORT_ALL_DECLARATION | typeof EXPORT_NAMED_DECLARATION

function scanForImportsAndExports(node: AcornNode & { type: AnalyzeType }, magicStr: MagicString) {
  switch (node.type) {
    case 'ImportDeclaration':
    case 'ExportAllDeclaration':
    case 'ExportNamedDeclaration':
  }
  magicStr.remove(node.start, node.end)
}

// Why not using rollup-plugin-external-globals
// It can't resolve many edge case for application.

// rs-module-lexer only prcoess js file.

// Transform is a collection of static methods
export class Transform {
  private dependencies: Record<string, IIFEModuleInfo>
  constructor() {
    this.dependencies = {}
  }
  injectDependencies(dependencies: Record<string, IIFEModuleInfo>) {
    this.dependencies = dependencies
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
    console.log(ast)
    console.log(scoped)
    const magicStr = new MagicString(code)
    this.analyze(ast, 'ImportDeclaration', magicStr)
    this.analyze(ast, 'ExportNamedDeclaration', magicStr)
    this.analyze(ast, 'ExportAllDeclaration', magicStr)
    return { code: magicStr.toString(), map: magicStr.generateMap() }
  }
  /**
   * 
   * @param ast Node {
  type: 'Program',
  start: 0,
  end: 134,
  body: [
    Node {
      type: 'ImportDeclaration',
      start: 0,
      end: 31,
      specifiers: [Array],
      source: [Node]
    },
    Node {
      type: 'VariableDeclaration',
      start: 35,
      end: 77,
      declarations: [Array],
      kind: 'const'
    },
    Node {
      type: 'ExpressionStatement',
      start: 81,
      end: 98,
      expression: [Node]
    },
    Node {
      type: 'ExportNamedDeclaration',
      start: 102,
      end: 134,
      declaration: [Node],
      specifiers: [],
      source: null
    }
  ],
  sourceType: 'module'
}
   */
  // step
  // 1: handle Import Or Export
  // 2: Record mdoule ref (But we has already run scanner It can get all of dep?)
  //
  private analyze(ast: AcornNode, type: AnalyzeType, magicStr: MagicString) {
    const document = ast.body as AcornNode[]
    for (const node of document) {
      if (node.type === type) {
        scanForImportsAndExports(node as AcornNode & { type: AnalyzeType }, magicStr)
      }
    }
  }
}

export function createTransform() {
  return new Transform()
}
