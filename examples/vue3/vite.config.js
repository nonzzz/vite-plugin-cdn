import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { VarletUIResolver } from 'unplugin-vue-components/resolvers'
import Components from 'unplugin-vue-components/vite'
import { cdn } from 'vite-plugin-cdn2'
import { cdnjs } from 'vite-plugin-cdn2/resolver/cdnjs'
import { compression } from 'vite-plugin-compression2'
import Inspect from 'vite-plugin-inspect'

export default defineConfig(({ command }) => {
  return {
    plugins: [
      vue(),
      Components({ resolvers: [VarletUIResolver()] }),
      cdn({
        modules: ['vue', 'vue-demi', 'pinia', 'axios'],
        apply: command,
        resolve: cdnjs()
      }),
      compression({
        algorithm: 'gzip',
        threshold: 3 * 1024
      }),
      Inspect()
    ]
  }
})
