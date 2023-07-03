import test from 'ava'
import fsp from 'fs/promises'
import { lookup, len } from '../dist/shared'


test('len', (t) => {
  t.is(len('123'), 3)
  t.is(len([1, 2, 3, 4, 5]), 5)
})

test('lookup', async (t) => {
  const modulePath  = require.resolve('vue')
  const file = lookup(modulePath, 'package.json')
  const s = await fsp.readFile(file, 'utf8')
  const p = JSON.parse(s)
  t.is(typeof p === 'object', true)
})
