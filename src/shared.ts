import { createRequire } from 'module'
import type { InternalError } from './interface'

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

export const unique = <T extends string[]>(original: T) => Array.from(new Set(original))

export const ERRORS = {
  INVALID_PACKAGE: 'INVALID_PACKAGE',
  NO_PRESET_FIELDS: 'NO_PRESET_FIELDS',
  INVALID_PRESET: 'INVALID_PRESET'
}

export const error = (native: Error | InternalError) => {
  if (!(native instanceof Error)) native = Object.assign(new Error(native.message), native)
  throw native
}
