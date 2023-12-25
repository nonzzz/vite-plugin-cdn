import type { FilterPattern } from '@rollup/pluginutils'
import type { ResolveOptions } from './resolve'

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

export type ScriptSpare = ScriptAttributes & {
  url: string
}

export type LinkSpare = LinkAttrobites & {
  url: string
}

export interface Module {
  name: string
  global?: string
}

export interface TrackModule extends Module {
  spare?: Array<ScriptSpare | LinkSpare> | string
  relativeModule?: string
  aliases?: Array<string>
}

export interface IIFEModuleInfo extends TrackModule {
  version: string
  unpkg?: string
  jsdelivr?: string
}

export type ResolverFunction = (p: string, extra: IIFEModuleInfo) => string

export interface ModuleInfo extends IIFEModuleInfo {
  bindings: Set<string>
  code?: string
}

export type IModule = TrackModule

export type ExternalModule = Required<Module> & {
  aliases?: Array<string>
}

type Pretty<T> = {
  [key in keyof T]:
  T[key] extends (...args: any[]) => any
    ? (...args: Parameters<T[key]>) => ReturnType<T[key]>
    : T[key] & NonNullable<unknown>
} & NonNullable<unknown>

export type CDNPluginOptions = Pretty<{
  modules?: Array<IModule | string>
  include?: FilterPattern
  exclude?: FilterPattern
  logLevel?: 'slient' | 'warn'
  resolve?: ResolveOptions
  apply?: 'build' | 'serve',
}>

export type ExternalPluginOptions = Pretty<{
  modules?: Array<ExternalModule>
  include?: FilterPattern
  exclude?: FilterPattern
}>
