declare module 'vite' {
  type TransformPluginContext = import('rollup').TransformPluginContext
}

interface Loc {
  start: number
  end: number
}

declare module 'estree' {
  // eslint-disable-next-line @typescript-eslint/no-empty-interface
  interface Identifier extends Loc {}
  // eslint-disable-next-line @typescript-eslint/no-empty-interface
  interface ExportNamedDeclaration extends Loc {}
  // eslint-disable-next-line @typescript-eslint/no-empty-interface
  interface ExportAllDeclaration extends Loc {}
  // eslint-disable-next-line @typescript-eslint/no-empty-interface
  interface ImportDeclaration extends Loc {}
  // eslint-disable-next-line @typescript-eslint/no-empty-interface
  interface FunctionDeclaration extends Loc {}
  // eslint-disable-next-line @typescript-eslint/no-empty-interface
  interface VariableDeclaration extends Loc {}
  // eslint-disable-next-line @typescript-eslint/no-empty-interface
  interface ClassDeclaration extends Loc {}
}

export {}
