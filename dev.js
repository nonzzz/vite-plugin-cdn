const { watch } = require('no-bump')

watch({
  input: 'src/index.ts',
  output: {
    sourceMap: false,
    dts: true,
    extractHelpers: false
  }
})
