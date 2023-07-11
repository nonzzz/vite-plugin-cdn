<template>
    <div>
        <p>This is a test case</p>
        <p>{{ value }}</p>
    </div>
</template>

<script>

import { defineComponent, ref, onMounted } from 'vue'

export default defineComponent({
    setup() {

        onMounted(()=>console.log('e2e'))

        const value = ref('test case')
        return { 
            value
        }
    }
})

</script>