module.exports = {
  env: {
    es2022: true,
    node: true,
    jest: true
  },
  globals: {
    before: true,
    after: true
  },
  extends: [
    'standard',
    'prettier',
    'eslint:recommended',
    'plugin:wdio/recommended'
  ],
  overrides: [],
  parserOptions: {
    ecmaVersion: 'latest'
  },
  plugins: ['prettier', 'wdio'],
  rules: {
    'prettier/prettier': 'error',
    'no-console': 'error',
    // SonarCloud (javascript:S121) requires braces on every control statement,
    // unconditionally, where eslint-config-standard does not. Enforcing it here
    // keeps the two in agreement instead of re-flagging each file when touched.
    curly: ['error', 'all']
  }
}
