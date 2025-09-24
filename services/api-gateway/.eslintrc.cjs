module.exports = {
  root: true,
  env: { node: true, es2020: true },
  extends: [
    'eslint:recommended',
  ],
  ignorePatterns: ['node_modules', 'package.json'],
  parserOptions: {
    ecmaVersion: 2020,
  },
  rules: {
    // Add any specific rules for this service here
  },
};