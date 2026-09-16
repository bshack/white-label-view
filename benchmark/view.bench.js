const assert = require('node:assert/strict');
const {performance} = require('node:perf_hooks');
const {JSDOM} = require('jsdom');
const View = require('../dist/index.js');
const {jsx, jsxs} = require('../dist/jsx-runtime.js');

const rounds = 5;

function median(values) {
    const sorted = [...values].sort((a, b) => a - b);
    return sorted[Math.floor(sorted.length / 2)];
}

function measure(name, iterations, callback) {
    const samples = [];
    for (let round = 0; round < rounds; round += 1) {
        const start = performance.now();
        for (let iteration = 0; iteration < iterations; iteration += 1) callback(iteration);
        samples.push(performance.now() - start);
    }
    return {operation: name, iterations, milliseconds: Number(median(samples).toFixed(2))};
}

class SharedDelegatedEvents {
    constructor(scope) {
        this.scope = scope;
        this.listeners = [];
        this.dispatchers = new Map();
    }

    key(type, capture, passive) {return `${type}:${capture ? 1 : 0}:${passive ? 1 : 0}`;}

    on(type, selector, callback, options = {}) {
        const settings = typeof options === 'boolean' ? {capture: options} : options;
        if (settings.signal?.aborted) return this;
        const registration = {
            type,
            selector,
            callback,
            capture: Boolean(settings.capture),
            passive: Boolean(settings.passive),
            once: Boolean(settings.once),
            signal: settings.signal
        };
        registration.abort = () => this.remove(registration);
        this.listeners.push(registration);
        const key = this.key(type, registration.capture, registration.passive);
        if (!this.dispatchers.has(key)) {
            const listener = event => this.dispatch(type, registration.capture, registration.passive, event);
            this.dispatchers.set(key, listener);
            this.scope.addEventListener(type, listener, {capture: registration.capture, passive: registration.passive});
        }
        registration.signal?.addEventListener('abort', registration.abort, {once: true});
        return this;
    }

    dispatch(type, capture, passive, event) {
        for (const registration of [...this.listeners]) {
            if (registration.type !== type || registration.capture !== capture || registration.passive !== passive) continue;
            const target = event.target && typeof event.target.closest === 'function'
                ? event.target.closest(registration.selector) : null;
            if (target && (target === this.scope || this.scope.contains(target))) {
                if (registration.once) this.remove(registration);
                registration.callback.call(target, event);
            }
        }
    }

    remove(registration) {
        registration.signal?.removeEventListener('abort', registration.abort);
        this.listeners = this.listeners.filter(item => item !== registration);
        const key = this.key(registration.type, registration.capture, registration.passive);
        if (!this.listeners.some(item => this.key(item.type, item.capture, item.passive) === key)) {
            const listener = this.dispatchers.get(key);
            if (listener) this.scope.removeEventListener(registration.type, listener, registration.capture);
            this.dispatchers.delete(key);
        }
    }

    clear() {
        for (const registration of [...this.listeners]) this.remove(registration);
        return this;
    }
}

function addSelectors(events, count, callback = () => {}) {
    for (let index = 0; index < count; index += 1) {
        events.on('click', `.selector-${index}`, callback);
    }
}

function exerciseSharedCompatibility(window, root) {
    const events = new SharedDelegatedEvents(root);
    const button = root.querySelector('.selector-0');
    const calls = [];
    const controller = new AbortController();
    events.on('click', '.selector-0', function () {calls.push(['first', this]);});
    events.on('click', '.selector-0', () => {
        calls.push(['once']);
        button.dispatchEvent(new window.MouseEvent('click', {bubbles: true}));
    }, {once: true});
    events.on('click', '.selector-0', () => calls.push(['aborted']), {signal: controller.signal});
    events.on('click', '.selector-0', () => calls.push(['passive']), {passive: true});
    events.on('click', '.selector-0', () => calls.push(['capture']), true);
    controller.abort();
    button.dispatchEvent(new window.MouseEvent('click', {bubbles: true}));
    assert.equal(calls.filter(call => call[0] === 'once').length, 1);
    assert.equal(calls.some(call => call[0] === 'aborted'), false);
    assert.equal(calls.some(call => call[0] === 'passive'), true);
    assert.equal(calls.some(call => call[0] === 'capture'), true);
    assert.equal(calls[0][0], 'capture');
    assert.equal(calls.filter(call => call[0] === 'first').every(call => call[1] === button), true);
    events.clear();
}

