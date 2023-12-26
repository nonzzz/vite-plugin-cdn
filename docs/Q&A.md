# Q & A

> What plugin is this?

- If you are a webpack or rollup user. you may know `external` option. This plugin more look like
  an aggregate of external and inject.

> Why i using pinia cause panic?

- Of course. Currently `vite-plugin-cdn2` can't know they dependencies. So you should define it by manual.
  Just set "vue-demi" in your modules.

> Why am i getting warnings or errors on my page?

- You should notice it. If it's global name missing. you should define it by manual.`vite-plugin-cdn2` can only
  guess the global name to the greatest extent.

> How to debug it?

- `set DEBUG=vite-plugin-cdn2 & vite`

> Why am i specified the `element-plus` and it still doesn't work?

- Because according `external`. it only find `element-plus` can't find `element-plus/es` or `element-plus/lib` if
  you are using `unplugin-vue-components`. You can try using `patch-package` and add new dependencies for `scanner.dependencies`
  Just look like

```js
await scanner.scanAllDependencies(); //  Add follow code next line

if (scanner.dependencies.has("element-plus")) {
  // If you are using ssr render. set es as lib :)
  scanner.dependencies.set(
    "element-plus/es",
    scanner.dependencies.get("element-plus")
  );
}
```

Or you can set 'aliases' from 'module' by manual.

```js
moudles: [{ name: "element-plus", aliases: ["es", "lib"] }];
```

> How to use it with React?

- Usually most of libraries will provide jsdelivr or unpkg filed but if isn't. You should set `relativeModule` for it.

> Why i can't find any module?

- If you‘re a pnpm user you need to explicitly install the peer dependencies
