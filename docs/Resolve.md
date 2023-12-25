# Resolve

Sometimes preset resolve can't convert most of scence, So you should write your resolve in your local

```js
import { defineResolve } from "vite-plugin-cdn2/resolve";

export const myResolve = defineResolve({
  name: "resolve:custom",
  setup({ extra }) {
    const baseURL = "https://cdnjs.cloudflare.com/ajax/libs/";
    const { version, name, relativeModule } = extra;
    const url = new URL(`${name}/${version}/${relativeModule}`, baseURL);
    return {
      url: url.href,
      injectTo: "head-prepend",
      attrs: {},
    };
  },
});
```