const dom = new JSDOM('<!doctype html><html><body><main></main></body></html>');
const {document} = dom.window;
const parentElement = document.querySelector('main');

const rows = [];

rows.push(measure('JSX element generation', 250_000, iteration => {
    jsx('div', {className: 'card', title: `item-${iteration}`, children: 'Hello'});
}));

rows.push(measure('JSX nested tree generation', 100_000, iteration => {
    jsxs('article', {
        className: 'card',
        style: {marginTop: iteration % 10, opacity: 1},
        children: [
            jsx('h2', {children: `Title ${iteration}`}),
            jsx('p', {children: 'Body'}),
            jsx('input', {disabled: iteration % 2 === 0, value: iteration})
        ]
    });
}));

{
    const view = new View({parentElement, template: () => '<section><h1>Hello</h1><p>World</p></section>'});
    rows.push(measure('unchanged string render', 50_000, () => view.render()));
    view.destroy();
}

{
    let value = 0;
    const view = new View({parentElement, template: () => `<section><h1>${value}</h1><p>World</p></section>`});
    view.render();
    rows.push(measure('changed string render', 5_000, iteration => {
        value = iteration;
        view.render();
    }));
    view.destroy();
}

{
    const element = document.createElement('section');
    parentElement.appendChild(element);
    const view = new View({
        parentElement,
        element,
        model: {get: () => ({value: 1})},
        template: () => '<section></section>',
        update(root, data) {
            root.textContent = String(data.value);
            return true;
        }
    });
    rows.push(measure('update fast path', 100_000, () => view.render()));
    view.destroy();
}

const delegationRoot = document.createElement('section');
delegationRoot.innerHTML = Array.from({length: 100}, (_, index) =>
    `<button class="selector-${index}">${index}</button>`
).join('');
parentElement.appendChild(delegationRoot);
const target = delegationRoot.querySelector('.selector-0');

for (const count of [4, 100]) {
    rows.push(measure(`delegation register+clear current (${count})`, count === 4 ? 2_000 : 300, () => {
        const events = new View({element: delegationRoot}).delegate(delegationRoot);
        addSelectors(events, count);
        events.clear();
    }));
    rows.push(measure(`delegation register+clear shared (${count})`, count === 4 ? 2_000 : 300, () => {
        const events = new SharedDelegatedEvents(delegationRoot);
        addSelectors(events, count);
        events.clear();
    }));

    const current = new View({element: delegationRoot}).delegate(delegationRoot);
    addSelectors(current, count);
    rows.push(measure(`delegation dispatch current (${count})`, count === 4 ? 20_000 : 4_000, () => {
        target.dispatchEvent(new dom.window.MouseEvent('click', {bubbles: true}));
    }));
    current.clear();

    const shared = new SharedDelegatedEvents(delegationRoot);
    addSelectors(shared, count);
    rows.push(measure(`delegation dispatch shared (${count})`, count === 4 ? 20_000 : 4_000, () => {
        target.dispatchEvent(new dom.window.MouseEvent('click', {bubbles: true}));
    }));
    shared.clear();
}

exerciseSharedCompatibility(dom.window, delegationRoot);

console.table(rows);
console.table([
    {registrations: 4, implementation: 'current', nativeListenerClosures: 4},
    {registrations: 4, implementation: 'shared', nativeListenerClosures: 1},
    {registrations: 100, implementation: 'current', nativeListenerClosures: 100},
    {registrations: 100, implementation: 'shared', nativeListenerClosures: 1}
]);
dom.window.close();
