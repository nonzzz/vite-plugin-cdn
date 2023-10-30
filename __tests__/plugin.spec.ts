import path from 'path'
import test from 'ava'
import { build } from 'vite'
import { cdn, external } from '../dist'

const defaultWd = __dirname

const fixturePath = path.join(defaultWd, 'fixtures')

test('exteranl plugin', async (t) => {
  const bundle = await build({
    plugins: [external({ include: /\.(mjs|js|ts|vue|jsx|tsx)(\?.*|)$/, modules: [{ name: 'vue', global: 'Vue' }] })],
    logLevel: 'silent',
    build: {
      lib: {
        entry: path.join(fixturePath, 'external-plugin', 'main.js'),
        formats: ['es']
      },
      write: false
    }
  })

  const { code } = bundle[0].output[0]
  const global = /Vue(.)\w+/g
  const [s, s1] = code.match(global)
  t.is(s, 'Vue.defineComponent')
  t.is(s1, 'Vue.createVNode')
})

test('cdn plugin', async (t) => {
  const bundle = await build({
    plugins: [cdn({ modules: [{ name: 'vue' }] })],
    logLevel: 'silent',
    root: path.join(fixturePath, 'cdn-plugin'),
    build: {
      write: false
    }
  })
  // @ts-ignored
  const { output } = bundle
  const chunk = output[0]
  const html = output[1]
  t.is(/Vue/.test(chunk.code), true)
  t.is(/https:\/\/cdn\.jsdelivr\.net\/npm\/vue/.test(html.source), true)
})
