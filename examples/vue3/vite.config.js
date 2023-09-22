import path from 'path'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { VarletUIResolver } from 'unplugin-vue-components/resolvers'
import Components from 'unplugin-vue-components/vite'
import { cdn } from 'vite-plugin-cdn2'
import { unpkg } from 'vite-plugin-cdn2/url.js'
import { compression } from 'vite-plugin-compression2'
import Inspect from 'vite-plugin-inspect'

export default defineConfig(({ command }) => {
  return {
    plugins: [
      vue(),
      Components({ resolvers: [VarletUIResolver()] }),
      cdn({
        url: 'https://cdn.bootcdn.net/ajax/libs/',
        modules: ['vue', 'vue-demi', 'pinia', 'axios'],
        apply: command,
        resolve(baseURL, { name, version, relativeModule }) {
          if (name === '@varlet/ui') return new URL(`${name}@${version}/${relativeModule}`, unpkg).href
          return new URL(`${name}/${version}/${path.basename(relativeModule)}`, baseURL).href
        }
      }),
      compression({
        algorithm: 'gzip',
        threshold: 3 * 1024
      }),
      Inspect()
    ]
  }
})
