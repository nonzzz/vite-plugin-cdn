import path from 'path'
import fs from 'fs'
import process from 'process'

export function lookup(entry: string, target: string): string {
  const dir = path.dirname(entry)
  const targetFile = path.join(dir, target)
  if (fs.existsSync(targetFile)) return targetFile
  return lookup(dir, target)
}

export function len<T extends ArrayLike<unknown>>(source: T) {
  return source.length
}

export function uniq<T>(arr: T[]) {
  return Array.from(new Set(arr))
}

export function isSupportThreads(): [boolean, string] {
  const [major, minor] = process.versions.node.split('.')
  if (+major < 12 || (+major === 12 && +minor < 17) || (+major === 13 && +minor < 13)) {
    return [false, `${major}.${minor}`]
  }
  return [true, `${major}.${minor}`]
}

export function is(condit: boolean, message: string) {
  if (!condit) {
    throw new Error(message)
  }
}

// TODO 
// If we find the correct dynamic import handing it should be removed.
export const _import = new Function('specifier', 'return import(specifier)')
