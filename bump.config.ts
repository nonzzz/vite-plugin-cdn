import { define } from 'no-bump'

export default define({
  input: 'src/index.ts',
  output: {
    sourceMap: false,
    dts: true,
    extractHelpers: false
  },
  clean: true
})
