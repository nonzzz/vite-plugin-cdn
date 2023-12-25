import path from 'path'
import { defineResolve } from '../resolve'
import type { HTMLTagDescriptor } from '../resolve'

export function cdnjs(options: HTMLTagDescriptor = {}) {
  const { injectTo = 'head-prepend', attrs = {} } = options
  const baseURL = 'https://cdnjs.cloudflare.com/ajax/libs/'
  return defineResolve({
    name: 'resolve:cdnjs',
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
