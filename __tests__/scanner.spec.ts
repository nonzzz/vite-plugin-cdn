import test from 'ava'
import { createScanner } from '../dist/scanner'


test('scanner dependencies', async (t) => {
  const scanner = createScanner(['vue'])
  await scanner.scanAllDependencies()
  t.is(scanner.dependencies.has('vue'), true)
})  

test('scanner failed', async  (t) => {
  const scanner = createScanner(['vue', 'react'])
  await scanner.scanAllDependencies()
  t.is(scanner.failedModules.has('react'), true)
  t.is(scanner.dependencies.has('vue'), true)
})
