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
  constructor(modules: Record<string, IIFEModuleInfo>, moduleNames: string[], mode: PresetDomain) {
    this.modules = this.prepareModules(modules, moduleNames, mode)
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
    console.log(this.modules)
    //issue #6
    // const element = document.body.querySelector('title')
    // element.insertAdjacentElement('beforebegin', '')
    return document.body.innerHTML
  }
  private prepareModules(modules: Record<string, IIFEModuleInfo>, moduleNames: string[], mode: PresetDomain) {
    // we need moduleNames ensure us sciprt or link insertion order.
    const result: Array<ScriptNode | LinkNode> = []
    const makeNode = (module: IIFEModuleInfo, tag: ReturnType<typeof isScript>): ScriptNode | LinkNode => {
      const data: ScriptNode | LinkNode = Object.create(null)
      data.url = []
      data.name = module.name
      data.tag = tag
      return data
    }
    moduleNames.forEach((moduleName) => {
      if (moduleName in modules) {
        const module = modules[moduleName]
        if (typeof mode === 'string') {
          const url = this.makeURL(module, mode)
          const tag = isScript(url)
          const node = makeNode(module, tag)
          node.url?.push(url)
          result.push(node)
        }
        const spare = uniq(Array.isArray(module.spare) ? module.spare : module.spare ? [module.spare] : [])
        spare.forEach((url) => {
          const tag = isScript(url)
          if (tag === 'script') {
            // node.url?.push(url)
            return
          }
        })
      }
    })
    return result
  }
  // we handle all dependenices in scanner. So in this stage. The module
  // must have the following fields.
  private makeURL(module: IIFEModuleInfo, mode: Exclude<PresetDomain, false>) {
    // if don't have any path will
    if (typeof mode === 'boolean') {
      return ''
    }
    const { jsdelivr, version, name } = module
    const base = mode === 'auto' ? (jsdelivr ? 'jsdelivr' : 'unpkg') : mode
    const baseURL = DOMAIN[base]
    if (!baseURL) return ''
    const url = `${name}@${version}/${module[base]}`
    return new URL(url, baseURL).href
  }
}

export function createInjectScript(
  dependModules: Record<string, IIFEModuleInfo>,
  moduleNames: string[],
  mode: PresetDomain
) {
  return new InjectScript(dependModules, moduleNames, mode)
}
