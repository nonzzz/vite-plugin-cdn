import { version } from 'vue'

export const getVueVersion = () => version

export const getVersion = () => {
  const version = 'version'
  return version
}

const _getVueVersion = () => {
  return version
}

export { _getVueVersion }
