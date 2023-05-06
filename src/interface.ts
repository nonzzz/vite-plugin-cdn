export interface TrackModule {
  name: string
  global?: string
  spare?: Array<string> | string
}

export type PresetDomain = 'auto' | 'jsdelivr' | 'unpkg' | false

export interface IIFEModuleInfo {
  version: string
  mode: PresetDomain
  name: string
  unpkg?: string
  jsdelivr?: string
}

export type Transformed = Array<
  | (ScriptAttributes &
      Omit<Serialization, 'tag' | 'type'> & {
        tag: 'script'
      })
  | (LinkAttrobites &
      Omit<Serialization, 'tag' | 'type'> & {
        tag: 'link'
      })
>
export interface CDNPluginOptions {
  isProduction?: boolean
  modules?: Array<TrackModule | string>
  preset?: PresetDomain
  logInfo?: 'silent' | 'info'
  mode?: PresetDomain
  transform?: (meta: Transformed) => void | Transformed
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

export interface Serialization {
  url?: string
  type?: string
  name: string
  tag: 'link' | 'script'
}

export interface AcornNode {
  end: number
  start: number
  type: string
  [prop: string]: unknown
}

export interface InternalError {
  code: string
  message: string
}
