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
  private modules: {
    links: Record<string, LinkNode>
    scripts: Record<string, ScriptNode>
  }
  private window: Window
  constructor(modules: Record<string, IIFEModuleInfo>, moduleNames: string[], mode: PresetDomain) {
    this.modules = this.prepareModules(modules, moduleNames, mode)
    this.window = new Window()
  }
  toTags() {
    const nodes = [...Object.values(this.modules.scripts), ...Object.values(this.modules.links)]
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    return nodes.flatMap(({ name: _, tag, url = [], ...restProps }) => {
      return url.map((url) => {
        const element = this.window.document.createElement(tag)
        if (tag === 'script') {
          element.setAttribute('src', url)
        } else {
          element.setAttribute('href', url)
        }
        for (const prop in restProps) {
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore
          const value = restProps[prop]
          element.setAttribute(prop, value.toString())
        }
        return element.toString()
      })
    })
  }
  inject(html: string, transformHook: undefined | CDNPluginOptions['transform']) {
    const { document } = this.window
    document.body.innerHTML = html
    if (transformHook) {
      const hook = transformHook()
      for (const module in this.modules.scripts) {
        hook.script?.(this.modules.scripts[module])
      }
      for (const module in this.modules.links) {
        hook.link?.(this.modules.links[module])
      }
    }
    //issue #6
    const element = document.body.querySelector('title')
    const tags = this.toTags()
    const text = tags.join('\n')
    element.insertAdjacentHTML('beforebegin', text)
    return document.body.innerHTML
  }
  private prepareModules(modules: Record<string, IIFEModuleInfo>, moduleNames: string[], mode: PresetDomain) {
    // we need moduleNames ensure us sciprt or link insertion order.
    const makeNode = (module: IIFEModuleInfo, tag: ReturnType<typeof isScript>): ScriptNode | LinkNode => {
      const data: ScriptNode | LinkNode = Object.create(null)
      data.url = []
      data.name = module.name
      data.tag = tag
      return data
    }
    const links: Record<string, LinkNode> = {}
    const scripts: Record<string, ScriptNode> = {}

    moduleNames.forEach((moduleName) => {
      if (moduleName in modules) {
        const module = modules[moduleName]
        if (typeof mode === 'string') {
          const url = this.makeURL(module, mode)
          const tag = isScript(url)
          const node = makeNode(module, tag)
          node.url?.push(url)
          if (tag === 'script') {
            scripts[moduleName] = node as ScriptNode
          } else {
            links[moduleName] = node as LinkNode
          }
        }
        const spare = uniq(Array.isArray(module.spare) ? module.spare : module.spare ? [module.spare] : [])
        spare.forEach((url) => {
          const tag = isScript(url)
          if (tag === 'script') {
            if (moduleName in scripts) {
              scripts[moduleName].url?.push(url)
            } else {
              const node = makeNode(module, 'script')
              node.url?.push(url)
              scripts[moduleName] = node as ScriptNode
            }
          }
          if (tag === 'link') {
            if (moduleName in links) {
              links[moduleName].url?.push(url)
            } else {
              const node = makeNode(module, 'link')
              node.url?.push(url)
              links[moduleName] = node as LinkNode
            }
          }
        })
      }
    })
    return { links, scripts }
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
