import { createApp, createVNode, defineComponent } from 'vue'

const App = defineComponent({
  name: 'Application',
  setup() {
    return () => createVNode('div', null, 'hello world')
  }
})

createApp(App).mount('#app')

export * from 'vue'
const version = 'cdn-plugin-test-version'
export { version }
