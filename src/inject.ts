//  refer: https://developer.mozilla.org/en-US/docs/Web/HTML/Element/script
import { URL } from 'url'
import { Window } from 'happy-dom'
import { uniq } from './shared'
import type { IIFEModuleInfo, CDNPluginOptions, ScriptNode, LinkNode } from './interface'

function isScript(url: string) {
  return url.split('.').pop() === 'js' ? 'script' : 'link'
}

function makeURL(moduleMeta: IIFEModuleInfo, baseURL:string) {
  const { version, name: packageName, relativeModule } = moduleMeta
  if (!baseURL) return
  return new URL(`${packageName}@${version}/${relativeModule}`, baseURL).href
}

function makeNode(packageName:string):ScriptNode | LinkNode {
  return {
    tag: 'link',
    url: new Set(),
    name: packageName
  }
}

class InjectScript {
  private modules:Map<string, LinkNode | ScriptNode>

  private window: Window
  constructor(modules: Map<string, IIFEModuleInfo>, url: string) {
    this.modules = this.prepareSource(modules, url)
    this.window = new Window()
  }

  toTags() {
    const tags = []
    this.modules.forEach((node) => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { tag, url, name: _, ...restProps } = node
      if (url.size) {
        url.forEach((l) => {
          const element = this.window.document.createElement(tag)
          element.setAttribute(tag === 'script' ? 'src' : 'href', l)
          for (const prop in restProps) {
            element.setAttribute(prop, restProps[prop])
          }
          tags.push(element.toString())
        })
      }
    })
    return tags
  }

  text(html: string, transformHook?: CDNPluginOptions['transform']) {
    const { document } = this.window
    document.body.innerHTML = html
    if (transformHook) {
      const hook = transformHook()
      this.modules.forEach((node) => {
        if (node.tag === 'script') {
          hook.script?.(node)
        }
        if (node.tag === 'link') {
          hook.link?.(node)
        }
      })
    }
    // issue #6
    const element = document.body.querySelector('title')
    const tags = this.toTags()
    const text = tags.join('\n')
    element.insertAdjacentHTML('beforebegin', text)
    return document.body.innerHTML
  }

  private prepareSource(modules: Map<string, IIFEModuleInfo>, baseURL: string) {
    const container:Map<string, LinkNode | ScriptNode> = new Map()

    const traverseModule = (moduleMeta: IIFEModuleInfo, moduleName: string) => {
      const { spare, name: packageName } = moduleMeta
      if (!spare) return
      if (Array.isArray(spare)) {
        for (const s of uniq(spare)) {
          traverseModule({ ...moduleMeta, spare: s }, moduleName)
        }
        return
      } 
      const tag = isScript(spare)
      const mark = `__${moduleName}__${tag}__`
      if (container.has(mark)) {
        const node = container.get(mark)
        node.url.add(spare)
        return
      }
      const node = makeNode(packageName)
      node.url.add(spare)
      node.tag = isScript(spare)
      container.set(mark, node)
    }

    modules.forEach((meta, moduleName) => {
      const node = makeNode(meta.name)
      const url = makeURL(meta, baseURL)
      node.url.add(url)
      node.tag = isScript(url)
      const mark = `__${moduleName}__${node.tag}__`
      container.set(mark, node)
      if (meta.spare)  traverseModule(meta, moduleName)
    })
    return container
  }
}

export function createInjectScript(
  dependModules: Map<string, IIFEModuleInfo>,
  url: string
) {
  return new InjectScript(dependModules, url)
}
