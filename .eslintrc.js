module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  extends: ['plugin:@typescript-eslint/recommended', 'kagura'],
  ignorePatterns: ['dist/**/*'],
  rules: {
    '@typescript-eslint/no-var-requires': 0,
    '@typescript-eslint/no-this-alias': 0,
  },
}
