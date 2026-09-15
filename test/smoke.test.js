'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

test('exports the View constructor', function() {
    const View = require('../dist/index');

    assert.equal(typeof View, 'function');
});

test('model binding removes only the view listener', function() {
    const View = require('../dist/index');
    const model = new EventTarget();
    const view = Object.create(View.prototype);
    let externalCalls = 0;
    let viewCalls = 0;
    view.model = model;
    view.modelChangeHandler = function() {viewCalls++;};
    view.modelBindingInitialized = false;
    model.addEventListener('change', () => {externalCalls++;});

    view.initializeModelBinding();
    view.initializeModelBinding();
    model.dispatchEvent(new Event('change'));
    assert.equal(externalCalls, 1);
    assert.equal(viewCalls, 1);

    view.destroyModelBinding();
    model.dispatchEvent(new Event('change'));
    assert.equal(externalCalls, 2);
    assert.equal(viewCalls, 1);
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
