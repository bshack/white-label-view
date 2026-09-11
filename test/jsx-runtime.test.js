'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {Fragment, jsx, jsxDEV, jsxs, raw} = require('../dist/jsx-runtime.js');

test('renders escaped children, fragments, arrays, primitives, and raw markup', () => {
    assert.equal(jsx('p', {children: '<Ada & Grace>'}), '<p>&lt;Ada &amp; Grace&gt;</p>');
    assert.equal(jsx(Fragment, {children: ['a', 2, 3n, false, true, null, undefined, raw('<b>safe</b>')]}), 'a23<b>safe</b>');
    assert.equal(jsxs('div', {children: ['one', jsx('span', {children: 'two'})]}), '<div>one<span>two</span></div>');
    assert.equal(jsxDEV('strong', {children: 'dev'}), '<strong>dev</strong>');
});

test('renders attributes, aliases, styles, arrays, booleans, and void elements', () => {
    assert.equal(
        jsx('label', {
            className: 'field "wide"',
            htmlFor: 'name',
            hidden: true,
            disabled: false,
            'aria-hidden': true,
            title: 'A < B & C',
            style: {backgroundColor: 'red', lineHeight: 1.2, ignored: null, nope: false},
            children: 'Name'
        }),
        '<label class="field &quot;wide&quot;" for="name" hidden aria-hidden="true" title="A &lt; B &amp; C" style="background-color:red;line-height:1.2">Name</label>'
    );
    assert.equal(jsx('input', {required: true, value: 5, class: ['a', 'b']}), '<input required value="5" class="a b">');
    assert.equal(jsx('meta', {content: undefined}), '<meta>');
});

test('supports function components and null props', () => {
    const Badge = props => jsx('span', {className: 'badge', children: props.children});
    assert.equal(jsx(Badge, {children: 'New'}), '<span class="badge">New</span>');
    assert.equal(jsx('div', null), '<div></div>');
});

test('rejects unsupported intrinsic attribute values', () => {
    assert.throws(() => jsx('button', {onClick() {}}), /Unsupported JSX attribute value for onClick/);
    assert.throws(() => jsx('div', {token: Symbol('x')}), /Unsupported JSX attribute value for token/);
    assert.throws(() => jsx('div', {config: {enabled: true}}), /Unsupported JSX attribute value for config/);
});
