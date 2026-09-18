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

Normal text and quoted-attribute interpolations are escaped. Use `attributes()` for conditional/boolean attributes and `unsafeHTML()` only for application-owned trusted or sanitized markup.

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
| KitaJS HTML | 4.2.13 | Yes | Yes | Uses the engine's own escaping rules. |

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

The first-party `html`` ` API has its own stricter contract: it escapes ordinary interpolations and rejects ambiguous interpolation contexts. That safety behavior should not be assumed for third-party engines.

## Why there are no adapters

Dedicated adapters would add dependencies and framework-specific surface without improving View's core contract. Keeping engines outside `white-label-view` preserves the project's minimal design while allowing applications to use the renderer that already fits their stack.
