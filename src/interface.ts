export interface TrackModule {
  name: string
  global: string
  spare?: Array<string> | string
}

export type PresetDomain = 'auto' | 'jsdelivr' | 'unpkg' | false

export interface CDNPluginOptions {
  isProduction?: boolean
  modules?: Array<TrackModule>
  preset?: PresetDomain
  logInfo?: 'silent' | 'info'
}

export type ScriptKeyWord = Pick<
  HTMLScriptElement,
  'async' | 'charset' | 'crossOrigin' | 'defer' | 'integrity' | 'noModule' | 'nonce' | 'referrerPolicy' | 'type'
>

export type LinkKeyWord = Pick<
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
