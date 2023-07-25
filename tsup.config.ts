import type { Options } from 'tsup'

export const tsup: Options = {
  entry: ['src/index.ts', 'src/url.ts', 'src/scanner.ts'],
  format: ['cjs', 'esm'],
  dts: true,
  splitting: true,
  clean: true,
  shims: false
}
