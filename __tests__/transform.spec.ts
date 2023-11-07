import test from 'ava'
import { parse, traverse } from '@babel/core'
import type { TransformWithBabelOptions } from '../src/transform'
import { transformWithBabel } from '../src/transform'
import { createScanner } from '../dist/scanner'

const dependency = <TransformWithBabelOptions>{}

function mockTransformOptions() {
  const scanner = createScanner([{ name: 'vue', aliases: ['dist'] }, { name: 'react', relativeModule: './umd/react.production.min.js' }])
  scanner.scanAllDependencies()
  const traverse = (aliases: string[], name: string) => aliases.reduce((acc, cur) => ({ ...acc, [cur]: name }), {})
  dependency.dependency = Object.fromEntries(scanner.dependencies)
  dependency.dependencyWithAlias = Object.values(dependency.dependency).reduce((acc, cur) => {
    if (cur.aliases) acc = { ...acc, ...traverse(cur.aliases, cur.name) }
    return { ...acc, [cur.name]: cur.name }
  }, {})
}

test.before(() => {
  mockTransformOptions()
})

test('scope transform', async (t) => {
  const code = 'import { version } from \'vue\';\n console.log(version);\n function t() { const version = 3;\n console.log(version) }'
  const { code: actually } = await transformWithBabel(code, dependency)
  t.is(actually, 'console.log(Vue.version);\nfunction t() {\n  const version = 3;\n  console.log(version);\n}')
})

test('exports loose source', async (t) => {
  const code = 'import { version } from \'vue\';\n export { version };\n'
  const { code: actually } = await transformWithBabel(code, dependency)
  t.is(actually, 'export var version = Vue.version;')
})

test('exports loose source and re named exported name', async (t) => {
  const code = 'import { version } from \'vue\';\n export { version, version as default };\n'
  const { code: actually } = await transformWithBabel(code, dependency)
  t.is(actually, 'export var version = Vue.version;\nexport default Vue.version;')
})

test('exports loose source and export self module', async (t) => {
  const code = 'import { version , ref } from \'vue\';\n const t = \'nonzzz\';\n export { t, version, ref as default };'
  const { code: actually } = await transformWithBabel(code, dependency)
  t.is(actually, 'const t = \'nonzzz\';\nexport { t };\nexport var version = Vue.version;\nexport default Vue.ref;')
})
  
test('exports with source', async (t) => {
  const code = 'export { ref , version } from \'vue\''
  const { code: actually } = await transformWithBabel(code, dependency)
  t.is(actually, 'export var ref = Vue.ref,\n  version = Vue.version;')
})

test('exports with source and re named local name', async (t) => {
  const code = 'export { default as myVue, version } from \'vue\''
  const { code: actually } = await transformWithBabel(code, dependency)
  const ast = await parse(actually, { babelrc: false, configFile: false })!
  const keys: Set<string> = new Set()
  // @ts-ignored
  await traverse(ast, {
    ObjectProperty: {
      enter: (path) => {
        path.node.key.type === 'Identifier' && keys.add(path.node.key.name)
      }
    }
  })
  // @ts-ignored
  t.is(keys.size, dependency.dependency.vue.bindings.size)
})
  
test('exports with source and re named exported name', async (t) => {
  const code = 'export { version as default , ref } from \'vue\''
  const { code: actually } = await transformWithBabel(code, dependency)
  t.is(actually, 'export var ref = Vue.ref;\nexport default Vue.version;')
})

test('export all with source and re named it with default', async (t) => {
  const code = 'export * as default from \'vue\''
  const { code: actually } = await transformWithBabel(code, dependency)
  const ast = await parse(actually, { babelrc: false, configFile: false })!
  const keys: Set<string> = new Set()
  // @ts-ignored
  await traverse(ast, {
    ObjectProperty: (path) => {
      path.node.key.type === 'Identifier' && keys.add(path.node.key.name)
    }
  })
  // @ts-ignored
  t.is(keys.size, dependency.dependency.vue.bindings.size)
})
  
test('export all with source and re named it with custom', async (t) => {
  const code = 'export * as myVue from \'vue\''
  const { code: actually } = await transformWithBabel(code, dependency)
  const ast = await parse(actually, { babelrc: false, configFile: false })!
  const keys: Set<string> = new Set()
  // @ts-ignored
  await traverse(ast, {
    ObjectProperty: (path) => {
      path.node.key.type === 'Identifier' && keys.add(path.node.key.name)
    }
  })
  // @ts-ignored
  t.is(keys.size, dependency.dependency.vue.bindings.size)
})
  
test('export all declaration', async (t) => {
  const code = 'export * from \'vue\''
  const { code: actually } = await transformWithBabel(code, dependency)
  const ast = await parse(actually, { babelrc: false, configFile: false })!
  let size = 0
  // @ts-ignored
  await traverse(ast, {
    VariableDeclarator: () => {
      size++
    }
  })
  // @ts-ignored
  t.is(size, dependency.dependency.vue.bindings.size)
})
  
test('export with declaration', async (t) => {
  const code = 'import { ref } from \'vue\';\nexport const value = ref(0);'
  const { code: actually } = await transformWithBabel(code, dependency)
  t.is(actually, 'export const value = Vue.ref(0);')
})
  
test('export all module but the current module itself contains duplicated node', async (t) => {
  const code = 'export * from \'vue\';\nexport const version = \'self\';'
  const { code: actually } = await transformWithBabel(code, dependency)
  t.is(/'self'/.test(actually), true)
})
  
test('import sub module', async (t) => {
  const code = 'import { ref } from "vue/dist"; console.log(ref); '
  const { code: actually } = await transformWithBabel(code, dependency)
  t.is(actually, 'console.log(Vue.ref);')
})

test('import default module and export it', async (t) => {
  const code = 'import React from "react";export default React;'
  const { code: actually } = await transformWithBabel(code, dependency)
  t.is(actually, 'var __external__React__ = React;\nexport default __external__React__;')
})
