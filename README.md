<h1 align="center">
<img src="https://socialify.git.ci/nonzzz/vite-plugin-cdn/image?description=1&descriptionEditable=A%20Vite%20plugin%20that%20allowed%20you%20replace%20module%20with%20CDN.%20&font=KoHo&language=1&logo=https%3A%2F%2Fcamo.githubusercontent.com%2F61e102d7c605ff91efedb9d7e47c1c4a07cef59d3e1da202fd74f4772122ca4e%2F68747470733a2f2f766974656a732e6465762f6c6f676f2e737667&name=1&pattern=Circuit%20Board&theme=Auto" alt="vite-plugin-cdn" width="640" height="320" />
</h1>

<p align="center">
<img src="https://img.shields.io/codecov/c/github/nonzzz/vite-plugin-cdn?style=for-the-badge" alt="Coverage Status" />
</p>

## Install

```bash

$ yarn add vite-plugin-cdn2 -D

# or

$ npm install vite-plugin-cdn2 -D

```

## Usage

```typescript
// vite.config.ts

import { defineConfig } from "vite";

import { cdn } from "vite-plugin-cdn2";

export default defineConfig({
  plugins: [
    //  ... your plugin
    cdn({ modules: ["vue"] }),
  ],
});
```

## Options

| params     | type                        | default                                     | description                                          |
| ---------- | --------------------------- | ------------------------------------------- | ---------------------------------------------------- |
| `include`  | `FilterPattern`             | `/\.(mjs\|js\|ts\|vue\|jsx\|tsx)(\?.*\|)$/` | Include all assets matching any of these conditions. |
| `exlcude`  | `FilterPattern` ß           | `-`                                         | Exclude all assets matching any of these conditions. |
| `modules`  | `Array<IModule \| string> ` | `[]`                                        | Should convert module.                               |
| `logLevel` | `slient\|warn`              | `warn`                                      | Adjust console output verbosity.                     |
| `resolve`  | `ResolveOptions`            | `jsdelivr plugin`                           | URL parser injected into the page.                   |
| `apply`    | `string`                    | `build`                                     | Same as vite apply.                                  |

### Acknowledgements

Thanks to [JetBrains](https://www.jetbrains.com/) for allocating free open-source licences for IDEs such as WebStorm.

<p align="right">
<img width="250px" height="250px" src="https://resources.jetbrains.com/storage/products/company/brand/logos/jb_square.png" alt="JetBrains Black Box Logo logo.">
</p>

### Document

- [Background](./docs/Background.md)
- [How it works](./docs/How-it-works.md)
- [Q & A](./docs/Q&A.md)

### LICENSE

[MIT](./LICENSE)

### Author

Kanno
