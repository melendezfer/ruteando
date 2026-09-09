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
    // client/ es un proyecto Next.js aparte, con su propia configuración
    // de ESLint (client/eslint.config.mjs, flat config vía
    // eslint-config-next) y su propio node_modules — sin este ignore,
    // `eslint .` desde la raíz también intenta analizar client/ y
    // termina cargando el eslint-plugin-react de client/node_modules
    // contra el ESLint (versión distinta) instalado en la raíz, lo que
    // revienta con un TypeError de incompatibilidad de API
    // (contextOrFilename.getFilename is not a function) en vez de dar un
    // error de lint real. El lint de client/ corre aparte, con `npm run
    // lint` parado en client/ (su propio eslint.config.mjs, su propio
    // ESLint) — no está cableado en .github/workflows/ci.yml todavía.
    ignores: ['node_modules/', 'coverage/', 'client/'],
  },
];
