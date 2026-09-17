const htmlMarkupBrand = Symbol.for('white-label-view.HTMLMarkup');
const attributeMarkupBrand = Symbol.for('white-label-view.AttributeMarkup');

const booleanAttributes = new Set([
    'allowfullscreen', 'async', 'autofocus', 'autoplay', 'checked', 'controls', 'default', 'defer',
    'disabled', 'formnovalidate', 'hidden', 'inert', 'ismap', 'itemscope', 'loop', 'multiple', 'muted',
    'nomodule', 'novalidate', 'open', 'playsinline', 'readonly', 'required', 'reversed', 'selected'
]);
const validAttributeName = /^[A-Za-z_:][A-Za-z0-9:._-]*$/;
const escapedCharacters = /[&<>"']/g;
const escapedCharacterValues: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
};

type Context = 'text' | 'tag' | 'double' | 'single' | 'comment' | 'script' | 'style';

interface ParseState {
    context: Context;
    tagName: string;
    closingTag: boolean;
    readingTagName: boolean;
}

interface InterpolationPlan {
    context: Context;
    attributeBoundary: boolean;
    trimAttributeSpace: boolean;
}

interface AttributeMarkup {readonly value: string}

export interface HTMLMarkup {
    readonly value: string;
    toString(): string;
    [Symbol.toPrimitive](): string;
}

const templatePlans = new WeakMap<TemplateStringsArray, readonly InterpolationPlan[]>();

function markupToString(this: HTMLMarkup): string {return this.value;}
function markupToPrimitive(this: HTMLMarkup): string {return this.value;}

function markup(value: string): HTMLMarkup {
    return Object.freeze({
        [htmlMarkupBrand]: true,
        value,
        toString: markupToString,
        [Symbol.toPrimitive]: markupToPrimitive
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
    return value.replace(escapedCharacters, character => escapedCharacterValues[character]!);
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
    if (Array.isArray(value)) {
        let rendered = '';
        for (const entry of value) {rendered += renderText(entry);}
        return rendered;
    }
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
        let rendered = '';
        for (const entry of value) {
            if (entry === null || entry === undefined || entry === false) {continue;}
            if (typeof entry !== 'string' && typeof entry !== 'number' &&
                typeof entry !== 'bigint' && typeof entry !== 'boolean') {
                throw new TypeError('Attribute arrays may contain only primitive values');
            }
            if (rendered) {rendered += ' ';}
            rendered += String(entry);
        }
        return rendered;
    }
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'bigint' || typeof value === 'boolean') {
        return String(value);
    }
    throw new TypeError('Attribute values must be primitive values or arrays of primitive values');
}

/** Render validated HTML attributes for interpolation in an opening tag. */
export function attributes(values: Record<string, unknown>): AttributeMarkup {
    let rendered = '';
    for (const name of Object.keys(values)) {
        const value = values[name];
        const lowerName = name.toLowerCase();
        if (!validAttributeName.test(name) || lowerName.startsWith('on')) {
            throw new TypeError(`Unsupported HTML attribute name ${name}`);
        }
        if (lowerName === 'srcdoc') {
            throw new TypeError('srcdoc requires an application-owned explicit HTML policy');
        }
        if (value === true && booleanAttributes.has(lowerName)) {
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
            const tagStart = source.indexOf('<', index);
            if (tagStart === -1) {return;}
            index = tagStart;
            if (source.startsWith('<!--', index)) {
                state.context = 'comment';
                index += 4;
                continue;
            }
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

function compileTemplate(strings: TemplateStringsArray): readonly InterpolationPlan[] {
    const state: ParseState = {context: 'text', tagName: '', closingTag: false, readingTagName: false};
    const plans: InterpolationPlan[] = [];
    for (let index = 0; index < strings.length - 1; index += 1) {
        const literal = strings[index]!;
        advance(state, literal);
        const trimAttributeSpace = /\s$/.test(literal);
        plans.push({
            context: state.context,
            attributeBoundary: state.context === 'tag' &&
                (trimAttributeSpace || /<[A-Za-z][A-Za-z0-9:._-]*$/.test(literal)),
            trimAttributeSpace
        });
    }
    return plans;
}

function renderInterpolation(value: unknown, plan: InterpolationPlan): string {
    if (plan.context === 'text') {return renderText(value);}
    if (plan.context === 'double' || plan.context === 'single') {return renderQuotedAttribute(value);}
    if (plan.context === 'tag') {
        if (value === null || value === undefined || value === false) {return '';}
        if (isAttributeMarkup(value) && plan.attributeBoundary) {
            return plan.trimAttributeSpace ? value.value.slice(1) : value.value;
        }
        throw new TypeError('Opening-tag interpolations must use attributes() at an attribute boundary');
    }
    throw new TypeError(`HTML interpolation is not supported inside ${plan.context} content`);
}

/** Render an HTML template with escaped interpolations and explicit trusted-markup boundaries. */
export function html(strings: TemplateStringsArray, ...values: unknown[]): HTMLMarkup {
    let plans = templatePlans.get(strings);
    if (!plans) {
        plans = compileTemplate(strings);
        templatePlans.set(strings, plans);
    }
    let rendered = strings[0]!;
    for (let index = 0; index < strings.length - 1; index += 1) {
        rendered += renderInterpolation(values[index], plans[index]!);
        rendered += strings[index + 1]!;
    }
    return markup(rendered);
}
