module.exports = {
  extends: ['kagura/typescript'],
  rules: {
    '@typescript-eslint/space-infix-ops': 'error',
    '@typescript-eslint/type-annotation-spacing': ['error', {
      before: false,
      after: true
    }]
  }
}
