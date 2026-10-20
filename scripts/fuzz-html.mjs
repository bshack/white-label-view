#!/usr/bin/env node
/*
 * Differential fuzzer for white-label-view/html.
 *
 * Generates random templates, renders them with the built `html` tag, and parses every accepted output
 * with parse5 (a spec-compliant HTML parser, with scripting both on and off). An untrusted sentinel value
 * must never become an attribute, an element, script/style source, or comment content. Any template that
 * breaks that is minimized and printed, and the process exits non-zero.
 *
 * Usage: npm run fuzz -- [--count=N] [--seed=S|random]
 * Requires a build (npm run build); npm run fuzz builds first.
 */
import {createRequire} from 'node:module';
import {parseFragment} from 'parse5';

const require = createRequire(import.meta.url);
const {html, attributes, unsafeHTML} = require('../dist/html.js');

function option(name, fallback) {
    const prefix = `--${name}=`;
    const argument = process.argv.slice(2).find(value => value.startsWith(prefix));
    return argument === undefined ? fallback : argument.slice(prefix.length);
}

const count = Number(option('count', '20000'));
const seedOption = option('seed', '1');
const seed = seedOption === 'random' ? Math.floor(Math.random() * 2 ** 32) : Number(seedOption);
if (!Number.isSafeInteger(count) || count < 1 || !Number.isSafeInteger(seed) || seed < 0) {
    console.error('Usage: fuzz-html.mjs [--count=N] [--seed=S|random] (N >= 1, S a non-negative integer)');
    process.exit(2);
}

