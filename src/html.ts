// Runtime-owned markup identity; the value records whether the markup is proven to leave an HTML
// (non-foreign) parse in ordinary text context.
const htmlMarkupValues = new WeakMap<object, boolean>();
const attributeMarkupValues = new WeakMap<object, true>();

const booleanAttributes = new Set([
    'allowfullscreen', 'async', 'autofocus', 'autoplay', 'checked', 'controls', 'default', 'defer',
    'disabled', 'formnovalidate', 'hidden', 'inert', 'ismap', 'itemscope', 'loop', 'multiple', 'muted',
    'nomodule', 'novalidate', 'open', 'playsinline', 'readonly', 'required', 'reversed', 'selected'
]);
const validAttributeName = /^[A-Za-z_:][A-Za-z0-9:._-]*$/;
const plainTagName = /^[a-z][a-z0-9:._-]*$/;
const trailingHTMLWhitespace = /[ \t\n\f\r]$/;
const escapedCharacter = /[&<>"']/;
const escapedCharacters = /[&<>"']/g;
const commentEnd = /--!?>/g;
const escapedCharacterValues: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
};

// Tokenizer states, named after the HTML Standard tokenizer states they model.
const DATA = 0;
const TAG_OPEN = 1;
const END_TAG_OPEN = 2;
const TAG_NAME = 3;
const BEFORE_ATTRIBUTE_NAME = 4;
const ATTRIBUTE_NAME = 5;
const AFTER_ATTRIBUTE_NAME = 6;
const BEFORE_ATTRIBUTE_VALUE = 7;
const DOUBLE_QUOTED = 8;
const SINGLE_QUOTED = 9;
const UNQUOTED = 10;
const AFTER_QUOTED = 11;
const SELF_CLOSING = 12;
const MARKUP_DECLARATION = 13;
const BOGUS_COMMENT = 14;
const COMMENT = 15;
const RAW_TEXT = 16;
/** Sticky: the browser's tokenizer state cannot be determined, so every later interpolation is rejected. */
const AMBIGUOUS = 17;

type RawKind = 'script' | 'rawtext' | 'rcdata' | 'plaintext';
const rawTextElements = new Map<string, RawKind>([
    ['script', 'script'], ['style', 'rawtext'], ['xmp', 'rawtext'], ['iframe', 'rawtext'],
    ['noembed', 'rawtext'], ['noframes', 'rawtext'], ['noscript', 'rawtext'], ['plaintext', 'plaintext'],
    ['textarea', 'rcdata'], ['title', 'rcdata']
]);
// Start tags that make the HTML parser leave SVG/MathML content (HTML Standard "parsing tokens in foreign content").
const foreignBreakoutElements = new Set([
    'b', 'big', 'blockquote', 'body', 'br', 'center', 'code', 'dd', 'div', 'dl', 'dt', 'em', 'embed', 'font',
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'head', 'hr', 'i', 'img', 'li', 'listing', 'menu', 'meta', 'nobr', 'ol',
    'p', 'pre', 'ruby', 's', 'small', 'span', 'strong', 'strike', 'sub', 'sup', 'table', 'tt', 'u', 'ul', 'var'
]);
const svgIntegrationPoints = new Set(['foreignobject', 'desc', 'title']);
const mathIntegrationPoints = new Set(['mi', 'mo', 'mn', 'ms', 'mtext', 'annotation-xml']);

interface ParseState {
    state: number;
    tagName: string;
    endTag: boolean;
    selfClosing: boolean;
    attributeName: string;
    rawTag: string;
    rawKind: RawKind;
    /**
     * Offset of the raw-text content in the current source. Only RCDATA continues across literals, because
     * compileTemplate makes every rejected interpolation context AMBIGUOUS.
     */
    rawStart: number;
    /** Script data escape state: 0 none, 1 escaped, 2 double-escaped. */
    scriptEscape: number;
    /** Set after an attribute-boundary interpolation whose meaning depends on the following literal. */
    boundary: number;
    /** Open SVG/MathML elements while the subtree is known to contain only foreign elements. */
    foreign: string[];
    foreignRoot: string;
    /** Foreign content may still be open but can no longer be tracked precisely. */
    foreignUncertain: boolean;
}

const TEXT = 0;
const RCDATA = 1;
const QUOTED = 2;
const ATTRIBUTES = 3;
const REJECT = 4;

interface InterpolationPlan {
    kind: number;
    trimAttributeSpace: boolean;
    foreign: boolean;
    /** RCDATA element name, or the rejection message. */
    detail: string;
}

interface CompiledTemplate {
    literals: readonly string[];
    plans: readonly InterpolationPlan[];
    contextPreserving: boolean;
    /** Frozen template arrays with data-property literals cannot change after compilation. */
    immutable: boolean;
}

interface AttributeMarkup {readonly value: string}

export interface HTMLMarkup {
    readonly value: string;
    toString(): string;
    [Symbol.toPrimitive](): string;
}

const templatePlans = new WeakMap<TemplateStringsArray, CompiledTemplate>();

function markup(value: string, contextPreserving: boolean): HTMLMarkup {
    const result = {
        value,
        toString: () => value,
        [Symbol.toPrimitive]: () => value
    };
    htmlMarkupValues.set(result, contextPreserving);
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
    return escapedCharacter.test(value)
        ? value.replace(escapedCharacters, character => escapedCharacterValues[character]!)
        : value;
}

function scalar(value: unknown, attribute = false): string {
    if (value === null || value === undefined) {return '';}
    if (typeof value === 'string') {return escapeHTML(value);}
    if (typeof value === 'number' || typeof value === 'bigint') {return escapeHTML(String(value));}
    if (typeof value === 'boolean') {return attribute ? String(value) : '';}
    throw new TypeError('HTML template interpolations must be primitive values, HTML markup, attributes, or arrays of supported values');
}

function renderTextValue(value: unknown, foreign: boolean, rcdata: string): string {
    if (isHTMLMarkup(value)) {
        if (rcdata) {throw new TypeError(`Nested HTML markup is not supported inside ${rcdata} content`);}
        assertContextPreservingMarkup(value, foreign);
        return value.value;
    }
    if (isAttributeMarkup(value)) {throw new TypeError('attributes() may only be interpolated inside an opening tag');}
    return scalar(value);
}

function renderText(value: unknown, foreign: boolean, rcdata: string): string {
    if (!Array.isArray(value)) {return renderTextValue(value, foreign, rcdata);}
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
        rendered += renderTextValue(current, foreign, rcdata);
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
    attributeMarkupValues.set(result, true);
    return Object.freeze(result);
}

/** Insert caller-owned, already trusted or sanitized HTML without escaping. */
export function unsafeHTML(value: string): HTMLMarkup {
    if (typeof value !== 'string') {throw new TypeError('unsafeHTML() requires a string');}
    return markup(value, false);
}

function createState(foreignUncertain: boolean): ParseState {
    return {
        state: DATA, tagName: '', endTag: false, selfClosing: false, attributeName: '', rawTag: '', rawKind: 'rawtext',
        rawStart: 0, scriptEscape: 0, boundary: 0, foreign: [], foreignRoot: '', foreignUncertain
    };
}

function inForeignContent(state: ParseState): boolean {
    return state.foreign.length > 0 || state.foreignUncertain;
}

/** Tokenizer whitespace; CR is normalized to LF before tokenization. */
function isWhitespace(code: number): boolean {
    return code === 32 || code === 9 || code === 10 || code === 12 || code === 13;
}

function isAsciiAlpha(code: number): boolean {
    return (code >= 65 && code <= 90) || (code >= 97 && code <= 122);
}

/** ASCII-only lowercase keeps offsets stable; String#toLowerCase can change string length. */
function asciiLower(code: number): string {
    return String.fromCharCode(code >= 65 && code <= 90 ? code + 32 : code);
}

/** Match a lowercase ASCII tag name followed by a tag-name delimiter. */
function matchesTagName(source: string, start: number, name: string): boolean {
    const end = start + name.length;
    if (end >= source.length) {return false;}
    for (let index = 0; index < name.length; index += 1) {
        const code = source.charCodeAt(start + index);
        if ((code >= 65 && code <= 90 ? code + 32 : code) !== name.charCodeAt(index)) {return false;}
    }
    const delimiter = source.charCodeAt(end);
    return isWhitespace(delimiter) || delimiter === 47 || delimiter === 62;
}

function beginTag(state: ParseState, endTag: boolean) {
    state.state = TAG_NAME;
    state.tagName = '';
    state.endTag = endTag;
    state.selfClosing = false;
    state.attributeName = '';
}

/** Apply a completed tag token, modelling only the tree-builder decisions that change tokenizer state. */
function emitTag(state: ParseState, next: number) {
    const name = state.tagName;
    state.state = DATA;
    state.boundary = 0;
    const foreign = state.foreign;
    if (state.endTag) {
        if (foreign.length && !state.foreignUncertain) {
            if (name === 'p' || name === 'br') {
                state.foreignUncertain = true;
            } else {
                const open = foreign.lastIndexOf(name);
                if (open !== -1) {foreign.length = open;}
            }
        }
        return;
    }
    if (foreign.length && !state.foreignUncertain) {
        const current = foreign[foreign.length - 1]!;
        const integrationPoint = state.foreignRoot === 'svg'
            ? svgIntegrationPoints.has(current)
            : mathIntegrationPoints.has(current);
        if (integrationPoint || foreignBreakoutElements.has(name)) {state.foreignUncertain = true;}
    }
    if (state.foreignUncertain) {
        // The element may be HTML or foreign, so a raw-text switch may or may not happen.
        if (rawTextElements.has(name)) {state.state = AMBIGUOUS;}
        return;
    }
    if (foreign.length) {
        // SVG script and style content are tokenized as markup but still executed or applied.
        if (name === 'script' || name === 'style') {state.state = AMBIGUOUS;}
        else if (!state.selfClosing) {foreign.push(name);}
        return;
    }
    if (name === 'svg' || name === 'math') {
        if (!state.selfClosing) {
            foreign.push(name);
            state.foreignRoot = name;
        }
        return;
    }
    const rawKind = rawTextElements.get(name);
    if (rawKind) {
        state.state = RAW_TEXT;
        state.rawTag = name;
        state.rawKind = rawKind;
        state.rawStart = next;
        state.scriptEscape = 0;
    }
}

/** Find the end tag of script data, following the escaped state and treating double escapes conservatively. */
function scriptEnd(state: ParseState, source: string, index: number): number {
    let position = index;
    let dashSearch = index;
    while (state.scriptEscape !== 2) {
        const lessThan = source.indexOf('<', position);
        if (state.scriptEscape === 1) {
            const close = source.indexOf('-->', dashSearch);
            if (close !== -1 && (lessThan === -1 || close < lessThan)) {
                state.scriptEscape = 0;
                position = close + 3;
                dashSearch = position;
                continue;
            }
        }
        if (lessThan === -1) {return -1;}
        if (source.charCodeAt(lessThan + 1) === 47 && matchesTagName(source, lessThan + 2, 'script')) {return lessThan;}
        if (state.scriptEscape === 0) {
            if (source.startsWith('<!--', lessThan)) {
                state.scriptEscape = 1;
                position = lessThan + 4;
                // The dashes of "<!--" already count toward "-->", so "<!-->" closes the escape.
                dashSearch = lessThan + 2;
                continue;
            }
        } else if (matchesTagName(source, lessThan + 1, 'script')) {
            state.scriptEscape = 2;
        }
        position = lessThan + 1;
        dashSearch = position;
    }
    return -1;
}

/** Return the offset of the raw-text element's end tag, or -1 while the content continues. */
function rawTextEnd(state: ParseState, source: string, index: number): number {
    if (state.rawKind === 'plaintext') {return -1;}
    if (state.rawKind === 'script') {return scriptEnd(state, source, index);}
    let position = index;
    for (;;) {
        const candidate = source.indexOf('</', position);
        if (candidate === -1) {return -1;}
        if (matchesTagName(source, candidate + 2, state.rawTag)) {
            if (state.rawTag === 'noscript' && !parsesAsText(source.slice(state.rawStart, candidate))) {
                // noscript is raw text only when scripting is enabled; both parses must agree on its end.
                state.state = AMBIGUOUS;
                return source.length;
            }
            return candidate;
        }
        position = candidate + 2;
    }
}

function parsesAsText(content: string): boolean {
    const shadow = createState(false);
    advance(shadow, content);
    return shadow.state === DATA && shadow.foreign.length === 0 && !shadow.foreignUncertain;
}

/** Handle the characters after "<!"; returns the next offset to tokenize. */
function markupDeclaration(state: ParseState, source: string, index: number): number {
    if (source.startsWith('--', index)) {
        const contentStart = index + 2;
        if (source.charCodeAt(contentStart) === 62) {
            state.state = DATA;
            return contentStart + 1;
        }
        if (source.startsWith('->', contentStart)) {
            state.state = DATA;
            return contentStart + 2;
        }
        state.state = COMMENT;
        return contentStart;
    }
    const foreign = inForeignContent(state);
    if (foreign && source.startsWith('[CDATA[', index)) {
        // A CDATA section in foreign content ends at "]]>", but after a breakout it is a bogus comment
        // ending at the first ">". Accept it only where both readings end at the same offset.
        const close = source.indexOf(']]>', index + 7);
        const end = source.indexOf('>', index);
        if (close === -1 || end !== close + 2) {
            state.state = AMBIGUOUS;
            return source.length;
        }
        state.state = DATA;
        return end + 1;
    }
    const rest = source.slice(index);
    if (rest.length < 7 && ('--'.startsWith(rest) || (foreign && '[CDATA['.startsWith(rest)))) {
        state.state = MARKUP_DECLARATION;
        return source.length;
    }
    // DOCTYPE and bogus comments both end at the first ">", even inside quoted identifiers.
    state.state = BOGUS_COMMENT;
    return index;
}

function advance(state: ParseState, source: string) {
    const length = source.length;
    let index = 0;
    if (state.boundary === TAG_NAME && length) {
        // "<name${attributes}x" parses as one tag name when the insertion is empty and two tokens otherwise.
        const code = source.charCodeAt(0);
        if (!isWhitespace(code) && code !== 47 && code !== 62) {state.state = AMBIGUOUS;}
        state.boundary = 0;
    }
    while (index < length) {
        switch (state.state) {
        case DATA: {
            const lessThan = source.indexOf('<', index);
            if (lessThan === -1) {return;}
            state.state = TAG_OPEN;
            index = lessThan + 1;
            break;
        }
        case TAG_OPEN: {
            const code = source.charCodeAt(index);
            if (code === 33) {
                index = markupDeclaration(state, source, index + 1);
            } else if (code === 47) {
                state.state = END_TAG_OPEN;
                index += 1;
            } else if (isAsciiAlpha(code)) {
                beginTag(state, false);
            } else if (code === 63) {
                state.state = BOGUS_COMMENT;
            } else {
                // "<" not followed by a tag-name start is ordinary text.
                state.state = DATA;
            }
            break;
        }
        case END_TAG_OPEN: {
            const code = source.charCodeAt(index);
            if (isAsciiAlpha(code)) {
                beginTag(state, true);
            } else if (code === 62) {
                state.state = DATA;
                index += 1;
            } else {
                state.state = BOGUS_COMMENT;
            }
            break;
        }
        case TAG_NAME: {
            const code = source.charCodeAt(index);
            index += 1;
            if (isWhitespace(code)) {
                state.state = BEFORE_ATTRIBUTE_NAME;
            } else if (code === 47) {
                state.state = SELF_CLOSING;
            } else if (code === 62) {
                emitTag(state, index);
            } else {
                state.tagName += asciiLower(code);
            }
            break;
        }
        case BEFORE_ATTRIBUTE_NAME: {
            const code = source.charCodeAt(index);
            if (isWhitespace(code)) {
                index += 1;
            } else if (code === 47 || code === 62) {
                state.state = AFTER_ATTRIBUTE_NAME;
            } else {
                state.state = ATTRIBUTE_NAME;
                state.attributeName = code === 61 ? '=' : '';
                if (code === 61) {index += 1;}
            }
            break;
        }
        case ATTRIBUTE_NAME: {
            const code = source.charCodeAt(index);
            if (isWhitespace(code) || code === 47 || code === 62) {
                state.state = AFTER_ATTRIBUTE_NAME;
            } else if (code === 61) {
                state.state = BEFORE_ATTRIBUTE_VALUE;
                index += 1;
            } else {
                state.attributeName += asciiLower(code);
                index += 1;
            }
            break;
        }
        case AFTER_ATTRIBUTE_NAME: {
            const code = source.charCodeAt(index);
            if (isWhitespace(code)) {
                index += 1;
                break;
            }
            if (code === 61 && state.boundary) {
                // "name ${attributes}=" assigns to name only when the insertion is empty.
                state.state = AMBIGUOUS;
                break;
            }
            state.boundary = 0;
            if (code === 47) {
                state.state = SELF_CLOSING;
                index += 1;
            } else if (code === 61) {
                state.state = BEFORE_ATTRIBUTE_VALUE;
                index += 1;
            } else if (code === 62) {
                index += 1;
                emitTag(state, index);
            } else {
                state.state = ATTRIBUTE_NAME;
                state.attributeName = '';
            }
            break;
        }
        case BEFORE_ATTRIBUTE_VALUE: {
            const code = source.charCodeAt(index);
            if (isWhitespace(code)) {
                index += 1;
            } else if (code === 34) {
                state.state = DOUBLE_QUOTED;
                index += 1;
            } else if (code === 39) {
                state.state = SINGLE_QUOTED;
                index += 1;
            } else if (code === 62) {
                index += 1;
                emitTag(state, index);
            } else {
                state.state = UNQUOTED;
            }
            break;
        }
        case DOUBLE_QUOTED:
        case SINGLE_QUOTED: {
            const close = source.indexOf(state.state === DOUBLE_QUOTED ? '"' : "'", index);
            if (close === -1) {return;}
            state.state = AFTER_QUOTED;
            index = close + 1;
            break;
        }
        case UNQUOTED: {
            const code = source.charCodeAt(index);
            index += 1;
            if (isWhitespace(code)) {
                state.state = BEFORE_ATTRIBUTE_NAME;
            } else if (code === 62) {
                emitTag(state, index);
            }
            break;
        }
        case AFTER_QUOTED: {
            const code = source.charCodeAt(index);
            if (isWhitespace(code)) {
                state.state = BEFORE_ATTRIBUTE_NAME;
                index += 1;
            } else if (code === 47) {
                state.state = SELF_CLOSING;
                index += 1;
            } else if (code === 62) {
                index += 1;
                emitTag(state, index);
            } else {
                state.state = BEFORE_ATTRIBUTE_NAME;
            }
            break;
        }
        case SELF_CLOSING: {
            if (source.charCodeAt(index) === 62) {
                state.selfClosing = true;
                index += 1;
                emitTag(state, index);
            } else {
                state.state = BEFORE_ATTRIBUTE_NAME;
            }
            break;
        }
        case BOGUS_COMMENT: {
            const end = source.indexOf('>', index);
            if (end === -1) {return;}
            state.state = DATA;
            index = end + 1;
            break;
        }
        case COMMENT: {
            commentEnd.lastIndex = index;
            const end = commentEnd.exec(source);
            if (!end) {return;}
            state.state = DATA;
            index = end.index + end[0].length;
            break;
        }
        case RAW_TEXT: {
            const end = rawTextEnd(state, source, index);
            if (end === -1) {return;}
            if (state.state === RAW_TEXT) {state.state = DATA;}
            index = end;
            break;
        }
        default:
            // MARKUP_DECLARATION continuing into a later literal is only reachable after a rejected
            // interpolation; AMBIGUOUS is sticky.
            state.state = AMBIGUOUS;
            return;
        }
    }
}

function assertContextPreservingMarkup(value: HTMLMarkup, foreign: boolean) {
    if (!foreign && htmlMarkupValues.get(value)) {return;}
    const state = createState(foreign);
    advance(state, value.value);
    if (state.state !== DATA || state.foreign.length > 0 || (!foreign && state.foreignUncertain)) {
        throw new TypeError('Nested HTML markup must end in ordinary text context');
    }
    if (!foreign) {htmlMarkupValues.set(value, true);}
}

function reject(message: string): InterpolationPlan {
    return {kind: REJECT, trimAttributeSpace: false, foreign: false, detail: message};
}

const attributeBoundaryRejection = reject('Opening-tag interpolations are only supported at an attribute boundary');
const ambiguousRejection = reject('HTML interpolation is not supported after markup whose parsing context is ambiguous');

function planInterpolation(state: ParseState, literal: string): InterpolationPlan {
    switch (state.state) {
    case DATA:
        return {kind: TEXT, trimAttributeSpace: false, foreign: inForeignContent(state), detail: ''};
    case RAW_TEXT:
        return state.rawKind === 'rcdata'
            ? {kind: RCDATA, trimAttributeSpace: false, foreign: false, detail: state.rawTag}
            : reject(`HTML interpolation is not supported inside ${state.rawTag} content`);
    case DOUBLE_QUOTED:
    case SINGLE_QUOTED: {
        const name = state.attributeName;
        if (name.startsWith('on')) {
            return reject(`HTML interpolation is not supported inside event-handler attribute ${name}`);
        }
        if (name === 'srcdoc') {
            return reject('HTML interpolation inside srcdoc requires an application-owned explicit HTML policy');
        }
        return {kind: QUOTED, trimAttributeSpace: false, foreign: false, detail: ''};
    }
    case TAG_NAME:
        if (state.endTag || !plainTagName.test(state.tagName)) {return attributeBoundaryRejection;}
        state.boundary = TAG_NAME;
        return {kind: ATTRIBUTES, trimAttributeSpace: false, foreign: false, detail: ''};
    case AFTER_ATTRIBUTE_NAME:
        state.boundary = AFTER_ATTRIBUTE_NAME;
        return {kind: ATTRIBUTES, trimAttributeSpace: trailingHTMLWhitespace.test(literal), foreign: false, detail: ''};
    case BEFORE_ATTRIBUTE_NAME:
    case AFTER_QUOTED:
        // An inserted complete attribute leaves the tokenizer in an equivalent state for the next literal.
        return {kind: ATTRIBUTES, trimAttributeSpace: trailingHTMLWhitespace.test(literal), foreign: false, detail: ''};
    case COMMENT:
        return reject('HTML interpolation is not supported inside comment content');
    case BOGUS_COMMENT:
        return reject('HTML interpolation is not supported inside declaration content');
    case AMBIGUOUS:
        return ambiguousRejection;
    default:
        return attributeBoundaryRejection;
    }
}

function compileTemplate(literals: readonly string[], immutable: boolean): CompiledTemplate {
    const state = createState(false);
    const plans: InterpolationPlan[] = [];
    const last = literals.length - 1;
    for (let index = 0; index < last; index += 1) {
        const literal = literals[index]!;
        advance(state, literal);
        const plan = planInterpolation(state, literal);
        // A rejected interpolation always throws, so later literals never need precise tracking.
        if (plan.kind === REJECT) {state.state = AMBIGUOUS;}
        plans.push(plan);
    }
    advance(state, literals[last]!);
    const contextPreserving = state.state === DATA && !inForeignContent(state);
    return {literals, plans, contextPreserving, immutable};
}

function sameLiterals(left: readonly string[], right: readonly string[]): boolean {
    return left.length === right.length && left.every((value, index) => value === right[index]);
}

function hasImmutableLiterals(strings: readonly unknown[]): boolean {
    if (!Object.isFrozen(strings)) {return false;}
    for (let index = 0; index < strings.length; index += 1) {
        const descriptor = Object.getOwnPropertyDescriptor(strings, index);
        if (!descriptor || !('value' in descriptor)) {return false;}
    }
    return true;
}

function renderInterpolation(value: unknown, plan: InterpolationPlan): string {
    switch (plan.kind) {
    case TEXT:
        return renderText(value, plan.foreign, '');
    case RCDATA:
        return renderText(value, false, plan.detail);
    case QUOTED:
        return renderQuotedAttribute(value);
    case ATTRIBUTES:
        if (value === null || value === undefined || value === false) {return '';}
        if (isAttributeMarkup(value)) {
            return plan.trimAttributeSpace ? value.value.slice(1) : value.value;
        }
        throw new TypeError('Opening-tag interpolations must use attributes() at an attribute boundary');
    default:
        throw new TypeError(plan.detail);
    }
}

function compiledTemplate(strings: TemplateStringsArray): CompiledTemplate {
    const cached = templatePlans.get(strings);
    // Frozen literal arrays cannot change, so only mutable or non-standard arrays need a fresh snapshot.
    if (cached?.immutable) {return cached;}
    const literals = Array.from(strings, value => {
        if (typeof value !== 'string') {throw new TypeError('html template literals must be strings');}
        return value;
    });
    if (!literals.length) {throw new TypeError('html must be used with template strings');}
    if (cached && sameLiterals(cached.literals, literals)) {return cached;}
    const compiled = compileTemplate(literals, hasImmutableLiterals(strings));
    templatePlans.set(strings, compiled);
    return compiled;
}

/** Render an HTML template with escaped interpolations and explicit trusted-markup boundaries. */
export function html(strings: TemplateStringsArray, ...values: unknown[]): HTMLMarkup {
    if (typeof strings !== 'object' || strings === null) {throw new TypeError('html must be used with template strings');}
    const {literals, plans, contextPreserving} = compiledTemplate(strings);
    let rendered = literals[0]!;
    for (let index = 0; index < plans.length; index += 1) {
        rendered += renderInterpolation(values[index], plans[index]!);
        rendered += literals[index + 1]!;
    }
    return markup(rendered, contextPreserving);
}
