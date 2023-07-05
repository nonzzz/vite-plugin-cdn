import test from 'ava'
import { parse, traverse } from '@babel/core'
import { createCodeGenerator } from '../dist/code-gen'
import { createScanner } from '../dist/scanner'
import type { ModuleInfo } from '../src/interface'


test('filter', async (t) => {
  const code = `
     import { ref } from 'vue';
     const v = ref(0)
    `
  const dependencies:Map<string, ModuleInfo> = new Map()
  const codeGen = createCodeGenerator()
  dependencies.set('vue', {
    name: 'vue',
    global: 'Vue',
    version: '0.0.0',
    relativeModule: '',
    bindings: new Set()
  })
  codeGen.injectDependencies(dependencies)
  t.is(codeGen.filter(code, 'mock.js'), true)
})

test('scope', async (t) => {
  const code = 'import { version } from \'vue\';\n console.log(version);\n function t() { const version = 3;\n console.log(version) }'
  const scanner = createScanner(['vue'])
  await scanner.scanAllDependencies()
  const codeGen = createCodeGenerator()
  codeGen.injectDependencies(scanner.dependencies)
  const res = await codeGen.transform(code)
  t.is(res.code, 'console.log(Vue.version);\nfunction t() {\n  const version = 3;\n  console.log(version);\n}')
})

test('exports loose source', async (t) => {
  const code = 'import { version } from \'vue\';\n export { version };\n'
  const scanner = createScanner(['vue'])
  await scanner.scanAllDependencies()
  const codeGen = createCodeGenerator()
  codeGen.injectDependencies(scanner.dependencies)
  const res = await codeGen.transform(code)
  t.is(res.code, 'export const version = Vue.version;')
})

test('exports loose source and re named exported name', async (t) => {
  const code = 'import { version } from \'vue\';\n export { version, version as default };\n'
  const scanner = createScanner(['vue'])
  await scanner.scanAllDependencies()
  const codeGen = createCodeGenerator()
  codeGen.injectDependencies(scanner.dependencies)
  const res = await codeGen.transform(code)
  t.is(res.code, 'export const version = Vue.version;\nexport default Vue.version;')
})

test('exports with source', async (t) => {
  const code = 'export { ref , version } from \'vue\''
  const scanner = createScanner(['vue'])
  await scanner.scanAllDependencies()
  const codeGen = createCodeGenerator()
  codeGen.injectDependencies(scanner.dependencies)
  const res = await codeGen.transform(code)
  t.is(res.code, 'export const ref = Vue.ref,\n  version = Vue.version;')
})

test('exports with source and re named local name', async (t) => {
  const code = 'export { default as myVue, version } from \'vue\''
  const scanner = createScanner(['vue'])
  await scanner.scanAllDependencies()
  const codeGen = createCodeGenerator()
  codeGen.injectDependencies(scanner.dependencies)
  const res = await codeGen.transform(code)
  if (!res.code) return
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const ast = await parse(res.code, { babelrc: false, configFile: false })!
  const keys:Set<string> = new Set()
  await traverse(ast, {
    ObjectProperty: {
      enter: (path) => {
        path.node.key.type === 'Identifier' && keys.add(path.node.key.name)
      }

    }
  })
  t.is(keys.size, scanner.dependencies.get('vue').bindings.size)
})

test('exports with source and re named exported name', async (t) => {
  const code = 'export { version as default , ref } from \'vue\''
  const scanner = createScanner(['vue'])
  await scanner.scanAllDependencies()
  const codeGen = createCodeGenerator()
  codeGen.injectDependencies(scanner.dependencies)
  const res = await codeGen.transform(code)
  t.is(res.code, 'export const ref = Vue.ref;\nexport default Vue.version;')
})
