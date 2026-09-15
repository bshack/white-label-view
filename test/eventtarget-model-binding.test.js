'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const {JSDOM} = require('jsdom');

function browserDom(t) {
    const window = new JSDOM('<main></main>').window;
    global.document = window.document;
    t.after(() => {window.close(); delete global.document;});
    return window;
}

function eventTargetModel(value) {
    const model = new EventTarget();
    model.value = value;
    model.get = () => ({value: model.value});
    model.on = () => {throw new Error('legacy on() must not be used when EventTarget is available');};
    model.removeListener = () => {throw new Error('legacy removeListener() must not be used when EventTarget is available');};
    return model;
}

test('browser View prefers EventTarget model binding and releases it on destroy', t => {
    browserDom(t);
    const View = require('../dist');
    const parentElement = document.querySelector('main');
    const model = eventTargetModel('first');
    const view = new View({parentElement, model, template: data => `<p>${data.value}</p>`}).initialize();

    assert.equal(parentElement.textContent, 'first');
    model.value = 'second';
    model.dispatchEvent(new CustomEvent('change', {detail: model.get()}));
    assert.equal(parentElement.textContent, 'second');

    view.destroy();
    model.value = 'third';
    model.dispatchEvent(new CustomEvent('change', {detail: model.get()}));
    assert.equal(parentElement.childNodes.length, 0);
});

test('server View prefers EventTarget model binding and releases it on destroy', () => {
    const View = require('../dist/server');
    const model = eventTargetModel('first');
    const view = new View({model, template: data => `<main>${data.value}</main>`}).initialize();

    assert.equal(view.toString(), '<main>first</main>');
    model.value = 'second';
    model.dispatchEvent(new CustomEvent('change', {detail: model.get()}));
    assert.equal(view.toString(), '<main>second</main>');

    view.destroy();
    model.value = 'third';
    model.dispatchEvent(new CustomEvent('change', {detail: model.get()}));
    assert.equal(view.toString(), '');
});
