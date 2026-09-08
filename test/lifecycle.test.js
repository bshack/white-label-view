'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const {JSDOM} = require('jsdom');
const {EventEmitter} = require('node:events');
const {Eta} = require('eta/core');
const View = require('../dist');
function dom(t) {
    const window = new JSDOM('<main></main>').window;
    global.document = window.document;
    global.DOMParser = window.DOMParser;
    t.after(() => {window.close(); delete global.document; delete global.DOMParser;});
    return window;
}
test('renders escaped Eta output without coupling the package to a template engine', t => {
    dom(t);
    const eta = new Eta({autoEscape: true});
    const parentElement = document.querySelector('main');
    const view = new View({
        parentElement,
        model: {name: '<script>alert(1)</script>'},
        template: data => eta.renderString('<p><%= it.name %></p>', data)
    }).initialize();
    assert.equal(parentElement.textContent, '<script>alert(1)</script>');
    assert.equal(parentElement.querySelector('script'), null);
    view.destroy();
});
test('renders, observes model updates, preserves unchanged DOM, and tears down', t => {
    dom(t);
    const parentElement = document.querySelector('main');
    const model = new EventEmitter();
    let value = 'first';
    model.get = () => ({value});
    const view = new View({parentElement, model, template: data => `<p>${data.value}</p>`});
    assert.equal(view.initialize(), view);
    assert.equal(parentElement.textContent, 'first');
    assert.equal(model.listenerCount('change'), 1);
    const first = view.element;
    view.render();
    assert.equal(view.element, first);
    value = 'second';
    model.emit('change');
    assert.equal(parentElement.textContent, 'second');
    assert.notEqual(view.element, first);
    assert.equal(model.listenerCount('change'), 1);
    assert.equal(view.destroy(), view);
    assert.equal(parentElement.childNodes.length, 0);
    assert.equal(model.listenerCount('change'), 0);
    view.destroy();
});
test('supports plain models, DOM templates, detached roots, and missing options', t => {
    dom(t);
    const empty = new View();
    assert.equal(empty.initialize(), empty);
    empty.destroy();
    empty.initializeTwoWayBinding();
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
    unbound.model = {on() {}};
    unbound.initializeTwoWayBinding();
    unbound.destroyTwoWayBinding();
    assert.equal(unbound.twoWayBindingInitialized, false);
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
