import { createFilter } from '@rollup/pluginutils'
import { createScanner } from './scanner'
import { createInjectScript } from './inject'
import { createCodeGenerator } from './code-gen'
import { isSupportThreads  } from './shared'
import { jsdelivr } from './url'
import type { Plugin } from 'vite'
import type { CDNPluginOptions } from './interface'

function cdn(opts: CDNPluginOptions = {}): Plugin {
  const { modules = [], url = jsdelivr, include = /\.(mjs|js|ts|vue|jsx|tsx)(\?.*|)$/, exclude, logLevel = 'warn' } = opts
  const filter = createFilter(include, exclude)
  const scanner = createScanner(modules)
  const generator = createCodeGenerator()
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
          scanner.failedModules.forEach((errorMessage, name) => config.logger.error(`vite-plugin-cdn2: ${name} ${errorMessage ? errorMessage : 'resolved failed.Please check it.'}`))
        }
      } catch (error) {
        config.logger.error(error)
      }
    },
    async transform(code, id) {
      if (!filter(id)) return
      if (!generator.filter(code, id)) return
      return generator.transform(code)
    },
    transformIndexHtml(html) {
      const inject = createInjectScript(scanner.dependencies, url)
      return inject.text(html, opts.transform)
    }
  }
}

export { cdn }
export default cdn

export type { InjectVisitor, TrackModule, CDNPluginOptions } from './interface'
