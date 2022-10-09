<h1 aligin="center">vite-plugin-cdn2</h1>

A Vite plugin that allowed you replace module with CDN. This plugin is designed to replace
`vite-plugin-cdn`,`vite-plugin-cdn-import`.

<p align="center">
<img src="https://img.shields.io/codecov/c/github/nonzzz/vite-plugin-cdn?style=for-the-badge" alt="Coverage Status" />
<img alt="GitHub Workflow Status" src="https://img.shields.io/github/workflow/status/nonzzz/vite-plugin-cdn/test?style=for-the-badge">
</p>

## Quick Start

### Install

```bash

$ yarn add vite-plugin-cdn2 -D

# or

$ npm install vite-plugin-cdn2 -D

```

### Usage

```typescript
// vite.config.ts

import { defineConfig } from 'vite'

import { cdn } from 'vite-pluginp-cdn2'

export default defineConfig({
  plugins: [
    //  ... your plugin
    cdn({
      isProduction: true,
      modules: [
        {
          name: 'vue',
          global: 'Vue'
        }
      ]
    })
  ]
})
```

### Options

```ts
export type PresetDomain = 'auto' | 'jsdelivr' | 'unpkg' | false

export interface CDNPluginOptions {
  isProduction?: boolean
  modules?: Array<TrackModule>
  /**
   * Preset auto will read the package.json has unpkg or jsdelivr path. If not willn't be
   * repalce. set false you can define spare for each module.
   */
  preset?: PresetDomain
  logInfo?: 'silent' | 'info'
  /**
   * Transform can replace the capture result. and rewrite them.
   */
  transform?: (meta: Transformed) => void
}
```

### Transform Demo

```ts
// vite.config.ts

import { defineConfig } from 'vite'

import { cdn } from 'vite-pluginp-cdn2'

export default defineConfig({
  plugins: [
    //  ... your plugin
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
          spare: [
            'https://cdn.jsdelivr.net/npm/@fect-ui/vue@1.6.1/dist/cjs/fect.umd.js',
            'https://cdn.jsdelivr.net/npm/@fect-ui/vue@1.6.1/dist/cjs/main.css'
          ]
        }
      ],
      preset: fasle,
      transform(result) {
        if (result.tag === 'script') result.defer = true
      }
    })
  ]
})
```

### Acknowledgements

Thanks to [JetBrains](https://www.jetbrains.com/) for allocating free open-source licences for IDEs such as WebStorm.

<p align="right">
<img width="250px" height="250px" src="https://resources.jetbrains.com/storage/products/company/brand/logos/jb_square.png" alt="JetBrains Black Box Logo logo.">
</p>

### LICENSE

[MIT](./LICENSE)
