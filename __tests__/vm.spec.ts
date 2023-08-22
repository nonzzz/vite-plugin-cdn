import test from 'ava'
import { MAX_CONCURRENT, createConcurrentQueue } from '../src/vm'



test('task queue', async (t) => {
  const tasks = [() => Promise.resolve(), () => Promise.resolve(), () => Promise.reject(new Error('3'))]

  const queue = createConcurrentQueue(MAX_CONCURRENT)
  for (const task of tasks) {
    queue.enqueue(task)
  }
  const err = await t.throwsAsync(queue.wait())
  t.is(err?.message, '3')
})
