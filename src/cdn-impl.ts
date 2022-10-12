import { Window } from 'happy-dom'
import MagicString from 'magic-string'
import { tryRequireModule, ERRORS, error } from './shared'
import type { Plugin } from 'vite'
import type { TrackModule, CDNPluginOptions, PresetDomain, AcornNode } from './interface'
import { translate } from './ast'
import { ParserModuleStruct } from './dom'

const PRESET_CDN_DOMAIN = {
  jsdelivr: 'https://cdn.jsdelivr.net/npm/',
  unpkg: 'https://unpkg.com/'
}

const parserModuleImpl = (modules: TrackModule[], preset: PresetDomain) => {
  const bucket: Array<
    | string
    | {
        name: string
        type: 'INVALID_PACKAGE' | 'NO_PRESET_FIELDS'
      }
  > = []
  const finder: Map<string, Required<TrackModule>> = new Map()
  modules.forEach((module, i) => {
    const { name, global, spare } = module
    if (!name || !global) {
      if (!name) throw Error(`[vite-plugin-cdn2]: Please pass the name for modules at postion ${i}. `)
      throw Error(`[vite-plugin-cdn2]: Please pass the global for modules at postion ${i}. `)
    }

    if (typeof preset === 'boolean' && !preset) {
      if (!spare) {
        bucket.push(name)
        return
      }
      finder.set(name, { name, global, spare })
      return
    }
    // In past. we always try to load the information from user node_modules. But if user pass an no exist package
    // it will block process and interrupt. So we should catch it in us internal logic. I think it's a right way.
    try {
      const { version, unpkg, jsdelivr } = tryRequireModule<{ version: string; unpkg?: string; jsdelivr?: string }>(
        `${name}/package.json`
      )

      const monitor = (type: Exclude<PresetDomain, false>) => {
        if (type === 'auto') {
          // In auto mode. jsdelivr is first.
          const real = jsdelivr ? jsdelivr : unpkg
          if (!real)
            error({
              code: ERRORS.NO_PRESET_FIELDS,
              message: ''
            })
          const type = jsdelivr ? 'jsdelivr' : 'unpkg'
          return `${PRESET_CDN_DOMAIN[type]}${name}@${version}/${real}`
        }
        const real = type === 'jsdelivr' ? jsdelivr : type === 'unpkg' ? unpkg : undefined
        if (!real)
          error({
            code: ERRORS.NO_PRESET_FIELDS,
            message: ''
          })
        return `${PRESET_CDN_DOMAIN[type]}${name}@${version}/${real}`
      }

      /**
       * In some package that not provide the jsdelivr and unpkg filed. So that we'll got undefined.
       * So for DX. we should check it if user pass spare option. we will concat them. If not, we will
       * push to bucket.
       */
      switch (preset) {
        case 'auto':
        case 'unpkg':
        case 'jsdelivr':
          const track = { name, global, spare: [monitor(preset)] }
          if (spare?.length) {
            const latestSpare = Array.isArray(spare) ? spare : [spare]
            track.spare.push(...latestSpare)
          }
          finder.set(name, track)
          break
        default:
          error({
            code: ERRORS.INVALID_PRESET,
            message: `[vite-plugin-cdn2]: Invalid preset ${preset}`
          })
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      // https://www.typescriptlang.org/tsconfig#useUnknownInCatchVariables
      if (err.code) {
        if (err.code === ERRORS.INVALID_PRESET) return error(err)
        if (err.code === ERRORS.NO_PRESET_FIELDS) {
          if (!spare?.length) {
            bucket.push({
              name,
              type: 'NO_PRESET_FIELDS'
            })
          } else {
            const latestSpare = Array.isArray(spare) ? spare : [spare]
            const latestTrack = finder.get(name)
            if (!latestTrack) {
              const track = { name, global, spare: latestSpare }
              finder.set(name, track)
              return
            }
          }
          return
        }
      }
      bucket.push({
        name,
        type: 'INVALID_PACKAGE'
      })
    }
  })
  return { finder, bucket }
}

export const cdn = (options: CDNPluginOptions = {}): Plugin => {
  const { modules = [], isProduction = false, preset = 'auto', logInfo = 'info' } = options

  const { finder, bucket } = parserModuleImpl(modules, preset)
  if (bucket.length && logInfo === 'info') {
    bucket.forEach((b) => {
      // If disabled the preset conf.
      if (typeof b === 'string') {
        console.warn(`[vite-plugin-cdn2]: please enter manually for ${b}.`)
        return
      }
      const { type, name } = b
      switch (type) {
        case 'INVALID_PACKAGE':
          console.warn(
            `[vite-plugin-cdn2]: can't find ${name} from node_modules in the workspace. Please check the package name manually.`
          )
          break
        case 'NO_PRESET_FIELDS':
          console.warn(`[vite-plugin-cdn2]: can't find unpkg or jsdelivr filed from ${name}. Please enter manually.`)
          break
      }
    })
  }

  return {
    name: 'vite-plugin-cdn',
    enforce: 'post',
    async transform(code, id) {
      if (id[0] === '\0') return
      if ([...finder.keys()].every((s) => !code.includes(s))) return
      const ast = this.parse(code) as AcornNode
      const { code: parserd } = await translate(ast, {
        finder,
        code: new MagicString(code)
      })
      return {
        code: parserd.toString(),
        map: parserd.generateMap()
      }
    },
    transformIndexHtml(raw: string) {
      if (!isProduction) return
      const struct = new ParserModuleStruct(finder)
      struct.format()
      if (options.transform) options.transform(struct.modules)
      const tpl = struct.toString()
      const window = new Window()
      const { document } = window
      document.body.innerHTML = raw
      const headEl = document.body.querySelector('head')
      headEl.insertAdjacentHTML('beforeend', tpl)
      return document.body.innerHTML
    }
  }
}

cdn.version = '0.2.1'
