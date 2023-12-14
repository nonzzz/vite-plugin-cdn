import path from 'path'
import fsp from 'fs/promises'
import fs from 'fs'
import http from 'http'
import test from 'ava'
import { chromium } from 'playwright'
import type { Page } from 'playwright'
import { cdn } from '../dist'

import type { Vite2Instance } from './vite2/interface'
import type { Vite3Instance } from './vite3/interface'
import type { Vite4Instance } from './vite4/interface'
import type { Vite5Instance } from './vite5/interface'

type ViteInstance = Vite2Instance | Vite3Instance | Vite4Instance | Vite5Instance

export interface TestOptions {
  vite: ViteInstance
  pluginOption?: Parameters<typeof cdn>[number],
  plugins: any[]
}

type Server = http.Server & {
  ip: string
}

const defaultWd = __dirname

function prepareAssets(taskName: string, options: TestOptions) {
  const { vite, pluginOption = {}, plugins } = options
  vite.build({
    root: defaultWd,
    build: {
      outDir: path.join(defaultWd, 'dist', taskName)
    },
    logLevel: 'silent',
    plugins: [...plugins, cdn(pluginOption) as any]
  })
}

function createGetter<T>(obj: T, key: string, getter: () => unknown) {
  Object.defineProperty(obj, key, {
    get: getter
  })
}

async function createChromeBrowser(server: Server) {
  const browser = await chromium.launch()
  const page = await browser.newPage()
  const localUrl = server.ip
  page.goto(localUrl)
  
  return { page }
}

function createServer(taskName: string) {
  const server = http.createServer()
  const mime = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'text/javascript'
  }
  const handleRequest = async (req: http.IncomingMessage, res: http.ServerResponse) => {
    const fullPath =
        req.url === '/'
          ? path.join(defaultWd, 'dist', taskName, 'index.html')
          : path.join(defaultWd, 'dist', taskName, req.url)
  
    try {
      const file = await fsp.stat(fullPath)
      if (file.isFile()) {
        const contentType = mime[path.extname(fullPath)] || 'text/plain'
        const readStream = fs.createReadStream(fullPath)
        res.setHeader('Content-Type', contentType)
        res.statusCode = 200
        readStream.pipe(res)
      }
    } catch (error) {
      res.statusCode = 404
      res.end(`404 Not Found: ${req.url}`)
    }
  }
  server.on('request', handleRequest)
  createGetter(server, 'ip', () => {
    const address = server.address()
    if (typeof address === 'string') return address
    return `http://127.0.0.1:${address.port}`
  })
  server.listen(0)
  return { server: server as Server }
}
  
async function expectTestCase(taskName: string, page: Awaited<Page>) {
  const expect1 = new Promise(resolve => {
    page.on('console', (message) => {
      resolve(message.type())
    })
  })

  test(`${taskName} cdn load`, async (t) => t.is(await expect1, 'info'))
}

export async function runTest(taskName: string, options: TestOptions) {
  await prepareAssets(taskName, options)
  await new Promise((resolve) => setTimeout(resolve, 5000))
  const { server } = createServer(taskName)
  const { page } = await createChromeBrowser(server)
  await expectTestCase(taskName, page)
}
