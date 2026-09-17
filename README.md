# white-label-view

> Rendering and lifecycle without a component framework.

`white-label-view` is a framework-independent TypeScript rendering and lifecycle library for browser and server applications. It supports existing DOM adoption, model-driven updates, delegated events, batching, child ownership, server-side rendering, and first-party tagged HTML templates.

[Documentation](https://whitelabeljs.org/docs/view/) · [API reference](https://whitelabeljs.org/api/#view) · [Demo site](https://whitelabeljs.org/)

**Responsibility:** turn state into output and own the lifecycle around that output. Nothing more.

## Why it exists

White Label keeps rendering close to the web platform instead of introducing a proprietary component model. View gives rendering, subscriptions, DOM ownership, and teardown a predictable home while leaving state, routing, application events, styling, networking, and higher-level composition outside the package.

Use it independently or compose it with the rest of White Label:

- [`white-label-model`](https://github.com/bshack/white-label-model) provides observable state that View can render.
- [`white-label-mediator`](https://github.com/bshack/white-label-mediator) carries application events without becoming part of View.
- [`white-label-router`](https://github.com/bshack/white-label-router) can start and destroy view lifecycles as navigation changes.
- [`generator-white-label`](https://github.com/bshack/white-label) demonstrates the complete composition.

The package has no runtime dependency on the other White Label packages. It does not bundle React, Preact, a CSS framework, sanitizer, state library, component framework, or third-party template engine.

## Where it fits

View is a strong fit when an application needs rendering lifecycle **without handing the whole page to a component framework**. Common cases include progressively enhanced public sites, server-rendered commerce or CMS pages, account and form experiences, small application islands, existing applications being modernized incrementally, and server-side HTML rendering.

An existing server-rendered element can be adopted directly. If an in-place `update()` hook handles the change, no client template is required at all. That makes View useful when the host platform should remain responsible for initial HTML while White Label owns only a narrow interactive region.

For public content, the recommended model is meaningful initial HTML first, then selective browser enhancement. View intentionally does not provide automatic hydration or a virtual DOM reconciliation layer.

See the [incremental server-rendered application guide](https://whitelabeljs.org/guides/incremental-javascript-for-server-rendered-apps/) for a complete integration pattern.

## Requirements

- Node.js `^22.18.0` or `>=24.11.0` for installation, development, and server rendering.
- npm, Yarn, and pnpm are supported for installation; see [`PACKAGE_MANAGERS.md`](PACKAGE_MANAGERS.md).
- A browser DOM only when using the default browser entrypoint.
- No `window` or `document` globals are required by `white-label-view/server` or `white-label-view/html`.

## Install

```sh
npm install white-label-view
# or: yarn add white-label-view
# or: pnpm add white-label-view
```

Browser:

```ts
import View from 'white-label-view';
```

Server:

```ts
import View from 'white-label-view/server';
```

First-party HTML templates:

```ts
import {attributes, html, unsafeHTML} from 'white-label-view/html';
```

## First-party tagged HTML templates

Tagged template literals are the first-party White Label template syntax. They are ordinary JavaScript/TypeScript syntax and require no JSX compiler mode or proprietary transform.

```ts
import View from 'white-label-view';
import {html} from 'white-label-view/html';

const view = new View({
    parentElement: document.querySelector('main')!,
    model: {name: '<Ada & Grace>'},
    template: data => {
        const profile = data as {name: string};
        return html`
            <section class="profile">
                <h1>Hello, ${profile.name}</h1>
            </section>
        `;
    }
}).initialize();
```

Normal text and quoted-attribute interpolations are HTML-escaped. Nested `html`` ` results and arrays of tagged-template results compose without double escaping. `null`, `undefined`, and booleans render no text; numbers and bigints render as text.

The tag rejects ambiguous or dangerous interpolation locations such as tag names, unquoted attributes, HTML comments, `<script>` bodies, and `<style>` bodies. Objects, functions, symbols, promises, DOM nodes, and other unsupported values also throw instead of being coerced implicitly.

### Conditional and boolean attributes

Use `attributes()` when a complete attribute should be conditional or when rendering standard boolean attributes:

```ts
import {attributes, html} from 'white-label-view/html';

const template = (data: {complete: boolean; id: number}) => html`
    <input ${attributes({
        type: 'checkbox',
        checked: data.complete,
        'data-task-id': data.id
    })}>
`;
```

`attributes()` validates attribute names, rejects inline `on*` event-handler attributes and `srcdoc`, quotes values, escapes delimiters, omits `null`/`undefined`/`false`, and renders recognized boolean attributes by presence when `true`.

Use browser event listeners or View's delegated event helper instead of inline HTML event-handler attributes.

### Trusted markup

Use `unsafeHTML()` only for markup that the application already owns, trusts, or has sanitized:

```ts
import {html, unsafeHTML} from 'white-label-view/html';

const template = (trustedMarkup: string) => html`
    <section>${unsafeHTML(trustedMarkup)}</section>
`;
```

`unsafeHTML()` is an explicit trust boundary. Never pass uncontrolled user content to it.

HTML escaping is not URL, JavaScript, CSS, or application-policy validation. Applications remain responsible for deciding which `href`, `src`, `action`, style values, and other semantic values are allowed.

## Browser rendering

Browser View accepts exactly one DOM element, one trusted HTML string, or one `HTMLMarkup` result from `white-label-view/html`.

```ts
import View from 'white-label-view';
import {Model} from 'white-label-model';
import {html} from 'white-label-view/html';

const model = new Model({name: 'Ada'});
const view = new View({
    parentElement: document.querySelector('main')!,
    model,
    template: data => html`<section><h1>Hello, ${(data as {name: string}).name}</h1></section>`
}).initialize();

model.update({name: 'Grace'});
view.destroy();
```

String/`HTMLMarkup` output must resolve to exactly one root element. Empty output, text-only output, comments, or multiple top-level elements are rejected.

## Adopt existing server-rendered markup

Pass an existing `element` when the server/CMS/commerce platform already rendered the DOM you want to enhance:

```ts
import {Model} from 'white-label-model';
import View from 'white-label-view';

const status = document.querySelector<HTMLElement>('[data-filter-status]')!;
const filters = new Model({color: ''});

const view = new View({
    parentElement: status.parentElement!,
    element: status,
    model: filters,
    update(element, data) {
        const state = data as {color: string};
        element.textContent = state.color
            ? `Color filter: ${state.color}`
            : 'No color filter selected';
        return true;
    }
}).initialize();
```

When the root is attached, View calls `update(element, data)` before requiring a template. Returning `true` means the current DOM handled the render. If it returns `false`, View falls back to the configured template when one exists.

Keep ownership explicit: View owns the adopted root and its lifecycle, not unrelated host-rendered siblings. `destroy()` removes the root it owns, so a host that intends to keep an element after enhancement teardown should structure ownership accordingly.

## Server rendering

```ts
import View from 'white-label-view/server';
import {html} from 'white-label-view/html';

const view = new View({
    model: {name: 'Ada'},
    template: data => html`<section><h1>Hello, ${(data as {name: string}).name}</h1></section>`
}).initialize();

const markup = view.toString();
view.destroy();
```

Server View accepts trusted HTML strings or White Label `HTMLMarkup`. It intentionally does not emulate DOM nodes, delegated events, focus, mounting, or animation frames.

For request-specific state, create request-specific Model/View instances rather than sharing mutable instances across concurrent requests.

## Serverless and function runtimes

Use `white-label-view/server` when a serverless function should produce HTML. It has no `window` or `document` requirement and returns rendered markup through `toString()`.

Create mutable View instances per request when they own request-specific models, subscriptions, child views, or output. Warm function processes may serve sequential or overlapping requests, so sharing one mutable View can mix output or lifecycle state unless that lifetime is deliberate.

The package currently documents Node.js as its supported server runtime. DOM-free rendering is portable by design, but that is not a blanket compatibility claim for every edge provider.

## Third-party template engines

`View` is template-engine agnostic. Any renderer that synchronously returns compatible HTML can be called from `template`; White Label does not require an adapter.

White Label currently tests these representative integrations through both Browser View and Server View:

- Handlebars `4.7.9`
- Eta `4.6.0`
- EJS `6.0.1`
- Mustache `4.2.0`
- Nunjucks `3.2.4`
- Pug `3.0.4`
- KitaJS HTML `4.2.13` for synchronous JSX-to-HTML rendering

KitaJS is a third-party JSX runtime, not a White Label dependency or first-party runtime. Its current security model requires callers to use Kita's `safe` attribute or explicit escaping for uncontrolled dynamic child strings. White Label compatibility does not replace Kita's own security guidance.

See [`TEMPLATE_ENGINES.md`](TEMPLATE_ENGINES.md) and the [public template-engine guide](https://whitelabeljs.org/docs/view/#template-engines) for the tested matrix, setup examples, and trust boundaries.

## Browser lifecycle

`initialize()` performs a synchronous `render()`. When a model exposes `get()`, View passes `model.get()` to the template/update hook; otherwise it passes the model itself.

For an attached root, `update(element, data)` gets the first opportunity to handle a render. A successful mount, adoption, or replacement initializes model binding, calls `addListeners()`, then calls `afterMount()`. Equal HTML output skips reparsing while attached, and equal DOM trees preserve the existing root.

When template rendering is used, browser output must resolve to exactly one element. Invalid output throws `TypeError` without replacing the last successful root.

## Events and delegated events

Use `addListeners()` and `removeListeners()` when a View owns browser events. The same callback reference should be used for registration and cleanup.

```ts
class ButtonView extends View {
    handleClick = () => console.log('Clicked');

    addListeners() {
        this.element.addEventListener('click', this.handleClick);
        return this;
    }

    removeListeners() {
        this.element.removeEventListener('click', this.handleClick);
        return this;
    }
}
```

For descendant events, `this.delegated` provides a native `addEventListener()`/`closest()` based registry. `delegate(scope)` creates a caller-owned registry. View-owned delegated registrations are cleared on root replacement or destruction.

## In-place updates and focus preservation

Use `update()` when replacing a root would unnecessarily destroy browser state such as focus, selection, or host-owned markup. Return `true` when the update was handled. Return `false` to fall back to normal template rendering. A template is optional when the View adopts an attached root and the update hook handles the render.

## Model binding and batching

Model binding is one-way: model changes trigger rendering; form input is not automatically written back to state.

Observable models use the native EventTarget contract and provide both `addEventListener()` and `removeEventListener()` so View can subscribe to and release `change`. `setModel(nextModel)` moves the binding and renders immediately.

Set `batchUpdates: true` in Browser View to coalesce model-driven renders into one `requestAnimationFrame`. Manual `render()` remains synchronous. Server View always renders model changes synchronously.

## Child ownership

`addChild()` opts a child into parent cleanup ownership; it does not mount the child automatically. Parent root replacement and destruction destroy owned browser children. In-place updates and equal-root renders preserve them. Server View destroys owned children during teardown.

`releaseChild()` transfers cleanup responsibility without destroying the child. Ownership cycles and simultaneous ownership by two parents throw `TypeError`.

## Accessibility and public content

View manages rendering mechanics, not markup quality. Applications remain responsible for semantic HTML, accessible names, keyboard operation, focus visibility, contrast, live regions, and other applicable accessibility requirements.

For public content, prefer meaningful server-rendered or static initial HTML and use Browser View for progressive enhancement. The package does not provide automatic hydration or claim to reconcile arbitrary server DOM with browser state.

## Browser public API

| Method | Behavior | Returns |
| --- | --- | --- |
| `initialize()` | Render/adopt current state and initialize lifecycle. | The same `View` instance. |
| `render()` | Synchronously update, mount, replace, or adopt the root. | The same View; template output errors throw `TypeError`. |
| `requestRender()` | Render now or coalesce into an animation frame when batching is enabled. | The same `View` instance. |
| `setModel(model?)` | Move model binding and render current state. | The same `View` instance. |
| `delegate(scope?)` | Create a native delegated-event registry. | A new delegated-event registry. |
| `addChild(child)` | Register child cleanup ownership. | The parent View; throws for cycles/conflicting ownership. |
| `releaseChild(child)` | Release ownership without destroying the child. | The parent View. |
| `initializeModelBinding()` | Subscribe to model `change` events. | `undefined`. |
| `destroyModelBinding()` | Release model subscription and queued work. | `undefined`. |
| `addListeners()` | Extension hook after root installation/adoption. | The same View by default. |
| `removeListeners()` | Extension hook before replacement/destruction. | The same View by default. |
| `afterMount()` | Extension hook after insertion/adoption and listener setup. | The same View by default. |
| `destroy()` | Release listeners, binding, children, queued work, and DOM root. | The same View after cleanup. |

Delegated-event registry methods `on()`, `off()`, and `clear()` return the registry for chaining.

## Server public API

| Method | Behavior | Returns |
| --- | --- | --- |
| `initialize()` | Render current state and initialize lifecycle. | The same server View. |
| `render()` | Render the template into stored HTML. | The same server View; throws for unsupported output. |
| `toString()` | Return the most recently rendered HTML. | The HTML string, or `''` when no output is stored. |
| `setModel(model?)` | Move model binding and render new state. | The same server View. |
| `addChild(child)` | Register child cleanup ownership. | The parent server View. |
| `releaseChild(child)` | Release ownership without destroying the child. | The same server View. |
| `initializeModelBinding()` | Subscribe to model `change`. | The same server View. |
| `destroyModelBinding()` | Release model subscription. | The same server View. |
| `destroy()` | Destroy children, release subscriptions, and clear output. | The same server View. |

## HTML template API

`white-label-view/html` exports:

| Export | Purpose |
| --- | --- |
| `html` | Build escaped, composable `HTMLMarkup` from a tagged template literal. |
| `attributes` | Render validated conditional/boolean attributes at an opening-tag attribute boundary. |
| `unsafeHTML` | Insert caller-owned trusted/sanitized markup without escaping. |
| `isHTMLMarkup` | Identify White Label tagged-template output, including output from another installed package copy. |
| `HTMLMarkup` | TypeScript interface for the branded first-party markup result. |

## TypeScript

All entrypoints use strict TypeScript and emit JavaScript, source maps, and declarations into `dist`.

`View.Settings`, `View.Model`, browser listener/settings types, and `HTMLMarkup` expose the supported contracts. Template data is `unknown`; application code should narrow it before reading domain fields.

## Development

```sh
npm ci --ignore-scripts
npm run build
npm run lint
npm run typecheck
npm test
npm run coverage
npm run audit
npm pack --dry-run
```

Coverage enforces 100% statements, branches, functions, and lines per implementation file. CI verifies the documented Node minimum and primary Node line, builds authored source, verifies public package subpaths from the packed artifact, tests npm/Yarn/pnpm compatibility, and runs the isolated template-engine matrix.

Edit `src/*.ts` and regenerate `dist`; do not edit generated files directly.

## Design boundary

View owns rendering and rendering lifecycle. It intentionally does not own application state, routing, networking, CSS, sanitization policy, or application-wide events. Browser-specific behavior stays browser-specific; portable rendering concepts stay portable.
