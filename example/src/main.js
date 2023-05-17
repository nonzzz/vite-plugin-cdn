import { createApp } from 'vue'
import { createPinia } from './pinia'
import App from './app.vue'

const pinia = createPinia()

createApp(App).use(pinia).mount('#app')
