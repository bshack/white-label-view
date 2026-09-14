# Template engine compatibility

`white-label-view` is template-engine agnostic. JSX is an optional first-party rendering choice, not a requirement. A third-party template engine is compatible when application code can call it from `template` and return output that satisfies the View runtime contract.

White Label does not wrap, configure, bundle, or depend on third-party template engines. Applications install and configure the renderer they choose.

For the public guide, including generator `--no-jsx` usage and the current tested-engine matrix, see [Template engines and JSX options](https://whitelabeljs.org/docs/view/#template-engines).

## Tested engines

CI verifies the packed `white-label-view` package with these representative engines:

| Engine | Tested version | Browser View | Server View |
| --- | --- | --- | --- |
| Handlebars | 4.7.9 | Yes | Yes |
| Eta | 4.6.0 | Yes | Yes |
| EJS | 6.0.1 | Yes | Yes |
| Mustache | 4.2.0 | Yes | Yes |
| Nunjucks | 3.2.4 | Yes | Yes |
| Pug | 3.0.4 | Yes | Yes |

The compatibility test renders escaped data through each engine and then passes the resulting HTML to White Label View. Engine-specific escaping remains application-owned; for example, the Nunjucks compatibility test enables `autoescape` explicitly.

## Browser contract

Browser View accepts a DOM element, White Label JSX output, or a trusted HTML string that resolves to exactly one root element. A third-party engine therefore normally appears as a small function:

```js
const view = new View({
    parentElement,
    model,
    template: data => compiledTemplate(data)
});
```

If an engine produces multiple top-level elements, text-only output, or an empty string, Browser View rejects that output just as it would any other incompatible string template.

## Server contract

`white-label-view/server` accepts a trusted HTML string directly:

```js
const view = new ServerView({
    model,
    template: data => compiledTemplate(data)
}).initialize();

const html = view.toString();
```

No DOM globals are required.

## Choosing JSX or another renderer

Use White Label JSX when its small first-party runtime fits the project. Skip JSX when plain TypeScript or an existing template engine should remain the application's template convention.

With `generator-white-label`, choose the no-JSX scaffold interactively or pass `--no-jsx`. The generated project then uses plain TypeScript functions that return HTML strings; replace or wrap those functions with your chosen renderer as needed. Model, View, Router, Mediator, progressive enhancement, and lifecycle behavior remain the same.

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

## Why there are no adapters

Dedicated adapters would add dependencies and framework-specific surface without improving View's core contract. Keeping engines outside `white-label-view` preserves the project's minimal design while allowing applications to use the renderer that already fits their stack.
