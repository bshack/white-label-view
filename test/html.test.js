'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {JSDOM} = require('jsdom');
const View = require('../dist/index.js');
const {attributes, html, isHTMLMarkup, unsafeHTML} = require('../dist/html.js');

const text = value => String(value);

test('html escapes text and quoted attribute interpolations', () => {
    const value = '<Ada & "Grace">';
    const output = html`<section title="Profile ${value}" data-name='${value}' data-active="${true}"><p>${value}</p></section>`;
    assert.equal(
        text(output),
        '<section title="Profile &lt;Ada &amp; &quot;Grace&quot;&gt;" data-name=\'&lt;Ada &amp; &quot;Grace&quot;&gt;\' data-active="true"><p>&lt;Ada &amp; &quot;Grace&quot;&gt;</p></section>'
    );
    assert.equal(output.value, text(output));
    assert.equal(output.toString(), output.value);
    assert.equal(isHTMLMarkup(output), true);
});

test('html preserves caller-authored literal whitespace', () => {
    const output = html`  <span>spaced</span>  `;
    assert.equal(text(output), '  <span>spaced</span>  ');
});

test('browser View renders branded tagged HTML output', () => {
    const dom = new JSDOM('<main></main>');
    const parentElement = dom.window.document.querySelector('main');
    const view = new View({
        parentElement,
        template: () => html`<section><p>${'<Ada>'}</p></section>`
    }).initialize();

    assert.equal(parentElement.innerHTML, '<section><p>&lt;Ada&gt;</p></section>');
    view.destroy();
    dom.window.close();
});

test('html composes nested markup and arrays without double escaping', () => {
    const items = ['<one>', 'two'].map(item => html`<li>${item}</li>`);
    const output = html`<ul>${items}</ul>`;
    assert.equal(text(output), '<ul><li>&lt;one&gt;</li><li>two</li></ul>');
});

test('text interpolation ignores nullish and boolean values while preserving numbers', () => {
    assert.equal(text(html`<p>${null}${undefined}${false}${true}${0}${2n}</p>`), '<p>02</p>');
});

test('unsafeHTML is explicit trusted markup', () => {
    const output = html`<section>${unsafeHTML('<strong>trusted</strong>')}</section>`;
    assert.equal(text(output), '<section><strong>trusted</strong></section>');
    assert.throws(() => unsafeHTML(42), /requires a string/);
});

test('attributes handles conditional, boolean, array, and escaped values', () => {
    const output = html`<input ${attributes({
        type: 'checkbox',
        checked: true,
        disabled: false,
        class: ['task', null, false, 'active', 2, true],
        'data-title': '<Ada & Grace>',
        'aria-hidden': true,
        title: undefined
    })}>`;
    assert.equal(
        text(output),
        '<input type="checkbox" checked class="task active 2 true" data-title="&lt;Ada &amp; Grace&gt;" aria-hidden="true">'
    );
});

test('attributes rejects event handlers, srcdoc, invalid names, and object values', () => {
    assert.throws(() => attributes({onclick: 'alert(1)'}), /Unsupported HTML attribute name/);
    assert.throws(() => attributes({srcdoc: '<script></script>'}), /srcdoc/);
    assert.throws(() => attributes({'bad name': 'value'}), /Unsupported HTML attribute name/);
    assert.throws(() => attributes({style: {display: 'none'}}), /Attribute values/);
    assert.throws(() => attributes({class: ['valid', {invalid: true}]}), /Attribute arrays/);
});

test('html rejects ambiguous or dangerous interpolation contexts', () => {
    assert.throws(() => html`<script>${'alert(1)'}</script>`, /script content/);
    assert.throws(() => html`<script>fixed ${'alert(1)'}</script>`, /script content/);
    assert.throws(() => html`<style>${'body{}'}</style>`, /style content/);
    assert.throws(() => html`<style>body { ${'color:red'} }</style>`, /style content/);
    assert.throws(() => html`<!-- ${'comment'} -->`, /comment content/);
    assert.throws(() => html`<div data-value=${'unquoted'}></div>`, /Opening-tag interpolations/);
    assert.throws(() => html`<${'section'}></section>`, /Opening-tag interpolations/);
});

test('html tracks completed comments, raw-text elements, declarations, and quoted attributes', () => {
    assert.equal(text(html`<!-- fixed --><p>${'safe'}</p>`), '<!-- fixed --><p>safe</p>');
    assert.equal(text(html`<script>fixed</script><p>${'safe'}</p>`), '<script>fixed</script><p>safe</p>');
    assert.equal(text(html`<style>p{display:block}</style><p>${'safe'}</p>`), '<style>p{display:block}</style><p>safe</p>');
    assert.equal(text(html`<!doctype html><p>${'safe'}</p>`), '<!doctype html><p>safe</p>');
    assert.equal(text(html`<?test?><p>${'safe'}</p>`), '<?test?><p>safe</p>');
});

test('html permits attributes only at opening-tag attribute boundaries', () => {
    assert.equal(text(html`<input${attributes({required: true})}>`), '<input required>');
    assert.equal(text(html`<input ${attributes({required: true})}>`), '<input required>');
    assert.equal(text(html`<input ${null}${undefined}${false}>`), '<input >');
    assert.throws(() => html`<input class=${attributes({required: true})}>`, /attribute boundary/);
    assert.throws(() => html`<p>${attributes({hidden: true})}</p>`, /only be interpolated inside an opening tag/);
});

test('html rejects unsupported interpolated values and promises', () => {
    assert.throws(() => html`<p>${{name: 'Ada'}}</p>`, /HTML template interpolations/);
    assert.throws(() => html`<p>${() => 'Ada'}</p>`, /HTML template interpolations/);
    assert.throws(() => html`<p>${Symbol('Ada')}</p>`, /HTML template interpolations/);
    assert.throws(() => html`<p>${Promise.resolve('Ada')}</p>`, /HTML template interpolations/);
    assert.throws(() => html`<p title="${html`<b>Ada</b>`}"></p>`, /Quoted attribute interpolations/);
    assert.throws(() => html`<p title="${['Ada']}"></p>`, /Quoted attribute interpolations/);
    assert.throws(() => html`<p title="${attributes({hidden: true})}"></p>`, /Quoted attribute interpolations/);
});

test('HTML markup identity interoperates across copies through the global symbol registry', () => {
    const foreign = Object.freeze({
        [Symbol.for('white-label-view.HTMLMarkup')]: true,
        value: '<em>shared</em>',
        toString() {return this.value;},
        [Symbol.toPrimitive]() {return this.value;}
    });
    assert.equal(isHTMLMarkup(foreign), true);
    assert.equal(isHTMLMarkup(null), false);
    assert.equal(isHTMLMarkup({value: '<em>unbranded</em>'}), false);
    assert.equal(isHTMLMarkup({[Symbol.for('white-label-view.HTMLMarkup')]: true, value: 42}), false);
    assert.equal(text(html`<p>${foreign}</p>`), '<p><em>shared</em></p>');
});
