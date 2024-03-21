const { nonzzz } = require('eslint-config-kagura')

module.exports = nonzzz({ 
  ts: true, jsx: true, react: true, unusedImports: false }, 
{ ignores: ['dist', 'node_modules', 'crates/**/output.js']
})
