import { tryRequireModule } from './shared'

import type { Plugin, UserConfig } from 'vite'
import type { TrackModule, CDNPluginOptions, PresetDomain } from './interface'

const PRESET_CDN_DOMAIN = {
  JSDELIVR: 'https://cdn.jsdelivr.net/npm/',
  UNPKG: 'https://unpkg.com/'
}

const parserModuleImpl = (modules: TrackModule[], preset: PresetDomain) => {
  const collection: string[] = []
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
        collection.push(name)
        return
      }
      finder.set(name, { name, global, spare })
      return
    }

    switch (preset) {
      case 'auto':
        // in auto mode. jsdelivr is first then use unpkg.
        if (!jsdelivr && !unpkg) return

        finder.set(name, { name, global, spare: `` })
        break
      case 'unpkg':
      case 'jsdelivr':
        break
      default:
        throw Error(`[vite-plugin-cdn2]: Invalid preset ${preset}`)
    }
  })
  return { finder, collection }
}

export const cdn = (options: CDNPluginOptions): Plugin => {
  const { modules = [], isProduction = false, preset = 'auto' } = options
  const { finder, collection } = parserModuleImpl(modules, preset)
  return {
    name: 'vite-plugin-cdn',
    enforce: 'post',
    config(userConfig: UserConfig) {
      //
    },
    transform() {
      //
    },
    transformIndexHtml(raw: string) {
      if (!isProduction) return
      if (collection.length) {
        //  print un replace
      }
    }
  }
}
