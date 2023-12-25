import test from 'ava'
import { unpkg } from '../src/resolver/unpkg'
import { jsdelivr } from '../src/resolver/jsdelivr'
import type { IIFEModuleInfo } from '../src/interface'
import { cdnjs } from '../src/resolver/cdnjs'
import { bootcdn } from '../src/resolver/bootcdn'

test('jsdelivr', (t) => {
  const extra = <IIFEModuleInfo>{
    name: 'fake',
    version: '0.0.0',
    relativeModule: 'dist/fake.js'
  }
  const result = jsdelivr().setup({ extra })
  t.is(result.url, 'https://cdn.jsdelivr.net/npm/fake@0.0.0/dist/fake.js')
  t.is(result.injectTo, 'head-prepend')
  t.is(Object.keys(result.attrs).length, 0)
})

test('upkg', (t) => {
  const extra = <IIFEModuleInfo>{
    name: 'fake',
    version: '0.0.0',
    relativeModule: 'dist/fake.js'
  }
  const result = unpkg().setup({ extra })
  t.is(result.url, 'https://unpkg.com/fake@0.0.0/dist/fake.js')
  t.is(result.injectTo, 'head-prepend')
  t.is(Object.keys(result.attrs).length, 0)
})

test('cdnjs', (t) => {
  const extra = <IIFEModuleInfo>{
    name: 'fake',
    version: '0.0.0',
    relativeModule: '../dist/fake.js'
  }
  const result = cdnjs().setup({ extra })
  t.is(result.url, 'https://cdnjs.cloudflare.com/ajax/libs/fake/0.0.0/fake.js')
  t.is(result.injectTo, 'head-prepend')
  t.is(Object.keys(result.attrs).length, 0)
})

test('bootcdn', (t) => {
  const extra = <IIFEModuleInfo>{
    name: 'fake',
    version: '0.0.0',
    relativeModule: '../dist/fake.js'
  }
  const result = bootcdn().setup({ extra })
  t.is(result.url, 'https://cdn.bootcdn.net/ajax/libs/fake/0.0.0/fake.js')
  t.is(result.injectTo, 'head-prepend')
  t.is(Object.keys(result.attrs).length, 0)
})
