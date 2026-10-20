'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {attributes, html, unsafeHTML} = require('../dist/html.js');

const text = value => String(value);
const payload = 'x onmouseover=window.__securityProbe=1';

function manualTemplate(literals, ...values) {
    literals.raw = [...literals];
    return html(literals, ...values);
}

test('attribute names follow the HTML tokenizer, not a restricted name pattern', () => {
    assert.throws(() => html`<div [hidden]="n > 0" class=${payload}></div>`, /attribute boundary/);
    assert.throws(() => html`<div (click)="a>b" title=${payload}></div>`, /attribute boundary/);
    assert.throws(() => html`<div @x="a>b" title=${payload}></div>`, /attribute boundary/);
    assert.throws(() => html`<div a"b="c>d" title=${payload}></div>`, /attribute boundary/);
    assert.equal(
        text(html`<div [hidden]="n > 0" (click)='a>b' title="${'<t>'}"></div>`),
        '<div [hidden]="n > 0" (click)=\'a>b\' title="&lt;t&gt;"></div>'
    );
    assert.throws(() => html`<div x-onclick-y onclick = "${'alert(1)'}"></div>`, /event-handler attribute onclick/);
});

test('unquoted attribute values end only at whitespace or >', () => {
    assert.throws(() => html`<div a=b=" title=${payload} "></div>`, /attribute boundary/);
    assert.throws(() => html`<div a=b' title=${payload} '></div>`, /attribute boundary/);
    assert.equal(text(html`<div a=b"c title="${'<t>'}"></div>`), '<div a=b"c title="&lt;t&gt;"></div>');
});

test('attribute boundaries reject insertions whose meaning depends on the inserted value', () => {
    assert.throws(
        () => html`<input disabled ${attributes({title: 't'})}="${payload}">`,
        /attribute boundary/
    );
    assert.throws(
        () => html`<input disabled ${attributes({title: 't'})} = "${payload}">`,
        /attribute boundary/
    );
    assert.throws(() => html`<script${attributes({type: 'module'})}x>${'alert(1)'}</script>`, /attribute boundary/);
    assert.equal(
        text(html`<input disabled ${attributes({title: 't'})} name="${'n'}">`),
        '<input disabled title="t" name="n">'
    );
    assert.equal(text(html`<input${attributes({title: 't'})}/><p>${'x'}</p>`), '<input title="t"/><p>x</p>');
});

test('attributes() is rejected where the insertion itself would change how the tag is parsed', () => {
    const value = attributes({title: 't'});
    // Inside a tag name: an empty insertion would join "a" and "b" into one name.
    assert.throws(() => html`<a${value}b>`, /attribute boundary/);
    assert.throws(() => html`<a${null}b>`, /attribute boundary/);
    assert.throws(() => html`<a${value}${value}b>`, /attribute boundary/);
    // Before "=": an empty insertion would assign the value to the preceding attribute.
    assert.throws(() => html`<a b ${value}=c>`, /attribute boundary/);
    assert.throws(() => html`<a b ${value} =c>`, /attribute boundary/);
    assert.throws(() => html`<a b ${value}${''}=c>`, /attribute boundary/);
    // End tags carry no attributes.
    assert.throws(() => html`</a ${value}>`, /attribute boundary/);
    assert.throws(() => html`</a b ${value}>`, /attribute boundary/);
    assert.throws(() => html`</a b="c"${value}>`, /attribute boundary/);
    assert.throws(() => html`</a${value}>`, /attribute boundary/);
    // Unambiguous neighbours still work, including when later markup is ambiguous for other reasons.
    assert.equal(text(html`<a${value} b>`), '<a title="t" b>');
    assert.equal(text(html`<a b ${value} c=d>`), '<a b title="t" c=d>');
    assert.equal(text(html`<a b ${value}${value}>`), '<a b title="t" title="t">');
    assert.equal(text(html`<a${value}><svg><style></style></svg>`), '<a title="t"><svg><style></style></svg>');
});

