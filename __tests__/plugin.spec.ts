import test from 'ava'
import fsp from 'fs/promises'
import path from 'path'
import { build } from 'vite'
import { cdn } from '../dist'
import type { CDNPluginOptions } from '../dist'

function sleep(delay: number) {
  return new Promise((resolve) => setTimeout(resolve, delay))
}

function getId() {
  return Math.random().toString(32).slice(2, 10)
}


const defaultWd = __dirname
const dist = path.join(defaultWd, 'dist')

export async function mockBuild(dir: string, pluginOptions: CDNPluginOptions = {}) {
  const id = getId()
  await build({
    root: path.join(defaultWd, 'fixtures', dir),
    build: {
      outDir: path.join(dist, `${dir}-${id}`)
    },
    plugins: [cdn(pluginOptions)],
    configFile: false,
    logLevel: 'silent'
  })
  await sleep(5000)
  return id
}

test.after(async () => {
  await fsp.rm(dist, { recursive: true })
})

test('plugin importer case', async (t) => {
  await mockBuild('importer', { modules: ['vue'] })
  t.pass()
})

test('plugin exporter case', async (t) => {
  await mockBuild('exporter', { modules: ['vue'] })
  t.pass()
})

test('plugin named exporter case', async (t) => {
  await mockBuild('name-export', { modules: ['vue'] })
  t.pass()
})
