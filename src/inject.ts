//  refer: https://developer.mozilla.org/en-US/docs/Web/HTML/Element/script
import { URL } from 'url'
import { Window } from 'happy-dom'
import type { IIFEModuleInfo, CDNPluginOptions, PresetDomain, ScriptNode, LinkNode } from './interface'
import { uniq } from './shared'

const DOMAIN: Record<Exclude<PresetDomain, false | 'auto'>, string> = {
  jsdelivr: 'https://cdn.jsdelivr.net/npm/',
  unpkg: 'https://unpkg.com/'
}

function isScript(url: string) {
  return url.split('.').pop() === 'js' ? 'script' : 'link'
}

class InjectScript {
  private modules: Array<ScriptNode | LinkNode>
  private window: Window
  constructor(modules: Record<string, IIFEModuleInfo>, mode: PresetDomain) {
    this.modules = this.prepareModules(modules, mode)
    this.window = new Window()
  }
  toString() {
    //
  }
  inject(html: string, transformHook: undefined | CDNPluginOptions['transform']) {
    const { document } = this.window
    document.body.innerHTML = html
    if (transformHook) {
      const hook = transformHook()
      for (const module of this.modules) {
        if (module.tag === 'script') {
          hook?.script?.(module)
        } else {
          hook?.link?.(module)
        }
      }
    }
    //issue #6
    // const element = document.body.querySelector('title')
    // element.insertAdjacentElement('beforebegin', '')
    return document.body.innerHTML
  }
  private prepareModules(input: Record<string, IIFEModuleInfo>, mode: PresetDomain) {
    const result: Array<ScriptNode | LinkNode> = []
    const makeNode = (module: IIFEModuleInfo, url: string): ScriptNode | LinkNode => {
      const data: ScriptNode | LinkNode = Object.create(null)
      data.tag = isScript(url)
      data.url = url
      data.name = module.name
      if (data.tag === 'link') data.rel = 'stylesheet'
      return data
    }
    for (const key in input) {
      const module = input[key]
      if (typeof mode === 'string') {
        const url = this.makeURL(module, mode)
        result.push(makeNode(module, url))
      }
      const spare = uniq(Array.isArray(module.spare) ? module.spare : module.spare ? [module.spare] : [])
      spare.forEach((url) => {
        result.push(makeNode(module, url))
      })
    }
    return result
  }
  private makeURL(module: IIFEModuleInfo, mode: Exclude<PresetDomain, false>) {
    let base: Exclude<PresetDomain, false | 'auto'> | '' = ''
    if (mode === 'auto') {
      if (module.jsdelivr) {
        base = 'jsdelivr'
      } else if (module.unpkg) {
        base = 'unpkg'
      }
    } else {
      base = mode
    }
    if (!base) {
      return ''
    }
    return new URL(module[base] as string, DOMAIN[base]).href
  }
}

export function createInjectScript(modules: Record<string, IIFEModuleInfo>, mode: PresetDomain) {
  return new InjectScript(modules, mode)
}
