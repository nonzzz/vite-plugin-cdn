import * as vue from 'vue'
import { ref, version } from 'vue'

console.log(vue.version)

const v = ref(0)

function scoped() {
  const v = 1
  console.log(v)
  console.log(version)
  console.log(vue.version)
}

scoped()

console.log(v)