test('raw-text elements inside select are ambiguous because parsers disagree on select content', () => {
    // Older parsers ignore <title>/<style>/<xmp>/... inside <select>, so their content is read as markup.
    assert.throws(() => html`<select><title><input ${payload}>`, /ambiguous/);
    assert.throws(() => html`<select><option>a</option><style><input title="</style>" x=${payload}>`, /ambiguous/);
    assert.throws(() => html`<select><xmp></xmp><p>${payload}</p>`, /ambiguous/);
    assert.throws(() => html`<select><noscript></noscript>${payload}`, /ambiguous/);
    assert.throws(() => html`<noscript><select></noscript><p>${payload}</p>`, /ambiguous/);
    // Nested markup is checked in the select context it lands in, and may not leave a select open.
    assert.throws(() => html`<select>${html`<title><input ${payload}></title>`}</select>`, /ordinary text context/);
    assert.throws(() => html`${unsafeHTML('<select>')}<title><input ${payload}>`, /ordinary text context/);
    assert.throws(() => html`${html`<select>`}<title><input ${payload}>`, /ordinary text context/);
    // Script and textarea are raw text in every parser; </select> ends the select context.
    assert.equal(text(html`<select><script></script><option>${'<i>'}</option></select>`), '<select><script></script><option>&lt;i&gt;</option></select>');
    assert.equal(text(html`<select></select><textarea>${'<i>'}</textarea>`), '<select></select><textarea>&lt;i&gt;</textarea>');
    assert.equal(text(html`<select><textarea>${'<i>'}</textarea>`), '<select><textarea>&lt;i&gt;</textarea>');
    assert.equal(text(html`<select></select><title>${'<i>'}</title>`), '<select></select><title>&lt;i&gt;</title>');
    assert.equal(text(html`<select>${html`<option>${'a'}</option>`}</select>`), '<select><option>a</option></select>');
    assert.equal(text(html`<svg><select></select></svg><title>${'t'}</title>`), '<svg><select></select></svg><title>t</title>');
});

test('RCDATA elements escape text and do not track tags until their end tag', () => {
    assert.equal(
        text(html`<textarea><script></textarea><p>${'<b>'}</p>`),
        '<textarea><script></textarea><p>&lt;b&gt;</p>'
    );
    assert.equal(
        text(html`<TITLE><!--</title><p>${'<b>'}</p>`),
        '<TITLE><!--</title><p>&lt;b&gt;</p>'
    );
    assert.equal(
        text(html`<textarea>${'</textarea><script>'}</textarea>`),
        '<textarea>&lt;/textarea&gt;&lt;script&gt;</textarea>'
    );
    assert.equal(text(html`<title>${['a', 1]}</title>`), '<title>a1</title>');
    assert.throws(() => html`<textarea><p title="</textarea><img title=${payload}>">`, /attribute boundary/);
    assert.throws(() => html`<title><p title="</title><img title=${payload}>">`, /attribute boundary/);
    assert.throws(() => html`<textarea>${html`<b>x</b>`}</textarea>`, /textarea content/);
    assert.throws(() => html`<title>${[unsafeHTML('<b>x</b>')]}</title>`, /title content/);
    assert.equal(text(html`<textarea></textareax>${'x'}<p title=${'y'}>`), '<textarea></textareax>x<p title=y>');
});

test('RAWTEXT elements reject interpolation and do not track tags until their end tag', () => {
    for (const name of ['xmp', 'iframe', 'noembed', 'noframes', 'noscript', 'plaintext']) {
        assert.throws(() => manualTemplate([`<${name}>`, `</${name}>`], 'x'), new RegExp(`${name} content`), name);
        assert.throws(
            () => manualTemplate([`<${name.toUpperCase()}>fixed `, ''], 'x'),
            new RegExp(`${name} content`),
            name
        );
    }
    for (const name of ['xmp', 'iframe', 'noembed', 'noframes']) {
        assert.throws(
            () => manualTemplate([`<${name}><p title="</${name}><img title=`, '>">'], payload),
            /attribute boundary/,
            name
        );
        assert.equal(
            text(manualTemplate([`<${name}><script></${name}><p>`, '</p>'], '<b>')),
            `<${name}><script></${name}><p>&lt;b&gt;</p>`
        );
    }
    assert.throws(() => html`<plaintext></plaintext><p>${'x'}</p>`, /plaintext content/);
});

