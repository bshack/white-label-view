/*
 * The `html` tagged-template implementation behind `white-label-view/html`.
 *
 * How it works:
 * 1. The first time a template literal is used, its fixed string parts ("literals") are run through a small
 *    model of the browser's HTML tokenizer (`advance()`). The tokenizer state at the end of each literal tells
 *    us where the next `${…}` lands: ordinary text, a quoted attribute value, an opening tag, a comment, and
 *    so on.
 * 2. `planInterpolation()` turns each state into a plan: escape as text, escape as an attribute value, accept
 *    only `attributes()`, or reject with a message. Plans are cached per template-strings array, so later
 *    calls only render values.
 * 3. When the tokenizer cannot be sure how a browser would read the rest of the template, it enters the
 *    AMBIGUOUS state and every later interpolation in that template is rejected. Rejecting is always safer
 *    than guessing.
 *
 * The tokenizer is not a full HTML parser. It models the tokenizer states that decide where an
 * interpolation lands, plus the few tree-builder decisions that switch tokenizer modes (raw-text elements
 * such as <script>, and SVG/MathML "foreign" content).
 *
 * Trust is tracked by identity: only objects created by this module instance (recorded in the WeakMaps
 * below) are treated as markup or attributes. A look-alike object, or output from another installed copy of
 * the package, is not trusted.
 */

// Markup created by html`` or unsafeHTML(). The boolean is true once the markup is known to leave a plain
// HTML (non-SVG/MathML) parse in ordinary text, which lets it be nested without being re-scanned.
const htmlMarkupValues = new WeakMap<object, boolean>();
// Results created by attributes().
const attributeMarkupValues = new WeakMap<object, true>();

