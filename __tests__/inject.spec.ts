import test from 'ava'
import { len } from '../src/shared'
import { createInjectScript } from '../dist/inject'
import { jsdelivr } from '../dist/url'
import type { IIFEModuleInfo } from '../src/interface'

test('inject', (t) => {
  const modules:Map<string, IIFEModuleInfo> = new Map()
  modules.set('fake', {
    relativeModule: 'fake.js',
    version: '0.0.0.',
    name: 'fake',
    spare: ['fake.css', 'fake2.css', 'fake2.js']
  })
  const injectScript = createInjectScript(modules, jsdelivr)
  t.is(len(injectScript.toTags()), 4)
})