test('noscript content must parse the same with scripting enabled or disabled', () => {
    assert.equal(
        text(html`<noscript><img src="pixel.gif" alt="a>b"></noscript><p>${'<b>'}</p>`),
        '<noscript><img src="pixel.gif" alt="a>b"></noscript><p>&lt;b&gt;</p>'
    );
    assert.throws(() => html`<noscript><script></noscript><p>${'alert(1)'}</p>`, /ambiguous/);
    assert.throws(() => html`<noscript><p title="</noscript>"><img title=${payload}></p>`, /ambiguous/);
    assert.throws(() => html`<noscript><!--</noscript><p>${'x'}</p>-->`, /ambiguous/);
});

test('a less-than sign that cannot start a tag is text', () => {
    assert.equal(text(html`<p>1 < 2 ${'<x>'}</p>`), '<p>1 < 2 &lt;x&gt;</p>');
    assert.equal(text(html`<p>a <3 ${'x'}</p>`), '<p>a <3 x</p>');
    assert.equal(text(html`<p></> ${'x'}</p>`), '<p></> x</p>');
    assert.throws(() => html`<p>a <${'b'}`, /attribute boundary/);
    assert.throws(() => html`<p>a </${'b'}`, /attribute boundary/);
});

test('attributes() may follow a closing attribute quote', () => {
    assert.equal(
        text(html`<div class="a"${attributes({title: '<t>', hidden: true})}>`),
        '<div class="a" title="&lt;t&gt;" hidden>'
    );
    assert.equal(text(html`<div class='a'${attributes({title: 't'})}>`), '<div class=\'a\' title="t">');
    assert.equal(text(html`<div class="a"${null}>`), '<div class="a">');
    assert.throws(() => html`<div class="a"${'title=x'}>`, /must use attributes\(\)/);
});

test('script escaped states follow the HTML tokenizer and double escapes stay conservative', () => {
    assert.equal(text(html`<script>a<!--b</script><p>${'<x>'}</p>`), '<script>a<!--b</script><p>&lt;x&gt;</p>');
    assert.equal(
        text(html`<script><!-- a --> b</script><p>${'x'}</p>`),
        '<script><!-- a --> b</script><p>x</p>'
    );
    assert.equal(text(html`<script><!--></script><p>${'x'}</p>`), '<script><!--></script><p>x</p>');
    assert.equal(
        text(html`<script><!-- --><script></script><p>${'x'}</p>`),
        '<script><!-- --><script></script><p>x</p>'
    );
    assert.throws(() => html`<script><!--<script></script><p>${'x'}</p>`, /script content/);
    assert.throws(() => html`<script><!--<script>--></script><p>${'x'}</p>`, /script content/);
    assert.throws(() => html`<script><!-- <script/></script> --></script><p>${'x'}</p>`, /script content/);
    assert.equal(text(html`<script><!-- <scriptx></script><p>${'x'}</p>`), '<script><!-- <scriptx></script><p>x</p>');
});

test('empty and abruptly closed comments return to text', () => {
    assert.equal(text(html`<!--><p>${'x'}</p>`), '<!--><p>x</p>');
    assert.equal(text(html`<!---><p>${'x'}</p>`), '<!---><p>x</p>');
    assert.equal(text(html`<!----><p>${'x'}</p>`), '<!----><p>x</p>');
    assert.throws(() => html`<!--!><p>${'x'}</p>`, /comment content/);
    assert.throws(() => html`<!---!><p>${'x'}</p>`, /comment content/);
    assert.throws(() => html`<!--x--!-><p>${'x'}</p>`, /comment content/);
    assert.throws(() => html`<!-${'x'}`, /attribute boundary/);
});

