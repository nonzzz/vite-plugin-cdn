<template>
  <div>
    <p>vite-plugin-cdn2 example</p>
    <p>{{ counter.count }}</p>
    <var-button size="mini" auto @click="clickHandler">Button</var-button>
  </div>
</template>

<script>
import { defineComponent } from 'vue'
import { useCounterStore } from './counter'

export default defineComponent({
  setup() {
    const counter = useCounterStore()
    const clickHandler = () => {
      console.log('hello world')
      counter.increment()
    }

    return {
      clickHandler,
      counter
    }
  }
})
</script>
