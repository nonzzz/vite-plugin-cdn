import test from 'ava'
import fsp from 'fs/promises'
import path from 'path'
import { build } from 'vite'
import { cdn } from '../dist'
import { getId, sleep } from '../internal/shared'
import type { CDNPluginOptions } from '../dist'

const defaultWd = __dirname
const dist = path.join(defaultWd, 'dist')

export async function mockBuild(dir: string, pluginOptions: CDNPluginOptions = {}) {
  const id = getId()
  await build({
    root: path.join(defaultWd, 'fixtures', dir),
    build: {
      outDir: path.join(dist, id)
    },
    plugins: [cdn(pluginOptions)],
    configFile: false,
    logLevel: 'silent'
  })
  await sleep(5000)
  return id
}

// test.after(async () => {
//   await fsp.rm(dist, { recursive: true })
// })

test('plugin importer case', async (t) => {
  const id = await mockBuild('importer', { modules: ['prettier'] })
  console.log(id)
  t.pass()
})

// test('plugin exporter case', async (t) => {
//   const id = await mockBuild('exporter', { modules: ['prettier'] })
//   console.log(id)
//   t.pass()
// })
