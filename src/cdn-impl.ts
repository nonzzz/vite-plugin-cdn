import { Window } from 'happy-dom'
import MagicString from 'magic-string'
import { tryRequireModule, unique } from './shared'
import type { Plugin } from 'vite'
import type {
  TrackModule,
  CDNPluginOptions,
  PresetDomain,
  ScriptAttributes,
  LinkAttrobites,
  Serialization,
  Transformed,
  AcornNode
} from './interface'
import { translate } from './ast'

const PRESET_CDN_DOMAIN = {
  jsdelivr: 'https://cdn.jsdelivr.net/npm/',
  unpkg: 'https://unpkg.com/'
}

// refer: https://developer.mozilla.org/en-US/docs/Web/HTML/Element/script

const serialize = (struct: Map<string, Required<TrackModule>>) => {
  const getMeta = (str: string) => {
    const suffix = str.split('.').pop()

    const isScript = suffix === 'js'

    return {
      type: isScript ? '' : 'stylesheet',
      tag: isScript ? 'script' : 'link',
      isScript
    } as Pick<Serialization, 'type' | 'tag'>
  }

  const parserd: Transformed = []
  struct.forEach(({ spare }) => {
    const final = unique(Array.isArray(spare) ? spare : [spare])
    final.forEach((sp) => {
      const { type, tag } = getMeta(sp)
      parserd.push({
        tag,
        url: sp,
        type
      })
    })
  })
  return parserd
}

const toString = (metas: ReturnType<typeof serialize>) => {
  const def = (origianl: (ScriptAttributes & Serialization) | (LinkAttrobites & Serialization)) => {
    const { url, tag, ...rest } = origianl
    const otherParams = Object.entries(rest).reduce((acc, [attr, v]) => {
      if (v) {
        if (typeof v === 'boolean') return (acc += (attr as string).toLowerCase())
        return (acc += `${(attr as string).toLowerCase()}="${v}"`)
      }
      return acc
    }, '')
    if (tag === 'link') return `<link ${otherParams} href="${url}" />`
    return `<script ${otherParams} src="${url}"></script>`
  }

  return metas.reduce((acc, cur) => {
    const r = def(cur) + '\n'
    return (acc += r)
  }, '')
}

const parserModuleImpl = (modules: TrackModule[], preset: PresetDomain) => {
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
        if (!jsdelivr && !unpkg && !spare?.length) return bucket.push(name)
        const latestSpare = spare ? (Array.isArray(spare) ? spare : [spare]) : []
        const track = { name, global, spare: [ensureCDN(preset)] }
        if (latestSpare.length) track.spare.push(...latestSpare)
        finder.set(name, track)
        break
      default:
        throw Error(`[vite-plugin-cdn2]: Invalid preset ${preset}`)
    }
  })
  return { finder, bucket }
}

export const cdn = (options: CDNPluginOptions = {}): Plugin => {
  const { modules = [], isProduction = false, preset = 'auto', logInfo = 'info' } = options

  const { finder, bucket } = parserModuleImpl(modules, preset)
  if (bucket.length && logInfo === 'info') {
    bucket.forEach((b) => {
      console.warn(`[vite-plugin-cdn2]: can't found unpkg or jsdelivr filed from ${b}. Please enter manually.`)
    })
  }

  return {
    name: 'vite-plugin-cdn',
    enforce: 'post',
    transform(code, id) {
      if (id[0] === '\0') return
      if ([...finder.keys()].every((s) => !code.includes(s))) return
      const ast = this.parse(code) as AcornNode
      const { code: parserd } = translate(ast, {
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
      const metas = serialize(finder)
      if (options.transform) options.transform(metas)
      const tpl = toString(metas)
      const window = new Window()
      const { document } = window
      document.body.innerHTML = raw
      const headEl = document.body.querySelector('head')
      headEl.insertAdjacentHTML('beforeend', tpl)
      return document.body.innerHTML
    }
  }
}
