import version, { version as reWriteVersion, prettier } from './exports'

console.log(version)

console.log(reWriteVersion)

console.log(prettier.version)

function scoped() {
  const version = 1
  console.log(version)
  console.log(reWriteVersion)
  console.log(prettier.version)
}

scoped()
