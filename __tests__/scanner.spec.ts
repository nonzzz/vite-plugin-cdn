import test from 'ava'
import { createScanner } from '../dist/scanner'

function expectScannerTest() {
  const scanner = createScanner(['vue'])
  test('scanner dependencies', async (t) => {
    await scanner.scanAllDependencies()
    t.is(scanner.dependencies.has('vue'), true)
  })
}

function expectScannerFailed() {
  const scanner = createScanner(['vue', 'react'])
  test('scanner failed', async  (t) => {
    await scanner.scanAllDependencies()
    t.is(scanner.failedModule.has('react'), true)
    t.is(scanner.dependencies.has('vue'), true)
  })
}

expectScannerTest()

expectScannerFailed()
