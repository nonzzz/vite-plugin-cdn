import test from 'ava'
import { len } from '../src/shared'
import { createInjectScript } from '../src/inject'
import type { IIFEModuleInfo } from '../src/interface'

test('inject mode auto', (t) => {
  const modules: Record<string, IIFEModuleInfo> = {
    fake: {
      name: 'fake',
      jsdelivr: undefined,
      unpkg: 'fake.js',
      version: '0.0.0',
    },
  }
  const inject = createInjectScript(modules, Object.keys(modules), 'auto')
  t.is(inject.toTags()[0], '<script src="https://unpkg.com/fake@0.0.0/fake.js"></script>')
})

test('inject mode jsdelivr', (t) => {
  const modules: Record<string, IIFEModuleInfo> = {
    fake: {
      name: 'fake',
      jsdelivr: 'fake.js',
      unpkg: 'fake.js',
      version: '0.0.0',
    },
  }
  const inject = createInjectScript(modules, Object.keys(modules), 'jsdelivr')
  t.is(inject.toTags()[0], '<script src="https://cdn.jsdelivr.net/npm/fake@0.0.0/fake.js"></script>')
})

test('inject mode unpkg', (t) => {
  const modules: Record<string, IIFEModuleInfo> = {
    fake: {
      name: 'fake',
      jsdelivr: 'fake.js',
      unpkg: 'fake.js',
      version: '0.0.0',
    },
  }
  const inject = createInjectScript(modules, Object.keys(modules), 'unpkg')
  t.is(inject.toTags()[0], '<script src="https://unpkg.com/fake@0.0.0/fake.js"></script>')
})

test('inject with spare', (t) => {
  const modules: Record<string, IIFEModuleInfo> = {
    fake: {
      name: 'fake',
      jsdelivr: 'fake.js',
      unpkg: 'fake.js',
      version: '0.0.0',
    },
    fakeUI: {
      name: 'fakeUI',
      jsdelivr: 'ui.js',
      unpkg: 'ui.js',
      spare: ['ui.css', 'theme.css', 'ui2.js'],
      version: '1.0.0',
    },
  }
  const inject = createInjectScript(modules, Object.keys(modules), 'auto')
  t.is(len(inject.toTags()), 5)
  t.is(len(inject.toTags().filter((s) => s.startsWith('<link'))), 2)
})
