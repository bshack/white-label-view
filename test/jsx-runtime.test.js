'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {JSDOM} = require('jsdom');
const View = require('../dist/index.js');
const {Fragment, isJSXMarkup, jsx, jsxDEV, jsxs, raw} = require('../dist/jsx-runtime.js');

const text = value => String(value);

test('renders escaped children, fragments, arrays, primitives, and raw markup', () => {
    assert.equal(text(jsx('p', {children: '<Ada & Grace>'})), '<p>&lt;Ada &amp; Grace&gt;</p>');
    assert.equal(text(jsx(Fragment, {children: ['a', 2, 3n, false, true, null, undefined, raw('<b>safe</b>')]})), 'a23<b>safe</b>');
    assert.equal(text(jsxs('div', {children: ['one', jsx('span', {children: 'two'})]})), '<div>one<span>two</span></div>');
    assert.equal(text(jsxDEV('strong', {children: 'dev'})), '<strong>dev</strong>');
});

test('renders attributes, aliases, styles, arrays, booleans, and void elements', () => {
    assert.equal(
        text(jsx('label', {
            className: 'field "wide"',
            htmlFor: 'name',
            hidden: true,
            disabled: false,
            'aria-hidden': true,
            title: 'A < B & C',
            style: {backgroundColor: 'red', lineHeight: 1.2, ignored: null, nope: false},
            children: 'Name'
        })),
        '<label class="field &quot;wide&quot;" for="name" hidden aria-hidden="true" title="A &lt; B &amp; C" style="background-color:red;line-height:1.2">Name</label>'
    );
    assert.equal(text(jsx('input', {required: true, value: 5, class: ['a', 'b']})), '<input required value="5" class="a b">');
    assert.equal(text(jsx('meta', {content: undefined})), '<meta>');
});

test('supports function components, null props, and markup detection', () => {
    const Badge = props => jsx('span', {className: 'badge', children: props.children});
    const badge = jsx(Badge, {children: 'New'});
    assert.equal(text(badge), '<span class="badge">New</span>');
    assert.equal(isJSXMarkup(badge), true);
    assert.equal(isJSXMarkup(null), false);
    assert.equal(isJSXMarkup({__whiteLabelJSXMarkup: false}), false);
    assert.equal(text(jsx('div', null)), '<div></div>');
});

test('rejects unsupported intrinsic values and child objects', () => {
    assert.throws(() => jsx('button', {onClick() {}}), /Unsupported JSX attribute value for onClick/);
    assert.throws(() => jsx('div', {token: Symbol('x')}), /Unsupported JSX attribute value for token/);
    assert.throws(() => jsx('div', {config: {enabled: true}}), /Unsupported JSX attribute value for config/);
    assert.throws(() => jsx('div', {children: {value: 'not trusted'}}), /Unsupported JSX child object/);
});

test('View accepts JSX output as a template root', () => {
    const dom = new JSDOM('<main></main>');
    const parentElement = dom.window.document.querySelector('main');
    const view = new View({
        parentElement,
        template: () => jsx('section', {children: jsx('h1', {children: 'Hello'})})
    }).initialize();
    assert.equal(parentElement.innerHTML, '<section><h1>Hello</h1></section>');
    view.destroy();
});
