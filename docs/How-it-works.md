# How it works

None of this is needed to use the library, it's purely for understanding how it works.

## Scanner Modules

To be able to generate `modules`. `vite-plugin-cdn2` will create a scanner at `configResolved` hook. It' will create a new threads to record
the package infomation.(So your local environment need support threads).


### Input 

```js

const s = ['vue']

```

### Output

```js

const s = {
    vue: {
        name: 'vue',
        global: 'Vue',
        // ... other info
    }
}

```

## Transform 

The reason to `vite-plugin-cdn2` can support `export * from 'module'` is because that scanner stage can record all of the package bindings.(All export function or variable).

### Input

```js

export * from 'vue'
export const ref = 1

```

### Output


```js

export const { onMounted: Vue.onMounted, .... } = Vue // ingored ref because it was been rewrite

export const ref = 1

```

## Binding Source

all of url will generate html element and binding it at `transformIndexHtml`