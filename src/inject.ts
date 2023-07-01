//  refer: https://developer.mozilla.org/en-US/docs/Web/HTML/Element/script
import { URL } from 'url'
import { Window } from 'happy-dom'
import { uniq } from './shared'
import type { IIFEModuleInfo, CDNPluginOptions, ScriptNode, LinkNode } from './interface'

function isScript(url: string) {
  return url.split('.').pop() === 'js' ? 'script' : 'link'
}

class InjectScript {
  private modules: {
    links: Record<string, LinkNode>
    scripts: Record<string, ScriptNode>
  }

  private window: Window
  constructor(modules: Map<string, IIFEModuleInfo>, url: string) {
    this.modules = this.prepareSource(modules, url)
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

  text(html: string, transformHook?: CDNPluginOptions['transform']) {
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
    // issue #6
    const element = document.body.querySelector('title')
    const tags = this.toTags()
    const text = tags.join('\n')
    element.insertAdjacentHTML('beforebegin', text)
    return document.body.innerHTML
  }

  private prepareSource(modules: Map<string, IIFEModuleInfo>, mode: string) {
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

    // modules.forEach(((module,moduleName)) => {
    //   if (moduleName in modules) {
    //     const module = modules[moduleName]
    //     if (typeof mode === 'string') {
    //       const url = this.makeURL(module, mode)
    //       const tag = isScript(url)
    //       const node = makeNode(module, tag)
    //       node.url?.push(url)
    //       if (tag === 'script') {
    //         scripts[moduleName] = node as ScriptNode
    //       } else {
    //         links[moduleName] = node as LinkNode
    //       }
    //     }
    //     const spare = uniq(Array.isArray(module.spare) ? module.spare : module.spare ? [module.spare] : [])
    //     spare.forEach((url) => {
    //       const tag = isScript(url)
    //       if (tag === 'script') {
    //         if (moduleName in scripts) {
    //           scripts[moduleName].url?.push(url)
    //         } else {
    //           const node = makeNode(module, 'script')
    //           node.url?.push(url)
    //           scripts[moduleName] = node as ScriptNode
    //         }
    //       }
    //       if (tag === 'link') {
    //         if (moduleName in links) {
    //           links[moduleName].url?.push(url)
    //         } else {
    //           const node = makeNode(module, 'link')
    //           node.url?.push(url)
    //           links[moduleName] = node as LinkNode
    //         }
    //       }
    //     })
    //   }
    // })
    return { links, scripts }
  }

  // we handle all dependenices in scanner. So in this stage. The module
  // must have the following fields.
  private makeURL(module: IIFEModuleInfo, baseURL:string) {
    // if don't have any path will
    const { version, name } = module
    if (!baseURL) return ''
    const url = `${name}@${version}/${module[baseURL]}`
    return new URL(url, baseURL).href
  }
}

export function createInjectScript(
  dependModules: Record<string, IIFEModuleInfo>,
  moduleNames: string[],
  url: string
) {
  return new InjectScript(dependModules, moduleNames, url)
}
