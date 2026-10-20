'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const {JSDOM} = require('jsdom');
const View = require('../dist');
function dom(t) {
    const window = new JSDOM('<main></main>').window;
    global.document = window.document;
    global.DOMParser = window.DOMParser;
    t.after(() => {window.close(); delete global.document; delete global.DOMParser;});
    return window;
}
test('renders trusted single-root HTML without requiring a template engine', t => {
    dom(t);
    const parentElement = document.querySelector('main');
    const view = new View({
        parentElement,
        model: {name: 'Ada'},
        template: data => `<p>Hello, ${data.name}</p>`
    }).initialize();
    assert.equal(parentElement.textContent, 'Hello, Ada');
    assert.equal(parentElement.firstElementChild.tagName, 'P');
    view.destroy();
});
test('renders, observes EventTarget model updates, preserves unchanged DOM, and tears down', t => {
    dom(t);
    const parentElement = document.querySelector('main');
    const model = new EventTarget();
    let value = 'first';
    model.get = () => ({value});
    const view = new View({parentElement, model, template: data => `<p>${data.value}</p>`});
    assert.equal(view.initialize(), view);
    assert.equal(parentElement.textContent, 'first');
    const first = view.element;
    view.render();
    assert.equal(view.element, first);
    value = 'second';
    model.dispatchEvent(new CustomEvent('change', {detail: model.get()}));
    assert.equal(parentElement.textContent, 'second');
    assert.notEqual(view.element, first);
    assert.equal(view.destroy(), view);
    assert.equal(parentElement.childNodes.length, 0);
    value = 'third';
    model.dispatchEvent(new CustomEvent('change', {detail: model.get()}));
    assert.equal(parentElement.childNodes.length, 0);
    view.destroy();
});
test('supports plain models, DOM templates, detached roots, and missing options', t => {
    dom(t);
    const empty = new View();
    assert.equal(empty.initialize(), empty);
    empty.destroy();
    empty.initializeModelBinding();
    const parentElement = document.querySelector('main');
    const element = document.createElement('p');
    parentElement.append(element);
    const view = new View({parentElement, element, model: {value: 'hello'}, template: data => {
        const node = document.createElement('p'); node.textContent = data.value; return node;
    }});
    view.initialize();
    const rendered = view.element;
    view.render();
    assert.equal(view.element, rendered);
    view.template = () => '<p>hello</p>';
    view.render();
    assert.equal(view.element, rendered);
    parentElement.removeChild(rendered);
    view.render();
    assert.equal(parentElement.textContent, 'hello');
    const unbound = new View({template: data => {assert.deepEqual(data, {}); return '<p>detached</p>';}});
    assert.equal(unbound.render(), unbound);
    unbound.template = () => '';
    assert.throws(() => unbound.render(), /root node/);
    unbound.model = {addEventListener() {}};
    unbound.initializeModelBinding();
    unbound.destroyModelBinding();
    assert.equal(unbound.modelBindingInitialized, false);
});
test('delegation filters events and removes only matching registrations', t => {
    const window = dom(t);
    const view = new View();
    view.element.innerHTML = '<button><span>click</span></button>';
    let count = 0;
    function callback() {count++; assert.equal(this.tagName, 'BUTTON');}
    const events = view.delegate();
    events.on('click', 'button', callback).on('change', 'input', () => {throw Error('unexpected');});
    view.element.querySelector('span').dispatchEvent(new window.MouseEvent('click', {bubbles: true}));
    assert.equal(count, 1);
    view.element.dispatchEvent(new window.MouseEvent('click'));
    assert.equal(count, 1);
    events.off('click', 'a').off('click', 'button', () => {});
    assert.equal(events.listeners.length, 2);
    events.off('click', 'button', callback);
    assert.equal(events.listeners.length, 1);
    events.off('change');
    assert.equal(events.listeners.length, 0);
    const rootEvents = view.delegate(view.element);
    let rootCount = 0;
    rootEvents.on('click', 'div', () => rootCount++);
    view.element.dispatchEvent(new window.MouseEvent('click'));
    assert.equal(rootCount, 1);
    const listener = rootEvents.listeners[0].listener;
    listener({target: null});
    listener({target: document.createTextNode('text')});
    listener({target: {closest: () => document.createElement('div')}});
    assert.equal(rootCount, 1);
    rootEvents.off('click');
});

test('owned delegation is cleared on replacement and destruction, without subclass cleanup', t => {
    const window = dom(t);
    let text = 'first';
    const view = new View({parentElement: document.querySelector('main'), template: () => `<div>${text}</div>`}).initialize();
    let calls = 0;
    const first = view.element;
    view.delegated.on('click', 'div', () => calls++);
    text = 'second';
    view.render();
    first.dispatchEvent(new window.MouseEvent('click'));
    const last = view.element;
    view.delegated.on('click', 'div', () => calls++);
    view.destroy();
    last.dispatchEvent(new window.MouseEvent('click'));
    assert.equal(calls, 0);
    assert.equal(view.delegated.scope, view.element);
    assert.equal(view.delegated.listeners.length, 0);
});

