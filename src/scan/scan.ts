// scan thrid part module info
import { resolve } from '@dual-bundle/import-meta-resolve'
import fs from 'fs'
import url from 'url'

export interface PackageJSONMetadata {
  name: string
  verssion: string
  unpkg?: string
  jsdelivr?: string
}

export function loadPackage(name: string) {
  const packageJSONPath = resolve(`${name}/package.json`, import.meta.url)
  return JSON.parse(fs.readFileSync(url.fileURLToPath(packageJSONPath), 'utf8')) as PackageJSONMetadata
}

export function resolvePackageInfo(packageName: string) {
  loadPackage(packageName)
}
