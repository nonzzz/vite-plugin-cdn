import { version } from 'prettier'

export const getPrettierVersion = () => version

export const getVersion = () => {
  const version = 'version'
  return version
}

const _getPrettierVersion = () => {
  return version
}

export { _getPrettierVersion }
