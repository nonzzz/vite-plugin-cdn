//  refer: https://developer.mozilla.org/en-US/docs/Web/HTML/Element/script
import { URL } from 'url'
import path from 'path'
import type { HtmlTagDescriptor } from 'vite'
import type { LinkSpare, ModuleInfo, ScriptSpare } from './interface'
import type { ResolveOptions, SetupResult } from './resolve'
import { is } from './shared'

function isScript(p: string) {
  const { pathname } = new URL(p, 'https://www.example.com')
  return path.extname(pathname) === '.js' ? 'script' : 'link'
}

function createTagDescriptor(options: SetupResult): HtmlTagDescriptor {
  const { url, ...rest } = options
  const descriptor = {
    tag: isScript(url),
    ...rest
  }

  if (descriptor.tag === 'script') {
    descriptor.attrs.src = url
  } else {
    descriptor.attrs.href = url
    descriptor.attrs.rel = 'stylesheet'
  }

  return descriptor
}

class InjectScript {
  private _tagDescriptors: Array<HtmlTagDescriptor>
  constructor(modules: Map<string, ModuleInfo>, resolve: ResolveOptions) {
    is(!resolve || !resolve.name, '[vite-plugin-cdn2]: missing resolve')
    this._tagDescriptors = this.prepareSource(modules, resolve)
  }

  get tagDescriptors() {
    return this._tagDescriptors
  }

  private prepareSource(modules: Map<string, ModuleInfo>, resolve: ResolveOptions) {
    const container: Array<HtmlTagDescriptor> = []
    // Inherit the insertion postion of the parent node.
    const traverse = (spare: string | Array<ScriptSpare | LinkSpare>, injectTo: HtmlTagDescriptor['injectTo']) => {
      if (typeof spare === 'string') {
        container.push(createTagDescriptor({ url: spare, injectTo, attrs: {} }))
      }
      if (Array.isArray(spare)) {
        for (const s of spare) {
          const { url, ...rest } = s
          container.push(createTagDescriptor({ url, injectTo, attrs: rest ?? {} }))
        }
      }
    }

    // eslint-disable-next-line no-unused-vars
    for (const [_, moduleInfo] of modules) {
      const descriptor = createTagDescriptor(resolve.setup({ extra: moduleInfo }))
      if (moduleInfo.spare) traverse(moduleInfo.spare, descriptor.injectTo)
      container.push(descriptor)
    }
    return container
  }
}

export function createInjectScript(
  dependModules: Map<string, ModuleInfo>,
  resolve: ResolveOptions
) {
  return new InjectScript(dependModules, resolve)
}
