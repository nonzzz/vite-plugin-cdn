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

## Options

- [`include`](#include)
- [`exclude`](#exclude)
- [`modules`](#modules)
- [`url`](#url)
- [`transform`](#transform)
- [`logLevel`](#logLevel)

### include

Type:

```ts

type FilterPattern = ReadonlyArray<string | RegExp> | string | RegExp | null

```
Default: `/\.(mjs|js|ts|vue|jsx|tsx)(\?.*|)$/`

Include all assets matching any of these conditions.

### exclude

Type:

```ts

type FilterPattern = ReadonlyArray<string | RegExp> | string | RegExp | null

```
Default: `undefined`

Exclude all assets matching any of these conditions.

### modules

Type:

```ts

interface TrackModule {
  name: string
  global?: string
  spare?: Array<string> | string 
  relativeModule?: string
}

type ResolverFunction = (p: string, extra: IIFEModuleInfo)=> string

interface IModule extends TrackModule{
  resolve: string | ResolverFunction
}

type Modules = Array<IModule | string>

```
Default: `[]`

Modules to be processed. Details see [Modules](./docs/Modules.md).

### url

Type: string

Default: `https://cdn.jsdelivr.net/npm/`

CDN url. Details see [URL](./docs/URL.md).

### transform

Type: 

```ts

interface InjectVisitor {
  script?: (node: ScriptNode)=> void
  link?: (node: LinkNode)=> void
}

type Trasnform = ()=> InjectVisitor

```

Default: `undefined`

Transform is a overwrite.

### logLevel 

Type: `slient` | `warn`

Default: `warn`

Adjust console output verbosity

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
