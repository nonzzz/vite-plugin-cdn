# Modules

Module accept `string[]` or `IModule[]`. 

## String

When you pass `string[]` it will be transform as `IModule[]`


## IModule

- name (package entry name)
- global (pacakge global name)
- spare (links that need to be bind to the page)
- relativeModule (If scanner error, try it)
- resolve (preset source convert)
- aliases (sub module name)