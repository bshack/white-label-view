'use strict';

/*
 * Real-browser checks, run with `npm run test:browser` (not part of npm test or coverage).
 *
 * 1. Tagged-HTML output is rendered in Node, then parsed by Chromium (innerHTML with scripting on, and
 *    DOMParser with scripting off). For accepted templates, the DOM shape must not depend on the
 *    interpolated value, and the untrusted value must survive as text or an attribute value, never as an
 *    element, attribute, or handler. For rejected templates, naive string concatenation is shown to change
 *    the DOM shape, which is why the tokenizer rejects them.
 * 2. Browser View lifecycle against the real DOM: render, delegated listener reached by a real click,
 *    update, and destroy removing the root and its listeners; plus adopting a server-rendered element.
 *
 * Locally, set PLAYWRIGHT_CHROMIUM_EXECUTABLE to a Chromium binary; CI uses `npx playwright install chromium`.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const esbuild = require('esbuild');
const {chromium} = require('playwright');
const {attributes, html, unsafeHTML} = require('../../dist/html.js');

const probe = 'window.__securityProbe=1';
const payloads = [
    `x onmouseover=${probe}`,
    `"><img src=x onerror=${probe}>`,
    `'><svg onload=${probe}>`,
    `</textarea></title><img src=x onerror=${probe}>`,
    `--><img src=x onerror=${probe}><!--`,
    `<script>${probe}</script>`,
    `]]><img src=x onerror=${probe}>`
];
const benign = 'SAFE';

// Accepted templates, as functions of the untrusted value. Drawn from the security cases in
// test/html.test.js and test/html-tokenizer.test.js.
const acceptedCases = {
    'text content': v => html`<p>${v}</p>`,
    'double-quoted attribute': v => html`<div title="${v}"></div>`,
    'single-quoted attribute': v => html`<a href="/x" title='${v}'>t</a>`,
    'textarea RCDATA': v => html`<textarea>${v}</textarea>`,
    'title RCDATA': v => html`<title>${v}</title>`,
    'svg text': v => html`<svg><text>${v}</text></svg>`,
    'math text': v => html`<math><mi>${v}</mi></math>`,
    'attributes() values': v => html`<input ${attributes({value: v, title: v, 'data-x': [v, v]})}>`,
    'attributes() after tag name': v => html`<input${attributes({value: v})}/><p>${v}</p>`,
    'attributes() after quoted value': v => html`<div class="a"${attributes({title: v})}></div>`,
    'attribute names with tokenizer punctuation': v => html`<div [hidden]="n > 0" (click)='a>b' title="${v}"></div>`,
    'unquoted value containing a quote': v => html`<div a=b"c title="${v}"></div>`,
    'less-than that is not a tag': v => html`<p>1 < 2 ${v}</p>`,
    'empty comments': v => html`<!-->${v}<!--->${v}<p>${v}</p>`,
    'after a script element': v => html`<script>/* </scriptx> */</script><p>${v}</p>`,
    'after a noscript element': v => html`<noscript><p>fallback</p></noscript><p>${v}</p>`,
    'select option': v => html`<select><option>${v}</option></select>`,
    'table cell': v => html`<table><tbody><tr><td title="${v}">${v}</td></tr></tbody></table>`,
    'template content': v => html`<template><p title="${v}">${v}</p></template>`,
    'nested markup and arrays': v => html`<ul>${[v, html`<li title="${v}">${v}</li>`]}</ul>`,
    'after trusted markup': v => html`<p>${unsafeHTML('<b title="x>">trusted</b>')}${v}</p>`,
    'after leaving svg': v => html`<svg><path></path></svg><p title="${v}">${v}</p>`
};

// Rejected templates: literals plus a value to insert by naive concatenation instead of html.
const rejectedCases = {
    'unquoted attribute value': {literals: ['<div title=', '></div>'], value: payloads[0]},
    'tag name': {literals: ['<', '></', '>'], value: 'img src=x onerror=1'},
    'comment content': {literals: ['<!-- ', ' -->'], value: payloads[4]},
    'style content': {literals: ['<style>', '</style>'], value: `</style><img src=x onerror=${probe}>`},
    'script content': {literals: ['<script>', '</script>'], value: `</script><img src=x onerror=${probe}>`},
    'event-handler attribute': {literals: ['<button onclick="', '">b</button>'], value: probe, handler: true},
    'attributes() inside a tag name': {literals: ['<a', 'b>'], value: ' title="t"', attributes: true},
    'attributes() before =': {literals: ['<a b ', '=c>'], value: ' title="t"', attributes: true},
    // Rejected for consistency rather than safety: browsers drop end-tag attributes, so the shape is unchanged.
    'attributes() in an end tag': {literals: ['<p></p ', '><i></i>'], value: ' title="t"', attributes: true, dropped: true}
};

function bundle() {
    const result = esbuild.buildSync({
        stdin: {
            contents: "window.WLV = {View: require('./dist/index.js'), ...require('./dist/html.js')};",
            resolveDir: path.join(__dirname, '..', '..'),
            loader: 'js'
        },
        bundle: true,
        format: 'iife',
        platform: 'browser',
        target: 'es2022',
        write: false
    });
    return result.outputFiles[0].text;
}

let browser;
let page;

test.before(async () => {
    browser = await chromium.launch({executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined});
    page = await browser.newPage();
    await page.setContent('<!doctype html><html><head><title>t</title></head><body><main></main></body></html>');
    await page.addScriptTag({content: bundle()});
});

test.after(async () => {
    await browser?.close();
});

/**
 * Parse markup in Chromium both ways and return, per mode, the DOM shape (tags, attribute names, node kinds)
 * and every text and attribute value. Hovers every element and waits a frame so injected handlers would run.
 */
function parseInBrowser(markup) {
    return page.evaluate(async source => {
        const describe = node => {
            if (node.nodeType === 3) {return {shape: '#text', values: [node.data]};}
            if (node.nodeType === 8) {return {shape: '#comment', values: [node.data]};}
            const values = [];
            const children = [];
            const childNodes = [...node.childNodes, ...(node.content ? node.content.childNodes : [])];
            for (const child of childNodes) {
                const description = describe(child);
                children.push(description.shape);
                values.push(...description.values);
            }
            const names = [];
            for (const attribute of node.attributes || []) {
                names.push(attribute.name);
                values.push(attribute.value);
            }
            return {shape: `${node.nodeName}[${names.join(',')}](${children.join(' ')})`, values};
        };
        window.__securityProbe = 0;
        const live = document.createElement('div');
        document.body.appendChild(live);
        live.innerHTML = source;
        for (const element of live.querySelectorAll('*')) {element.dispatchEvent(new MouseEvent('mouseover', {bubbles: true}));}
        await new Promise(resolve => requestAnimationFrame(() => setTimeout(resolve, 0)));
        const scripted = describe(live);
        live.remove();
        const parsed = new DOMParser().parseFromString(`<!doctype html><body>${source}`, 'text/html').body;
        const unscripted = describe(parsed);
        return {scripted, unscripted, probe: window.__securityProbe};
    }, markup);
}

test('accepted interpolations never change the DOM shape or become markup in Chromium', async () => {
    for (const [name, render] of Object.entries(acceptedCases)) {
        const expected = await parseInBrowser(String(render(benign)));
        for (const payload of payloads) {
            const actual = await parseInBrowser(String(render(payload)));
            const label = `${name} with ${JSON.stringify(payload)}`;
            assert.equal(actual.scripted.shape, expected.scripted.shape, `${label} (scripting on)`);
            assert.equal(actual.unscripted.shape, expected.unscripted.shape, `${label} (scripting off)`);
            assert.ok(actual.scripted.values.some(value => value.includes(payload)), `${label} kept as text or a value`);
            assert.ok(actual.unscripted.values.some(value => value.includes(payload)), `${label} kept as text or a value`);
            assert.equal(actual.probe, 0, `${label} ran no injected code`);
        }
    }
});

test('rejected interpolations are ones whose naive concatenation Chromium parses differently', async () => {
    for (const [name, {literals, value, handler, dropped, attributes: isAttributes}] of Object.entries(rejectedCases)) {
        const strings = Object.assign([...literals], {raw: [...literals]});
        const values = literals.slice(1).map(() => (isAttributes ? attributes({title: 't'}) : value));
        assert.throws(() => html(strings, ...values), TypeError, `${name} is rejected by html`);
        const join = inserted => literals.join(inserted);
        const benignParse = await parseInBrowser(join(isAttributes ? '' : benign));
        const naiveParse = await parseInBrowser(join(value));
        if (handler) {
            // The value lands in executable code rather than changing structure.
            assert.ok(naiveParse.scripted.shape.includes('onclick'), name);
        } else if (dropped) {
            assert.equal(naiveParse.scripted.shape, benignParse.scripted.shape, `${name}: browser drops the attributes`);
        } else {
            assert.notEqual(naiveParse.scripted.shape, benignParse.scripted.shape, `${name}: naive output changes shape`);
        }
    }
});

async function listenerCount(handle, type) {
    const session = await page.context().newCDPSession(page);
    try {
        await handle.evaluate(element => {window.__inspected = element;});
        const {result} = await session.send('Runtime.evaluate', {expression: 'window.__inspected'});
        const {listeners} = await session.send('DOMDebugger.getEventListeners', {objectId: result.objectId});
        return listeners.filter(listener => listener.type === type).length;
    } finally {
        await session.detach();
    }
}

test('View renders, handles real delegated clicks, updates, and destroys its root and listeners', async () => {
    await page.evaluate(() => {
        const {View, html} = window.WLV;
        const main = document.querySelector('main');
        main.replaceChildren();
        const model = new EventTarget();
        model.count = 0;
        model.get = () => ({count: model.count});
        class Counter extends View {
            addListeners() {
                this.delegated.on('click', '[data-action="increment"]', () => {
                    model.count += 1;
                    model.dispatchEvent(new CustomEvent('change'));
                });
                return this;
            }
        }
        window.__counter = new Counter({
            parentElement: main,
            model,
            template: data => html`<section class="counter"><button type="button" data-action="increment">Add</button><output>${data.count}</output></section>`,
            update(element, data) {
                element.querySelector('output').textContent = String(data.count);
                return true;
            }
        }).initialize();
        window.__counterRoot = window.__counter.element;
    });
    assert.equal(await page.textContent('main output'), '0');
    await page.click('main [data-action="increment"]');
    await page.click('main [data-action="increment"]');
    assert.equal(await page.textContent('main output'), '2');
    // In-place update kept the same root element.
    assert.equal(await page.evaluate(() => window.__counter.element === window.__counterRoot), true);

    const root = await page.evaluateHandle(() => window.__counterRoot);
    assert.equal(await listenerCount(root, 'click'), 1);
    await page.evaluate(() => window.__counter.destroy());
    assert.equal(await page.locator('main section').count(), 0, 'destroy removes the root');
    assert.equal(await listenerCount(root, 'click'), 0, 'destroy removes the delegated listener');
    // Clicking the detached root after reattaching it elsewhere does not reach the destroyed View.
    await page.evaluate(() => document.body.appendChild(window.__counterRoot));
    await page.click('body > section [data-action="increment"]');
    assert.equal(await page.textContent('body > section output'), '2');
    await page.evaluate(() => window.__counterRoot.remove());
    await root.dispose();
});

test('View adopts a server-rendered element and updates it in place', async () => {
    await page.evaluate(() => {
        const {View} = window.WLV;
        const main = document.querySelector('main');
        main.innerHTML = '<p class="host">Host</p><div data-filter-status>No color filter selected</div><button data-pick>Pick</button>';
        const status = main.querySelector('[data-filter-status]');
        const model = new EventTarget();
        model.color = '';
        model.get = () => ({color: model.color});
        window.__adoptModel = model;
        window.__adopted = new View({
            parentElement: main,
            element: status,
            model,
            update(element, data) {
                element.textContent = data.color ? `Color filter: ${data.color}` : 'No color filter selected';
                return true;
            }
        }).initialize();
        window.__adoptedRoot = status;
        main.querySelector('[data-pick]').addEventListener('click', () => {
            model.color = 'red';
            model.dispatchEvent(new CustomEvent('change'));
        });
    });
    assert.equal(await page.textContent('[data-filter-status]'), 'No color filter selected');
    await page.click('[data-pick]');
    assert.equal(await page.textContent('[data-filter-status]'), 'Color filter: red');
    assert.equal(await page.evaluate(() => window.__adopted.element === window.__adoptedRoot), true, 'adopted root kept');
    await page.evaluate(() => window.__adopted.destroy());
    assert.equal(await page.locator('[data-filter-status]').count(), 0, 'destroy removes the adopted root');
    assert.equal(await page.locator('main .host').count(), 1, 'host siblings are not owned');
    // The model subscription was released: a later change does not touch the detached root.
    await page.evaluate(() => {
        window.__adoptModel.color = 'blue';
        window.__adoptModel.dispatchEvent(new CustomEvent('change'));
    });
    assert.equal(await page.evaluate(() => window.__adoptedRoot.textContent), 'Color filter: red');
});
