# Background

`vite-plugin-cdn2` is a vite plugin that can replace `vite-plugin-cdn`,`vite-plugin-cdn2` or others same as package.

## Principles

### Cover as many scenes as possible

Un like other plugins. `vite-plugin-cdn2` can cover as many scenes as possbile. Such as `export * from 'module'`

### Friendy Options

If you are using `vite-plugin-cdn-import` you may write the follow option look like:

```js

import importToCDN from 'vite-plugin-cdn-import'

importToCDN({modules: [{ name: 'react', var: 'React' , path: 'umd/react.production.min.js' }] })

```

But now when you migrate to `vite-plugin-cdn2`, you only need


```js

import { cdn } from 'vite-plugin-cdn2'

cdn({modules: ['react'] })

```

## Tradeoffs

### Don't support dynamic import

```js

async function dynamicImport () {
    const react = import('react')
    return react
}

```

In most of case, we won't use dynamic import to introduce some libraries.

### Use export all as little as possible

Although we support `export * from 'module'`. But in most of case we don't encourage
users to use it. Because it's a long transform task. And we only handle the duplicate node(Just remove duplicate node)
