const htmlMarkupBrand = Symbol.for('white-label-view.HTMLMarkup');
const attributeMarkupBrand = Symbol.for('white-label-view.AttributeMarkup');

const booleanAttributes = new Set([
    'allowfullscreen', 'async', 'autofocus', 'autoplay', 'checked', 'controls', 'default', 'defer',
    'disabled', 'formnovalidate', 'hidden', 'inert', 'ismap', 'itemscope', 'loop', 'multiple', 'muted',
    'nomodule', 'novalidate', 'open', 'playsinline', 'readonly', 'required', 'reversed', 'selected'
]);
const validAttributeName = /^[A-Za-z_:][A-Za-z0-9:._-]*$/;

type Context = 'text' | 'tag' | 'double' | 'single' | 'comment' | 'script' | 'style';

interface ParseState {
    context: Context;
    tagName: string;
    closingTag: boolean;
    readingTagName: boolean;
}

interface AttributeMarkup {readonly value: string}

export interface HTMLMarkup {
    readonly value: string;
    toString(): string;
    [Symbol.toPrimitive](): string;
}

function markup(value: string): HTMLMarkup {
    return Object.freeze({
        [htmlMarkupBrand]: true,
        value,
        toString: () => value,
        [Symbol.toPrimitive]: () => value
    });
}

/** Identify output created by this package, including output from another installed copy. */
export function isHTMLMarkup(value: unknown): value is HTMLMarkup {
    return typeof value === 'object' && value !== null &&
        (value as Record<PropertyKey, unknown>)[htmlMarkupBrand] === true &&
        typeof (value as {value?: unknown}).value === 'string';
}

function isAttributeMarkup(value: unknown): value is AttributeMarkup {
    return typeof value === 'object' && value !== null &&
        (value as Record<PropertyKey, unknown>)[attributeMarkupBrand] === true &&
        typeof (value as {value?: unknown}).value === 'string';
}

function escapeHTML(value: string): string {
    return value
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
}

function scalar(value: unknown, attribute = false): string {
    if (value === null || value === undefined) {return '';}
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'bigint') {
        return escapeHTML(String(value));
    }
    if (typeof value === 'boolean') {return attribute ? String(value) : '';}
    throw new TypeError('HTML template interpolations must be primitive values, HTML markup, attributes, or arrays of supported values');
}

function renderText(value: unknown): string {
    if (Array.isArray(value)) {return value.map(renderText).join('');}
    if (isHTMLMarkup(value)) {return value.value;}
    if (isAttributeMarkup(value)) {throw new TypeError('attributes() may only be interpolated inside an opening tag');}
    return scalar(value);
}

function renderQuotedAttribute(value: unknown): string {
    if (Array.isArray(value) || isHTMLMarkup(value) || isAttributeMarkup(value)) {
        throw new TypeError('Quoted attribute interpolations must be primitive values');
    }
    return scalar(value, true);
}

function attributeValue(value: unknown): string | null {
    if (value === null || value === undefined || value === false) {return null;}
    if (Array.isArray(value)) {
        return value.map(entry => {
            if (entry === null || entry === undefined || entry === false) {return '';}
            if (typeof entry === 'string' || typeof entry === 'number' || typeof entry === 'bigint' || typeof entry === 'boolean') {
                return String(entry);
            }
            throw new TypeError('Attribute arrays may contain only primitive values');
        }).filter(Boolean).join(' ');
    }
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'bigint' || typeof value === 'boolean') {
        return String(value);
    }
    throw new TypeError('Attribute values must be primitive values or arrays of primitive values');
}

/** Render validated HTML attributes for interpolation in an opening tag. */
export function attributes(values: Record<string, unknown>): AttributeMarkup {
    let rendered = '';
    for (const [name, value] of Object.entries(values)) {
        if (!validAttributeName.test(name) || /^on/i.test(name)) {
            throw new TypeError(`Unsupported HTML attribute name ${name}`);
        }
        if (name.toLowerCase() === 'srcdoc') {
            throw new TypeError('srcdoc requires an application-owned explicit HTML policy');
        }
        if (value === true && booleanAttributes.has(name.toLowerCase())) {
            rendered += ` ${name}`;
            continue;
        }
        const normalized = attributeValue(value);
        if (normalized !== null) {rendered += ` ${name}="${escapeHTML(normalized)}"`;}
    }
    return Object.freeze({[attributeMarkupBrand]: true, value: rendered}) as AttributeMarkup;
}

