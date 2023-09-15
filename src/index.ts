import { createFilter } from '@rollup/pluginutils'
import type { Plugin } from 'vite'
import _debug from 'debug'
import { createScanner, getPackageExports } from './scanner'
import { createInjectScript } from './inject'
import {  createCodeGenerator } from './code-gen'
import { isSupportThreads, transformCJSRequire  } from './shared'
import { jsdelivr } from './url'
import type { CodeGen } from './code-gen'
import type { CDNPluginOptions, ExternalPluginOptions, ModuleInfo } from './interface'

const debug = _debug('vite-plugin-cdn2')

interface ExternalPluginAPI {
  filter: (id: unknown)=> boolean
  generator: CodeGen
}


function transformPresetModule(api: ExternalPluginAPI): Plugin {
  // Inspired by vite-plugin-external
  const nodeModules = 'node_modules'
  return {
    name: 'vite-plugin-cdn2:presetModule',
    transform(code, id) {
      if (!api.filter(id)) return
      if (!id.includes(nodeModules)) return
      // coomonjs
      code = transformCJSRequire(code, api.generator.dependencies)
      // esm
      if (api.generator.filter(code, id)) return api.generator.transform(code)
      return { code }
    }
  }
} 

function cdn(opts: CDNPluginOptions = {}): Plugin[] {
  const { modules = [], url = jsdelivr, include = /\.(mjs|js|ts|vue|jsx|tsx)(\?.*|)$/, exclude, logLevel = 'warn', resolve: resolver, apply = 'build' } = opts
  const scanner = createScanner(modules)
  const { transform, api: _api } = external({ modules: [], include, exclude })
  const api = _api as ExternalPluginAPI
  const transformPlugin = (): Plugin => {
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
          api.generator.injectDependencies(scanner.dependencies)
          if (logLevel === 'warn') {
            scanner.failedModules.forEach((errorMessage, name) => config.logger.error(`vite-plugin-cdn2: ${name} ${errorMessage ? errorMessage : 'resolved failed.Please check it.'}`))
          }
          // work for serve mode
          // https://vitejs.dev/config/dep-optimization-options.html
          // include and exclude are mutually exclusive
          if (apply === 'serve') {
            const exclude = config.optimizeDeps?.exclude || []
            config.optimizeDeps.exclude = [...exclude, ...scanner.dependencies.keys()]
            const include = config.optimizeDeps?.include || []
            config.optimizeDeps.include = include.filter(dep => !config.optimizeDeps.exclude.includes(dep))
          }
        } catch (error) {
          config.logger.error(error)
        }
      },
      transform,
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
  return [{ ...transformPlugin(), apply }, { ...transformPresetModule(api), apply }]
}

function external(opts: ExternalPluginOptions = {}): Plugin {
  const debug = _debug('vite-plugin-external')
  const { modules = [], include, exclude } = opts
  const filter = createFilter(include, exclude)
  const generator = createCodeGenerator()

  return {
    name: 'vite-plugin-external',
    async buildStart() {
      try {
        debug('start check modules')
        for (const module of modules) {
          if (!module.global) throw new Error(`vite-plugin-external: missing global for module ${module.name}`)
        }
        debug('check done')
        const dependencies = await Promise.all(modules.map(async (module) => {
          const exports = await getPackageExports(module)
          return { bindings: exports, ...module }
        })) as ModuleInfo[]
        const deps = new Map(dependencies.map(dep => [dep.name, dep]))
        debug('scanning done', deps)
        generator.injectDependencies(deps)
      } catch (error) {
        this.error(error)
      }
    },
    async transform(code, id) {
      if (!filter(id)) return
      if (!generator.filter(code, id)) return
      return generator.transform(code)
    },
    api: {
      filter,
      generator
    }
  }
}

external.getExternalPluginAPI = (plugins: Plugin[]): ExternalPluginAPI | undefined => {
  return plugins.find(p => p.name === 'vite-plugin-external')?.api
}

export { cdn, external }

export default cdn

export type { InjectVisitor, TrackModule, CDNPluginOptions, ExternalPluginOptions } from './interface'
