// import perfHooks from 'node/perf_hooks'
import MagicString from 'magic-string'
import { parse } from 'rs-module-lexer'
import { hasOwn, len } from './shared'
import type { ImportSpecifier, ExportSpecifier } from 'rs-module-lexer'
import type { ResolvedConfig } from 'vite'

import type { TrackModule } from './interface'

class Lexer {
  code: string
  pos: number
  char: string
  constructor(code: string) {
    this.code = code
    this.pos = 0
    this.char = this.code[this.pos]
  }
  step() {
    //
  }
  eat() {
    //
  }
  next() {
    //
  }
}

function createLexer(code: string) {
  return new Lexer(code)
}

function captureModule(code: string, s: number, e: number) {
  const raw = code.substring(s, e)
  const lexer = createLexer(raw)
  // lexer.next()
}

function handleDependencies(
  imports: ImportSpecifier[],
  exports: ExportSpecifier[],
  dependencies: Record<string, string>,
  code: string
) {
  if (!len(imports) && !len(exports)) return code
  const magic = new MagicString(code)
  // const importerLast = imports.
  imports.forEach((importer) => {
    // console.log(importer)
    // console.log(code.substring(importer.ss + 6, importer.se))
    if (importer.n && hasOwn(dependencies, importer.n)) {
      const moduleGlobalName = dependencies[importer.n]
      captureModule(code, importer.ss, importer.se)
      magic.remove(importer.ss + 6, importer.se)
    }
  })
  console.log(magic.toString())
}

export class Scanner {
  modules: Array<TrackModule>
  private _dependencies: Array<string>
  private _dependenciesGraph: Record<string, string>
  constructor(modules: Array<TrackModule> = []) {
    this.modules = modules
    this._dependencies = []
    this._dependenciesGraph = Object.create(null)
  }
  // scan all dependencies is implement for find file import & export module
  // if don't exist we will pass.
  scanAllDependencies(filename: string, code: string) {
    const { output } = parse({
      input: [{ filename, code }]
    })
    // eslint-disable-next-line prefer-destructuring
    const { imports, exports } = output[0]
    return handleDependencies(imports, exports, this.dependenciesGraph, code)
  }
  extraDependencies(viteConf: ResolvedConfig) {
    viteConf.build.rollupOptions = {
      ...viteConf.build.rollupOptions,
      external: this.dependencies
    }
  }

  get dependencies() {
    if (!this._dependencies.length) {
      this._dependencies = this.modules.map((v) => v.name)
    }
    return this._dependencies
  }
  get dependenciesGraph() {
    if (!this._dependencies.length) {
      this._dependenciesGraph = this.modules.reduce((acc, { name, global }) => ({ ...acc, [name]: global }), {})
    }
    return this._dependenciesGraph
  }
}

export function createScanner(modules: Array<TrackModule>) {
  return new Scanner(modules)
}
