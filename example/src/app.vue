<template>
  <div>
    <p>vite-plugin-cdn2 example</p>
    <p>{{ counter.count }}</p>
    <var-button size="mini" auto @click="clickHandler">Button</var-button>
    <p>This is a mock data</p>
    <p>{{ mock?.title }}</p>
    <var-button size="mini" auto @click="handleRequest">Button</var-button>
  </div>
</template>

<script>
import { defineComponent } from 'vue'
import axios from 'axios'
import { useCounterStore } from './counter'
import ref, { onMounted, version } from './api'

export default defineComponent({
  setup() {
    const mock = ref({ title: 'Init Titlte' })
    const counter = useCounterStore()

    onMounted(() => {
      console.log('hello world')
      console.log(version)
    })

    const clickHandler = () => {
      console.log('hello world')
      counter.increment()
    }

    const handleRequest = async () => {
      try {
        const r = await axios.get('https://jsonplaceholder.typicode.com/todos/1')
        if (r.data) {
          mock.value = r.data
        }
      } catch (error) {}
    }

    return {
      clickHandler,
      handleRequest,
      counter,
      mock
    }
  }
})
</script>
