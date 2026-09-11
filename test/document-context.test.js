'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {JSDOM} = require('jsdom');
const View = require('../dist');

test('uses the owning document for parsing, construction, and reset without a global DOMParser', t => {
    const hostWindow = new JSDOM('<main></main>').window;
    const viewWindow = new JSDOM('<main></main>').window;
    global.document = hostWindow.document;
    delete global.DOMParser;
    t.after(() => {
        hostWindow.close();
        viewWindow.close();
        delete global.document;
        delete global.DOMParser;
    });

    const parentElement = viewWindow.document.querySelector('main');
    const view = new View({
        parentElement,
        template: () => '<section><p>frame-local</p></section>'
    }).initialize();

    assert.equal(view.element.ownerDocument, viewWindow.document);
    assert.equal(parentElement.textContent, 'frame-local');

    delete global.document;
    view.destroy();
    assert.equal(view.element.ownerDocument, viewWindow.document);

    const templateFree = new View({parentElement});
    assert.equal(templateFree.element.ownerDocument, viewWindow.document);
    templateFree.destroy();
});
