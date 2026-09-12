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

console.table(rows);
dom.window.close();
