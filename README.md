# white-label-view

> Rendering and lifecycle without a component framework.

`white-label-view` is a framework-independent TypeScript rendering and lifecycle library for browser and server applications. It supports DOM rendering, model-driven updates, delegated events, batching, child ownership, server-side string rendering, and optional JSX without React.

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

## Requirements

- Node.js `^22.18.0` or `>=24.11.0` for installation, development, and server rendering.
- npm, Yarn, and pnpm are supported for installation; see [`PACKAGE_MANAGERS.md`](PACKAGE_MANAGERS.md).
- A browser DOM only when using the default browser entrypoint.
- No `window` or `document` globals are required by `white-label-view/server`.

## Install

```sh
npm install white-label-view
# or: yarn add white-label-view
# or: pnpm add white-label-view
```

Browser:

```js
import View from 'white-label-view';
```

Server:

```js
import View from 'white-label-view/server';
```

## One rendering model, explicit runtime boundaries

### Browser

```js
import View from 'white-label-view';
import {Model} from 'white-label-model';

const model = new Model({name: 'Ada'});
const parentElement = document.querySelector('main');

const view = new View({
    parentElement,
    model,
    template: data => {
        const section = document.createElement('section');
        section.textContent = `Hello, ${data.name}`;
        return section;
    }
}).initialize(); // Returns the View instance after the initial synchronous render.

model.update({name: 'Grace'});
view.destroy();
```

Browser View accepts one DOM element, one trusted single-root HTML string, or White Label JSX output.

### Server

```js
import View from 'white-label-view/server';
import {Model} from 'white-label-model';

const model = new Model({name: 'Ada'});
const view = new View({
    model,
    template: data => `<section><h1>Hello, ${data.name}</h1></section>`
}).initialize();

// toString() returns the most recently rendered HTML string.
const html = view.toString();
view.destroy();
```

Server View accepts a trusted HTML string or White Label JSX output. It intentionally does not emulate DOM nodes, delegated events, focus, mounting, or animation frames.

For request-specific state, create request-specific Model/View instances rather than sharing mutable instances across concurrent requests.

## Serverless and function runtimes

Use `white-label-view/server` when a serverless function should produce HTML. It has no `window` or `document` requirement and returns rendered markup through `toString()`, so it fits functions that receive a request, build request-scoped state, render a response, and then release that lifecycle.

Create mutable View instances per request when they own request-specific models, subscriptions, child views, or output. Warm function processes may serve many sequential or overlapping requests, so sharing one mutable View across invocations can mix output or lifecycle state unless that shared lifetime is deliberate.

Browser View remains a separate progressive-enhancement concern. A function runtime should use the server entrypoint rather than emulating DOM mounting, delegated events, focus, or animation frames.

Direct HTML strings remain trusted caller input in serverless rendering just as they are elsewhere. Escape or sanitize untrusted values for their output context, or use the optional White Label JSX runtime where its default escaping fits the application.

The package currently documents Node.js as its supported server runtime. DOM-free server rendering is portable by design, but that is not a blanket compatibility claim for every edge provider; verify the actual target runtime before deployment.

## JSX is optional

White Label View includes a framework-independent automatic JSX runtime at `white-label-view/jsx-runtime`. Use it when JSX/TSX fits the project; skip it when plain TypeScript or another template engine should own rendering. View itself does not require JSX.

Configure TypeScript when choosing JSX:

```json
{
  "compilerOptions": {
    "jsx": "react-jsx",
    "jsxImportSource": "white-label-view"
  }
}
```

Then write normal TSX:

```tsx
const view = new View({
    parentElement: document.querySelector('main')!,
    model,
    template: data => (
        <section className="profile">
            <h1>Hello, {data.name}</h1>
        </section>
    )
}).initialize();
```

JSX child text and ordinary attribute values are HTML-escaped by default. Fragments, child arrays, function components, boolean attributes, `className`, `htmlFor`, and style objects are supported. Invalid intrinsic tag or attribute names and intrinsic `on*` event-handler attributes throw `TypeError`; use browser listeners instead. JSX and `raw()` values are recognized by runtime-owned identity rather than by forgeable marker-shaped objects.

Escaping prevents ordinary text/attribute markup injection, but it is not a general-purpose sanitizer or policy engine. Applications must still validate URL-bearing values such as `href`/`src`, CSS/style values, and any other context whose safety depends on semantic meaning rather than HTML delimiters.

