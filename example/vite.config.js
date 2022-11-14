import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { cdn } from 'vite-plugin-cdn2'

export default defineConfig({
  plugins: [
    vue(),
    cdn({
      isProduction: true,
      modules: [
        {
          name: 'vue',
          global: 'Vue'
        },
        {
          name: '@fect-ui/vue',
          global: 'fect',
          spare: ['https://cdn.jsdelivr.net/npm/@fect-ui/vue@1.6.1/dist/cjs/main.css']
        }
      ],
      transform(meta) {
        meta.forEach((item) => {
          if (item.name === 'vue') {
            item.url = 'https://cdn.jsdelivr.net/npm/vue@3.2.37/dist/vue.global.prod.js'
          }
        })
      }
    })
  ]
})
