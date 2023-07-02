import test from 'ava'
import { createScanner } from '../dist/scanner'

async function expectScannerTest() {
  const scanner = createScanner(['vue'])
  await scanner.scanAllDependencies()
  test('scanner dependencies', (t) => {
    t.is(scanner.dependencies.has('vue'), true)
  })
}

async function expectScannerFailed() {
  const scanner = createScanner(['vue', 'react'])
  await scanner.scanAllDependencies()
  test('scanner failed',  (t) => {
    t.is(scanner.failedModule.has('react'), true)
    t.is(scanner.dependencies.has('vue'), true)
  })
}

expectScannerTest()

expectScannerFailed()
