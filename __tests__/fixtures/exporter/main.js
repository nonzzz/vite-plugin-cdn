import version,{ version as _version,vue } from './exports'

console.log(version)
console.log(_version)
console.log(vue.version)

function scoped(){
  const version = 1
  console.log(version)
  console.log(_version)
  console.log(vue.version)
}

scoped()