test('opt-in updates preserve focus and selection and can fall back to a new template', t => {
    dom(t);
    const data = {value: 'Ada'};
    let update = true;
    const view = new View({parentElement: document.querySelector('main'), model: data,
        template: () => '<div><input value="Ada"><span></span></div>',
        update: (element, state) => {
            if (!update) {return false;}
            element.querySelector('span').textContent = state.value;
            return true;
        }
    }).initialize();
    const input = view.element.querySelector('input');
    input.focus(); input.setSelectionRange(1, 2);
    data.value = 'Grace'; view.render();
    assert.equal(document.activeElement, input);
    assert.equal(input.selectionStart, 1);
    assert.equal(input.selectionEnd, 2);
    assert.equal(view.element.querySelector('span').textContent, 'Grace');
    update = false; view.render();
    assert.notEqual(view.element.querySelector('input'), input);
    view.destroy();
});

test('removeListeners runs only after addListeners ran for a mounted root', t => {
    dom(t);
    const events = [];
    class Tracked extends View {
        addListeners() {events.push('add'); return this;}
        removeListeners() {events.push('remove'); return this;}
    }
    let text = 'one';
    const view = new Tracked({parentElement: document.querySelector('main'), template: () => `<p>${text}</p>`}).initialize();
    assert.deepEqual(events, ['add']);
    text = 'two';
    view.render();
    assert.deepEqual(events, ['add', 'remove', 'add']);
    view.destroy();
    assert.deepEqual(events, ['add', 'remove', 'add', 'remove']);
    view.destroy();
    new Tracked().destroy();
    new Tracked({parentElement: document.querySelector('main')}).destroy();
    assert.deepEqual(events, ['add', 'remove', 'add', 'remove']);
});

test('delegated registrations made before the first mount follow the view root until destroy', t => {
    const window = dom(t);
    const parentElement = document.querySelector('main');
    const calls = [];
    class Early extends View {
        constructor(settings) {
            super(settings);
            this.delegated.on('click', 'button', function () {calls.push(this.textContent);});
        }
    }
    let text = 'one';
    const view = new Early({parentElement, template: () => `<div><button>${text}</button></div>`});
    const controller = new AbortController();
    view.delegated.on('click', 'button', () => calls.push('once'), {once: true});
    view.delegated.on('click', 'button', () => calls.push('signal'), {signal: controller.signal});
    view.initialize();
    const click = () => view.element.querySelector('button').dispatchEvent(new window.MouseEvent('click', {bubbles: true}));
    click();
    assert.deepEqual(calls, ['one', 'once', 'signal']);
    text = 'two';
    view.render();
    view.delegated.on('click', 'button', () => calls.push('root-scoped'));
    click();
    assert.deepEqual(calls, ['one', 'once', 'signal', 'two', 'signal', 'root-scoped']);
    controller.abort();
    text = 'three';
    view.render();
    click();
    assert.deepEqual(calls.slice(6), ['three']);
    assert.equal(view.delegated.listeners.length, 1);
    const last = view.element;
    view.destroy();
    last.querySelector('button').dispatchEvent(new window.MouseEvent('click', {bubbles: true}));
    assert.deepEqual(calls.slice(6), ['three']);
    assert.equal(view.delegated.listeners.length, 0);
});

test('pre-mount delegated registrations survive adoption, failed mounts, and retries', t => {
    const window = dom(t);
    const parentElement = document.querySelector('main');
    parentElement.innerHTML = '<button>adopted</button>';
    let calls = 0;
    let fail = true;
    class Flaky extends View {
        addListeners() {
            this.delegated.on('click', 'button', () => {calls += 100;});
            if (fail) {fail = false; throw new Error('mount failed');}
            return this;
        }
    }
    const view = new Flaky({parentElement, element: parentElement.firstChild, template: () => '<button>new</button>'});
    view.delegated.on('click', 'button', () => {calls += 1;}, true);
    assert.throws(() => view.initialize(), /mount failed/);
    assert.equal(view.delegated.listeners.length, 1);
    view.initialize();
    view.element.dispatchEvent(new window.MouseEvent('click', {bubbles: true}));
    assert.equal(calls, 101);
    assert.equal(view.delegated.listeners[0].capture, true);
    view.destroy();
});

test('adopted roots outside parentElement are moved instead of duplicated', t => {
    const window = new JSDOM('<main></main><aside><p id="old">old</p></aside>').window;
    t.after(() => window.close());
    const {document: page} = window;
    const parentElement = page.querySelector('main');
    const view = new View({parentElement, element: page.getElementById('old'), template: () => '<p>new</p>'}).initialize();
    assert.equal(page.querySelector('aside').childNodes.length, 0);
    assert.equal(page.querySelectorAll('p').length, 1);
    assert.equal(parentElement.firstChild, view.element);
    view.destroy();
    assert.equal(page.querySelectorAll('p').length, 0);
});
