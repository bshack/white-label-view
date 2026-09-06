'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const EventEmitter = require('node:events');

test('exports the View constructor', function() {
    // Gator exposes its browser global while the module is loaded.
    global.window = {};
    const View = require('../dist/index');

    assert.equal(typeof View, 'function');
    delete global.window;
});

test('two-way binding removes only the view listener', function() {
    global.window = {};
    const View = require('../dist/index');
    const model = new EventEmitter();
    const view = Object.create(View.prototype);
    const externalListener = function() {};
    view.model = model;
    view.modelChangeHandler = function() {};
    model.on('change', externalListener);

    view.initializeTwoWayBinding();
    view.destroyTwoWayBinding();

    assert.deepEqual(model.listeners('change'), [externalListener]);
    delete global.window;
});

test('render skips unchanged string output before parsing or replacing DOM', function() {
    global.window = {};
    const View = require('../dist/index');
    const view = Object.create(View.prototype);
    view.template = () => '<p>unchanged</p>';
    view.model = {};
    view.renderedTemplate = '<p>unchanged</p>';
    view.element = {};
    view.parentElement = {contains: (element) => element === view.element};

    assert.equal(view.render(), view);
    delete global.window;
});
