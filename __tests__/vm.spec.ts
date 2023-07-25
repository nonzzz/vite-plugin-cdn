import test from 'ava'
import { MAX_CONCURRENT, createConcurrentQueue, createVM } from '../src/vm'

test('native vm', async (t) => {
  const vm = createVM()
  await vm.run('var nonzzz = \'test plugin\'', { name: 'nonzzz' } as any, (err) => err)
  t.is(vm.bindings.has('nonzzz'), true)
})

test('shadow vm', async (t) => {
  const vm = createVM()
  await vm.run('window.nonzzz = 123', { name: 'nonzzz' } as any, (err) => err)
  t.is(vm.bindings.has('nonzzz'), true)
})

test('throw error in vm', async (t) => {
  const vm = createVM()
  await vm.run('throw new Error(\'error\')', { name: 'nonzzz' } as any, (err) => {
    t.is(err?.message, 'nonzzz')
  })
})

test('task queue', async (t) => {
  const tasks = [() => Promise.resolve(), () => Promise.resolve(), () => Promise.reject(new Error('3'))]

  const queue = createConcurrentQueue(MAX_CONCURRENT)
  for (const task of tasks) {
    queue.enqueue(task)
  }
  const err = await t.throwsAsync(queue.wait())
  t.is(err?.message, '3')
})
