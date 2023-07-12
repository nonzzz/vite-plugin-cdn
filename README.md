<h1 aligin="center">vite-plugin-cdn2</h1>

A Vite plugin that allowed you replace module with CDN. This plugin is designed to replace
`vite-plugin-cdn`,`vite-plugin-cdn-import`.
Why choose `vite-plugin-cdn2`? Simple conf and usage. The most important thing is that can over
many scenes.

<p align="center">
<img src="https://img.shields.io/codecov/c/github/nonzzz/vite-plugin-cdn?style=for-the-badge" alt="Coverage Status" />
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

import { cdn } from 'vite-plugin-cdn2'

export default defineConfig({
  plugins: [
    //  ... your plugin
    cdn({ modules: ['vue'] })
  ]
})
```

### Options

| params                 | type                                          | default           | description                                                    |
| ---------------------- | --------------------------------------------- | ----------------- | -------------------------------------------------------------- |
| `include`              | `string \| RegExp \| Array<string \| RegExp>` | `/\.(mjs|js|ts|vue|jsx|tsx)(\?.*|)$/`               | Include all assets matching any of these conditions.           |
| `exclude`              | `string \| RegExp \| Array<string \| RegExp>` | `-`               | Exclude all assets matching any of these conditions.           |
| `url`            | `string`                                      | `jsdelivr`               | cdn source url    |
| `modules`            | `Array<string>\| Array<TrackModule>`                           | `[]`            | modules to be processed                                    |
| `transform`   | `()=>InjectVisitor`                          | `-`              | Transform can replace the capture result. and rewrite them. |
| `logLevel`             | `'slient'|'warn'`                                      | `warn` |  Adjust console output verbosity                                   |


### Acknowledgements

Thanks to [JetBrains](https://www.jetbrains.com/) for allocating free open-source licences for IDEs such as WebStorm.

<p align="right">
<img width="250px" height="250px" src="https://resources.jetbrains.com/storage/products/company/brand/logos/jb_square.png" alt="JetBrains Black Box Logo logo.">
</p>


### Document

- [Background](./docs/Background.md)
- [How it works](./docs/How-it-works.md)

### LICENSE

[MIT](./LICENSE)

### Author

Kanno
