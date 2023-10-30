import type { Options } from 'tsup'

export const tsup: Options = {
  entry: ['src/index.ts', 'src/url.ts', 'src/scanner.ts'],
  dts: true,
  format: ['cjs', 'esm'],
  clean: true,
  shims: true,
  minify: true,
  noExternal: ['@nolyfill/es-aggregate-error']
}
