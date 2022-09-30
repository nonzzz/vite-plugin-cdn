import { createRequire } from 'module'

/**
 * Currently, i used ignored to disabled the warn in terminal. Because from the
 * ava document. i can't found any way to set different  tsconfig for it compiler.
 */
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignored
const _require = createRequire(import.meta.url)

export const tryRequireModule = <T>(module: string): T => {
  return _require(module) as T
}

export const unique = <T extends string[]>(origianl: T) => Array.from(new Set(origianl))
