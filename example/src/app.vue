<template>
  <div>
    CDN example
    <fe-spacer :y="1" />
    <fe-button size="mini" auto @click="clickHandler">Button</fe-button>
  </div>
</template>

<script>
import { defineComponent } from 'vue'
import { Toast } from '@fect-ui/vue'

export default defineComponent({
  setup() {
    const clickHandler = () => Toast({ text: 'power by fect & vite-plugin-cdn2' })

    return {
      clickHandler
    }
  }
})
</script>
