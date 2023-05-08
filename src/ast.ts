// refer https://astexplorer.net/
import { parse as esModuleLexer } from 'rs-module-lexer'
import type { IIFEModuleInfo } from './interface'

// Transform is a collection of static methods
export class Transform {
  private dependencies: Record<string, IIFEModuleInfo>
  constructor() {
    this.dependencies = {}
  }
  injectDependencies(dependencies: Record<string, IIFEModuleInfo>) {
    this.dependencies = dependencies
  }
  filter(code: string) {
    return true
  }
}

export function createTransform() {
  return new Transform()
}
