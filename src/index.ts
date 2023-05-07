import { createScanner } from './scanner'
import { createInjectScript } from './inject'
import { isSupportThreads } from './shared'
import type { Plugin, ResolvedBuildOptions } from 'vite'
import type { CDNPluginOptions } from './interface'

function cdn(opts: CDNPluginOptions = {}): Plugin {
  const { modules = [], mode = 'auto' } = opts
  const scanner = createScanner(modules)
  return {
    name: 'vite-plugin-cdn',
    enforce: 'post',
    apply: 'build',
    async buildStart() {
      try {
        const [isSupport, version] = isSupportThreads()
        if (!isSupport) throw new Error(`vite-plugin-cdn2 can't work with nodejs ${version}.`)
        await scanner.scanAllDependencies()
      } catch (err) {
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        this.error(err)
      }
    },
    configResolved(config) {
      // When we extra module we should set it as external
      if (!config.build.rollupOptions) {
        config.build.rollupOptions = {}
      }
      if (!('external' in config.build.rollupOptions)) {
        config.build.rollupOptions.external = []
      }
      const { external } = config.build.rollupOptions as Required<ResolvedBuildOptions['rollupOptions']>
      if (typeof external === 'function') {
        config.logger.warnOnce(`'rollupOptions.external' is a function. It's may casue not work as expected.`)
        config.build.rollupOptions.external = [...scanner.dependModuleNames]
        return
      }
      if (Array.isArray(external)) {
        external.push(...scanner.dependModuleNames)
        return
      }
      config.build.rollupOptions.external = [...scanner.dependModuleNames, external]
    },
    async transform(code, id) {
      //
    },
    transformIndexHtml(html) {
      const inject = createInjectScript(scanner.dependencies, scanner.dependModuleNames, mode)
      return inject.inject(html, opts.transform)
    }
  }
}

export { cdn }

export default cdn

export type { InjectVisitor, PresetDomain, TrackModule } from './interface'
