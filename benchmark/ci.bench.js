'use strict';

/*
 * Short benchmark for CI: a reduced version of view.bench.js that compares against benchmark/baseline.json.
 * It fails only when an operation is more than `tolerance` times slower than the baseline (runner noise is
 * large) or when a deterministic counter changes.
 *
 *   npm run bench:ci                   compare against the baseline
 *   npm run bench:ci -- --update       re-record benchmark/baseline.json on this machine
 */

const fs = require('node:fs');
const path = require('node:path');
const {performance} = require('node:perf_hooks');
const {JSDOM} = require('jsdom');
const View = require('../dist/index.js');
const {attributes, html} = require('../dist/html.js');

const baselinePath = path.join(__dirname, 'baseline.json');
const tolerance = 3;
const rounds = 7;

function median(values) {
    const sorted = [...values].sort((a, b) => a - b);
    return sorted[Math.floor(sorted.length / 2)];
}

function measure(iterations, callback) {
    // One untimed round warms up the JIT and the template plan cache.
    for (let iteration = 0; iteration < iterations; iteration += 1) {callback(iteration);}
    const samples = [];
    for (let round = 0; round < rounds; round += 1) {
        const start = performance.now();
        for (let iteration = 0; iteration < iterations; iteration += 1) {callback(iteration);}
        samples.push(performance.now() - start);
    }
    return Number(median(samples).toFixed(2));
}

const dom = new JSDOM('<!doctype html><html><body><main></main></body></html>');
const parentElement = dom.window.document.querySelector('main');
const operations = {};
const counters = {};

{
    let length = 0;
    operations['tagged HTML generation'] = {iterations: 200_000, milliseconds: measure(200_000, iteration => {
        length = String(html`<div class="card" title="item-${iteration % 10}">Hello</div>`).length;
    })};
    counters['tagged HTML generation output length'] = length;
}

{
    let length = 0;
    operations['tagged HTML nested generation'] = {iterations: 50_000, milliseconds: measure(50_000, iteration => {
        const heading = html`<h2>Title ${iteration % 10}</h2>`;
        const body = html`<p>Body</p>`;
        const input = html`<input ${attributes({disabled: iteration % 2 === 0, value: iteration % 10})}>`;
        length = String(html`<article class="card">${[heading, body, input]}</article>`).length;
    })};
    counters['tagged HTML nested generation output length'] = length;
}

{
    const view = new View({parentElement, template: () => html`<section><h1>Hello</h1><p>World</p></section>`});
    view.render();
    const root = view.element;
    let replacements = 0;
    operations['unchanged tagged render'] = {iterations: 50_000, milliseconds: measure(50_000, () => {
        view.render();
        if (view.element !== root) {replacements += 1;}
    })};
    // An unchanged render must keep the mounted root.
    counters['unchanged tagged render root replacements'] = replacements;
    view.destroy();
}

dom.window.close();

const current = {node: process.version, tolerance, operations, counters};

if (process.argv.includes('--update')) {
    fs.writeFileSync(baselinePath, `${JSON.stringify(current, null, 2)}\n`);
    console.log(`Recorded ${path.relative(process.cwd(), baselinePath)}`);
    console.table(operations);
    process.exit(0);
}

const baseline = JSON.parse(fs.readFileSync(baselinePath, 'utf8'));
const failures = [];
const rows = [];
for (const [name, {iterations, milliseconds}] of Object.entries(operations)) {
    const expected = baseline.operations[name];
    if (!expected) {
        failures.push(`${name}: missing from baseline.json (run npm run bench:ci -- --update)`);
        continue;
    }
    if (expected.iterations !== iterations) {failures.push(`${name}: iterations changed from ${expected.iterations} to ${iterations}`);}
    const ratio = milliseconds / expected.milliseconds;
    rows.push({operation: name, iterations, milliseconds, baseline: expected.milliseconds, ratio: Number(ratio.toFixed(2))});
    if (ratio > tolerance) {failures.push(`${name}: ${milliseconds} ms is ${ratio.toFixed(2)}x the ${expected.milliseconds} ms baseline (limit ${tolerance}x)`);}
}
for (const [name, value] of Object.entries(counters)) {
    if (baseline.counters[name] !== value) {failures.push(`${name}: expected ${baseline.counters[name]}, got ${value}`);}
}
console.table(rows);
if (failures.length) {
    console.error(failures.join('\n'));
    process.exit(1);
}
console.log(`bench:ci: all operations within ${tolerance}x of baseline; counters unchanged.`);
