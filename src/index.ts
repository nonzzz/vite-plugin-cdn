import { createScanner } from './scanner'
import { hasOwn, isSupportThreads } from './shared'
import type { Plugin } from 'vite'
import type { CDNPluginOptions } from './interface'

// const VITE_INTERNAL_MODULE = 'vite/'

function cdn(opts: CDNPluginOptions = {}): Plugin {
  const { modules = [], mode = 'auto' } = opts
  return {
    name: 'vite-plugin-cdn',
    enforce: 'post',
    apply: 'build',
    async buildStart() {
      try {
        const [isSupport, version] = isSupportThreads()
        if (!isSupport) throw new Error(`vite-plugin-cdn2 can't work with ${version}.`)
        const scanner = createScanner(modules, mode)
        await scanner.scanAllDependencies()
      } catch (err) {
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        this.error(err)
      }
    }
  }
}

export { cdn }

export default cdn

export type { Transformed, PresetDomain, TrackModule } from './interface'
