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

function observable(value) {
    const model = new EventTarget();
    model.value = value;
    model.get = function() {return {value: this.value};};
    return model;
}

test('server view renders tagged HTML with escaping and no DOM globals', t => {
    withoutBrowserGlobals(t);
    const View = require('../dist/server');
    const {html, unsafeHTML} = require('../dist/html');
    const view = new View({
        model: {name: '<Ada & Grace>'},
        template: data => html`<main class="profile"><h1>${data.name}</h1>${unsafeHTML('<p>trusted</p>')}</main>`
    });

    assert.equal(view.initialize(), view);
    assert.equal(view.toString(), '<main class="profile"><h1>&lt;Ada &amp; Grace&gt;</h1><p>trusted</p></main>');
});

test('server view mirrors EventTarget model binding, setModel, child ownership, and teardown', t => {
    withoutBrowserGlobals(t);
    const View = require('../dist/server');
    const model = observable('first');
    const parent = new View({model, template: data => `<main>${data.value}</main>`});
    const child = new View({template: () => '<aside>child</aside>'});

    parent.addChild(child).initialize();
    model.value = 'second';
    model.dispatchEvent(new CustomEvent('change', {detail: model.get()}));
    assert.equal(parent.toString(), '<main>second</main>');

    parent.model = model;
    const replacement = observable('third');
    assert.equal(parent.setModel(replacement), parent);
    assert.equal(parent.toString(), '<main>third</main>');

    model.value = 'ignored';
    model.dispatchEvent(new CustomEvent('change', {detail: model.get()}));
    assert.equal(parent.toString(), '<main>third</main>');
    replacement.value = 'fourth';
    replacement.dispatchEvent(new CustomEvent('change', {detail: replacement.get()}));
    assert.equal(parent.toString(), '<main>fourth</main>');

    assert.throws(() => child.addChild(parent), /cycles/);
    const other = new View();
    assert.throws(() => other.addChild(child), /already has an owner/);
    assert.equal(other.releaseChild(child), other);

    assert.equal(parent.destroy(), parent);
    assert.equal(parent.toString(), '');
    replacement.value = 'ignored after destroy';
    replacement.dispatchEvent(new CustomEvent('change', {detail: replacement.get()}));
    assert.equal(parent.toString(), '');
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

    const owner = new View();
    const owned = new View();
    owner.addChild(owned);
    assert.equal(owned.destroy(), owned);
    assert.equal(owner.addChild(owned), owner);
});

test('server view attempts every cleanup phase and preserves multiple failures', t => {
    withoutBrowserGlobals(t);
    const View = require('../dist/server');
    const events = [];
    const model = {
        get: () => ({value: 'x'}),
        addEventListener() {},
        removeEventListener() {events.push('model'); throw new Error('model cleanup');}
    };

    const owner = new View();
    const child = new View({model, template: () => '<p>child</p>'}).initialize();
    child.addChild({
        owner: undefined,
        destroy() {events.push('child'); throw new Error('child cleanup');}
    });
    owner.addChild(child);
    owner.releaseChild = () => {events.push('owner'); throw new Error('owner cleanup');};

    assert.throws(() => child.destroy(), error => {
        assert.equal(error instanceof AggregateError, true);
        assert.deepEqual(
            error.errors.map(item => item instanceof AggregateError
                ? item.errors.map(inner => inner.message)
                : item.message),
            ['owner cleanup', ['child cleanup'], 'model cleanup']
        );
        return true;
    });

    assert.deepEqual(events, ['owner', 'child', 'model']);
    assert.equal(child.toString(), '');
});

test('server view rejects DOM-like or unsupported template results', t => {
    withoutBrowserGlobals(t);
    const View = require('../dist/server');
    const view = new View({template: () => ({nodeType: 1})});
    assert.throws(() => view.render(), /string or White Label HTML markup/);
});
