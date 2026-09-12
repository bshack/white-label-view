'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');

function withoutBrowserGlobals(t) {
    const previousWindow = global.window;
    const previousDocument = global.document;
    delete global.window;
    delete global.document;
    t.after(() => {
        if (previousWindow === undefined) {delete global.window;} else {global.window = previousWindow;}
        if (previousDocument === undefined) {delete global.document;} else {global.document = previousDocument;}
    });
}

test('server view renders JSX with escaping and no DOM globals', t => {
    withoutBrowserGlobals(t);
    const View = require('../dist/server');
    const {jsx, raw} = require('../dist/jsx-runtime');
    const view = new View({
        model: {name: '<Ada & Grace>'},
        template: data => jsx('main', {
            className: 'profile',
            children: [jsx('h1', {children: data.name}), raw('<p>trusted</p>')]
        })
    });

    assert.equal(view.initialize(), view);
    assert.equal(view.toString(), '<main class="profile"><h1>&lt;Ada &amp; Grace&gt;</h1><p>trusted</p></main>');
});

test('server view mirrors model binding, setModel, child ownership, and teardown', t => {
    withoutBrowserGlobals(t);
    const View = require('../dist/server');
    const listeners = new Set();
    const model = {
        value: 'first',
        get() {return {value: this.value};},
        on(event, callback) {assert.equal(event, 'change'); listeners.add(callback);},
        removeListener(event, callback) {assert.equal(event, 'change'); listeners.delete(callback);}
    };
    const parent = new View({model, template: data => `<main>${data.value}</main>`});
    const child = new View({template: () => '<aside>child</aside>'});

    parent.addChild(child).initialize();
    assert.equal(listeners.size, 1);
    model.value = 'second';
    for (const callback of listeners) {callback();}
    assert.equal(parent.toString(), '<main>second</main>');

    parent.model = model;
    assert.equal(listeners.size, 1);
    const replacementListeners = new Set();
    const replacement = {
        value: 'third',
        get() {return {value: this.value};},
        on(_event, callback) {replacementListeners.add(callback);},
        removeListener(_event, callback) {replacementListeners.delete(callback);}
    };
    assert.equal(parent.setModel(replacement), parent);
    assert.equal(listeners.size, 0);
    assert.equal(replacementListeners.size, 1);
    assert.equal(parent.toString(), '<main>third</main>');

    assert.throws(() => child.addChild(parent), /cycles/);
    const other = new View();
    assert.throws(() => other.addChild(child), /already has an owner/);
    assert.equal(other.releaseChild(child), other);

    assert.equal(parent.destroy(), parent);
    assert.equal(parent.toString(), '');
    assert.equal(replacementListeners.size, 0);
});

test('server view supports empty lifecycle and plain model data', t => {
    withoutBrowserGlobals(t);
    const View = require('../dist/server');
    const empty = new View();
    assert.equal(empty.initialize(), empty);
    assert.equal(empty.toString(), '');
    assert.equal(empty.destroyModelBinding(), empty);

    const plain = new View({model: {name: 'Ada'}, template: data => `<p>${data.name}</p>`});
    assert.equal(plain.render(), plain);
    assert.equal(plain.toString(), '<p>Ada</p>');
    plain.model = undefined;
    assert.equal(plain.render(), plain);
    assert.equal(plain.toString(), '<p>undefined</p>');
});

test('server view continues child cleanup and reports aggregate failures', t => {
    withoutBrowserGlobals(t);
    const View = require('../dist/server');
    const parent = new View();
    const first = new View();
    const second = new View();
    let secondDestroyed = false;
    first.destroy = () => {throw new Error('first failed');};
    second.destroy = () => {secondDestroyed = true; return second;};
    parent.addChild(first).addChild(second);

    assert.throws(() => parent.destroy(), error => {
        assert.equal(error instanceof AggregateError, true);
        assert.match(error.message, /Unable to destroy child views/);
        return true;
    });
    assert.equal(secondDestroyed, true);
});

test('server view rejects DOM-like or unsupported template results', t => {
    withoutBrowserGlobals(t);
    const View = require('../dist/server');
    const view = new View({template: () => ({nodeType: 1})});
    assert.throws(() => view.render(), /string or White Label JSX markup/);
});
