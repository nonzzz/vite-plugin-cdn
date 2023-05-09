import { define } from 'no-bump'
import cleanUp from 'rollup-plugin-cleanup'

export default define({
  input: 'src/index.ts',
  output: { dts: true, exports: 'named' },
  external: ['happy-dom', '@rollup/pluginutils', 'magic-string', 'rs-module-lexer'],
  plugins: [cleanUp({ extensions: ['.ts'] })]
})
