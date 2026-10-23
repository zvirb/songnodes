const js = require('@eslint/js');
const tsParser = require('@typescript-eslint/parser');
const tsPlugin = require('@typescript-eslint/eslint-plugin');
const globals = require('globals');
const tsConfigs = tsPlugin.configs['flat/recommended'].map((config) => ({
  ...config,
  files: ['**/*.ts', '**/*.tsx'],
  languageOptions: {
    ...config.languageOptions,
    parser: tsParser,
    globals: globals.node
  }
}));

module.exports = [
  js.configs.recommended,
  ...tsConfigs,
  {
    ignores: ['dist/**', 'node_modules/**']
  }
];
