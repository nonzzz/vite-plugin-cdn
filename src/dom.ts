// Unfortunately. I'm ava noob. `vite-cdn-plugin-2` is a pure esm
// library. I can't find any way to define different `ts.config`
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
      const { url, tag, ...rest } = cur
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
    const spares = Array.from(this.input.values())
      .map(({ spare }) => unique(Array.isArray(spare) ? spare : [spare]))
      .flat()
    return spares.reduce((acc, cur) => {
      const suffix = cur.split('.').pop()
      const isScript = suffix === 'js'
      const meta: Transformed[number] = {
        tag: isScript ? 'script' : 'link',
        url: cur
      }
      if (!isScript) Reflect.set(meta, 'rel', 'stylesheet')
      acc.push(meta)
      return acc
    }, [] as Transformed)
  }
}
