/**
 * FYI. This file will be refactor in future.
 * Becuase rollup don't support return AST. so
 * we prase the raw code to AST. then get
 * the import and exports meta. Then use magic-string
 * to replace them.
 */

// refer https://astexplorer.net/
import MagicString from 'magic-string'
import type { AcornNode, TrackModule } from './interface'
import { tryRequireModule } from './shared'

const AST_TYPES = {
  IMPORT_DECLARATION: 'ImportDeclaration',
  EXPORT_NAMED_DECLARATION: 'ExportNamedDeclaration',
  EXPORT_ALL_DECLARATION: 'ExportAllDeclaration'
}

interface GrapResult {
  alias: string
  pos: number[]
  isDefault?: boolean
}

const ensureExportModule = (local: { name: string }, exported: { name: string }, globalName: string): string => {
  if (local.name === exported.name) {
    if (local.name === 'default') return globalName
    return `${globalName}.${local.name}`
  }

  if (exported.name === 'default') {
    return `${globalName}.${local.name}`
  }

  return `${globalName}.${exported.name}`
}

// We will analyzed the import and export syntax in source code.
// Transform them by right rule.

const graph = (
  nodes: Array<
    AcornNode & {
      specifiers: Array<AcornNode>
    }
  >,
  finder: Map<string, Required<TrackModule>>
) => {
  const weaks = new Map<string, GrapResult>()

  const pows = new Map<string, GrapResult>()

  const imports = nodes.filter(({ type }) => type === AST_TYPES.IMPORT_DECLARATION)

  const exportsType = [AST_TYPES.EXPORT_NAMED_DECLARATION, AST_TYPES.EXPORT_ALL_DECLARATION]

  const exports = nodes.filter(({ type }) => exportsType.includes(type))
  imports.forEach(({ source = {}, specifiers, start, end }) => {
    const { value: name } = source as AcornNode & {
      value?: string
    }
    if (!name) return
    const meta = finder.get(name)
    if (!meta) return
    specifiers.forEach((spec) => {
      const n = spec.imported ? `${meta.global}.${(spec.imported as { name: string }).name}` : meta.global
      weaks.set((spec.local as { name: string }).name, { alias: n, pos: [start, end] })
    })
  })

  exports.forEach(({ source = {}, specifiers, start, end, declaration, type }) => {
    if (type === AST_TYPES.EXPORT_ALL_DECLARATION) {
      const { value: name } = source as AcornNode & {
        value?: string
      }
      if (!name) return
      if (finder.has(name)) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const pkg = tryRequireModule(name) as any
        const keys = Object.keys(pkg)
        const realKeys = keys.length === 1 && keys[0] === 'default' ? Object.keys(pkg.default) : keys
        realKeys.forEach((k) => {
          pows.set(k, { alias: `${finder.get(name)?.global}.${k}`, pos: [start, end] })
        })
      }
    } else {
      if (declaration) return
      if (!source) return
      const { value: name } = source as AcornNode & {
        value?: string
      }
      if (!name) return
      const meta = finder.get(name)
      if (!meta) return
      specifiers.forEach((spec) => {
        const local = spec.local as { name: string }
        const exported = spec.exported as { name: string }
        const n = ensureExportModule(local, exported, meta.global)
        pows.set(local.name === 'default' ? meta.global : local.name, {
          alias: n,
          pos: [start, end],
          isDefault: exported.name === 'default'
        })
      })
    }
  })

  return { weaks, pows }
}

export const translate = (
  nodes: AcornNode,
  {
    finder,
    code
  }: {
    finder: Map<string, Required<TrackModule>>
    code: MagicString
  }
) => {
  const { weaks, pows } = graph(nodes.body as never, finder)

  const s: string[] = []
  const es: string[] = []

  /**
   * eg:
   *  import Vue from 'vue'
   *  transform as const _Vue = Vue
   */

  weaks.forEach(({ pos, alias }, k) => {
    const ident = k === alias ? `__import__${k}` : k
    s.push(`const ${ident} = ${alias};\n`)
    code.remove(pos[0], pos[1])
  })
  /**
   * eg:
   *  export { ref } from  'vue'
   *  transform as export const ref =  Vue.ref
   *
   *  export { ref as default } from 'vue'
   *  transform as const  ref = Vue.ref
   *                export default ref
   *
   *  export {default as React } from 'react'
   *  transform as export const _React  = React
   *
   *  export * from 'vue'
   *  transform as export const ref = Vue.ref
   */
  pows.forEach(({ pos, alias, isDefault }, k) => {
    const ident = k === alias ? `__export__${k}` : k
    const str = isDefault
      ? `const ${ident} = ${alias};\nexport default ${ident};\n`
      : `export const ${ident} = ${alias};\n`
    es.push(str)
    code.remove(pos[0], pos[1])
  })

  code.appendLeft(
    0,
    s.reduce((acc, cur) => (acc += cur), '')
  )

  code.append(es.reduce((acc, cur) => (acc += cur), ''))

  return { code }
}
