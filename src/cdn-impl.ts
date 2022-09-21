import { tryRequireModule } from './shared'

import type { Plugin, UserConfig } from 'vite'
import type { TrackModule, CDNPluginOptions, PresetDomain } from './interface'

const PRESET_CDN_DOMAIN = {
  JSDELIVR: 'https://cdn.jsdelivr.net/npm/',
  UNPKG: 'https://unpkg.com/'
}

const parserModuleImpl = (modules: TrackModule[], perset: PresetDomain) => {
  const finder: Map<string, TrackModule> = new Map()

  return { finder }
}

export const cdn = (options: CDNPluginOptions): Plugin => {
  const { modules = [], isProduction = false, preset = 'auto' } = options

  const {} = parserModuleImpl(modules, preset)

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
    }
  }
}
