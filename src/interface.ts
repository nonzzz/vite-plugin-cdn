export interface TrackModule {
  name: string
  global?: string
  spare?: Array<string> | string
}

export type PresetDomain = 'auto' | 'jsdelivr' | 'unpkg' | false

export interface IIFEModuleInfo extends Pick<TrackModule, 'spare'> {
  version: string
  name: string
  globalName?: string
  unpkg?: string
  jsdelivr?: string
}

export type ScriptNode = ScriptAttributes &
  Omit<Serialization, 'tag' | 'type'> & {
    tag: 'script'
  }

export type LinkNode = LinkAttrobites &
  Omit<Serialization, 'tag' | 'type'> & {
    tag: 'link'
  }

export interface InjectVisitor {
  script?: (node: ScriptNode) => void
  link?: (node: LinkNode) => void
}

export interface CDNPluginOptions {
  isProduction?: boolean
  modules?: Array<TrackModule | string>
  preset?: PresetDomain
  logInfo?: 'silent' | 'info'
  mode?: PresetDomain
  transform?: () => InjectVisitor
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
