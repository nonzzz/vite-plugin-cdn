import { createFilter } from '@rollup/pluginutils'
import type { Plugin } from 'vite'
import _debug from 'debug'
import { createScanner, getPackageExports, serializationExportsFields } from './scanner'
import { createInjectScript } from './inject'
import { isSupportThreads, len, transformCJSRequire } from './shared'
import { jsdelivr } from './url'
import type { CDNPluginOptions, ExternalPluginOptions, ModuleInfo } from './interface'
import { transformWithBabel } from './transform'

const debug = _debug('vite-plugin-cdn2')

// rs-module-lexer can't cover all platforms.
// But it provide a wasm bindings. So we provide
// a wrapper func to cover most of scence.
// WASM support at least node15

async function createRsModuleLexer() {
  try {
    const { parse } = (await import('rs-module-lexer')).default
    return parse
  } catch (error) {
    const { parse } = await import('@xn-sakina/rml-wasm').catch(() => {
      throw new Error('rs-module-lexer can\'t work on you current machine.')
    })
    return parse
  }
}

function createDependency() {
  const dependency: Record<string, ModuleInfo> = {}

  const filter = (code: string, id: string, dependencyWithAlias: Record<string, string>, lex: Awaited<ReturnType<typeof createRsModuleLexer>>) => {
    const { output } = lex({ input: [{ filename: id, code }] })
    if (!len(output)) return false
    const { imports } = output[0]
    const modules = Array.from(new Set([...imports.map(i => i.n)]))
    for (const m of modules) {
      if (dependencyWithAlias[m]) return true
      continue
    }
    return false
  }

  return {
    dependency,
    lex: null,
    get dependencyWithAlias() {
      const traverse = (aliases: string[], name: string) => aliases.reduce((acc, cur) => ({ ...acc, [cur]: name }), {})
      return Object.values(this.dependency).reduce((acc, cur) => {
        if (cur.aliases) acc = { ...acc, ...traverse(cur.aliases, cur.name) }
        return { ...acc, [cur.name]: cur.name }
      }, {})
    },
    filter: function (code: string, id: string) {
      return filter(code, id, this.dependencyWithAlias, this.lex)
    }
  }
}

interface ExternalPluginAPI {
  filter: (id: unknown) => boolean
  dependency: ReturnType<typeof createDependency>
}

function transformPresetModule(api: ExternalPluginAPI): Plugin {
  // Inspired by vite-plugin-external
  const nodeModules = 'node_modules'
  const { dependency } = api
  return {
    name: 'vite-plugin-cdn2:presetModule',
    transform(code, id) {
      if (!api.filter(id)) return
      if (!id.includes(nodeModules)) return
      // coomonjs
      code = transformCJSRequire(code, api.dependency.dependency)
      // esm
      if (dependency.filter(code, id)) {
        return transformWithBabel(code, dependency) 
      }
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
          const esModuleLexer = await createRsModuleLexer()
          api.dependency.lex = esModuleLexer
          console.log(api.dependency, esModuleLexer)
          const defaultWd = config.root
          scanner.setDefaultWd(defaultWd)
          debug('start scanning')
          scanner.scanAllDependencies()
          debug('scanning done', scanner.dependencies)
          api.dependency.dependency = Object.fromEntries(scanner.dependencies)
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
  const dependency = createDependency()

  return {
    name: 'vite-plugin-external',
    async buildStart() {
      try {
        const esModuleLexer = await createRsModuleLexer()
        dependency.lex = esModuleLexer
        debug('start check modules')
        for (const module of modules) {
          if (!module.global) throw new Error(`vite-plugin-external: missing global for module ${module.name}`)
        }
        debug('check done')
        const defaultWd = process.cwd()
        const dependencies = await Promise.all(modules.map(async (module) => {
          const exports = await getPackageExports(module, defaultWd)
          return { bindings: exports, ...module, aliases: serializationExportsFields(module.name, module.aliases) }
        })) as ModuleInfo[]
        dependency.dependency = dependencies.reduce((deps, dep) => ({ ...deps, [dep.name]: dep }), {})
        debug('scanning done', dependency.dependency)
      } catch (error) {
        this.error(error)
      }
    },
    transform(code, id) {
      if (!filter(id)) return
      if (!dependency.filter(code, id)) return
      return transformWithBabel(code, dependency)
    },
    api: {
      filter,
      dependency
    }
  }
}

external.getExternalPluginAPI = (plugins: Plugin[]): ExternalPluginAPI | undefined => {
  return plugins.find(p => p.name === 'vite-plugin-external')?.api
}

export { cdn, external }

export default cdn

export type { InjectVisitor, TrackModule, CDNPluginOptions, ExternalPluginOptions, ExternalModule } from './interface'
