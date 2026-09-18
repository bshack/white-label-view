'use strict';
const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const packageJson = require('../package.json');

const testedRenderers = ['handlebars', 'eta', 'ejs', 'mustache', 'nunjucks', 'pug', '@kitajs/html'];
const runtimeDependencyFields = ['dependencies', 'peerDependencies', 'optionalDependencies'];

test('tested third-party renderers remain application-owned dependencies', () => {
    for (const field of runtimeDependencyFields) {
        const dependencies = packageJson[field] || {};
        for (const renderer of testedRenderers) {
            assert.equal(
                Object.hasOwn(dependencies, renderer),
                false,
                `${renderer} must not be declared in ${field}`
            );
        }
    }
});

test('compatibility documentation preserves renderer-specific escaping requirements', () => {
    const documentation = fs.readFileSync(require.resolve('../TEMPLATE_ENGINES.md'), 'utf8');
    assert.match(documentation, /KitaJS HTML[^\n]*dynamic child text `safe`[^\n]*unescaped by default/);
});
