'use strict';
const fs = require('node:fs');
const path = require('node:path');

function update(file, transform) {
    const before = fs.readFileSync(file, 'utf8');
    const after = transform(before);
    if (after === before) throw new Error(`Expected compatibility changes were not found in ${file}`);
    fs.writeFileSync(file, after);
}

function replaceAll(source, from, to) {
    if (!source.includes(from)) throw new Error(`Missing expected text: ${from}`);
    return source.split(from).join(to);
}

update('src/index.ts', source => {
    source = replaceAll(source, 'twoWayBindingInitialized', 'modelBindingInitialized');
    source = replaceAll(source, 'initializeTwoWayBinding', 'initializeModelBinding');
    source = replaceAll(source, 'destroyTwoWayBinding', 'destroyModelBinding');
    return source;
});

for (const directory of ['test', 'test-types']) {
    if (!fs.existsSync(directory)) continue;
    for (const name of fs.readdirSync(directory)) {
        const file = path.join(directory, name);
        if (!fs.statSync(file).isFile()) continue;
        const before = fs.readFileSync(file, 'utf8');
        let after = before
            .split('initializeTwoWayBinding').join('initializeModelBinding')
            .split('destroyTwoWayBinding').join('destroyModelBinding')
            .split('twoWayBindingInitialized').join('modelBindingInitialized');
        if (after !== before) fs.writeFileSync(file, after);
    }
}

update('README.md', source => {
    source = source
        .split('initializeTwoWayBinding').join('initializeModelBinding')
        .split('destroyTwoWayBinding').join('destroyModelBinding')
        .split('twoWayBindingInitialized').join('modelBindingInitialized');
    source = source.replace(
        'Despite the historical method name, model binding is one-way: model changes trigger view rendering. Form input is not automatically written back to the model.\n',
        'Model binding is one-way: model changes trigger view rendering. Form input is not automatically written back to the model.\n'
    );
    const marker = '## Install\n';
    if (!source.includes(marker)) throw new Error('README install marker not found');
    source = source.replace(marker,
        '## Versioning policy\n\nBackward compatibility is not maintained through aliases, deprecated method names, fallback signatures, or other runtime shims. Breaking public API changes are communicated with a Semantic Versioning major release and documented migration notes.\n\n### Version 5 migration\n\nThe historically named `initializeTwoWayBinding()` and `destroyTwoWayBinding()` methods have been removed. The binding has always been one-way; use `initializeModelBinding()` and `destroyModelBinding()` instead. No compatibility aliases are provided.\n\n' + marker
    );
    return source;
});

update('package.json', source => {
    const data = JSON.parse(source);
    if (data.version !== '4.0.1') throw new Error(`Unexpected package version ${data.version}`);
    data.version = '5.0.0';
    return JSON.stringify(data, null, 2) + '\n';
});
