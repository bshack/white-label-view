const fragment = Symbol('white-label-view.fragment');
const booleanAttributes = new Set([
    'allowfullscreen', 'async', 'autofocus', 'autoplay', 'checked', 'controls', 'default', 'defer',
    'disabled', 'formnovalidate', 'hidden', 'inert', 'ismap', 'itemscope', 'loop', 'multiple', 'muted',
    'nomodule', 'novalidate', 'open', 'playsinline', 'readonly', 'required', 'reversed', 'selected'
]);
const voidElements = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr']);

export interface RawMarkup {readonly __whiteLabelRawMarkup: true; readonly value: string}
export type JSXChild = string | number | bigint | boolean | null | undefined | RawMarkup | JSXChild[];
export type JSXComponent = (props: Record<string, unknown>) => JSXChild;
export type JSXType = string | JSXComponent | typeof fragment;

/** Mark caller-owned markup as trusted so it is inserted without escaping. */
export function raw(value: string): RawMarkup {
    return Object.freeze({__whiteLabelRawMarkup: true as const, value});
}

function escapeText(value: string): string {
    return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

function escapeAttribute(value: string): string {
    return escapeText(value).replaceAll('"', '&quot;');
}

function renderChild(child: JSXChild): string {
    if (child === null || child === undefined || child === false || child === true) {return '';}
    if (Array.isArray(child)) {return child.map(renderChild).join('');}
    if (typeof child === 'object') {return child.value;}
    return escapeText(String(child));
}

function attributeName(name: string): string {
    if (name === 'className') {return 'class';}
    if (name === 'htmlFor') {return 'for';}
    return name;
}

function renderStyle(value: Record<string, unknown>): string {
    return Object.entries(value)
        .filter(([, entry]) => entry !== null && entry !== undefined && entry !== false)
        .map(([name, entry]) => `${name.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`)}:${String(entry)}`)
        .join(';');
}

function renderAttribute(name: string, value: unknown): string {
    const renderedName = attributeName(name);
    if (value === null || value === undefined || value === false) {return '';}
    if (typeof value === 'function' || typeof value === 'symbol' || typeof value === 'object' && !Array.isArray(value) && name !== 'style') {
        throw new TypeError(`Unsupported JSX attribute value for ${name}`);
    }
    if (typeof value === 'boolean') {
        if (booleanAttributes.has(renderedName.toLowerCase())) {return value ? ` ${renderedName}` : '';}
        return ` ${renderedName}="${value}"`;
    }
    const renderedValue = name === 'style' && typeof value === 'object'
        ? renderStyle(value as Record<string, unknown>)
        : Array.isArray(value) ? value.join(' ') : String(value);
    return ` ${renderedName}="${escapeAttribute(renderedValue)}"`;
}

function renderElement(type: string, props: Record<string, unknown>): string {
    const children = props.children as JSXChild;
    const attributes = Object.entries(props)
        .filter(([name]) => name !== 'children')
        .map(([name, value]) => renderAttribute(name, value))
        .join('');
    if (voidElements.has(type.toLowerCase())) {return `<${type}${attributes}>`;}
    return `<${type}${attributes}>${renderChild(children)}</${type}>`;
}

/** Automatic JSX runtime entry point. Output is an escaped HTML string accepted by View templates. */
export function jsx(type: JSXType, props: Record<string, unknown> | null): string {
    const values = props ?? {};
    if (type === fragment) {return renderChild(values.children as JSXChild);}
    if (typeof type === 'function') {return renderChild(type(values));}
    return renderElement(type, values);
}

export const jsxs = jsx;
export const jsxDEV = jsx;
export const Fragment = fragment;

export namespace JSX {
    export type Element = string;
    export interface IntrinsicElements {[name: string]: Record<string, unknown>}
    export interface ElementChildrenAttribute {children: Record<string, unknown>}
}
