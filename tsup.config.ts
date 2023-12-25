import type { Options } from 'tsup'

export const tsup: Options = {
  entry: ['src/index.ts', 'src/resolve.ts', 'src/scanner.ts', 'src/resolver/*.ts'],
  dts: true,
  format: ['cjs', 'esm'],
  clean: true,
  shims: true,
  minify: true,
  noExternal: ['@nolyfill/es-aggregate-error']
}
