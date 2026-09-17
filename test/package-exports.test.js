'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

test('public package entrypoints resolve from built output', () => {
    const View = require('white-label-view');
    const ServerView = require('white-label-view/server');
    const htmlRuntime = require('white-label-view/html');

    assert.equal(typeof View, 'function');
    assert.equal(typeof ServerView, 'function');
    assert.equal(typeof htmlRuntime.html, 'function');
    assert.equal(typeof htmlRuntime.attributes, 'function');
    assert.equal(typeof htmlRuntime.unsafeHTML, 'function');
});
