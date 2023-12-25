import { defineResolve } from '../resolve'
import type { HTMLTagDescriptor } from '../resolve'

export function jsdelivr(options: HTMLTagDescriptor = {}) {
  const { injectTo = 'head-prepend', attrs = {} } = options
  const baseURL = 'https://cdn.jsdelivr.net/npm/'
  return defineResolve({
    name: 'resolve:jsdelivr',
    setup({ extra }) {
      const { version, name, relativeModule } = extra
      const url = new URL(`${name}@${version}/${relativeModule}`, baseURL)
      return {
        url: url.href,
        injectTo,
        attrs: { ...attrs }
      }
    }
  })
}
