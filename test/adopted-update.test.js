'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const {JSDOM} = require('jsdom');
const View = require('../dist');

function observable(value) {
    const target = new EventTarget();
    target.value = value;
    target.get = function() {return {value: this.value};};
    target.change = function() {
        return this.dispatchEvent(new CustomEvent('change', {detail: this.get()}));
    };
    return target;
}

test('adopted markup can update in place without a template', t => {
    const window = new JSDOM('<main><p id="status">Server value</p><aside>Host-owned sibling</aside></main>').window;
    global.document = window.document;
    global.DOMParser = window.DOMParser;
    t.after(() => {
        window.close();
        delete global.document;
        delete global.DOMParser;
    });

    const parent = document.querySelector('main');
    const root = document.querySelector('#status');
    const sibling = document.querySelector('aside');
    const model = observable('Initial client value');
    let updates = 0;

    const view = new View({
        parentElement: parent,
        element: root,
        model,
        update(element, data) {
            updates++;
            element.textContent = data.value;
            return true;
        }
    }).initialize();

    assert.equal(view.element, root);
    assert.equal(root.textContent, 'Initial client value');
    assert.equal(sibling.textContent, 'Host-owned sibling');

    model.value = 'Updated client value';
    model.change();

    assert.equal(view.element, root);
    assert.equal(root.textContent, 'Updated client value');
    assert.equal(sibling.textContent, 'Host-owned sibling');
    assert.equal(updates, 2);

    view.destroy();
    assert.equal(parent.contains(root), false);
    assert.equal(parent.contains(sibling), true);
});
