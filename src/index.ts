import { createScanner } from './scanner'
import { hasOwn, isSupportThreads } from './shared'
import type { Plugin } from 'vite'
import type { CDNPluginOptions } from './interface'

// const VITE_INTERNAL_MODULE = 'vite/'

function cdn(opts: CDNPluginOptions = {}): Plugin {
  const { modules = [], mode = 'auto' } = opts
  // let shouldTransform = false
  // let checked = false

  // if (hasOwn(opts as Required<CDNPluginOptions>, 'isProduction')) {
  //   shouldTransform = Boolean(opts.isProduction)
  //   checked = true
  // }

  // const scanner = createScanner(modules)

  return {
    name: 'vite-plugin-cdn',
    enforce: 'post',
    apply: 'build',
    async buildStart() {
      try {
        const [isSupport, version] = isSupportThreads()
        if (!isSupport) throw new Error(`vite-plugin-cdn can't work with ${version}.`)
        const scanner = createScanner(modules, mode)
        await scanner.scanAllDependencies()
      } catch (err) {
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        this.error(err)
      }
    }
    // configResolved(conf) {
    //   // I think we should declare the transform Option auto.
    //   // If use set isProduction as fasly. we will respect the conf
    //   if (conf.command === 'build' && !checked) {
    //     shouldTransform = true
    //     scanner.extraDependencies(conf)
    //   }
    // },
    // async transform(code, id) {
    //   // we don't handle virtual module ,entry and vite internal module
    //   if (!shouldTransform || id[0] === '\0' || id.endsWith('html') || id.startsWith(VITE_INTERNAL_MODULE)) return
    //   return scanner.scanAllDependencies(id, code)
    // }
  }
}

export { cdn }

export default cdn

export type { Transformed, PresetDomain, TrackModule } from './interface'