// Attributes that attributes() renders by presence alone (`checked`, not `checked="true"`) when true.
const booleanAttributes = new Set([
    'allowfullscreen', 'async', 'autofocus', 'autoplay', 'checked', 'controls', 'default', 'defer',
    'disabled', 'formnovalidate', 'hidden', 'inert', 'ismap', 'itemscope', 'loop', 'multiple', 'muted',
    'nomodule', 'novalidate', 'open', 'playsinline', 'readonly', 'required', 'reversed', 'selected'
]);
// Names attributes() accepts. Deliberately stricter than what browsers tolerate.
const validAttributeName = /^[A-Za-z_:][A-Za-z0-9:._-]*$/;
// A tag name that attributes() may follow directly, as in `<input${attributes(…)}>`.
const plainTagName = /^[a-z][a-z0-9:._-]*$/;
// The literal before an attributes() interpolation already ends in whitespace.
const trailingHTMLWhitespace = /[ \t\n\f\r]$/;
const escapedCharacter = /[&<>"']/;
const escapedCharacters = /[&<>"']/g;
// A comment ends at "-->" or the error-tolerant "--!>".
const commentEnd = /--!?>/g;
const escapedCharacterValues: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
};

/*
 * Tokenizer states. Each is named after the HTML Standard tokenizer state it models. The comment says what
 * the tokenizer is reading in that state and what happens to an interpolation placed there.
 */
/** Ordinary text between tags. Interpolations are escaped as text. */
const DATA = 0;
/** Just read "<". Decides whether a tag, an end tag, "<!", "<?", or plain text follows. Rejected. */
const TAG_OPEN = 1;
/** Just read "</". Rejected. */
const END_TAG_OPEN = 2;
/** Reading a tag name. Only attributes() is accepted, and only right after a plain opening-tag name. */
const TAG_NAME = 3;
/** Inside a tag, between attributes. attributes() is accepted. */
const BEFORE_ATTRIBUTE_NAME = 4;
/** Reading an attribute name. Rejected. */
const ATTRIBUTE_NAME = 5;
/** After an attribute name and whitespace, before "=" or the next attribute. attributes() is accepted. */
const AFTER_ATTRIBUTE_NAME = 6;
/** Just read "=". A value placed here would be unquoted, so it is rejected. */
const BEFORE_ATTRIBUTE_VALUE = 7;
/** Inside a "double-quoted" attribute value. Escaped, except in on* handlers and srcdoc, which are rejected. */
const DOUBLE_QUOTED = 8;
/** Inside a 'single-quoted' attribute value. Same rules as DOUBLE_QUOTED. */
const SINGLE_QUOTED = 9;
/** Inside an unquoted attribute value. Rejected. */
const UNQUOTED = 10;
/** Just closed a quoted value. attributes() is accepted. */
const AFTER_QUOTED = 11;
/** Read "/" inside a tag; a ">" next makes it self-closing. Rejected. */
const SELF_CLOSING = 12;
/** Read "<!" but the literal ended before it showed whether a comment or CDATA follows. Rejected. */
const MARKUP_DECLARATION = 13;
/** DOCTYPE, "<?…>", "</1…>" and similar declarations, which run to the next ">". Rejected. */
const BOGUS_COMMENT = 14;
/** Inside "<!-- … -->". Rejected. */
const COMMENT = 15;
/** Inside an element whose content is not read as tags (see rawTextElements). Only RCDATA accepts text. */
const RAW_TEXT = 16;
/**
 * The browser's tokenizer state cannot be determined from the template alone. This state is sticky:
 * the rest of the template is not tracked and every later interpolation is rejected.
 */
const AMBIGUOUS = 17;
/** ParseState.boundary value: the literal after an attributes() insertion showed the insertion was unsafe. */
const BOUNDARY_VIOLATED = -1;

/**
 * How a raw-text element's content is read:
 * - script: script data, which ends at </script> but has extra "<!--" escape rules (see scriptEnd()).
 * - rawtext: no tags or character references until the matching end tag. Interpolation is rejected.
 * - rcdata: no tags until the matching end tag, but character references are decoded, so escaped text is
 *   safe there. Used by <textarea> and <title>.
 * - plaintext: never ends.
 */
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
// Elements whose children are parsed as HTML again even though they sit inside <svg> or <math>.
const svgIntegrationPoints = new Set(['foreignobject', 'desc', 'title']);
const mathIntegrationPoints = new Set(['mi', 'mo', 'mn', 'ms', 'mtext', 'annotation-xml']);

/** Everything the tokenizer remembers between characters, and between literals of one template. */
interface ParseState {
    /** One of the tokenizer state constants above. */
    state: number;
    /** Lowercased name of the tag being read. */
    tagName: string;
    /** The tag being read is an end tag ("</…"). */
    endTag: boolean;
    /** The tag being read ended with "/>". */
    selfClosing: boolean;
    /** Lowercased name of the attribute being read, used to reject on* and srcdoc values. */
    attributeName: string;
    /** Name of the open raw-text element, such as "script" or "textarea". */
    rawTag: string;
    rawKind: RawKind;
    /**
     * Offset in the current literal where the raw-text content began. It is only read for <noscript>, which
     * always ends inside a single literal: an interpolation inside rawtext content is rejected, and a
     * rejection makes the rest of the template AMBIGUOUS. Only RCDATA content continues into later literals.
     */
    rawStart: number;
    /**
     * Script "escape" state: 0 normal, 1 after "<!--" (escaped), 2 after "<!--<script" (double-escaped).
     * Double-escaped script content is never treated as ended; see scriptEnd().
     */
    scriptEscape: number;
    /**
     * Set to TAG_NAME or AFTER_ATTRIBUTE_NAME after an attributes() interpolation in that state. The next
     * literal's first characters decide whether the insertion was safe; see advance() and AFTER_ATTRIBUTE_NAME.
     * advance() sets it to BOUNDARY_VIOLATED when they show it was not, and compileTemplate() then rejects
     * the interpolations that set it.
     */
    boundary: number;
    /** Open SVG/MathML elements, while the subtree is known to contain only foreign elements. */
    foreign: string[];
    /** "svg" or "math": the outermost open foreign element, which picks the integration-point list. */
    foreignRoot: string;
    /**
     * Foreign content may still be open, but a tag that can leave it (an integration point or a breakout tag)
     * was seen, so whether the browser is reading HTML or SVG/MathML is no longer tracked precisely.
     */
    foreignUncertain: boolean;
}

// What renderInterpolation() does with a value, decided once per interpolation when a template is compiled.
/** Escaped text; nested markup and arrays allowed. */
const TEXT = 0;
/** Escaped text inside <textarea> or <title>; nested markup rejected because it could close the element. */
const RCDATA = 1;
/** Escaped quoted attribute value; primitives only. */
const QUOTED = 2;
/** Inside an opening tag; only attributes() results (or null, undefined, false) allowed. */
const ATTRIBUTES = 3;
/** Always throws with the plan's detail message. */
const REJECT = 4;

interface InterpolationPlan {
    /** One of TEXT, RCDATA, QUOTED, ATTRIBUTES, REJECT. */
    kind: number;
    /** The preceding literal already ends in whitespace, so drop the leading space attributes() renders. */
    trimAttributeSpace: boolean;
    /** The interpolation sits inside SVG/MathML, so nested markup is re-checked as foreign content. */
    foreign: boolean;
    /** RCDATA element name, or the rejection message. */
    detail: string;
}

interface CompiledTemplate {
    /** Snapshot of the literals the plans were computed from. */
    literals: readonly string[];
    /** One plan per interpolation. */
    plans: readonly InterpolationPlan[];
    /** The template ends in ordinary HTML text, so its output can be nested without being re-scanned. */
    contextPreserving: boolean;
    /** Frozen template arrays with data-property literals cannot change after compilation. */
    immutable: boolean;
}

/** Validated attribute text returned by attributes(). Only usable inside an opening tag. */
interface AttributeMarkup {readonly value: string}

/**
 * Trusted markup returned by html`` and unsafeHTML(). Interpolating it into another html`` template inserts
 * it without escaping. It converts to its HTML string through `value`, `toString()`, or string coercion.
 */
export interface HTMLMarkup {
    readonly value: string;
    toString(): string;
    [Symbol.toPrimitive](): string;
}

// Compiled plans keyed by the template-strings array that JavaScript passes to the tag.
const templatePlans = new WeakMap<TemplateStringsArray, CompiledTemplate>();

/** Create a frozen, trusted markup object and record it in the identity map. */
function markup(value: string, contextPreserving: boolean): HTMLMarkup {
    const result = {
        value,
        toString: () => value,
        [Symbol.toPrimitive]: () => value
    };
    htmlMarkupValues.set(result, contextPreserving);
    return Object.freeze(result);
}

/**
 * Check whether a value is markup created by `html` or `unsafeHTML()` from this installed copy of the
 * package. Objects that merely look like markup, and markup from another copy, return false.
 *
 * @param value - Any value.
 * @returns True when `value` is trusted `HTMLMarkup` from this package instance.
 */
export function isHTMLMarkup(value: unknown): value is HTMLMarkup {
    return typeof value === 'object' && value !== null && htmlMarkupValues.has(value);
}

function isAttributeMarkup(value: unknown): value is AttributeMarkup {
    return typeof value === 'object' && value !== null && attributeMarkupValues.has(value);
}

/** Escape &, <, >, " and ' as character references. Strings without them are returned as is. */
function escapeHTML(value: string): string {
    return escapedCharacter.test(value)
        ? value.replace(escapedCharacters, character => escapedCharacterValues[character]!)
        : value;
}

/**
 * Render a primitive. null and undefined render nothing; booleans render nothing in text and "true"/"false"
 * in attribute values. Anything else (objects, functions, symbols) throws instead of being stringified.
 */
function scalar(value: unknown, attribute = false): string {
    if (value === null || value === undefined) {return '';}
    if (typeof value === 'string') {return escapeHTML(value);}
    if (typeof value === 'number' || typeof value === 'bigint') {return escapeHTML(String(value));}
    if (typeof value === 'boolean') {return attribute ? String(value) : '';}
    throw new TypeError('HTML template interpolations must be primitive values, HTML markup, attributes, or arrays of supported values');
}

/**
 * Render one non-array value in a text position.
 * @param foreign - The position is inside SVG/MathML.
 * @param rcdata - Name of the enclosing <textarea>/<title>, or '' outside RCDATA.
 */
function renderTextValue(value: unknown, foreign: boolean, rcdata: string): string {
    if (isHTMLMarkup(value)) {
        if (rcdata) {throw new TypeError(`Nested HTML markup is not supported inside ${rcdata} content`);}
        assertContextPreservingMarkup(value, foreign);
        return value.value;
    }
    if (isAttributeMarkup(value)) {throw new TypeError('attributes() may only be interpolated inside an opening tag');}
    return scalar(value);
}

/**
 * Render a text-position value, flattening nested arrays in order. Uses an explicit stack instead of
 * recursion so deeply nested arrays cannot overflow the call stack, and throws on cyclic arrays.
 */
function renderText(value: unknown, foreign: boolean, rcdata: string): string {
    if (!Array.isArray(value)) {return renderTextValue(value, foreign, rcdata);}
    const activeArrays = new WeakSet<object>();
    // An {array} entry marks the end of that array, so it can leave the cycle-detection set.
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

/** Quoted attribute values accept primitives only; markup, attributes() and arrays throw. */
function renderQuotedAttribute(value: unknown): string {
    if (Array.isArray(value) || isHTMLMarkup(value) || isAttributeMarkup(value)) {
        throw new TypeError('Quoted attribute interpolations must be primitive values');
    }
    return scalar(value, true);
}

/**
 * Convert one attributes() value to unescaped text, or null to omit the attribute. Arrays are joined with
 * spaces after dropping null, undefined and false entries (handy for class lists).
 */
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

/**
 * Build validated attributes to interpolate inside an opening tag, for example
 * html`<input ${attributes({type: 'checkbox', checked: done})}>`.
 *
 * - `null`, `undefined` and `false` omit the attribute.
 * - `true` renders a recognized boolean attribute (such as `checked` or `disabled`) by name alone; other
 *   attributes render `"true"`.
 * - Arrays are joined with spaces after dropping `null`, `undefined` and `false` entries.
 * - Every value is quoted and escaped.
 *
 * @param values - Attribute names mapped to values, rendered in key order.
 * @returns An attributes object accepted only inside an opening tag of an `html` template.
 * @throws TypeError for an invalid name, an `on*` event-handler name, `srcdoc`, or a non-primitive value.
 */
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

/**
 * Mark a string as trusted HTML so an `html` template inserts it without escaping. This is an explicit trust
 * boundary: pass only markup the application owns or has already sanitized, never raw user input.
 *
 * The markup is still checked when it is nested: it must not leave the surrounding template inside an open
 * tag, comment or raw-text element.
 *
 * @param value - Trusted HTML.
 * @returns Trusted `HTMLMarkup`.
 * @throws TypeError when `value` is not a string.
 */
export function unsafeHTML(value: string): HTMLMarkup {
    if (typeof value !== 'string') {throw new TypeError('unsafeHTML() requires a string');}
    return markup(value, false);
}

/**
 * Fresh tokenizer state in ordinary text.
 * @param foreignUncertain - Start as if possibly inside SVG/MathML (used to check markup nested there).
 */
function createState(foreignUncertain: boolean): ParseState {
    return {
        state: DATA, tagName: '', endTag: false, selfClosing: false, attributeName: '', rawTag: '', rawKind: 'rawtext',
        rawStart: 0, scriptEscape: 0, boundary: 0, foreign: [], foreignRoot: '', foreignUncertain
    };
}

/** True when the position may be inside SVG/MathML. */
function inForeignContent(state: ParseState): boolean {
    return state.foreign.length > 0 || state.foreignUncertain;
}

/**
 * HTML tokenizer whitespace. Browsers turn CR into LF before tokenizing; templates still contain the raw CR,
 * so it is accepted here too.
 */
function isWhitespace(code: number): boolean {
    return code === 32 || code === 9 || code === 10 || code === 12 || code === 13;
}

function isAsciiAlpha(code: number): boolean {
    return (code >= 65 && code <= 90) || (code >= 97 && code <= 122);
}

/**
 * Lowercase one ASCII character, as the tokenizer does for tag and attribute names. String#toLowerCase is
 * avoided because it also folds non-ASCII characters (sometimes into a different length), which browsers do not.
 */
function asciiLower(code: number): string {
    return String.fromCharCode(code >= 65 && code <= 90 ? code + 32 : code);
}

/**
 * Check whether `source` has the tag name `name` (lowercase ASCII, compared case-insensitively) at `start`,
 * followed by whitespace, "/" or ">". Returns false when the source ends before that delimiter.
 */
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

/** Start reading a new start or end tag. */
function beginTag(state: ParseState, endTag: boolean) {
    state.state = TAG_NAME;
    state.tagName = '';
    state.endTag = endTag;
    state.selfClosing = false;
    state.attributeName = '';
}

/**
 * Handle a finished tag. Besides returning to DATA, this models the few parser decisions that change how
 * the following characters are tokenized:
 * - Entering and leaving <svg>/<math> (foreign content).
 * - Leaving foreign content through an integration point or a breakout tag. After that the parser may be
 *   reading HTML or SVG/MathML, so tracking becomes "uncertain" and any raw-text element is AMBIGUOUS.
 * - <script>/<style> inside SVG/MathML: their content is tokenized as markup but still executed or applied,
 *   so they are AMBIGUOUS.
 * - Ordinary HTML raw-text elements, which switch to RAW_TEXT.
 *
 * @param next - Offset just after the tag's ">", where raw-text content would begin.
 */
function emitTag(state: ParseState, next: number) {
    const name = state.tagName;
    state.state = DATA;
    state.boundary = 0;
    const foreign = state.foreign;
    if (state.endTag) {
        if (foreign.length && !state.foreignUncertain) {
            // </p> and </br> are handled as HTML even inside foreign content.
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

/**
 * Find where script content ends, or return -1 if it does not end in `source`.
 *
 * Script content normally ends at "</script". Inside "<!--" (escaped) it still ends at "</script", and "-->"
 * returns to normal. A "<script" inside the escaped part (double-escaped) means a later "</script" may not
 * end the element, which depends on details this module does not track, so double-escaped script is treated
 * as never ending: the script stays open and later interpolations are rejected.
 */
function scriptEnd(state: ParseState, source: string, index: number): number {
    let position = index;
    // Where to look for "-->"; may start before `position` because the dashes of "<!--" count.
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

/**
 * Return the offset of the raw-text element's end tag ("</name" plus a delimiter), or -1 while the content
 * continues. May set the state to AMBIGUOUS (and return the source length) for an inconsistent <noscript>.
 */
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

/**
 * True when `content`, read as ordinary HTML, ends back in plain text with nothing left open. Used to make
 * sure <noscript> content ends at the same place with scripting on (raw text) and off (markup).
 */
function parsesAsText(content: string): boolean {
    const shadow = createState(false);
    advance(shadow, content);
    return shadow.state === DATA && shadow.foreign.length === 0 && !shadow.foreignUncertain;
}

/**
 * Handle what follows "<!": a comment ("<!--"), the empty comments "<!-->" and "<!--->", CDATA in foreign
 * content, or a DOCTYPE/bogus comment. Returns the next offset to tokenize.
 */
function markupDeclaration(state: ParseState, source: string, index: number): number {
    if (source.startsWith('--', index)) {
        const contentStart = index + 2;
        // "<!-->" and "<!--->" are complete (empty) comments.
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
    // The literal ends partway through "<!--" or "<![CDATA[", so the kind of declaration is still unknown.
    if (rest.length < 7 && ('--'.startsWith(rest) || (foreign && '[CDATA['.startsWith(rest)))) {
        state.state = MARKUP_DECLARATION;
        return source.length;
    }
    // DOCTYPE and bogus comments both end at the first ">", even inside quoted identifiers.
    state.state = BOGUS_COMMENT;
    return index;
}

/**
 * Run the tokenizer over one literal, updating `state` in place. Called once per literal while compiling a
 * template, and over the value of nested markup to check that it ends in ordinary text.
 */
function advance(state: ParseState, source: string) {
    const length = source.length;
    let index = 0;
    if (state.boundary === TAG_NAME && length) {
        // "<name${attributes}x" parses as one tag name when the insertion is empty and two tokens otherwise.
        const code = source.charCodeAt(0);
        if (!isWhitespace(code) && code !== 47 && code !== 62) {
            state.state = AMBIGUOUS;
            state.boundary = BOUNDARY_VIOLATED;
            return;
        }
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
                // "<!"
                index = markupDeclaration(state, source, index + 1);
            } else if (code === 47) {
                // "</"
                state.state = END_TAG_OPEN;
                index += 1;
            } else if (isAsciiAlpha(code)) {
                beginTag(state, false);
            } else if (code === 63) {
                // "<?" is read as a bogus comment.
                state.state = BOGUS_COMMENT;
            } else {
                // "<" not followed by a tag-name start is ordinary text, as in "1 < 2".
                state.state = DATA;
            }
            break;
        }
        case END_TAG_OPEN: {
            const code = source.charCodeAt(index);
            if (isAsciiAlpha(code)) {
                beginTag(state, true);
            } else if (code === 62) {
                // "</>" is dropped.
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
                // A leading "=" is part of the attribute name.
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
                state.boundary = BOUNDARY_VIOLATED;
                return;
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
                // "name=>" ends the tag with an empty value.
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
            // Unquoted values end only at whitespace or ">"; quotes and "=" are part of the value.
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
                // A character straight after the closing quote starts a new attribute name.
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
            // rawTextEnd() may have switched to AMBIGUOUS; otherwise resume at the end tag, which DATA then reads.
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

/**
 * Throw unless nested markup ends in ordinary text, so it cannot leave the surrounding template inside an
 * open tag, comment, raw-text element or SVG/MathML element. A pass is remembered for plain HTML positions
 * so the same markup is not scanned twice.
 */
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

/**
 * Decide how to render the interpolation that follows `literal`, given the tokenizer state at its end.
 * May set `state.boundary` so the next literal can confirm that an attributes() insertion is unambiguous.
 */
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
        // End tags carry no attributes.
        if (state.endTag) {return attributeBoundaryRejection;}
        state.boundary = AFTER_ATTRIBUTE_NAME;
        return {kind: ATTRIBUTES, trimAttributeSpace: trailingHTMLWhitespace.test(literal), foreign: false, detail: ''};
    case BEFORE_ATTRIBUTE_NAME:
    case AFTER_QUOTED:
        if (state.endTag) {return attributeBoundaryRejection;}
        // An inserted complete attribute leaves the tokenizer in an equivalent state for the next literal.
        return {kind: ATTRIBUTES, trimAttributeSpace: trailingHTMLWhitespace.test(literal), foreign: false, detail: ''};
    case COMMENT:
        return reject('HTML interpolation is not supported inside comment content');
    case BOGUS_COMMENT:
        return reject('HTML interpolation is not supported inside declaration content');
    case AMBIGUOUS:
        return ambiguousRejection;
    default:
        // TAG_OPEN, END_TAG_OPEN, ATTRIBUTE_NAME, BEFORE_ATTRIBUTE_VALUE, UNQUOTED, SELF_CLOSING, MARKUP_DECLARATION.
        return attributeBoundaryRejection;
    }
}

/** Tokenize every literal of a template and plan each interpolation between them. */
function compileTemplate(literals: readonly string[], immutable: boolean): CompiledTemplate {
    const state = createState(false);
    const plans: InterpolationPlan[] = [];
    // attributes() interpolations whose safety the next non-empty literal still has to confirm.
    let unconfirmed: number[] = [];
    const advanceLiteral = (literal: string) => {
        advance(state, literal);
        if (state.boundary === BOUNDARY_VIOLATED) {
            // The insertion itself would change how the tag is read, so reject it rather than only later ones.
            for (const index of unconfirmed) {plans[index] = attributeBoundaryRejection;}
            state.boundary = 0;
        }
        if (!state.boundary) {unconfirmed = [];}
    };
    const last = literals.length - 1;
    for (let index = 0; index < last; index += 1) {
        const literal = literals[index]!;
        advanceLiteral(literal);
        const plan = planInterpolation(state, literal);
        // A rejected interpolation always throws, so later literals never need precise tracking.
        if (plan.kind === REJECT) {state.state = AMBIGUOUS;}
        if (state.boundary) {unconfirmed.push(index);}
        plans.push(plan);
    }
    advanceLiteral(literals[last]!);
    const contextPreserving = state.state === DATA && !inForeignContent(state);
    return {literals, plans, contextPreserving, immutable};
}

function sameLiterals(left: readonly string[], right: readonly string[]): boolean {
    return left.length === right.length && left.every((value, index) => value === right[index]);
}

/**
 * True when the strings array is frozen and every entry is a plain data property, so its literals can never
 * change. Real template literals always qualify; hand-built arrays may not.
 */
function hasImmutableLiterals(strings: readonly unknown[]): boolean {
    if (!Object.isFrozen(strings)) {return false;}
    for (let index = 0; index < strings.length; index += 1) {
        const descriptor = Object.getOwnPropertyDescriptor(strings, index);
        if (!descriptor || !('value' in descriptor)) {return false;}
    }
    return true;
}

/** Render one interpolated value according to its plan. */
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

/**
 * Return the compiled plan for a strings array, compiling on first use. Mutable or hand-built arrays are
 * re-read on every call and recompiled if their literals changed, so a cached plan is never applied to
 * different markup.
 */
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

/**
 * Tag for HTML template literals: html`<p>${name}</p>`.
 *
 * Each interpolation is handled according to where it appears:
 * - Text content: strings, numbers and bigints are escaped; `null`, `undefined` and booleans render
 *   nothing; nested `html`/`unsafeHTML()` markup and arrays of supported values are inserted as is.
 * - `<textarea>` and `<title>` content: escaped primitives (or arrays of them); nested markup is rejected.
 * - Quoted attribute values: escaped primitives only (booleans render "true"/"false"), except in `on*`
 *   event handlers and `srcdoc`, which are rejected.
 * - Inside an opening tag at an attribute boundary: only `attributes()` results, `null`, `undefined` or `false`.
 * - Anywhere else (tag names, unquoted values, comments, declarations, `<script>`, `<style>` and other
 *   raw-text elements, and anything after markup whose parsing is ambiguous): rejected.
 *
 * @param strings - The template's literal parts, supplied by JavaScript when used as a tag.
 * @param values - The interpolated values.
 * @returns Trusted `HTMLMarkup` for the rendered template.
 * @throws TypeError when called without a non-empty strings array, when an interpolation is in a rejected
 *   position, or when a value is not allowed in its position.
 */
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
