import test from 'ava'
import { createScanner } from '../dist'

async function expectScannerTest() {
  const scanner = createScanner(['prettier'])
  await scanner.scanAllDependencies()
  test('scanner dependencies', (t) => {
    t.deepEqual(scanner.dependModuleNames, ['prettier'])
  })
}

expectScannerTest()
