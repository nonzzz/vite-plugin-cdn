import { defineConfig } from 'vite'
import React from '@vitejs/plugin-react'
import Inspect from 'vite-plugin-inspect'
import { cdn } from 'vite-plugin-cdn2'

export default defineConfig(({ command }) => {
  return {
    plugins: [React(), cdn({
      modules: [
        { name: 'react', relativeModule: './umd/react.production.min.js' },
        { name: 'react-dom', relativeModule: './umd/react-dom.production.min.js', aliases: ['client'] }
      ],
      apply: command
    }), Inspect()]
  }
})
