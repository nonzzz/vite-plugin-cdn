import test from 'ava'
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

test('transform', async (t) => {
  const code = `
   import { ref } from 'vue';
   function useState (val) {
     const state = ref(val);
     const dispatch = (next) => {
        state.value =  typeof next === 'function' ? next(state.value) : next;
     }
     return [state,dispatch];
   }
   const [visible,setVisible] = useState(false);
  `
  const scanner = createScanner(['vue'])
  await scanner.scanAllDependencies()
  const codeGen = createCodeGenerator()
  codeGen.injectDependencies(scanner.dependencies)
  //   const res = await codeGen.transform(code)
  //   t.is(res.code, '')
  t.pass()
})
