'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

test('public package entrypoints resolve from built output', () => {
    const View = require('white-label-view');
    const ServerView = require('white-label-view/server');
    const jsxRuntime = require('white-label-view/jsx-runtime');
    const jsxDevRuntime = require('white-label-view/jsx-dev-runtime');

    assert.equal(typeof View, 'function');
    assert.equal(typeof ServerView, 'function');
    assert.equal(typeof jsxRuntime.jsx, 'function');
    assert.equal(typeof jsxRuntime.jsxs, 'function');
    assert.equal(typeof jsxDevRuntime.jsxDEV, 'function');
});