// mulberry32: small, fast, deterministic for a given seed.
let rngState = seed >>> 0;
function random() {
    rngState = (rngState + 0x6D2B79F5) >>> 0;
    let t = rngState;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const rand = n => Math.floor(random() * n);
const pick = values => values[rand(values.length)];

// Generator 1: token soup biased towards the tokenizer's edge cases.
const vocab = ['<', '>', '/', '"', "'", '=', ' ', '\n', 'a', 'p', 'b', 'x', 'script', 'style', 'textarea', 'title', 'noscript',
    'svg', 'math', 'mi', 'desc', 'foreignObject', '<!--', '-->', '--!>', '-', '!', '<!', '<?', ']]>', '<![CDATA[', '</', 'iframe',
    'xmp', 'plaintext', 'onclick', 'title=', 'İ', '&', 'select', 'table', 'div', '<p>', '</p>', '<svg>', '</svg>', '<script>', '</script>',
    '<style>', '</style>', '<textarea>', '</textarea>', '<a ', 'class="c"', '[x]', '(y)', '@z', 'br', 'font', 'path', 'g', '="a>b"', "='a>b'",
    '<a [x]', '<img (y)'];
const benign = ['x', ' ', 'text ', '<p>', '</p>', '<b>', '</b>', '<div ', ' class="c">', '<i title="t">', '</i>', '>', '<span>'];
const soupEnds = [' title=', ' b=', '', ' ', '<p>', '<div ', '<div title="', "<div title='", '<div class="c"', '<input ', '<textarea>',
    '<title>', '<svg>', '<svg><text>', '<p class="a"'];
function soupFragment() {
    let source = '';
    const length = 1 + rand(8);
    for (let index = 0; index < length; index += 1) {source += rand(3) ? pick(benign) : pick(vocab);}
    return source;
}

// Generator 2: structured tags, attributes, comments and declarations.
const tagNames = ['p', 'div', 'a', 'script', 'style', 'textarea', 'title', 'noscript', 'iframe', 'xmp', 'plaintext', 'svg', 'math', 'mi',
    'desc', 'foreignObject', 'select', 'table', 'b', 'br', 'font', 'path', 'g', 'template', 'SCRIPT', 'scrİpt', 'noembed'];
const attributeNames = ['title', 'class', '[x]', '(y)', '@z', 'a"b', "a'b", 'a<b', 'onclick', 'x-y', '=', 'b=c', 'src'];
const specials = ['>', '"', "'", '</textarea>', '</script>', '</style>', '-->', '<!--', '</noscript>', ']]>', '=', ' ', '/', '<p>', 'x', 'İ',
    '</title>', '</iframe>'];
const structuredEnds = ['', '<p>', ' ', '<div title="', "<div title='", '<div class="c"', '<input ', '<div title=', '<b x '];
function specialValue() {
    let value = '';
    const length = rand(4);
    for (let index = 0; index < length; index += 1) {value += pick(specials);}
    return value;
}
function structuredAttribute() {
    const name = pick(attributeNames);
    const quote = rand(4);
    if (quote === 0) {return ` ${name}`;}
    const value = specialValue();
    if (quote === 1) {return ` ${name}="${value.replace(/"/g, '')}"`;}
    if (quote === 2) {return ` ${name}='${value.replace(/'/g, '')}'`;}
    return ` ${name}=${value}`;
}
function structuredPiece() {
    switch (rand(9)) {
    case 0:
    case 1: {
        let tag = `<${pick(tagNames)}`;
        const length = rand(3);
        for (let index = 0; index < length; index += 1) {tag += structuredAttribute();}
        return tag + (rand(5) ? '>' : '/>');
    }
    case 2: return `</${pick(tagNames)}>`;
    case 3: return `<!--${specialValue()}${rand(3) ? '-->' : '--!>'}`;
    case 4: return pick([`<!x${specialValue()}>`, `<?${specialValue()}>`, `<![CDATA[${specialValue()}]]>`, '<!doctype html>', '<!-->', '<!--->']);
    case 5: return specialValue();
    default: return pick(['text', ' ', '1 < 2', '&amp;']);
    }
}
function structuredFragment() {
    let source = '';
    const length = 1 + rand(6);
    for (let index = 0; index < length; index += 1) {source += structuredPiece();}
    return source;
}

const generators = [
    {fragment: soupFragment, ends: soupEnds},
    {fragment: structuredFragment, ends: structuredEnds}
];

// The untrusted value. If it is ever parsed as markup, "qzq"/"qzw" show up as attribute or tag names.
const SENTINEL = 'QZQ QZW=1';

/** Value descriptions are kept separate from the values so a failure can be printed and minimized. */
function generateTemplate(generator) {
    const parts = 2 + rand(3);
    const literals = [];
    for (let index = 0; index < parts; index += 1) {
        literals.push(index < parts - 1 ? generator.fragment() + pick(generator.ends) : generator.fragment());
    }
    const values = [];
    for (let index = 0; index < parts - 1; index += 1) {
        const kind = rand(4);
        if (kind === 0) {values.push({kind: 'attributes'});}
        else if (kind === 1) {values.push({kind: 'unsafeHTML', source: generator.fragment()});}
        else if (kind === 2) {values.push({kind: 'html', source: generator.fragment()});}
        else {values.push({kind: 'text'});}
    }
    // The last interpolation always carries the sentinel.
    values[parts - 2] = {kind: rand(2) ? 'text' : 'attributes'};
    return {literals, values};
}

function buildValue(description) {
    switch (description.kind) {
    case 'attributes': return attributes({'data-k': SENTINEL});
    case 'unsafeHTML': return unsafeHTML(description.source);
    case 'html': return html(Object.assign([description.source], {raw: [description.source]}));
    default: return SENTINEL;
    }
}

/** Render a template, or return null when html rejects it (rejection is always a safe outcome). */
function render({literals, values}) {
    const strings = Object.assign([...literals], {raw: [...literals]});
    try {
        return String(html(strings, ...values.map(buildValue)));
    } catch {
        return null;
    }
}

function walk(node, visit, inRaw) {
    visit(node, inRaw);
    const raw = inRaw || node.nodeName === 'script' || node.nodeName === 'style';
    for (const child of node.childNodes || []) {walk(child, visit, raw);}
    if (node.content) {walk(node.content, visit, raw);}
}

function problemsIn(output) {
    const problems = [];
    for (const scriptingEnabled of [true, false]) {
        walk(parseFragment(output, {scriptingEnabled}), (node, inRaw) => {
            for (const attribute of node.attrs || []) {
                if (/qz[qw]/.test(attribute.name)) {problems.push(`attribute ${attribute.name} (scripting=${scriptingEnabled})`);}
            }
            if (/qz/i.test(node.nodeName)) {problems.push(`element ${node.nodeName} (scripting=${scriptingEnabled})`);}
            if (node.nodeName === '#text' && inRaw && node.value.includes('QZQ')) {
                problems.push(`script/style source (scripting=${scriptingEnabled})`);
            }
            if (node.nodeName === '#comment' && node.data.includes('QZQ')) {problems.push(`comment (scripting=${scriptingEnabled})`);}
        }, false);
    }
    return problems;
}

function fails(template) {
    const output = render(template);
    return output !== null && problemsIn(output).length > 0;
}

/**
 * Greedy delta-debugging: drop interpolations, simplify values, then delete character runs from the literals
 * and from nested markup sources, keeping each change that still reproduces the failure.
 */
function minimize(template) {
    let current = structuredClone(template);
    const attempt = candidate => {
        if (fails(candidate)) {current = candidate; return true;}
        return false;
    };
    const shrinkString = (read, write) => {
        let changed = false;
        for (let size = read(current).length; size >= 1; size = Math.floor(size / 2)) {
            for (let start = 0; start + size <= read(current).length;) {
                const value = read(current);
                if (attempt(write(current, value.slice(0, start) + value.slice(start + size)))) {changed = true;} else {start += 1;}
            }
        }
        return changed;
    };
    let changed = true;
    while (changed) {
        changed = false;
        // Remove interpolation i by joining the literals around it.
        for (let index = 0; index < current.values.length && current.values.length > 1;) {
            const literals = [...current.literals];
            literals.splice(index, 2, literals[index] + literals[index + 1]);
            const values = current.values.filter((_, position) => position !== index);
            if (attempt({literals, values})) {changed = true;} else {index += 1;}
        }
        for (let index = 0; index < current.values.length; index += 1) {
            if (current.values[index].kind === 'text') {continue;}
            const values = current.values.with(index, {kind: 'text'});
            if (attempt({literals: current.literals, values})) {changed = true;}
        }
        for (let index = 0; index < current.literals.length; index += 1) {
            if (shrinkString(state => state.literals[index],
                (state, value) => ({literals: state.literals.with(index, value), values: state.values}))) {changed = true;}
        }
        for (let index = 0; index < current.values.length; index += 1) {
            if (current.values[index].source === undefined) {continue;}
            if (shrinkString(state => state.values[index].source,
                (state, source) => ({literals: state.literals, values: state.values.with(index, {...state.values[index], source})}))) {changed = true;}
        }
    }
    return current;
}

function describe({literals, values}) {
    const shown = value => {
        switch (value.kind) {
        case 'attributes': return `\${attributes({'data-k': ${JSON.stringify(SENTINEL)}})}`;
        case 'unsafeHTML': return `\${unsafeHTML(${JSON.stringify(value.source)})}`;
        case 'html': return `\${html\`${value.source}\`}`;
        default: return `\${${JSON.stringify(SENTINEL)}}`;
        }
    };
    let source = literals[0];
    values.forEach((value, index) => {source += shown(value) + literals[index + 1];});
    return `html\`${source}\``;
}

console.log(`fuzz-html: ${count} templates, seed ${seed}`);
let accepted = 0;
for (let iteration = 0; iteration < count; iteration += 1) {
    const template = generateTemplate(generators[iteration % generators.length]);
    const output = render(template);
    if (output === null) {continue;}
    accepted += 1;
    const problems = problemsIn(output);
    if (problems.length) {
        const minimal = minimize(template);
        console.error(`Differential found at template ${iteration} (seed ${seed}).`);
        console.error(`Original:  ${describe(template)}`);
        console.error(`Minimized: ${describe(minimal)}`);
        console.error(`Literals:  ${JSON.stringify(minimal.literals)}`);
        console.error(`Values:    ${JSON.stringify(minimal.values)}`);
        console.error(`Output:    ${JSON.stringify(render(minimal))}`);
        console.error(`Problems:  ${[...new Set(problemsIn(render(minimal)))].join('; ')}`);
        process.exit(1);
    }
}
console.log(`fuzz-html: 0 differentials (${accepted} of ${count} templates accepted and parsed)`);
