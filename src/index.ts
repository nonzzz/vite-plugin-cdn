import { createFilter } from '@rollup/pluginutils'
import { createScanner } from './scanner'
import { createInjectScript } from './inject'
import { createTransform } from './ast'
import { isSupportThreads } from './shared'
import type { Plugin, ResolvedBuildOptions } from 'vite'
import type { CDNPluginOptions } from './interface'

function cdn(opts: CDNPluginOptions = {}): Plugin {
  const { modules = [], mode = 'auto', include = /\.[jt]s$/, exclude } = opts
  const filter = createFilter(include, exclude)
  const scanner = createScanner(modules)
  const transform = createTransform()
  return {
    name: 'vite-plugin-cdn',
    enforce: 'post',
    apply: 'build',
    async configResolved(config) {
      const [isSupport, version] = isSupportThreads()
      try {
        if (!isSupport) throw new Error(`vite-plugin-cdn2 can't work with nodejs ${version}.`)
        await scanner.scanAllDependencies()
        transform.injectDependencies(scanner.dependencies)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } catch (error: any) {
        config.logger.error(error)
      }
      // When we extra module we should set it as external
      if (!config.build.rollupOptions) {
        config.build.rollupOptions = {}
      }
      if (!('external' in config.build.rollupOptions)) {
        config.build.rollupOptions.external = []
      }
      const { external } = config.build.rollupOptions as Required<ResolvedBuildOptions['rollupOptions']>
      if (typeof external === 'function') {
        config.logger.warnOnce(`'rollupOptions.external' is a function. It's may cause not work as expected.`)
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
      if (!filter(id)) return
      if (!transform.filter(code)) return
    }
    // transformIndexHtml(html) {
    //   const inject = createInjectScript(scanner.dependencies, scanner.dependModuleNames, mode)
    //   return inject.inject(html, opts.transform)
    // }
  }
}

export { cdn }

export default cdn

export type { InjectVisitor, PresetDomain, TrackModule } from './interface'
