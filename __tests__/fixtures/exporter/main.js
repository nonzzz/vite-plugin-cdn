import version, { version as reWriteVersion, prettier } from './exports'

console.log(reWriteVersion)

console.log(prettier.version)
console.log(version)

function scoped() {
  const version = 1
  console.log(version)
  console.log(reWriteVersion)
  console.log(prettier.version)
}

scoped()
