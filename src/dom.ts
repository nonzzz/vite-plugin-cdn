// Unfortunately. I'm ava noob. `vite-cdn-plugin-2` is a pure esm
// library. I can't find any way to define different `tsconfig`
// for ava.
// So as a temporary solution. compose part should be independent.

// refer: https://developer.mozilla.org/en-US/docs/Web/HTML/Element/script

import type { TrackModule, Transformed } from './interface'

const unique = <T extends string[]>(original: T) => Array.from(new Set(original))

export class ParserModuleStruct {
  private input: Map<string, Required<TrackModule>>
  private _modules?: Transformed
  constructor(userModules: Map<string, Required<TrackModule>>) {
    this.input = userModules
  }
  toString() {
    return this.modules.reduce((acc, cur) => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { url, tag, name: _, ...rest } = cur
      const parameter = Object.entries(rest).reduce((acc, [attr, v]) => {
        if (v) {
          if (typeof v === 'boolean') return (acc += (attr as string).toLowerCase())
          return (acc += `${(attr as string).toLowerCase()}="${v}"`)
        }
        return acc
      }, '')
      const str = tag === 'link' ? `<link ${parameter} href="${url}" />` : `<script ${parameter} src="${url}"></script>`
      return (acc += str + '\n')
    }, '')
  }

  get modules(): Transformed {
    if (this._modules) return this._modules
    return this.format()
  }

  set modules(values) {
    this._modules = values
  }

  format() {
    const spares = Array.from(this.input.values()).reduce<Array<{ name: string; spare: string }>>(
      (acc, { spare, name }) => {
        if (Array.isArray(spare)) {
          unique(spare).forEach((s) => acc.push({ name, spare: s }))
          return acc
        }
        acc.push({ name, spare })
        return acc
      },
      []
    )
    return spares.reduce<Transformed>((acc, { name, spare }) => {
      const meta: Transformed[number] = {
        tag: spare.split('.').pop() === 'js' ? 'script' : 'link',
        url: spare,
        name
      }
      if (meta.tag === 'link') meta.rel = 'stylesheet'
      acc.push(meta)
      return acc
    }, [])
  }
}
