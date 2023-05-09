import prettier from 'prettier'
import { version, doc } from 'prettier'

console.log(prettier.version)
console.log(version)

console.log(doc)

function scoped() {
  const doc = 1
  const version = 2
  console.log(doc, version)
}

scoped()
