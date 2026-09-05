'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

test('exports the View constructor', function() {
    // Gator exposes its browser global while the module is loaded.
    global.window = {};
    const View = require('../dist/index');

    assert.equal(typeof View, 'function');
    delete global.window;
});
