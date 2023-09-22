import type { Options } from 'tsup'


export const tsup: Options = {
  entry: ['src/index.ts', 'src/url.ts', 'src/scanner.ts'],
  dts: true,
  format: ['cjs', 'esm'],
  splitting: true,
  clean: true,
  shims: false,
  minify: true,
  noExternal: ['@nolyfill/es-aggregate-error'],
  esbuildOptions(options, { format }) {
    if (format === 'cjs') {
      options.define = {
        'import.meta.url': '__meta.url'
      }
    }
  },
  plugins: [{
    name: 'inject-meta',
    renderChunk(code) {
      if (/__meta.url/.test(code)) {
        return {
          code: `const __meta = /* @__PURE__ */{ url: require('url').pathToFileURL(__filename).href };\r\n${code}`
        }
      }
    }
  }]
}
