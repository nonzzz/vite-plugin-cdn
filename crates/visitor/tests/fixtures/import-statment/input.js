import { ref, version } from 'vue'
import * as vue from 'vue'

const onMounted = vue.onMounted

const [s, s1] = [1, 2]

const { useAttrs } = vue

console.log(ref)

console.log(version)

console.log(vue)

function caller() {
  const version = 'in scope'
  console.log(version)
}

caller()
