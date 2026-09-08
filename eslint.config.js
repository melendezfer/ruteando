const js = require('@eslint/js');
const prettier = require('eslint-config-prettier');

module.exports = [
  js.configs.recommended,
  prettier,
  {
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: 'commonjs',
      globals: {
        process: 'readonly',
        console: 'readonly',
        module: 'writable',
        require: 'readonly',
        __dirname: 'readonly',
        exports: 'writable',
        Buffer: 'readonly',
      },
    },
    rules: {
      'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
  {
    files: ['tests/**/*.js'],
    languageOptions: {
      globals: {
        describe: 'readonly',
        it: 'readonly',
        expect: 'readonly',
        beforeAll: 'readonly',
        afterAll: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
        jest: 'readonly',
      },
    },
  },
  {
    // Los scripts de k6 corren en el runtime propio de k6 (goja), no en
    // Node — usan sintaxis de módulos ES (import/export) y globals de k6
    // (__ENV), no CommonJS.
    files: ['scripts/loadtest-*.js'],
    languageOptions: {
      sourceType: 'module',
      globals: {
        __ENV: 'readonly',
      },
    },
  },
  {
    ignores: ['node_modules/', 'coverage/'],
  },
];
