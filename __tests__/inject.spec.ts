import test from 'ava'
import { createInjectScript } from '../src/inject'

test('inject script auto mode', (t) => {
  const inject = createInjectScript(
    {
      prettier: {
        name: 'pretteir',
        jsdelivr: 'a.js',
        unpkg: 'b.js',
        globalName: 'prettier',
        version: '0.0.0',
        spare: ['c.js', 'd.css']
      }
    },
    'auto'
  )
  inject.inject('', () => {
    return {
      script(node) {
        // console.log(node)
      },
      link(node) {}
    }
  })
  t.pass()
})
