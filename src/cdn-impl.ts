import { Window } from 'happy-dom'
import MagicString from 'magic-string'
import { tryRequireModule, ERRORS, error, requireResolve, lookup, tryRequireRealModule } from './shared'
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

  const monitor = (
    type: Exclude<PresetDomain, false>,
    {
      jsdelivr,
      unpkg,
      version,
      name
    }: {
      jsdelivr?: string
      unpkg?: string
      version: string
      name: string
    },
    throwError?: boolean
  ) => {
    const ensureResource =
      type === 'jsdelivr' ? jsdelivr : type === 'unpkg' ? unpkg : type === 'auto' ? jsdelivr || unpkg : undefined
    if (!ensureResource) {
      if (!throwError) {
        return ERRORS.NO_PRESET_FIELDS
      }
      error({
        code: ERRORS.NO_PRESET_FIELDS,
        message: ''
      })
    }

    const autoType = jsdelivr ? 'jsdelivr' : 'unpkg'
    return `${PRESET_CDN_DOMAIN[type === 'auto' ? autoType : type]}${name}@${version}/${ensureResource}`
  }

  modules.forEach((module, i) => {
    const { name, global, spare } = module
    if (!name || !global) {
      if (!name) throw Error(`[vite-plugin-cdn2]: Please pass the name for modules at postion ${i}. `)
      throw Error(`[vite-plugin-cdn2]: Please pass the global for modules at postion ${i}. `)
    }

    if (typeof preset === 'boolean' && !preset) {
      if (!spare || !spare.length) {
        bucket.push(name)
        return
      }
      finder.set(name, { name, global, spare })
      return
    }

    try {
      const { version, unpkg, jsdelivr } = tryRequireModule<{ version: string; unpkg?: string; jsdelivr?: string }>(
        `${name}/package.json`
      )
      switch (preset) {
        case 'auto':
        case 'unpkg':
        case 'jsdelivr':
          const track = { name, global, spare: [monitor(preset, { jsdelivr, unpkg, version, name }, true)] }
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
        switch (err.code) {
          case ERRORS.INVALID_PACKAGE:
            error(err)
          case ERRORS.NO_PRESET_FIELDS:
            if (!spare?.length)
              return bucket.push({
                name,
                type: ERRORS.NO_PRESET_FIELDS
              })
            return finder.set(name, { name, global, spare })
          // In some libraries who set type=module will trigger this logic.
          case ERRORS.ERR_PACKAGE_PATH_NOT_EXPORTED:
            const modulePath = requireResolve(name)
            const { version, jsdelivr, unpkg } = tryRequireRealModule<{
              version: string
              unpkg?: string
              jsdelivr?: string
            }>(lookup(modulePath, 'package.json'))
            const link = monitor(preset, { jsdelivr, unpkg, version, name })
            if (link === ERRORS.NO_PRESET_FIELDS) return bucket.push({ name, type: ERRORS.NO_PRESET_FIELDS })
            const track = { name, global, spare: [link] }
            if (spare?.length) {
              const latestSpare = Array.isArray(spare) ? spare : [spare]
              track.spare.push(...latestSpare)
            }
            finder.set(name, track)
        }
        return
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
      if (!isProduction) return
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
      let { modules } = struct
      if (options.transform) {
        const res = options.transform(struct.modules)
        if (res) modules = res
      }
      struct.modules = modules
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

cdn.version = '0.3.0'
