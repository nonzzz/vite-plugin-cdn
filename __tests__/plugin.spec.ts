import test from 'ava'
// import path from 'path'
// import { build } from 'vite'
// import { cdn } from '../src'

// test('t', async (t) => {
//   await build({
//     root: path.join(__dirname, 'fixtures', 'dynamic'),
//     plugins: [
//       cdn({
//         modules: [
//           {
//             name: 'prettier',
//             global: 'Prettier',
//             spare: ['https://www.baidu.com']
//           }
//         ]
//       })
//     ]
//   })
//   t.pass()
// })

import { createScanner } from '../src/scanner'

test('scanner', async (t) => {
  const scanner = createScanner([
    {
      name: 'vue',
      global: 'Vue'
    }
  ])

  const code = `
  import vue from 'vue'
  import { ref } from 'vue'
  import { unref } from 'vue'
  import {myRef} from '@core'
  import * as Vue from 'vue'
  import o from 'op'
  `
  scanner.scanAllDependencies('a.js', code)
  t.pass()
})
