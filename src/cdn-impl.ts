import { tryRequireModule } from './shared'

import type { Plugin, UserConfig, BuildOptions } from 'vite'
import type { TrackModule, CDNPluginOptions, PresetDomain } from './interface'

// Because vite don't expose rollupOptions declare. So we need to do this.
type RollupOptions = Exclude<BuildOptions['rollupOptions'], undefined>

const PRESET_CDN_DOMAIN = {
  jsdelivr: 'https://cdn.jsdelivr.net/npm/',
  unpkg: 'https://unpkg.com/'
}

export const parserModuleImpl = (modules: TrackModule[], preset: PresetDomain) => {
  const bucket: string[] = []
  const finder: Map<string, Required<TrackModule>> = new Map()
  modules.forEach((module, i) => {
    const { name, global, spare } = module
    if (!name || !global) {
      if (!name) throw Error(`[vite-plugin-cdn2]: Please pass the name for modules at postion ${i}. `)
      throw Error(`[vite-plugin-cdn2]: Please pass the global for modules at postion ${i}. `)
    }
    const { version, unpkg, jsdelivr } = tryRequireModule<{ version: string; unpkg?: string; jsdelivr?: string }>(
      `${name}/package.json`
    )

    if (typeof preset === 'boolean' && !preset) {
      if (!spare) {
        bucket.push(name)
        return
      }
      finder.set(name, { name, global, spare })
      return
    }

    const ensureCDN = (type: Exclude<PresetDomain, false>) => {
      if (type === 'auto') {
        return `${jsdelivr ? PRESET_CDN_DOMAIN.jsdelivr : PRESET_CDN_DOMAIN.unpkg}${name}@${version}/${
          jsdelivr ? jsdelivr : unpkg
        }`
      }
      return `${PRESET_CDN_DOMAIN[type]}${name}@${version}/${type === 'jsdelivr' ? jsdelivr : unpkg}`
    }

    switch (preset) {
      case 'auto':
      case 'unpkg':
      case 'jsdelivr':
        if (!jsdelivr && !unpkg) return bucket.push(name)
        finder.set(name, { name, global, spare: ensureCDN(preset) })
        break
      default:
        throw Error(`[vite-plugin-cdn2]: Invalid preset ${preset}`)
    }
  })
  return { finder, bucket }
}

export const cdn = (options: CDNPluginOptions): Plugin => {
  const { modules = [], isProduction = false, preset = 'auto', logInfo = 'info' } = options
  const { finder, bucket } = parserModuleImpl(modules, preset)

  if (bucket.length && logInfo === 'info') {
    bucket.forEach((b) => {
      console.log(`[vite-plugin-cdn2]: can't found unpkg or jsdelivr filed from ${b}. Please enter manually.`)
    })
  }

  return {
    name: 'vite-plugin-cdn',
    enforce: 'post',
    config(userConfig: UserConfig) {
      const names: Array<string | RegExp> = [...finder.keys()]
      if (names.length) {
        const prev = userConfig.build?.rollupOptions?.external || []
        const rollupOptions: RollupOptions = {}
        if (typeof prev === 'function') {
          // expose a tips
        } else {
          if (Array.isArray(prev)) {
            rollupOptions.external = [...prev, ...names]
          } else {
            rollupOptions.external = names.concat(prev)
          }
        }

        if (userConfig.build) {
          Object.assign(userConfig.build, { rollupOptions })
        } else {
          userConfig.build = { rollupOptions }
        }

        return userConfig
      }
    },
    transformIndexHtml(raw: string) {
      if (!isProduction) return
      if (options.transform) {
        const { transform } = options
      }
    }
  }
}
