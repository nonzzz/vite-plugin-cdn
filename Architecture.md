# Architecture


## Foreword

`vite-plugin-cdn2` is a plugin that can solves as many problems as possible.

It can replace `vite-pluigin-cdn` & `vite-plugin-cdn-importer`. Because they don't support `export * from 'module'`.
This is a very ticky case.

Look at the follow case:


```javascript

export * from 'vue'

function version () {
   retrun 3
}


export function getVersion() {

  return version

}


export function _getVersion() {

  return version

}

```

To be honestly. If we handle this case the `version` should be renamed.


```javascript 

export * from 'moduleA'

export * from 'moduleB'


```

They all export a module called `version`. Normally. we rewrite the syntax as named export and purge.
But if we can't handle the first case this behavoir is meaningless.


## How it's work?

`vite-plugin-cdn2` is a light plugin to convert your application code and bind the cdn resource.
First. plugin will scanner your module. and find the global name then to the next stage. 
transform your code and apply the cdn resouce.


## Advice

Use `export * from 'module'` as less as possible. If you want to do this,You can split them into 2 files.Don't export the same module (It just a suggestion)