/** Insert caller-owned, already trusted or sanitized HTML without escaping. */
export function unsafeHTML(value: string): HTMLMarkup {
    if (typeof value !== 'string') {throw new TypeError('unsafeHTML() requires a string');}
    return markup(value);
}

function startTag(state: ParseState) {
    state.context = 'tag';
    state.tagName = '';
    state.closingTag = false;
    state.readingTagName = true;
}

function finishTag(state: ParseState) {
    const rawText = !state.closingTag && (state.tagName === 'script' || state.tagName === 'style')
        ? state.tagName as 'script' | 'style'
        : 'text';
    state.context = rawText;
    state.tagName = '';
    state.closingTag = false;
    state.readingTagName = false;
}

function advance(state: ParseState, source: string) {
    const lower = source.toLowerCase();
    let index = 0;
    while (index < source.length) {
        if (state.context === 'text') {
            if (source.startsWith('<!--', index)) {
                state.context = 'comment';
                index += 4;
                continue;
            }
            if (source[index] === '<') {
                startTag(state);
                index += 1;
                if (source[index] === '/') {
                    state.closingTag = true;
                    index += 1;
                } else if (source[index] === '!' || source[index] === '?') {
                    state.readingTagName = false;
                }
                continue;
            }
            index += 1;
            continue;
        }

        if (state.context === 'comment') {
            const end = source.indexOf('-->', index);
            if (end === -1) {return;}
            state.context = 'text';
            index = end + 3;
            continue;
        }

        if (state.context === 'script' || state.context === 'style') {
            const close = `</${state.context}`;
            const end = lower.indexOf(close, index);
            if (end === -1) {return;}
            state.context = 'text';
            index = end;
            continue;
        }

        if (state.context === 'double' || state.context === 'single') {
            const quote = state.context === 'double' ? '"' : "'";
            const end = source.indexOf(quote, index);
            if (end === -1) {return;}
            state.context = 'tag';
            index = end + 1;
            continue;
        }

        const character = source[index]!;
        if (state.readingTagName) {
            if (/\s/.test(character)) {
                state.readingTagName = false;
            } else if (character === '>') {
                finishTag(state);
            } else if (character !== '/') {
                state.tagName += character.toLowerCase();
            }
            index += 1;
            continue;
        }
        if (character === '"') {state.context = 'double';}
        else if (character === "'") {state.context = 'single';}
        else if (character === '>') {finishTag(state);}
        index += 1;
    }
}

function canInsertAttributes(previousLiteral: string): boolean {
    return /\s$/.test(previousLiteral) || /<[A-Za-z][A-Za-z0-9:._-]*$/.test(previousLiteral);
}

function renderInterpolation(value: unknown, state: ParseState, previousLiteral: string): string {
    if (state.context === 'text') {return renderText(value);}
    if (state.context === 'double' || state.context === 'single') {return renderQuotedAttribute(value);}
    if (state.context === 'tag') {
        if (value === null || value === undefined || value === false) {return '';}
        if (isAttributeMarkup(value) && canInsertAttributes(previousLiteral)) {
            return /\s$/.test(previousLiteral) ? value.value.replace(/^ /, '') : value.value;
        }
        throw new TypeError('Opening-tag interpolations must use attributes() at an attribute boundary');
    }
    throw new TypeError(`HTML interpolation is not supported inside ${state.context} content`);
}

/** Render an HTML template with escaped interpolations and explicit trusted-markup boundaries. */
export function html(strings: TemplateStringsArray, ...values: unknown[]): HTMLMarkup {
    const state: ParseState = {context: 'text', tagName: '', closingTag: false, readingTagName: false};
    let rendered = '';
    for (let index = 0; index < strings.length; index += 1) {
        const literal = strings[index]!;
        rendered += literal;
        advance(state, literal);
        if (index < values.length) {
            rendered += renderInterpolation(values[index], state, literal);
        }
    }
    return markup(rendered);
}
