import { createFilter } from '@rollup/pluginutils'
import { createScanner } from './scanner'
import { createInjectScript } from './inject'
import { createGenerator } from './generator'
import { isSupportThreads  } from './shared'
import type { Plugin } from 'vite'
import type { CDNPluginOptions } from './interface'

function cdn(opts: CDNPluginOptions = {}): Plugin {
  const { modules = [], mode = 'auto', include = /\.(mjs|js|ts|vue|jsx|tsx)(\?.*|)$/, exclude, logLevel = 'warn' } = opts
  const filter = createFilter(include, exclude)
  const scanner = createScanner(modules)
  const generator = createGenerator()
  return {
    name: 'vite-plugin-cdn',
    enforce: 'post',
    apply: 'build',
    async configResolved(config) {
      const [isSupport, version] = isSupportThreads()
      try {
        if (!isSupport) throw new Error(`vite-plugin-cdn2 can't work with nodejs ${version}.`)
        await scanner.scanAllDependencies()
        generator.injectDependencies(scanner.dependencies)
        if (logLevel === 'warn') {
          scanner.failedModuleNames.forEach((name) => config.logger.error(`vite-plugin-cdn2: ${name} resolved failed.Please check it.`))
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } catch (error: any) {
        config.logger.error(error)
      }
    },
    async transform(code, id) {
      if (!filter(id)) return
      if (!generator.filter(code, id)) return
      return generator.overwrite(code, this)
    },
    transformIndexHtml(html) {
      const inject = createInjectScript(scanner.dependencies, scanner.dependModuleNames, mode)
      return inject.inject(html, opts.transform)
    }
  }
}

export { cdn }
export default cdn

export type { InjectVisitor, PresetDomain, TrackModule, CDNPluginOptions } from './interface'
