const htmlMarkupValues = new WeakSet<object>();
const attributeMarkupValues = new WeakSet<object>();

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
    quotedAttributeName: string;
}

interface InterpolationPlan {
    context: Context;
    attributeBoundary: boolean;
    trimAttributeSpace: boolean;
    quotedAttributeName: string;
}

interface CompiledTemplate {
    literals: readonly string[];
    plans: readonly InterpolationPlan[];
}

interface AttributeMarkup {readonly value: string}

export interface HTMLMarkup {
    readonly value: string;
    toString(): string;
    [Symbol.toPrimitive](): string;
}

const templatePlans = new WeakMap<TemplateStringsArray, CompiledTemplate>();

function markup(value: string): HTMLMarkup {
    const result = {
        value,
        toString: () => value,
        [Symbol.toPrimitive]: () => value
    };
    htmlMarkupValues.add(result);
    return Object.freeze(result);
}

/** Identify tagged output created by this installed package instance. */
export function isHTMLMarkup(value: unknown): value is HTMLMarkup {
    return typeof value === 'object' && value !== null && htmlMarkupValues.has(value);
}

function isAttributeMarkup(value: unknown): value is AttributeMarkup {
    return typeof value === 'object' && value !== null && attributeMarkupValues.has(value);
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
    const activeArrays = new WeakSet<object>();
    const stack: Array<{value: unknown} | {array: unknown[]}> = [{value}];
    let rendered = '';
    while (stack.length) {
        const entry = stack.pop()!;
        if ('array' in entry) {
            activeArrays.delete(entry.array);
            continue;
        }
        const current = entry.value;
        if (Array.isArray(current)) {
            if (activeArrays.has(current)) {throw new TypeError('HTML template arrays may not contain cycles');}
            activeArrays.add(current);
            stack.push({array: current});
            for (let index = current.length - 1; index >= 0; index -= 1) {
                stack.push({value: current[index]});
            }
            continue;
        }
        if (isHTMLMarkup(current)) {
            rendered += current.value;
            continue;
        }
        if (isAttributeMarkup(current)) {throw new TypeError('attributes() may only be interpolated inside an opening tag');}
        rendered += scalar(current);
    }
    return rendered;
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
    const result: AttributeMarkup = {value: rendered};
    attributeMarkupValues.add(result);
    return Object.freeze(result);
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
    state.quotedAttributeName = '';
}

function finishTag(state: ParseState) {
    const rawText = !state.closingTag && (state.tagName === 'script' || state.tagName === 'style')
        ? state.tagName as 'script' | 'style'
        : 'text';
    state.context = rawText;
    state.tagName = '';
    state.closingTag = false;
    state.readingTagName = false;
    state.quotedAttributeName = '';
}

function isRawTextEndDelimiter(character: string | undefined): boolean {
    return character === '>' || character === '/' || character === ' ' || character === '\t' ||
        character === '\n' || character === '\f' || character === '\r';
}

function findRawTextEnd(state: ParseState, source: string, lower: string, index: number): number {
    const close = `</${state.context}`;
    let searchIndex = index;
    while (searchIndex < source.length) {
        const candidate = lower.indexOf(close, searchIndex);
        if (candidate === -1) {return -1;}
        if (isRawTextEndDelimiter(source[candidate + close.length])) {
            // Legacy script-escaped/double-escaped states are deliberately treated as ambiguous.
            // Remaining in script context is conservative and prevents a false transition to HTML text.
            if (state.context === 'script') {
                const escapeStart = lower.indexOf('<!--', index);
                if (escapeStart !== -1 && escapeStart < candidate) {return -1;}
            }
            return candidate;
        }
        searchIndex = candidate + close.length;
    }
    return -1;
}

function attributeNameBeforeQuote(source: string, quoteIndex: number): string {
    const match = /([A-Za-z_:][A-Za-z0-9:._-]*)\s*=\s*$/.exec(source.slice(0, quoteIndex));
    return match?.[1]?.toLowerCase() ?? '';
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
            const end = findRawTextEnd(state, source, lower, index);
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
            state.quotedAttributeName = '';
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
        if (character === '"' || character === "'") {
            state.quotedAttributeName = attributeNameBeforeQuote(source, index);
            state.context = character === '"' ? 'double' : 'single';
        } else if (character === '>') {
            finishTag(state);
        }
        index += 1;
    }
}

function compileTemplate(strings: readonly string[]): readonly InterpolationPlan[] {
    const state: ParseState = {
        context: 'text', tagName: '', closingTag: false, readingTagName: false, quotedAttributeName: ''
    };
    const plans: InterpolationPlan[] = [];
    for (let index = 0; index < strings.length - 1; index += 1) {
        const literal = strings[index]!;
        advance(state, literal);
        const trimAttributeSpace = /\s$/.test(literal);
        plans.push({
            context: state.context,
            attributeBoundary: state.context === 'tag' &&
                (trimAttributeSpace || /<[A-Za-z][A-Za-z0-9:._-]*$/.test(literal)),
            trimAttributeSpace,
            quotedAttributeName: state.quotedAttributeName
        });
    }
    return plans;
}

function sameLiterals(left: readonly string[], right: readonly string[]): boolean {
    return left.length === right.length && left.every((value, index) => value === right[index]);
}

function assertQuotedAttributeInterpolationAllowed(name: string) {
    if (name.startsWith('on')) {
        throw new TypeError(`HTML interpolation is not supported inside event-handler attribute ${name}`);
    }
    if (name === 'srcdoc') {
        throw new TypeError('HTML interpolation inside srcdoc requires an application-owned explicit HTML policy');
    }
}

function renderInterpolation(value: unknown, plan: InterpolationPlan): string {
    if (plan.context === 'text') {return renderText(value);}
    if (plan.context === 'double' || plan.context === 'single') {
        assertQuotedAttributeInterpolationAllowed(plan.quotedAttributeName);
        return renderQuotedAttribute(value);
    }
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
    if (typeof strings !== 'object' || strings === null) {throw new TypeError('html must be used with template strings');}
    const literals = Array.from(strings, value => {
        if (typeof value !== 'string') {throw new TypeError('html template literals must be strings');}
        return value;
    });
    let compiled = templatePlans.get(strings);
    if (!compiled || !sameLiterals(compiled.literals, literals)) {
        compiled = {literals, plans: compileTemplate(literals)};
        templatePlans.set(strings, compiled);
    }
    let rendered = literals[0]!;
    for (let index = 0; index < literals.length - 1; index += 1) {
        rendered += renderInterpolation(values[index], compiled.plans[index]!);
        rendered += literals[index + 1]!;
    }
    return markup(rendered);
}
