import test from 'ava'
import { createScanner } from '../dist/scanner'

async function expectScannerTest() {
  const scanner = createScanner(['vue'])
  await scanner.scanAllDependencies()
  test('scanner dependencies', (t) => {
    t.deepEqual(scanner.dependModuleNames, ['vue'])
  })
}

async function expectScannerError() {
  const scanner = createScanner(['react'])
  test('scanner Error', async (t) => {
    const error = await t.throwsAsync(scanner.scanAllDependencies())
    t.is(error?.message, 'try resolve react failed.')
  })
}

expectScannerTest()

expectScannerError()
