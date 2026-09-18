import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const packageJson = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
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
