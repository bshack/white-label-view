'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {JSDOM} = require('jsdom');
const View = require('../dist/index.js');
const {attributes, html, isHTMLMarkup, unsafeHTML} = require('../dist/html.js');

const text = value => String(value);

function manualTemplate(literals, value) {
    literals.raw = [...literals];
    return html(literals, value);
}

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

test('html escapes interpolation after a text-only literal prefix', () => {
    assert.equal(text(html`Hello ${'<Ada>'}`), 'Hello &lt;Ada&gt;');
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

test('html rejects nested markup that leaves an executable parsing context open', () => {
    const payload = 'window.__securityProbe=1';
    const scriptStart = html`<script>`;
    const scriptEnd = html`</script>`;
    const handlerStart = html`<button onclick="`;
    const handlerEnd = html`">Test</button>`;

    assert.throws(() => html`${scriptStart}${payload}${scriptEnd}`, /ordinary text context/);
    assert.throws(
        () => html`<section>${handlerStart}${payload}${handlerEnd}</section>`,
        /ordinary text context/
    );
    assert.throws(() => html`${[scriptStart, payload, scriptEnd]}`, /ordinary text context/);
    assert.throws(() => html`${unsafeHTML('<script>')}${payload}`, /ordinary text context/);
});

test('html handles deeply nested arrays without recursion and rejects cycles', () => {
    let deeplyNested = 'safe';
    for (let depth = 0; depth < 20_000; depth += 1) {deeplyNested = [deeplyNested];}
    assert.equal(text(html`<p>${deeplyNested}</p>`), '<p>safe</p>');

    const cyclic = [];
    cyclic.push(cyclic);
    assert.throws(() => html`<p>${cyclic}</p>`, /may not contain cycles/);
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

test('html rejects dynamic event-handler and srcdoc attribute content', () => {
    assert.throws(() => html`<button onclick="${'alert(1)'}">Bad</button>`, /event-handler attribute/);
    assert.throws(() => html`<button ONCLICK='${'alert(1)'}'>Bad</button>`, /event-handler attribute/);
    assert.throws(() => html`<iframe srcdoc="${'<script>alert(1)</script>'}"></iframe>`, /srcdoc/);
    assert.equal(text(html`<a href="${'javascript:caller-policy'}" title="${'safe'}">Link</a>`), '<a href="javascript:caller-policy" title="safe">Link</a>');
    assert.throws(() => manualTemplate(['<div "', '"></div>'], 'literal'), /Opening-tag interpolations/);
});

test('html rejects interpolation that splits attribute syntax', () => {
    const payload = 'window.__securityProbe=1';
    for (const empty of [null, undefined, false]) {
        assert.throws(() => html`<button on${empty}click="${payload}">Test</button>`, /attribute boundary/);
        assert.throws(() => html`<button onclick=${empty}"${payload}">Test</button>`, /attribute boundary/);
        assert.throws(() => html`<button ON${empty}CLICK="${payload}">Test</button>`, /attribute boundary/);
        assert.throws(() => html`<iframe src${empty}doc="${payload}"></iframe>`, /attribute boundary/);
    }
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

test('raw-text end tags must be appropriate browser end tags', () => {
    assert.throws(() => html`<script></scriptx><p>${'alert(1)'}</p>`, /script content/);
    assert.throws(() => html`<style></stylex><p>${'color:red'}</p>`, /style content/);
    assert.throws(() => html`<script><!--<script></script><p>${'alert(1)'}</p>`, /script content/);
    assert.throws(() => html`<script></script${'alert(1)'}`, /script content/);

    const delimiters = ['>', ' >', '\t>', '\n>', '\f>', '\r>', '/>'];
    for (const delimiter of delimiters) {
        const output = manualTemplate([`<script>fixed</script${delimiter}<p>`, '</p>'], 'safe');
        assert.equal(text(output), `<script>fixed</script${delimiter}<p>safe</p>`);
    }
});

test('html treats browser error-recovery states conservatively', () => {
    const payload = 'window.__securityProbe=1';
    assert.throws(() => html`<script/x>${payload}</script>`, /script content/);
    assert.throws(() => html`<!-- --!><script>/* --> */${payload}</script>`, /script content/);
    assert.throws(
        () => html`<button data-x=abc"${' onmouseover=window.__securityProbe=1 x=y'}">Test</button>`,
        /Opening-tag interpolations/
    );
    assert.throws(
        () => manualTemplate(['<button\u00a0', '></button>'], attributes({title: 'safe'})),
        /attribute boundary/
    );
});

test('html tracks completed comments, raw-text elements, declarations, and quoted attributes', () => {
    assert.equal(text(html`<!-- fixed --><p>${'safe'}</p>`), '<!-- fixed --><p>safe</p>');
    assert.equal(text(html`<!-- fixed --!><p>${'safe'}</p>`), '<!-- fixed --!><p>safe</p>');
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

test('html snapshots template literals and invalidates stale cached context plans', () => {
    const literals = ['<p>', '</p>'];
    literals.raw = [...literals];
    assert.equal(text(html(literals, '<safe>')), '<p>&lt;safe&gt;</p>');

    literals[0] = '<script>';
    literals[1] = '</script>';
    assert.throws(() => html(literals, 'alert(1)'), /script content/);

    assert.throws(() => html('not-template-strings'), /template strings/);
    assert.throws(() => html(null), /template strings/);
    const nonStringLiterals = [1];
    nonStringLiterals.raw = [1];
    assert.throws(() => html(nonStringLiterals), /literals must be strings/);
});

test('trusted markup identity is runtime-owned and cannot be forged', () => {
    const forgedHtml = Object.freeze({
        [Symbol.for('white-label-view.HTMLMarkup')]: true,
        value: '<img src=x onerror=alert(1)>'
    });
    const forgedAttributes = Object.freeze({
        [Symbol.for('white-label-view.AttributeMarkup')]: true,
        value: ' onclick="alert(1)"'
    });

    assert.equal(isHTMLMarkup(forgedHtml), false);
    assert.equal(isHTMLMarkup(null), false);
    assert.equal(isHTMLMarkup({value: '<em>untrusted</em>'}), false);
    assert.throws(() => html`<p>${forgedHtml}</p>`, /HTML template interpolations/);
    assert.throws(() => html`<input ${forgedAttributes}>`, /Opening-tag interpolations/);
});
