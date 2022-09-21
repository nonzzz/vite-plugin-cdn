import { createRequire } from 'module'

const _require = createRequire(import.meta.url)

export const tryRequireModule = <T>(module: string): T => {
  //
  return {} as T
}
