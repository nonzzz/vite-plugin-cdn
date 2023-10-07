import { createVNode, defineComponent } from 'vue'

export default defineComponent({
  name: 'Button',
  setup(_, { slots }) {
    return () => createVNode('button', null, slots)
  }
})
