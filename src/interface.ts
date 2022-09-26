export interface TrackModule {
  name: string
  global: string
  spare?: Array<string> | string
}

export type PresetDomain = 'auto' | 'jsdelivr' | 'unpkg' | false

export type Transformed = Array<
  | (ScriptAttributes &
      Omit<Serialization, 'tag'> & {
        tag: 'script'
      })
  | (LinkAttrobites &
      Omit<Serialization, 'tag'> & {
        tag: 'link'
      })
>
export interface CDNPluginOptions {
  isProduction?: boolean
  modules?: Array<TrackModule>
  preset?: PresetDomain
  logInfo?: 'silent' | 'info'
  transform?: (meta: Transformed) => void
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
  tag: 'link' | 'script'
}

export interface AcornNode {
  end: number
  start: number
  type: string
  [prop: string]: unknown
}
