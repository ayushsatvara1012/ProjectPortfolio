import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([globalIgnores(['dist', 'dist-widget', 'public/widget.js']), {
  files: ['**/*.{js,jsx,ts,tsx}'],
  extends: [
    js.configs.recommended,
    reactHooks.configs.flat.recommended,
    reactRefresh.configs.vite,
  ],
  languageOptions: {
    ecmaVersion: 2020,
    globals: globals.browser,
    parserOptions: {
      ecmaVersion: 'latest',
      ecmaFeatures: { jsx: true },
      sourceType: 'module',
    },
  },
  rules: {
    'no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]' }],
    // Discourage stray console.log in production paths; warn/error are kept
    // because the structured-logging hook in error.tsx still uses console.error
    // until a real monitoring backend (Sentry etc.) lands.
    'no-console': ['warn', { allow: ['warn', 'error'] }],
  },
}])
