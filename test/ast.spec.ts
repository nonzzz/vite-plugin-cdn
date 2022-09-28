import test from 'ava'
import * as acorn from 'acorn'
import MagicString from 'magic-string'
import { translate } from '../src/ast'
import type { AcornNode, TrackModule } from '../src/interface'

const mockRawCode = (raw: string, external: Record<string, string>) => {
  const ast = acorn.parse(raw, { ecmaVersion: 'latest', sourceType: 'module' }) as AcornNode
  const { code } = translate(ast, {
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

test('ImportDeclaration', (t) => {
  const c = mockRawCode(`import vue from 'vue'`, {
    vue: 'Vue'
  })
  t.is(c, 'const vue = Vue;\n')
})

test('ImportSpecifier', (t) => {
  const c = mockRawCode(`import { ref, watchEffect as Effect } from 'vue'`, { vue: 'Vue' })
  t.is(c, 'const ref = Vue.ref;\nconst Effect = Vue.watchEffect;\n')
})

test('ImportNamespaceSpecifier', (t) => {
  const c = mockRawCode(`import * as myVue from 'vue'`, { vue: 'Vue' })
  t.is(c, 'const myVue = Vue;\n')
})

test('ExportNamedDeclaration', (t) => {
  const c = mockRawCode(`export { ref } from 'vue'`, { vue: 'Vue' })
  t.is(c, `export const ref = Vue.ref;\n`)
})

test('ExportNamedDeclaration but as default', (t) => {
  const c = mockRawCode(`export { default } from 'vue'`, { vue: 'Vue' })
  t.is(c, `const __export__Vue = Vue;\nexport default __export__Vue;\n`)
})
