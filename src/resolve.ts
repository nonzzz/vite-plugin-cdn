import type { HtmlTagDescriptor } from 'vite'
import type { IIFEModuleInfo, LinkSpare, ScriptAttributes, ScriptSpare } from './interface'

export type HTMLTagDescriptor = Pick<HtmlTagDescriptor, 'injectTo' | 'attrs'> & {
  attrs?: ScriptAttributes
}

interface SetupContext {
  extra: IIFEModuleInfo
}

export type SetupResult = { url: string } & HTMLTagDescriptor

export interface ResolveOptions {
  name: string
  setup(ctx: SetupContext): SetupResult
}

export function defineResolve(opts: ResolveOptions) {
  return opts
}

export function defineScript(opts: ScriptSpare) {
  return opts
}

export function defineLink(opts: LinkSpare) {
  return opts
}
