import test from 'ava'
import { createScanner } from '../src/scanner'

test('scan all dependencies', async (t) => {
  const scanner = createScanner(['prettier'], 'auto')
  await scanner.scanAllDependencies()
  t.is(Object.keys(scanner.bindings), ['prettier'])
  t.is(scanner.bindings['prettier']['version'], '2.8.7')
})
