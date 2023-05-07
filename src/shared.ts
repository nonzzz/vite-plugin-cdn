import path from 'path'
import fs from 'fs'
import process from 'process'

export function lookup(entry: string, target: string): string {
  const dir = path.dirname(entry)
  const targetFile = path.join(dir, target)
  if (fs.existsSync(targetFile)) return targetFile
  return lookup(dir, target)
}

// eslint-disable-next-line @typescript-eslint/ban-types
export function hasOwn<T extends { [key: string]: unknown }>(obj: T, key: keyof T | (string & {})): boolean {
  return Object.hasOwnProperty.call(obj, key)
}

export function len<T extends ArrayLike<unknown>>(source: T) {
  return source.length
}

export function uniq<T>(arr: NonNullable<T>[]) {
  const result: T[] = []
  const record = new WeakMap<object, boolean>()
  arr.map((item) => {
    const key = typeof item === 'object' ? item : { 0: item }
    if (!record.has(key)) {
      result.push(item)
      record.set(key, true)
    }
  })
  return result
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
