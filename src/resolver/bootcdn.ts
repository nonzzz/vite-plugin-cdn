import path from 'path'
import { defineResolve } from '../resolve'
import type { HTMLTagDescriptor } from '../resolve'

export function bootcdn(options: HTMLTagDescriptor = {}) {
  const { injectTo = 'head-prepend', attrs = {} } = options
  const baseURL = 'https://cdn.bootcdn.net/ajax/libs/'
  return defineResolve({
    name: 'resolve:bootcdn',
    setup({ extra }) {
      const { version, name, relativeModule } = extra
      const baseName = path.basename(relativeModule)
      const url = new URL(`${name}/${version}/${baseName}`, baseURL)
      return {
        url: url.href,
        injectTo,
        attrs: { ...attrs }
      }   
    }
  })
}
