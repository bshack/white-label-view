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

    assert.throws(() => child.addChild(parent), /cycles/);
    const other = new View();
    assert.throws(() => other.addChild(child), /already has an owner/);

    assert.equal(parent.destroy(), parent);
    assert.equal(parent.toString(), '');
    assert.equal(listeners.size, 0);
});

test('server view rejects DOM-like or unsupported template results', t => {
    withoutBrowserGlobals(t);
    const View = require('../dist/server');
    const view = new View({template: () => ({nodeType: 1})});
    assert.throws(() => view.render(), /string or White Label JSX markup/);
});