test('bogus comments and declarations end at the first >', () => {
    assert.throws(() => html`<!x a="><img title=${payload}">`, /attribute boundary/);
    assert.throws(() => html`<?x a="><img title=${payload}">`, /attribute boundary/);
    assert.throws(() => html`</ x a="><img title=${payload}">`, /attribute boundary/);
    assert.throws(() => html`<!DOCTYPE html PUBLIC "a><img title=${payload}">`, /attribute boundary/);
    assert.throws(() => html`<![CDATA[ a="><img title=${payload}">`, /attribute boundary/);
    assert.throws(() => html`<!doctype ${attributes({lang: 'en'})}>`, /declaration content/);
    assert.equal(text(html`</ x a=">"><p>${'x'}</p>`), '</ x a=">"><p>x</p>');
});

test('raw-text end tags are matched without Unicode case-mapping offsets', () => {
    // Each U+0130 lowercases to two code units, which previously shifted end-tag offsets past `<a`.
    const turkish = '\u0130'.repeat(10);
    const padding = ' '.repeat(8);
    assert.throws(() => manualTemplate([`<script>${turkish}</script><a${padding}b=`, '>'], payload), /attribute boundary/);
    assert.throws(() => manualTemplate([`<style>${turkish}</style><a${padding}b=`, '>'], payload), /attribute boundary/);
    assert.equal(
        text(manualTemplate([`<script>${turkish}</script><p>`, '</p>'], 'x')),
        `<script>${turkish}</script><p>x</p>`
    );
    assert.equal(text(manualTemplate(['<scr\u0130pt>', '</script>'], 'x')), '<scr\u0130pt>x</script>');
});

test('SVG and MathML content cannot switch raw-text tokenizer states', () => {
    assert.throws(() => html`<svg><style><a title="</style>" x=${payload}></a></style></svg>`, /ambiguous/);
    assert.throws(() => html`<svg><script><a title="</script>" x=${payload}></a></script></svg>`, /ambiguous|attribute boundary/);
    assert.throws(() => html`<svg><style></style></svg><p>${'x'}</p>`, /ambiguous/);
    assert.throws(() => html`<math><mi><style></style></mi></math><p>${'x'}</p>`, /ambiguous/);
    assert.throws(() => html`<svg><p></p><textarea></textarea></svg><p>${'x'}</p>`, /ambiguous/);
    assert.throws(
        () => html`<svg><foreignObject><p></svg></p></foreignObject><style><a title="</style>" x=${payload}>`,
        /ambiguous|attribute boundary/
    );
    assert.throws(() => html`<svg></math><style><a title="</style>" x=${payload}>`, /ambiguous|attribute boundary/);
    assert.equal(
        text(html`<svg viewBox="0 0 1 1"><title>Close</title><path d="M0 0"/><g><circle r="1"></circle></g></svg><style>p{}</style><p>${'<x>'}</p>`),
        '<svg viewBox="0 0 1 1"><title>Close</title><path d="M0 0"/><g><circle r="1"></circle></g></svg><style>p{}</style><p>&lt;x&gt;</p>'
    );
    assert.equal(
        text(html`<svg><text fill="${'<c>'}">${'<t>'}</text></svg><svg/><textarea>${'v'}</textarea>`),
        '<svg><text fill="&lt;c&gt;">&lt;t&gt;</text></svg><svg/><textarea>v</textarea>'
    );
    assert.equal(text(html`<math><svg></math><style>p{}</style><p>${'x'}</p>`), '<math><svg></math><style>p{}</style><p>x</p>');
});

