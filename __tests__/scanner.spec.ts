import test from 'ava'
import { createScanner } from '../dist/scanner'


test('scanner dependencies', async (t) => {
  const scanner = createScanner(['vue'])
  await scanner.scanAllDependencies()
  t.is(scanner.dependencies.has('vue'), true)
})  

test('scanner failed', async (t) => {
  const scanner = createScanner(['vue', 'react'])
  await scanner.scanAllDependencies()
  t.is(scanner.failedModules.has('react'), true)
  t.is(scanner.dependencies.has('vue'), true)
})


test('scanner with resolver', async (t) => {
  const scanner = createScanner([{ name: 'vue', resolve: (p) => p }])
  await scanner.scanAllDependencies()
  t.is(typeof scanner.dependencies.get('vue').resolve === 'function', true)
})
