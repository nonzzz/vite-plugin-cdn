// This file invorked by `cdn-impl`. Provide translate func
// only transform import and export syntax.

// ExportAllDeclaration is a special case. we should analyze it (May it'll cause bug. At present, All i can think of should be `default export`)
// Maybe it's also break the semantics of the original code.
// Just like vue3 don't export as default export. but using this plugin you can write `import Vue from 'vue';`
// Will be transform as `const __import__Vue = Vue;` (Currently, Don't care the module is a namespace.)
// In some case. mayn't be able to cover :) If the case is right. PR Welcome.
// FYI.

// Refer https://astexplorer.net/

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

  if (exported.name === 'default') {
    return `${globalName}.${local.name}`
  }

  return `${globalName}.${exported.name}`
}

// We will analyzed the import and export syntax in source code.
// Transform them by right rule.

const graph = async (
  nodes: Array<
    AcornNode & {
      specifiers: Array<AcornNode>
    }
  >,
  finder: Map<string, Required<TrackModule>>
) => {
  const weaks = new Map<string, GrapResult>()

  const pows = new Map<string, GrapResult>()

  interface Node extends AcornNode {
    source: AcornNode & {
      value?: string
    }
    specifiers: Array<AcornNode>
  }

  const nodeInvork = (nodes: unknown, filter: string[], invork?: (nodes: Node) => void) => {
    const filters = (nodes as Array<Node>).filter(({ type }) => filter.includes(type))
    filters.forEach((v) => invork && invork(v))
  }

  nodeInvork(nodes, [AST_TYPES.IMPORT_DECLARATION], (imports) => {
    const { source, specifiers, start, end } = imports
    const { value } = source
    if (!value) return
    if (!finder.has(value)) return
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const { global: alias } = finder.get(value)!

    specifiers.length &&
      specifiers.forEach((spec) => {
        const { imported, local } = spec as AcornNode & {
          imported: {
            name: string
          }
          local: {
            name: string
          }
        }
        const n = imported ? `${alias}.${imported.name}` : alias
        weaks.set(local.name, { alias: n, pos: [start, end] })
      })
    return
  })

  await nodeInvork(nodes, [AST_TYPES.EXPORT_NAMED_DECLARATION, AST_TYPES.EXPORT_ALL_DECLARATION], (exports) => {
    const { source, specifiers, start, end, declaration, type } = exports

    switch (type) {
      case AST_TYPES.EXPORT_ALL_DECLARATION: {
        const { value } = source
        if (!value) return
        if (!finder.has(value)) return
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const { global: alias } = finder.get(value)!
        import(value).then((pkg) => {
          const keys = Object.keys(pkg)
          const realKeys = keys.length === 1 && keys[0] === 'default' ? Object.keys(pkg.default) : keys
          realKeys.forEach((k) => {
            pows.set(k === 'default' ? alias : k, {
              alias: `${alias}.${k}`,
              pos: [start, end],
              isDefault: k === 'default'
            })
          })
        })
        break
      }
      default:
        /**
         * In some case
         * ```js
         *  import Vue from 'vue'
         *  export const vue = Vue
         * ```
         * We will replace the import syntax so we should skip the export syntax with declaration
         *
         * Second Case
         *
         * ```js
         *  import { ref } from 'vue'
         *  export { ref }
         * ```
         * Accroding AST node. this case source will be null. should be skip
         *
         */
        if (declaration || !source) return
        const { value } = source
        if (!value) return
        if (!finder.has(value)) return
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const { global: alias } = finder.get(value)!
        specifiers &&
          specifiers.forEach((spec) => {
            const { exported, local } = spec as AcornNode & {
              exported: {
                name: string
              }
              local: {
                name: string
              }
            }
            // named export can cover a variety of situations.
            // ReExport :)
            const n = ensureExportModule(local, exported, alias)
            pows.set(local.name === 'default' ? alias : local.name, {
              alias: n,
              pos: [start, end],
              isDefault: exported.name === 'default'
            })
          })
    }

    return
  })

  return { weaks, pows }
}

export const translate = async (
  nodes: AcornNode,
  {
    finder,
    code
  }: {
    finder: Map<string, Required<TrackModule>>
    code: MagicString
  }
) => {
  const { weaks, pows } = await graph(nodes.body as never, finder)
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
