const js = require('@eslint/js');
const globals = require('globals');

module.exports = [
  js.configs.recommended,
  {
    files: ['**/*.js', '**/*.cjs'],
    languageOptions: {
      sourceType: 'commonjs',
      globals: globals.node
    },
    rules: {
      'no-unused-vars': [
        'error',
        { argsIgnorePattern: '^(?:_|next$)', caughtErrors: 'none' }
      ],
      'no-control-regex': 'off',
      'preserve-caught-error': 'off'
    }
  },
  {
    ignores: ['node_modules/**']
  }
];
