const { watch, build } = require('no-bump')

const main = () => {
  const argvs = process.argv.slice(2)
  const dev = argvs.length ? argvs.includes('dev') : true
  /**
   * @type {Exclude<Parameters<typeof build>[number],undefined>}
   */
  const conf = {
    input: 'src/index.ts',
    output: {
      sourceMap: false,
      dts: !dev,
      extractHelpers: false
    },
    clean: !dev
  }

  if (!dev) {
    return build(conf)
  }
  watch(conf)
}

if (require.main === module) {
  main()
}
