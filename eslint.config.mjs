import babelParser from '@babel/eslint-parser';
import js from '@eslint/js';

const sharedRules = {curly: ['error', 'all'], eqeqeq: ['error', 'always'], 'no-eval': 'error', 'no-implied-eval': 'error', 'no-new-wrappers': 'error', 'no-var': 'error', 'prefer-const': 'error'};
// Globals Node provides to tests, benchmarks and scripts (listed inline to avoid a dependency just for this).
const nodeGlobals = Object.fromEntries([
  'AbortController', 'Buffer', 'CustomEvent', 'Event', 'EventTarget', 'URL', 'clearTimeout', 'console', 'globalThis',
  'performance', 'process', 'queueMicrotask', 'setImmediate', 'setTimeout', 'structuredClone'
].map(name => [name, 'readonly']));
const commonjsGlobals = {require: 'readonly', module: 'writable', exports: 'writable', __dirname: 'readonly', __filename: 'readonly', global: 'writable'};
// The jsdom tests install jsdom's document as a global (global.document = window.document) for the View under test.
const jsdomTestGlobals = {document: 'readonly'};
// Browser test callbacks passed to page.evaluate() run in Chromium, not Node.
const browserGlobals = {window: 'readonly', document: 'readonly', DOMParser: 'readonly', MouseEvent: 'readonly', requestAnimationFrame: 'readonly'};

export default [
  {ignores: ['dist/**', 'coverage/**', 'node_modules/**']},
  {files: ['src/**/*.ts'], languageOptions: {parser: babelParser, parserOptions: {requireConfigFile: false, sourceType: 'unambiguous', babelOptions: {presets: ['@babel/preset-typescript']}}}, rules: {...js.configs.recommended.rules, 'no-undef': 'off', 'no-unused-vars': 'off', ...sharedRules}},
  {files: ['test/**/*.js', 'benchmark/**/*.js'], languageOptions: {ecmaVersion: 'latest', sourceType: 'commonjs', globals: {...nodeGlobals, ...commonjsGlobals}}, rules: {...js.configs.recommended.rules, ...sharedRules}},
  {files: ['integration/**/*.mjs', 'scripts/**/*.mjs', 'test/**/*.mjs', 'benchmark/**/*.mjs'], languageOptions: {ecmaVersion: 'latest', sourceType: 'module', globals: nodeGlobals}, rules: {...js.configs.recommended.rules, ...sharedRules}},
  {files: ['test/*.test.js'], languageOptions: {globals: jsdomTestGlobals}},
  {files: ['test/browser/**'], languageOptions: {globals: browserGlobals}},
];