For independently trusted or sanitized markup, `raw()` is an explicit escape hatch:

```tsx
import {raw} from 'white-label-view/jsx-runtime';

const template = () => <section>{raw('<strong>Trusted markup</strong>')}</section>;
```

Never pass untrusted user content to `raw()`. Direct HTML-string templates are also trusted caller input and must already be escaped or sanitized for their context.

If you do not want JSX, return DOM nodes or trusted HTML strings directly, or call a third-party renderer from `template`. See [Template engines and JSX options](https://whitelabeljs.org/docs/view/#template-engines) for the no-JSX generator path, tested engines, and rendering/security contracts.

## Template-engine agnostic

The first-party JSX runtime is optional. `View` only requires `template` to return a compatible result, so applications can keep the renderer they already use. White Label currently tests Handlebars `4.7.9`, Eta `4.6.0`, EJS `6.0.1`, Mustache `4.2.0`, Nunjucks `3.2.4`, and Pug `3.0.4` in both browser and server View. Other compatible renderers can use the same contract but remain application-owned integrations rather than package dependencies or White Label-tested combinations.

If you use `generator-white-label`, choose the no-JSX option (`--no-jsx`) to generate plain TypeScript templates that return HTML strings. Install and configure your preferred engine in the generated application, then call it from the View `template` function. That keeps the same White Label architecture, lifecycle behavior, and progressive-enhancement capabilities while avoiding a second template syntax or JSX compiler/runtime integration.

See [Template engines and JSX options](https://whitelabeljs.org/docs/view/#template-engines) for tested compatibility, no-JSX setup, rendering contracts, and escaping/security boundaries. The repository-level compatibility notes are also in [`TEMPLATE_ENGINES.md`](TEMPLATE_ENGINES.md).

## Browser lifecycle

`initialize()` performs a synchronous `render()`. When a model exposes `get()`, View passes `model.get()` to the template; otherwise it passes the model itself.

A successful mount or replacement installs the root, initializes model binding when possible, calls `addListeners()`, and then calls `afterMount()`. Equal HTML/JSX output skips reparsing while attached, and equal DOM trees preserve the existing root.

Browser templates must resolve to exactly one element. Empty strings, text nodes, comments, multiple roots, top-level multi-element fragments, `null`, and other non-element results throw `TypeError` without replacing the last successful root.

## Simple click event

Use `addListeners()` and `removeListeners()` when a View owns a browser event:

```js
class ButtonView extends View {
    handleClick = () => {
        console.log('Clicked');
    };

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

The same callback reference is used for registration and cleanup. View calls `addListeners()` after the root is installed and `removeListeners()` before replacement or destruction.

## Browser public API

| Method | Behavior | Returns |
| --- | --- | --- |
| `initialize()` | Render current state and initialize lifecycle. | The same `View` instance. |
| `render()` | Synchronously mount, replace, or update the root. | The same `View` instance; throws `TypeError` if a template does not resolve to exactly one element. |
| `requestRender()` | Render now or coalesce into an animation frame when batching is enabled. | The same `View` instance, whether rendered immediately or queued. |
| `setModel(model?)` | Move model binding and render current state. | The same `View` instance after rendering. |
| `delegate(scope?)` | Create a native delegated-event registry. | A new delegated-event registry scoped to the supplied element or current root. |
| `addChild(child)` | Register child ownership. | The parent `View`; throws `TypeError` for cycles or a child already owned elsewhere. |
| `releaseChild(child)` | Release ownership without destroying the child. | The parent `View`. |
| `initializeModelBinding()` | Subscribe to model `change` events. | `undefined`; updates binding state in place. |
| `destroyModelBinding()` | Release model subscription and queued work. | `undefined`; updates binding state in place. |
| `addListeners()` | Extension hook after root installation. | The same `View` instance by default. |
| `removeListeners()` | Extension hook before replacement or destruction. | The same `View` instance by default. |
| `afterMount()` | Extension hook after insertion and listener setup. | The same `View` instance by default. |
| `destroy()` | Release listeners, model binding, children, queued work, and DOM root. | The same `View` instance after cleanup. |

Delegated-event registry methods `on()`, `off()`, and `clear()` each return that registry for chaining. These methods belong to the delegated DOM-event helper.

## Server public API

| Method | Behavior | Returns |
| --- | --- | --- |
| `initialize()` | Render current state and initialize lifecycle. | The same server `View` instance. |
| `render()` | Render the template into stored HTML. | The same server `View`; throws `TypeError` for output that is neither a string nor White Label JSX markup. |
| `toString()` | Return the most recently rendered HTML. | The rendered HTML string, or `''` before/after output is cleared. |
| `setModel(model?)` | Move model binding and synchronously render new state. | The same server `View` instance after rendering. |
| `addChild(child)` | Register child ownership. | The parent server `View`; throws `TypeError` for cycles or a child already owned elsewhere. |
| `releaseChild(child)` | Release ownership without destroying the child. | The same server `View` instance. |
| `initializeModelBinding()` | Subscribe to model `change` events. | The same server `View` instance. |
| `destroyModelBinding()` | Release model subscription. | The same server `View` instance. |
| `destroy()` | Destroy children, release subscriptions, and clear output. | The same server `View` instance after cleanup. |

## Delegated browser events

Use the delegated helper when one View root owns events for matching descendants:

```js
class MenuView extends View {
    constructor(settings) {
        super(settings);
        this.handleLinkClick = this.handleLinkClick.bind(this);
    }

    addListeners() {
        this.delegated.on('click', 'a', this.handleLinkClick);
        return this;
    }

    removeListeners() {
        this.delegated.off('click', 'a', this.handleLinkClick);
        return this;
    }

    handleLinkClick(event) {
        event.preventDefault();
    }
}
```

Delegation uses native `addEventListener()` and `closest()`. Registries created with `delegate(scope)` are caller-owned; the View-owned `delegated` registry is cleared when the root is replaced or destroyed.

## In-place updates and focus preservation

Use `update()` when replacing a root would unnecessarily destroy browser state:

```js
const view = new View({
    parentElement: document.querySelector('main'),
    model,
    template: () => '<section><input><span></span></section>',
    update: (element, data) => {
        element.querySelector('span').textContent = data.status;
        return true;
    }
}).initialize();
```

Return `true` when the update was handled. Return `false` to fall back to normal rendering.

## Model binding and batching

Model binding is one-way: model changes trigger rendering; form input is not automatically written back to state.

Observable models use the native `EventTarget` contract and provide both `addEventListener()` and `removeEventListener()` so View can subscribe to and release the `change` event. `setModel(nextModel)` moves the binding and renders immediately.

Set `batchUpdates: true` in Browser View to coalesce model-driven renders into one `requestAnimationFrame`. Manual `render()` remains synchronous. Server View always renders model changes synchronously.

## Child ownership

`addChild()` opts a child into parent ownership; it does not mount the child automatically. Parent root replacement and destruction destroy owned browser children. In-place updates and equal-root renders preserve them. Server View destroys owned children during teardown.

`releaseChild()` transfers cleanup responsibility without destroying the child. Ownership cycles and simultaneous ownership by two parents throw `TypeError`.

## Accessibility and public content

View manages rendering mechanics, not markup quality. Applications remain responsible for semantic HTML, accessible names, keyboard operation, focus visibility, contrast, live regions, and other applicable accessibility requirements.

For public content, prefer meaningful server-rendered or static initial HTML and use Browser View for progressive enhancement. The package does not provide automatic hydration or claim to reconcile server DOM with browser state.

## TypeScript

Both entrypoints use strict TypeScript and emit JavaScript, source maps, and declarations into `dist`.

```ts
const settings: View.Settings = {
    parentElement: document.body,
    template: () => '<p>Hello</p>',
    batchUpdates: true
};

const view = new View(settings).initialize();
```

`View.Settings`, `View.Model`, browser listener/settings types, and JSX runtime types expose the supported contracts. Template data is `unknown`; application code should narrow it before reading domain fields.

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

Coverage enforces 100% statements, branches, functions, and lines per implementation file. CI verifies both the documented Node 22.18 minimum and the primary Node 24 line, builds authored source, uploads generated artifacts for inspection, verifies public package subpaths from the packed artifact, tests packed-package compatibility across npm, Yarn, and pnpm, and runs the isolated template-engine compatibility matrix.

Edit `src/*.ts` and regenerate `dist`; do not edit generated files directly.

## Design boundary

View owns rendering and rendering lifecycle. It intentionally does not own application state, routing, networking, CSS, sanitization policy, or application-wide events. Browser-specific behavior stays browser-specific; portable rendering concepts stay portable.