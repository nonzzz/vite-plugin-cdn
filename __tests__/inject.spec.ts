import test from 'ava'
import { len } from '../src/shared'
import { createInjectScript } from '../src/inject'
import { jsdelivr } from '../src/url'
import type { TrackModule } from '../src'

interface MockIIFEMdoule extends TrackModule{
  relativeModule: string
  version: string
  bindings: Set<string>
}

test('inject', (t) => {
  const modules: Map<string, MockIIFEMdoule> = new Map()
  modules.set('fake', {
    relativeModule: 'fake.js',
    version: '0.0.0.',
    name: 'fake',
    spare: ['fake.css', 'fake2.css', 'fake2.js'],
    bindings: new Set()
  })
  const injectScript = createInjectScript(modules, jsdelivr)
  t.is(len(injectScript.toTags()), 4)
})
