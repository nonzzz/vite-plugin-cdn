import type { FilterPattern } from '@rollup/pluginutils'

export interface TrackModule {
  name: string
  global?: string
  spare?: Array<string> | string
  relativeModule?: string
  aliases?: Array<string>
}

export interface IIFEModuleInfo extends TrackModule {
  version: string
  unpkg?: string
  jsdelivr?: string
  exports?: Record<string, any>
}

export type ResolverFunction = (p: string, extra: IIFEModuleInfo)=> string

export interface ModuleInfo extends IIFEModuleInfo {
  bindings: Set<string>
  code?: string
  resolve?: string | ResolverFunction
}

export interface IModule extends TrackModule {
  resolve?: string | ResolverFunction
}

export interface Serialization {
  url?: Set<string>
  type?: string
  name: string
  tag: 'link' | 'script'
  extra: Record<string, any>
}


export type ScriptAttributes = Partial<
  Pick<
    HTMLScriptElement,
    'async' | 'crossOrigin' | 'defer' | 'integrity' | 'noModule' | 'nonce' | 'referrerPolicy' | 'type'
  >
>

export type LinkAttrobites = Partial<
  Pick<
    HTMLLinkElement,
    | 'as'
    | 'crossOrigin'
    | 'href'
    | 'hreflang'
    | 'imageSizes'
    | 'imageSrcset'
    | 'integrity'
    | 'media'
    | 'referrerPolicy'
    | 'rel'
    | 'title'
    | 'type'
  >
>

export type ScriptNode = ScriptAttributes &
  Omit<Serialization, 'tag' | 'type'> & {
    tag: 'script'
  }

export type LinkNode = LinkAttrobites &
  Omit<Serialization, 'tag' | 'type'> & {
    tag: 'link'
  }

export interface InjectVisitor {
  script?: (node: ScriptNode)=> void
  link?: (node: LinkNode)=> void
}

type Pretty<T> = {
  [key in keyof T]:
  T[key] extends (...args: any[])=> any
  ? (...args: Parameters<T[key]>)=> any
  : T[key] & NonNullable<unknown>
} & NonNullable<unknown>

export type CDNPluginOptions = Pretty<{
  modules?: Array<IModule | string>
  url?: string
  transform?: ()=> InjectVisitor
  include?: FilterPattern
  exclude?: FilterPattern
  logLevel?: 'slient' | 'warn'
  resolve?: ResolverFunction
  apply?: 'build' | 'serve',
}>
