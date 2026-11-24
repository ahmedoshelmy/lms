// @ts-check
const eslint = require('@eslint/js');
const tseslint = require('typescript-eslint');
const angular = require('angular-eslint');

module.exports = tseslint.config(
  {
    ignores: ['dist/**', '.angular/**', 'node_modules/**', 'coverage/**'],
  },
  {
    files: ['**/*.ts'],
    extends: [
      eslint.configs.recommended,
      ...tseslint.configs.recommended,
      ...angular.configs.tsRecommended,
    ],
    processor: angular.processInlineTemplates,
    rules: {
      '@angular-eslint/directive-selector': [
        'error',
        { type: 'attribute', prefix: 'app', style: 'camelCase' },
      ],
      '@angular-eslint/component-selector': [
        'error',
        { type: 'element', prefix: 'app', style: 'kebab-case' },
      ],
      // Known debt, tracked in docs/frontend-roadmap.md. Warnings, so CI fails
      // on new errors without blocking on what is already there. Each moves to
      // "error" when its task is done.
      '@typescript-eslint/no-explicit-any': 'warn', // F-08
    },
  },
  {
    files: ['**/*.html'],
    extends: [...angular.configs.templateRecommended, ...angular.configs.templateAccessibility],
    rules: {
      // `!= null` is used on purpose to cover null and undefined together.
      '@angular-eslint/template/eqeqeq': ['error', { allowNullOrUndefined: true }],
      // PrimeNG's pButton draws its text from the `label` input.
      '@angular-eslint/template/elements-content': ['error', { allowList: ['label'] }],
      // Known debt, as above.
      '@angular-eslint/template/label-has-associated-control': 'warn', // A-04
      '@angular-eslint/template/click-events-have-key-events': 'warn', // A-03
      '@angular-eslint/template/interactive-supports-focus': 'warn', // A-03
      '@angular-eslint/template/prefer-control-flow': 'error', // done in F-05
    },
  }
);
