'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const EventEmitter = require('node:events');
const ServerView = require('../dist/server');
const {jsx} = require('../dist/jsx-runtime');

class Model extends EventEmitter {
    constructor(value) {
        super();
        this.value = value;
    }
    get() {return this.value;}
}

test('server View renders JSX with the browser View lifecycle names and no DOM globals', () => {
    assert.equal(typeof globalThis.document, 'undefined');
    const model = new Model({name: '<Grace>'});
    const calls = [];
    const view = new ServerView({
        model,
        template: data => jsx('h1', {children: data.name})
    });
    view.addListeners = () => {calls.push('listeners'); return view;};
    view.afterMount = () => {calls.push('mount'); return view;};

    assert.equal(view.initialize(), view);
    assert.equal(view.toString(), '<h1>&lt;Grace&gt;</h1>');
    assert.deepEqual(calls, ['listeners', 'mount']);
    assert.equal(model.listenerCount('change'), 1);

    model.value = {name: 'Ada'};
    model.emit('change');
    assert.equal(view.toString(), '<h1>Ada</h1>');
    assert.equal(model.listenerCount('change'), 1);

    assert.equal(view.destroy(), view);
    assert.equal(view.toString(), '');
    assert.equal(model.listenerCount('change'), 0);
});

test('server View accepts trusted string templates and model replacement', () => {
    const first = new Model({value: 'one'});
    const second = new Model({value: 'two'});
    const view = new ServerView({model: first, template: data => `<p>${data.value}</p>`});

    view.initialize();
    assert.equal(view.setModel(first), view);
    assert.equal(first.listenerCount('change'), 1);
    assert.equal(view.setModel(second), view);
    assert.equal(first.listenerCount('change'), 0);
    assert.equal(second.listenerCount('change'), 1);
    assert.equal(view.toString(), '<p>two</p>');

    view.model = second;
    assert.equal(second.listenerCount('change'), 1);
    view.model = undefined;
    assert.equal(second.listenerCount('change'), 0);
    assert.equal(view.render(), view);
    assert.equal(view.toString(), '<p>undefined</p>');
});

test('server View supports no-template lifecycle and non-observable models', () => {
    const view = new ServerView({model: {value: 1}});
    assert.equal(view.initialize(), view);
    assert.equal(view.toString(), '');
    assert.equal(view.initializeModelBinding(), view);
    assert.equal(view.destroyModelBinding(), view);
    assert.equal(view.addListeners(), view);
    assert.equal(view.removeListeners(), view);
    assert.equal(view.afterMount(), view);
});

test('server View rejects unsupported template output', () => {
    const view = new ServerView({template: () => /** @type {any} */ ({bad: true})});
    assert.throws(() => view.render(), /string or JSX markup/);
});

test('server View owns and releases child lifecycles safely', () => {
    const parent = new ServerView({template: () => '<main></main>'});
    const child = new ServerView({template: () => '<span></span>'});
    const other = new ServerView();

    assert.equal(parent.addChild(child), parent);
    assert.equal(parent.addChild(child), parent);
    assert.throws(() => child.addChild(parent), /cycles/);
    assert.throws(() => other.addChild(child), /already has an owner/);
    assert.equal(parent.releaseChild(child), parent);
    assert.equal(parent.releaseChild(child), parent);
    assert.equal(other.addChild(child), other);
    assert.equal(child.destroy(), child);
    assert.equal(other.releaseChild(child), other);

    const owned = new ServerView({template: () => '<i></i>'});
    parent.addChild(owned);
    parent.initialize();
    owned.initialize();
    parent.destroy();
    assert.equal(owned.toString(), '');
});
