import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import tseslint from 'typescript-eslint'
import nextPlugin from '@next/eslint-plugin-next'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist', 'dist-widget', 'public/widget.js', '.next', 'node_modules']),
  {
    files: ['**/*.{js,jsx,ts,tsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
    ],
    plugins: {
      '@typescript-eslint': tseslint.plugin,
      '@next/next': nextPlugin,
    },
    languageOptions: {
      // TypeScript parser so .ts/.tsx type syntax lints instead of failing to parse.
      parser: tseslint.parser,
      ecmaVersion: 2020,
      globals: { ...globals.browser, ...globals.node },
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    rules: {
      // TS compiler already catches undefined identifiers; core no-undef misfires
      // on type-only references, so defer to tsc (typescript-eslint guidance).
      'no-undef': 'off',
      // Defer to the TS-aware rule: core no-unused-vars misfires on type-only
      // and interface method-signature params.
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]', argsIgnorePattern: '^_' }],
      // Discourage stray console.log in production paths; warn/error are kept
      // because the structured-logging hook in error.tsx still uses console.error
      // until a real monitoring backend (Sentry etc.) lands.
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      // React Compiler hints: these flag many legitimate patterns (SSR mount
      // flags, localStorage/media-query hydration, local accumulators). Kept as
      // warnings to surface without blocking; static-components + exhaustive-deps
      // stay at their recommended severity.
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/immutability': 'warn',
      'react-hooks/refs': 'warn',
      'react-hooks/purity': 'warn',
    },
  },
])
