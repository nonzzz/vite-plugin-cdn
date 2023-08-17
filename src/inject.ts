//  refer: https://developer.mozilla.org/en-US/docs/Web/HTML/Element/script
import { URL } from 'url'
import type { HtmlTagDescriptor } from 'vite'
import { uniq } from './shared'
import type { CDNPluginOptions, LinkNode, ModuleInfo, ResolverFunction, ScriptNode } from './interface'

function isScript(url: string) {
  return url.split('.').pop() === 'js' ? 'script' : 'link'
}

interface Options {
  extra: ModuleInfo,
  baseURL: string
}

// [baseURL][version][name]
function replaceURL(p: string, url: string | ResolverFunction, options: Options) {
  const template = typeof url === 'function' ? url(p, options.extra) : url
  return template.replace(/\[version\]/, options.extra.version).replace(/\[baseURL\]/, options.baseURL).replace(/\[name\]/, options.extra.name)
}

function makeURL(moduleMeta: ModuleInfo, baseURL: string, resolver?: ResolverFunction) {
  const { version, name: packageName, relativeModule, resolve } = moduleMeta
  if (!baseURL) return
  const u = resolver ? resolver(baseURL, moduleMeta) : new URL(`${packageName}@${version}/${relativeModule}`, baseURL).href 
  if (resolve) return replaceURL(u, resolve, { extra: moduleMeta, baseURL })
  return u
}

function makeNode(moduleInfo: ModuleInfo): ScriptNode | LinkNode {
  return {
    tag: 'link',  
    url: new Set(),
    name: moduleInfo.name,
    extra: moduleInfo
  }
}

class InjectScript {
  private modules: Map<string, LinkNode | ScriptNode>
  constructor(modules: Map<string, ModuleInfo>, url: string, resolver?: ResolverFunction) {
    this.modules = this.prepareSource(modules, url, resolver)
  }

  toTags() {
    const tags: Array<HtmlTagDescriptor> = []
    this.modules.forEach((node) => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { tag, url, name: _, extra: __, ...restProps } = node
      if (url.size) {
        url.forEach((l) => {
          const descriptor: HtmlTagDescriptor = Object.create(null)
          descriptor.tag = tag
          descriptor.injectTo = 'head-prepend'
          descriptor.attrs = {}
          descriptor.attrs[tag === 'script' ? 'src' : 'href'] = l
          for (const prop in restProps) {
            descriptor.attrs[prop] = restProps[prop]
          }
          tags.push(descriptor)
        })
      }
    })
    return tags
  }


  calledHook(transformHook?: CDNPluginOptions['transform']) {
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
  }

  private prepareSource(modules: Map<string, ModuleInfo>, baseURL: string, resolver?: ResolverFunction) {
    const container: Map<string, LinkNode | ScriptNode> = new Map()

    const traverseModule = (moduleMeta: ModuleInfo, moduleName: string) => {
      const { spare } = moduleMeta
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
      const node = makeNode(moduleMeta)
      node.url.add(spare)
      node.tag = isScript(spare)
      container.set(mark, node)
    }

    modules.forEach((meta, moduleName) => {
      const node = makeNode(meta)
      const url = makeURL(meta, baseURL, resolver)
      if (!url) return
      node.url.add(url)
      node.tag = isScript(url)
      const mark = `__${moduleName}__${node.tag}__`
      container.set(mark, node)
      if (meta.spare) traverseModule(meta, moduleName)
    })
    return container
  }
}

export function createInjectScript(
  dependModules: Map<string, ModuleInfo>,
  url: string,
  resolver?: ResolverFunction
) {
  return new InjectScript(dependModules, url, resolver)
}
