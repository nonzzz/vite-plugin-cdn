import test from 'ava'
import { ParserModuleStruct } from '../src/dom'
import type { Transformed, TrackModule } from '../src/interface'

const mockTransformHook = (origianl: Array<TrackModule>, invork: (meta: Transformed) => void | Transformed) => {
  const latest = new Map(origianl.map((o) => [o.global, o] as [string, Required<TrackModule>]))
  const struct = new ParserModuleStruct(latest)
  let { modules } = struct
  const re = invork(modules)
  if (re) modules = re
  struct.modules = modules
  return struct.toString()
}

test('transform hook called with result', (t) => {
  const str = mockTransformHook(
    [
      {
        name: 'vue',
        global: 'Vue',
        spare: ['https://www.test/prod.js', 'https://www.test/prod.js']
      }
    ],
    (meta) => {
      return meta.map((item) => {
        if (item.tag === 'script') {
          item.async = true
          item.defer = true
          item.type = 'text/javascript'
        }
        return item
      })
    }
  )
  t.is(str, '<script async defer type="text/javascript"  src="https://www.test/prod.js"></script>\n')
})

test('transform hook called with void', (t) => {
  const str = mockTransformHook(
    [
      {
        name: 'test',
        global: 'Test',
        spare: 'favicon.ico'
      }
    ],
    (meta) => {
      meta.forEach((item) => {
        if (item.tag === 'link') item.rel = 'icon'
      })
    }
  )
  t.is(str, '<link rel="icon"  href="favicon.ico" />\n')
})
