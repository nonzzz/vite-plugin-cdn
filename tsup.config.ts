import type { Options } from 'tsup'

export const tsup: Options = {
  entry: ['src/index.ts', 'src/url.ts', 'src/scanner.ts'],
  dts: true,
  format: ['cjs', 'esm'],
  splitting: true,
  clean: true,
  shims: false,
  esbuildOptions(options, { format }) {
    if (format === 'cjs') {
      options.define = {
        'import.meta.url': '__meta.url'
      }
      options.banner = {
        js: "const __meta = { url: require('url').pathToFileURL(__filename).href }"
      }
    }
  }
}
