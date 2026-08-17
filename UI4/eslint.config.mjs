/* ESLint flat config.

   The previous build's config declared browser globals by hand and missed
   Event, Image, Headers, atob, AbortController, self, caches… so `npx eslint`
   reported 19 phantom "is not defined" errors. Nobody could tell a real
   problem from the noise, so nobody ran it. This one uses the shared globals
   package and splits browser code from service-worker code.
*/
import globals from 'globals';

const shared = {
  ecmaVersion: 2022,
  sourceType: 'script'
};

const rules = {
  'no-undef': 'error',
  /* Ignored catch bindings are deliberate throughout (private-mode storage,
     best-effort precache, cancelled fetches) and each one carries a comment. */
  'no-unused-vars': ['warn', { args: 'none', caughtErrors: 'none' }],
  'no-unreachable': 'error',
  'no-dupe-keys': 'error',
  'no-duplicate-case': 'error',
  'no-cond-assign': 'error',
  'no-fallthrough': 'error',
  'no-constant-condition': ['warn', { checkLoops: false }],
  'use-isnan': 'error',
  'valid-typeof': 'error',
  eqeqeq: ['warn', 'smart'],
  'no-var': 'off'
};

export default [
  { ignores: ['vendor/**', 'node_modules/**'] },

  {
    files: ['js/**/*.js', 'i18n/**/*.js', '*/**.js', '**/*.js'],
    ignores: ['sw.js', 'vendor/**', 'tools/**'],
    languageOptions: {
      ...shared,
      globals: {
        ...globals.browser,
        L: 'readonly',
        google: 'readonly',
        APP_CONFIG: 'writable',
        StepByPrefs: 'readonly',
        StepByI18n: 'readonly',
        StepByAuth: 'readonly',
        StepByApi: 'readonly',
        StepByUI: 'readonly',
        StepByGeo: 'readonly',
        StepByIcons: 'readonly',
        STEPBY_DICT: 'writable',
        t: 'readonly'
      }
    },
    rules
  },

  {
    files: ['sw.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'script',
      globals: { ...globals.serviceworker }
    },
    rules
  }
];
