'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const EventEmitter = require('node:events');

test('exports the View constructor', function() {
    const View = require('../dist/index');

    assert.equal(typeof View, 'function');
});

test('two-way binding removes only the view listener', function() {
    const View = require('../dist/index');
    const model = new EventEmitter();
    const view = Object.create(View.prototype);
    const externalListener = function() {};
    view.model = model;
    view.modelChangeHandler = function() {};
    view.modelBindingInitialized = false;
    model.on('change', externalListener);

    view.initializeModelBinding();
    view.initializeModelBinding();
    assert.equal(model.listenerCount('change'), 2);
    view.destroyModelBinding();

    assert.deepEqual(model.listeners('change'), [externalListener]);
});

test('render skips unchanged string output before parsing or replacing DOM', function() {
    const View = require('../dist/index');
    const view = Object.create(View.prototype);
    view.template = () => '<p>unchanged</p>';
    view.model = {};
    view.renderedTemplate = '<p>unchanged</p>';
    view.element = {};
    view.parentElement = {contains: (element) => element === view.element};

    assert.equal(view.render(), view);
});

test('native event delegation handles nested targets and removes the registered listener', function() {
    const View = require('../dist/index');
    const registered = {};
    const scope = {
        addEventListener(type, listener) {
            registered[type] = listener;
        },
        contains(target) {
            return target === matchingElement;
        },
        removeEventListener(type, listener) {
            assert.equal(listener, registered[type]);
            delete registered[type];
        }
    };
    const matchingElement = {};
    const nestedElement = {closest: () => matchingElement};
    const view = Object.create(View.prototype);
    const delegated = view.delegate(scope);
    let callbackContext;

    function callback() {
        callbackContext = this;
    }

    delegated.on('click', 'a', callback);
    registered.click({target: nestedElement});
    assert.equal(callbackContext, matchingElement);

    delegated.off('click', 'a', callback);
    assert.equal(registered.click, undefined);
});
