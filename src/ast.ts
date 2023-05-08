// refer https://astexplorer.net/
import MagicString from 'magic-string'
import { attachScopes } from '@rollup/pluginutils'
import { parse as esModuleLexer } from 'rs-module-lexer'
import { len } from './shared'
import type { TransformPluginContext } from 'vite'
import type { IIFEModuleInfo } from './interface'

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
    const ast = rollupTransformPluginContext.parse(code)
    // attachScopes(ast, 'scope')
    const magicStr = new MagicString(code)
    return { code: magicStr.toString(), map: magicStr.generateMap() }
  }
}

export function createTransform() {
  return new Transform()
}
