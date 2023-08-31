import { createFilter } from '@rollup/pluginutils'
import type { Plugin } from 'vite'
import _debug from 'debug'
import { createScanner } from './scanner'
import { createInjectScript } from './inject'
import {  createCodeGenerator } from './code-gen'
import { isSupportThreads, transformCJSRequire  } from './shared'
import { jsdelivr } from './url'
import type { CodeGen } from './code-gen'
import type { CDNPluginOptions } from './interface'

const debug = _debug('vite-plugin-cdn2')

interface PresetModuleApi {
  installCodeGen: (codeGen: CodeGen)=> void
  injectFilter: (fn: (id: unknown)=> boolean)=> void
}

function transformPresetModule(apply: 'serve' | 'build'): Plugin {
  // Inspired by vite-plugin-external
  const nodeModules = 'node_modules'
  let generator: CodeGen = null
  let filter: (id: unknown)=> boolean = undefined
  return {
    name: 'vite-plugin-cdn2:presetModule',
    apply,
    transform(code, id) {
      if (!filter(id)) return
      if (!id.includes(nodeModules)) return
      // coomonjs
      code = transformCJSRequire(code, generator.dependencies)
      // esm
      if (generator.filter(code, id)) return generator.transform(code)
      return { code }
    },
    api: {
      installCodeGen: (codeGen: CodeGen) => generator = codeGen,
      injectFilter: (fn) => filter = fn
    }
  }
} 

function cdn(opts: CDNPluginOptions = {}): Plugin[] {
  const { modules = [], url = jsdelivr, include = /\.(mjs|js|ts|vue|jsx|tsx)(\?.*|)$/, exclude, logLevel = 'warn', resolve: resolver, apply = 'build' } = opts
  const filter = createFilter(include, exclude)
  const scanner = createScanner(modules)
  const generator = createCodeGenerator()
  const transformPlugin  = (apply:  'serve' | 'build'): Plugin => {
    return {
      name: 'vite-plugin-cdn2:transform',
      enforce: 'post',
      apply,
      async configResolved(config) {
        const [isSupport, version] = isSupportThreads()
        try {
          if (!isSupport) throw new Error(`vite-plugin-cdn2 can't work with nodejs ${version}.`)
          debug('start scanning')
          scanner.scanAllDependencies()
          debug('scanning done', scanner.dependencies)
          generator.injectDependencies(scanner.dependencies)
          const plugin = config.plugins.find(p => p.name === 'vite-plugin-cdn2:presetModule')
          if (plugin) {
            const presetModuleApi = plugin.api as PresetModuleApi
            presetModuleApi.injectFilter(filter)
            presetModuleApi.installCodeGen(generator)
          }
          if (logLevel === 'warn') {
            scanner.failedModules.forEach((errorMessage, name) => config.logger.error(`vite-plugin-cdn2: ${name} ${errorMessage ? errorMessage : 'resolved failed.Please check it.'}`))
          }
          // work for serve mode
          // https://vitejs.dev/config/dep-optimization-options.html
          if (apply === 'serve') {
            const exclude = config.optimizeDeps?.exclude || []
            config.optimizeDeps.exclude = [...exclude, ...scanner.dependencies.keys()]
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
        const inject = createInjectScript(scanner.dependencies, url, resolver)
        inject.calledHook(opts.transform)
        return {
          html,
          tags: inject.toTags()
        }
      }
    }
  } 
  return [transformPlugin(apply), transformPresetModule(apply)]
}

export { cdn }
export default cdn

export type { InjectVisitor, TrackModule, CDNPluginOptions } from './interface'
