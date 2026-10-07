import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'

export default [
  // The backend under server/ is a separate package with its own runtime
  // (Node globals, no React); this config only covers the Vite frontend.
  //
  // nashik-monitor-v2-master/ is the reference map project we port data and
  // layer definitions from. It is a complete, separate codebase with its own
  // tooling and browser globals this config does not declare, so linting it
  // here would report hundreds of errors we did not write and must not fix.
  { ignores: ['dist', 'node_modules', 'server', 'nashik-monitor-v2-master'] },
  js.configs.recommended,
  reactHooks.configs.flat['recommended-latest'],
  reactRefresh.configs.vite,
  {
    files: ['**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 'latest',
      globals: { ...globals.browser },
      parserOptions: { ecmaFeatures: { jsx: true }, sourceType: 'module' },
    },
    rules: {
      'no-unused-vars': ['warn', { varsIgnorePattern: '^[A-Z_]', ignoreRestSiblings: true }],
    },
  },
  {
    // Provider + hook and toast + hook live together by design.
    files: ['src/context/**/*.jsx', 'src/components/ui/Toast.jsx'],
    rules: { 'react-refresh/only-export-components': 'off' },
  },
]