test('CDATA sections are accepted only where both foreign and HTML parsing agree', () => {
    assert.throws(() => html`<svg><![CDATA[ a="]]><img title=${payload}>`, /attribute boundary/);
    assert.equal(text(html`<svg><![CDATA[x<y]]></svg><p>${'x'}</p>`), '<svg><![CDATA[x<y]]></svg><p>x</p>');
    assert.throws(() => html`<svg><![CDATA[x>y]]></svg><p>${'x'}</p>`, /ambiguous/);
    assert.throws(() => html`<svg><![CDATA[x]]</svg><p>${'x'}</p>`, /ambiguous/);
    assert.throws(() => html`<svg><![CDAT${'x'}`, /attribute boundary/);
});

test('nested markup must not leave foreign content open or switch states inside it', () => {
    assert.throws(() => html`<p>${unsafeHTML('<svg>')}</p>`, /ordinary text context/);
    assert.throws(() => html`<p>${unsafeHTML('<svg><title><b>')}</p>`, /ordinary text context/);
    assert.throws(() => html`<svg>${html`<style></style>`}</svg>`, /ordinary text context/);
    assert.equal(text(html`<svg>${html`<path d="${'M0'}"/>`}</svg>`), '<svg><path d="M0"/></svg>');
    const icon = html`<svg><path/></svg>`;
    assert.equal(text(html`<p>${icon}${icon}</p>`), '<p><svg><path/></svg><svg><path/></svg></p>');
});

test('html requires at least one template literal', () => {
    assert.throws(() => manualTemplate([]), /template strings/);
});

test('attribute tokenizer edge states match the HTML tokenizer', () => {
    assert.equal(text(html`<p ="a>b" title="${'<x>'}">`), '<p ="a>b" title="&lt;x&gt;">');
    assert.equal(text(html`<input disabled /><p>${'x'}</p>`), '<input disabled /><p>x</p>');
    assert.equal(text(html`<p a=>${'x'}</p>`), '<p a=>x</p>');
    assert.equal(text(html`<p a=b>${'x'}</p>`), '<p a=b>x</p>');
    assert.equal(text(html`<p a="b"c='d' title="${'x'}">`), '<p a="b"c=\'d\' title="x">');
    assert.throws(() => html`<p a="b"onclick="${'alert(1)'}">`, /event-handler attribute onclick/);
    assert.equal(text(html`<TEXTAREA>${'x'}</TEXTAREA ><p title="${'y'}">`), '<TEXTAREA>x</TEXTAREA ><p title="y">');
    assert.equal(text(html`<script>a</b><!--<b>c</script><p>${'x'}</p>`), '<script>a</b><!--<b>c</script><p>x</p>');
    assert.equal(text(html`<xmp></b></xmp><p>${'x'}</p>`), '<xmp></b></xmp><p>x</p>');
    assert.throws(() => html`<svg></p><style></style><p>${'x'}</p>`, /ambiguous/);
    assert.throws(() => html`<svg></br><style></style><p>${'x'}</p>`, /ambiguous/);
});

test('cached plans are reused only while literal arrays cannot change', () => {
    const literals = ['<p>', '</p>'];
    literals.raw = [...literals];
    assert.equal(text(html(literals, 'a')), '<p>a</p>');
    assert.equal(text(html(literals, 'b')), '<p>b</p>');

    let current = '<p>';
    const accessor = ['', '</p>'];
    Object.defineProperty(accessor, 0, {get: () => current, enumerable: true});
    Object.freeze(accessor);
    assert.equal(text(html(accessor, 'x')), '<p>x</p>');
    current = '<script>';
    assert.throws(() => html(accessor, 'alert(1)'), /script content/);

    const backing = ['<p>', '</p>'];
    const proxy = new Proxy(Object.freeze({}), {
        get: (_target, key) => key === 'length' ? backing.length : backing[key]
    });
    assert.equal(text(html(proxy, 'x')), '<p>x</p>');
    backing[0] = '<style>';
    assert.throws(() => html(proxy, 'x'), /style content/);

    const tagged = value => html`<p>${value}</p>`;
    assert.equal(text(tagged('a')), '<p>a</p>');
    assert.equal(text(tagged('<b>')), '<p>&lt;b&gt;</p>');
});
