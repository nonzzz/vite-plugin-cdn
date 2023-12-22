import test from 'ava'
import { len } from '../src/shared'
import { createInjectScript } from '../src/inject'
import { jsdelivr } from '../src/resolver/jsdelivr'
import type { TrackModule } from '../src'

interface MockIIFEMdoule extends TrackModule {
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
    spare: [{ url: 'fake.css' }, { url: 'fake2.css' }, { url: 'fake3.js' }],
    bindings: new Set()
  })
  const injectScript = createInjectScript(modules, jsdelivr())
  t.is(len(injectScript.tagDescriptors), 4)
})
