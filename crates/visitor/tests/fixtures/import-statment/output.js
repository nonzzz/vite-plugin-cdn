const vue = Vue;
const onMounted = Vue.onMounted;
const { useAttrs } = Vue;
console.log(Vue.ref);
console.log(Vue.version);
console.log(vue);
function caller() {
    const version = 'in scope';
    console.log(version);
}
caller();