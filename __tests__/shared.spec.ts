import fsp from 'fs/promises'
import test from 'ava'
import { MAX_CONCURRENT, createConcurrentQueue, len, lookup } from '../src/shared'

test('len', (t) => {
  t.is(len('123'), 3)
  t.is(len([1, 2, 3, 4, 5]), 5)
})

test('lookup', async (t) => {
  const modulePath = require.resolve('vue')
  const file = lookup(modulePath, 'package.json')
  const s = await fsp.readFile(file, 'utf8')
  const p = JSON.parse(s)
  t.is(typeof p === 'object', true)
})

test('task queue', async (t) => {
  const tasks = [() => Promise.resolve(), () => Promise.resolve(), () => Promise.reject(new Error('3'))]

  const queue = createConcurrentQueue(MAX_CONCURRENT)
  for (const task of tasks) {
    queue.enqueue(task)
  }
  const err = await t.throwsAsync(queue.wait())
  t.is(err instanceof AggregateError, true)
  t.is((err as AggregateError).errors[0].message, '3')
})
