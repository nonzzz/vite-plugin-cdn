import test from 'ava'
import { ParserModuleStruct } from '../src/dom'
import type { TrackModule } from '../src/interface'

const mockModuleResult = (modules: Array<TrackModule>) => {
  const latest = new Map(modules.map((o) => [o.global, o] as [string, Required<TrackModule>]))
  const parser = new ParserModuleStruct(latest)
  return parser
}

test('script', (t) => {
  const r = mockModuleResult([
    {
      name: 'vue',
      global: 'Vue',
      spare: ['https://www.test/prod.js', 'https://www.test/prod.js']
    }
  ])
  r.format()
  t.deepEqual(r.modules, [
    {
      tag: 'script',
      url: 'https://www.test/prod.js',
      name: 'vue'
    }
  ])
  const str = r.toString()
  t.is(str, '<script  src="https://www.test/prod.js"></script>\n')
})

test('dyanmic script', (t) => {
  const r = mockModuleResult([])
  r.modules = [
    {
      tag: 'script',
      name: 'Test',
      url: 'https://www.test/prod.js'
    }
  ]
  const str = r.toString()
  t.is(str, '<script  src="https://www.test/prod.js"></script>\n')
})

test('link', (t) => {
  const r = mockModuleResult([
    {
      name: '@fect-ui/vue',
      global: 'fect',
      spare: ['https://www.test/fect.js', 'https://www.test/fect.css']
    }
  ])
  r.format()
  t.deepEqual(r.modules, [
    {
      tag: 'script',
      name: '@fect-ui/vue',
      url: 'https://www.test/fect.js'
    },
    {
      rel: 'stylesheet',
      tag: 'link',
      name: '@fect-ui/vue',
      url: 'https://www.test/fect.css'
    }
  ])
  const str = r.toString()
  t.is(
    str,
    '<script  src="https://www.test/fect.js"></script>\n<link rel="stylesheet" href="https://www.test/fect.css" />\n'
  )
})
