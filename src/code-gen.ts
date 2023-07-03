import { parse as esModuleLexer } from 'rs-module-lexer'
import { parse as babelParse, traverse, transformFromAstAsync } from '@babel/core'
import { len } from './shared'
import type { IIFEModuleInfo } from './interface'

export class CodeGen {
  private dependencies:Map<string, IIFEModuleInfo>
  injectDependencies(dependencies:Map<string, IIFEModuleInfo>) {
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

  async transform(code:string) {
    const ast = await babelParse(code)
    traverse(ast, {
      enter(path, state) {
        // 
      },
      exit(path, state) {
        // 
      }
    })
    const result = await transformFromAstAsync(ast)
    return {
      code: result.code,
      map: result.map
    }
  }
}


export function createCodeGenerator() {
  return new CodeGen() 
}

