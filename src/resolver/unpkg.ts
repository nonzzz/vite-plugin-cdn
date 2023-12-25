import { defineResolve } from '../resolve'
import type { HTMLTagDescriptor } from '../resolve'

export function unpkg(options: HTMLTagDescriptor = {}) {
  const { injectTo = 'head-prepend', attrs = {} } = options
  const baseURL = 'https://unpkg.com/'
  return defineResolve({
    name: 'resolve:unpkg',
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
