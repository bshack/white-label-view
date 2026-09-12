"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Fragment = exports.jsxDEV = exports.jsxs = void 0;
exports.raw = raw;
exports.isJSXMarkup = isJSXMarkup;
exports.jsx = jsx;
const fragment = Symbol('white-label-view.fragment');
const booleanAttributes = new Set([
    'allowfullscreen', 'async', 'autofocus', 'autoplay', 'checked', 'controls', 'default', 'defer',
    'disabled', 'formnovalidate', 'hidden', 'inert', 'ismap', 'itemscope', 'loop', 'multiple', 'muted',
    'nomodule', 'novalidate', 'open', 'playsinline', 'readonly', 'required', 'reversed', 'selected'
]);
const voidElements = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr']);
/** Mark caller-owned markup as trusted so it is inserted without escaping. */
function raw(value) {
    return Object.freeze({ __whiteLabelRawMarkup: true, value });
}
function markup(value) {
    return Object.freeze({
        __whiteLabelJSXMarkup: true,
        value,
        toString: () => value
    });
}
/** Identify output created by this JSX runtime. */
function isJSXMarkup(value) {
    return typeof value === 'object' && value !== null && '__whiteLabelJSXMarkup' in value &&
        value.__whiteLabelJSXMarkup === true;
}
function escapeText(value) {
    return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}
function escapeAttribute(value) {
    return escapeText(value).replaceAll('"', '&quot;');
}
function renderChild(child) {
    if (child === null || child === undefined || child === false || child === true) {
        return '';
    }
    if (Array.isArray(child)) {
        return child.map(renderChild).join('');
    }
    if (typeof child === 'object') {
        if ('__whiteLabelRawMarkup' in child || isJSXMarkup(child)) {
            return child.value;
        }
        throw new TypeError('Unsupported JSX child object');
    }
    return escapeText(String(child));
}
function attributeName(name) {
    if (name === 'className') {
        return 'class';
    }
    if (name === 'htmlFor') {
        return 'for';
    }
    return name;
}
function renderStyle(value) {
    return Object.entries(value)
        .filter(([, entry]) => entry !== null && entry !== undefined && entry !== false)
        .map(([name, entry]) => `${name.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`)}:${String(entry)}`)
        .join(';');
}
function renderAttribute(name, value) {
    const renderedName = attributeName(name);
    if (value === null || value === undefined || value === false) {
        return '';
    }
    if (typeof value === 'function' || typeof value === 'symbol' || typeof value === 'object' && !Array.isArray(value) && name !== 'style') {
        throw new TypeError(`Unsupported JSX attribute value for ${name}`);
    }
    if (typeof value === 'boolean') {
        if (booleanAttributes.has(renderedName.toLowerCase())) {
            return ` ${renderedName}`;
        }
        return ` ${renderedName}="${value}"`;
    }
    const renderedValue = name === 'style' && typeof value === 'object'
        ? renderStyle(value)
        : Array.isArray(value) ? value.join(' ') : String(value);
    return ` ${renderedName}="${escapeAttribute(renderedValue)}"`;
}
function renderElement(type, props) {
    const children = props.children;
    const attributes = Object.entries(props)
        .filter(([name]) => name !== 'children')
        .map(([name, value]) => renderAttribute(name, value))
        .join('');
    if (voidElements.has(type.toLowerCase())) {
        return `<${type}${attributes}>`;
    }
    return `<${type}${attributes}>${renderChild(children)}</${type}>`;
}
/** Automatic JSX runtime entry point. Output remains distinguishable from plain text until the final render boundary. */
function jsx(type, props) {
    const values = props ?? {};
    if (type === fragment) {
        return markup(renderChild(values.children));
    }
    if (typeof type === 'function') {
        return markup(renderChild(type(values)));
    }
    return markup(renderElement(type, values));
}
exports.jsxs = jsx;
exports.jsxDEV = jsx;
exports.Fragment = fragment;
//# sourceMappingURL=jsx-runtime.js.map