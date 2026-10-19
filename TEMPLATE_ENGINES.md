# Template engine compatibility

`white-label-view` is template-engine agnostic. The first-party rendering choice is the `html`` ` tagged-template API from `white-label-view/html`. Third-party engines are compatible when application code can call them from `template` and return output that satisfies the View runtime contract.

White Label does not wrap, configure, bundle, or depend on third-party template engines. Applications install and configure the renderer they choose.

For the public guide and the current tested-engine matrix, see [Template engines](https://whitelabeljs.org/docs/view/#template-engines).

## First-party templates

Tagged templates require no third-party renderer dependency:

```ts
import {html} from 'white-label-view/html';

const template = (data: {name: string}) => html`
    <section><h1>Hello ${data.name}</h1></section>
`;
```

The tag escapes each interpolation for the position it appears in, or rejects it with a `TypeError`:

| Position | Result |
| --- | --- |
| Text content | Escaped. `null`, `undefined`, and booleans render nothing. Nested `html`, `unsafeHTML()`, and arrays are inserted as markup. |
| `<textarea>`, `<title>` content | Escaped primitives (or arrays of them); nested markup is rejected. |
| Quoted attribute value | Escaped primitives; rejected inside `on*` handlers and `srcdoc`. |
| Opening tag, at an attribute boundary | `attributes()` results (or `null`/`undefined`/`false`) only. |
| Tag or attribute name, unquoted value, comment, DOCTYPE or other declaration | Rejected. |
| `<script>`, `<style>`, `<xmp>`, `<iframe>`, `<noembed>`, `<noframes>`, `<noscript>`, `<plaintext>` content | Rejected. |
| After markup whose parsing is ambiguous (for example `<style>` inside `<svg>`) | Rejected for the rest of the template. |

Use `attributes()` for conditional/boolean attributes and `unsafeHTML()` only for application-owned trusted or sanitized markup. See [`README.md`](README.md#where-interpolation-is-allowed) for examples and the full ambiguity rules.

## Tested third-party engines

CI verifies the packed `white-label-view` package with these representative engines:

| Engine | Tested version | Browser View | Server View | Notes |
| --- | --- | --- | --- | --- |
| Handlebars | 4.7.9 | Yes | Yes | Uses the engine's normal escaping. |
| Eta | 4.6.0 | Yes | Yes | Uses escaped interpolation. |
| EJS | 6.0.1 | Yes | Yes | Uses escaped interpolation. |
| Mustache | 4.2.0 | Yes | Yes | Uses the engine's normal escaping. |
| Nunjucks | 3.2.4 | Yes | Yes | Compatibility fixture enables `autoescape`. |
| Pug | 3.0.4 | Yes | Yes | Uses escaped interpolation. |
| KitaJS HTML | 4.2.13 | Yes | Yes | Compatibility fixture marks dynamic child text `safe`; child expressions are otherwise unescaped by default. |

The compatibility test renders untrusted-looking data through each engine and then passes the resulting HTML to White Label View. Engine-specific escaping remains application-owned.

## Browser contract

Browser View accepts a DOM element, White Label `HTMLMarkup`, or a trusted HTML string that resolves to exactly one root element. A third-party engine therefore normally appears as a small function:

```js
const view = new View({
    parentElement,
    model,
    template: data => compiledTemplate(data)
});
```

If an engine produces multiple top-level elements, text-only output, or an empty string, Browser View rejects that output just as it would any other incompatible string template.

## Server contract

`white-label-view/server` accepts `HTMLMarkup` or a trusted HTML string directly:

```js
const view = new ServerView({
    model,
    template: data => compiledTemplate(data)
}).initialize();

const html = view.toString();
```

No DOM globals are required.

The View template contract is synchronous. Engines or engine features that return promises need to resolve that work before calling View; asynchronous renderer modes are not part of the tested compatibility contract.

## Other renderers

A renderer does not need a White Label adapter. Install it in the application and call it from `template`:

```js
const view = new View({
    parentElement,
    model,
    template: data => renderer.render(templateSource, data)
}).initialize();
```

Engines not listed in the tested matrix can still work when they satisfy the same output contract; they are simply not covered by White Label's compatibility CI.

## Security boundary

White Label does not sanitize third-party template output. Use each engine's escaping features correctly and treat raw/unescaped template features as a caller-owned trust boundary.

Compatibility with an engine does not mean White Label audits or guarantees that engine's behavior, security, performance, or release lifecycle. Applications own their template-engine dependency and version choice.

The first-party `html` tag has its own stricter contract (the table above): it escapes interpolations for their position and rejects ambiguous or executable positions. Do not assume that behavior from third-party engines.

## Why there are no adapters

Dedicated adapters would add dependencies and framework-specific surface without improving View's core contract. Keeping engines outside `white-label-view` preserves the project's minimal design while allowing applications to use the renderer that already fits their stack.
