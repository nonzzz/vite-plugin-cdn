import test from 'ava'
import * as acorn from 'acorn'
import MagicString from 'magic-string'
import { translate } from '../src/ast'
import type { AcornNode, TrackModule } from '../src/interface'

const mockRawCode = async (raw: string, external: Record<string, string>) => {
  const ast = acorn.parse(raw, { ecmaVersion: 'latest', sourceType: 'module' }) as AcornNode
  const { code } = await translate(ast, {
    finder: new Map(
      Object.entries(external).map(([s, e]) => {
        const p = { global: e } as Required<TrackModule>
        return [s, p]
      })
    ),
    code: new MagicString(raw)
  })
  return code.toString()
}

test('ImportDeclaration', async (t) => {
  const c = await mockRawCode(`import vue from 'vue'`, {
    vue: 'Vue'
  })
  t.is(c, 'const vue = Vue;\n')
})

test('ImportSpecifier', async (t) => {
  const c = await mockRawCode(`import { ref, watchEffect as Effect } from 'vue'`, { vue: 'Vue' })
  t.is(c, 'const ref = Vue.ref;\nconst Effect = Vue.watchEffect;\n')
})

test('ImportNamespaceSpecifier', async (t) => {
  const c = await mockRawCode(`import * as myVue from 'vue'`, { vue: 'Vue' })
  t.is(c, 'const myVue = Vue;\n')
})

test('ExportNamedDeclaration', async (t) => {
  const c = await mockRawCode(`export { ref } from 'vue'`, { vue: 'Vue' })
  t.is(c, `export const ref = Vue.ref;\n`)
})

test('ExportNamedDeclaration but as default', async (t) => {
  const c = await mockRawCode(`export { default } from 'vue'`, { vue: 'Vue' })
  t.is(c, `const __export__Vue = Vue;\nexport default __export__Vue;\n`)
})

test('ExportAllDeclaration', async (t) => {
  const c = await mockRawCode(`export * from 'no-bump'`, { 'no-bump': 'bump' })
  t.is(
    c,
    'export const build = bump.build;\nexport const define = bump.define;\nexport const watch = bump.watch;\nconst bump = bump.default;\nexport default bump;\n'
  )
})

test('ExportNamedDeclaration but ReExport as default', async (t) => {
  const c = await mockRawCode(`export { ref as default } from 'vue'`, { vue: 'Vue' })
  t.is(c, `const ref = Vue.ref;\nexport default ref;\n`)
})

test('ExportNamedDeclaration but ReExport', async (t) => {
  const c = await mockRawCode(`export { ref as Ref } from 'vue'`, { vue: 'Vue' })
  t.is(c, `export const Ref = Vue.ref;\n`)
})
