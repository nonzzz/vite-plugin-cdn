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

  if (local.name === 'default') {
    return exported.name
  }
  return `${globalName}.${exported.name}`
}

// graph will record all import and export value and pos.
// Currently, It's not a good way to support export * from 'module'

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

  const exportsType = [AST_TYPES.EXPORT_NAMED_DECLARATION]

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

  exports.forEach(({ source = {}, specifiers, start, end, declaration }) => {
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
