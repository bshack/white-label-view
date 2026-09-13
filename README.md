# white-label-view

> Rendering and lifecycle without a component framework.

`white-label-view` provides explicit rendering and lifecycle primitives for browser and server runtimes. Browser View owns DOM rendering, model-driven updates, delegated events, batching, child ownership, and cleanup. The `/server` entrypoint uses the same model/template concepts to render strings or White Label JSX without DOM globals.

**Responsibility:** turn state into output and own the lifecycle around that output. Nothing more.

## Why it exists

White Label keeps rendering close to the web platform instead of introducing a proprietary component model. View gives rendering, subscriptions, DOM ownership, and teardown a predictable home while leaving state, routing, application events, styling, networking, and higher-level composition outside the package.

Use it independently or compose it with the rest of White Label:

- [`white-label-model`](https://github.com/bshack/white-label-model) provides observable state that View can render.
- [`white-label-mediator`](https://github.com/bshack/white-label-mediator) carries application events without becoming part of View.
- [`white-label-router`](https://github.com/bshack/white-label-router) can start and destroy view lifecycles as navigation changes.
- [`generator-white-label`](https://github.com/bshack/white-label) demonstrates the complete composition.
- [`white-label-demo-site`](https://github.com/bshack/white-label-demo-site) contains the complete documentation and live examples.

The package has no runtime dependency on the other White Label packages. It does not bundle React, Preact, a CSS framework, sanitizer, state library, or component framework.

## Requirements

- Node.js `^22.18.0` or `>=24.11.0` for installation, development, and server rendering.
- A browser DOM only when using the default browser entrypoint.
- No `window` or `document` globals are required by `white-label-view/server`.

## Install

```sh
npm install white-label-view
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
}).initialize();

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

const html = view.toString();
view.destroy();
```

Server View accepts a trusted HTML string or White Label JSX output. It intentionally does not emulate DOM nodes, delegated events, focus, mounting, or animation frames.

For request-specific state, create request-specific Model/View instances rather than sharing mutable instances across concurrent requests.

## JSX is optional

White Label View includes a framework-independent automatic JSX runtime at `white-label-view/jsx-runtime`. It has no React or Preact dependency.

Configure TypeScript:

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

JSX child text and attribute values are escaped by default. Fragments, child arrays, function components, boolean attributes, `className`, `htmlFor`, and style objects are supported. Intrinsic event-handler attributes such as `onClick` are not serialized; use delegated browser events instead.

For independently trusted or sanitized markup, `raw()` is an explicit escape hatch:

```tsx
import {raw} from 'white-label-view/jsx-runtime';

const template = () => <section>{raw('<strong>Trusted markup</strong>')}</section>;
```

Never pass untrusted user content to `raw()`. Direct HTML-string templates are also trusted caller input and must already be escaped or sanitized for their context.

## Template-engine agnostic

The first-party JSX runtime is optional. Any renderer that can be called from JavaScript and return a compatible result can sit in front of View. Handlebars, Eta, Mustache, Nunjucks, or application-specific renderers can be called inside `template`; none are package dependencies.

## Browser lifecycle

`initialize()` performs a synchronous `render()`. When a model exposes `get()`, View passes `model.get()` to the template; otherwise it passes the model itself.

A successful mount or replacement installs the root, initializes model binding when possible, calls `addListeners()`, and then calls `afterMount()`. Equal HTML/JSX output skips reparsing while attached, and equal DOM trees preserve the existing root.

Browser templates must resolve to exactly one element. Empty strings, text nodes, comments, multiple roots, top-level multi-element fragments, `null`, and other non-element results throw `TypeError` without replacing the last successful root.

## Browser public API

| Method | Behavior |
| --- | --- |
| `initialize()` | Render current state and initialize lifecycle. |
| `render()` | Synchronously mount, replace, or update the root. |
| `requestRender()` | Render now or coalesce into an animation frame when batching is enabled. |
| `setModel(model?)` | Move model binding and render current state. |
| `delegate(scope?)` | Create a native delegated-event registry. |
| `addChild(child)` | Register child ownership. |
| `releaseChild(child)` | Release ownership without destroying the child. |
| `initializeModelBinding()` | Subscribe to model `change` events. |
| `destroyModelBinding()` | Release model subscription and queued work. |
| `addListeners()` | Extension hook after root installation. |
| `removeListeners()` | Extension hook before replacement or destruction. |
| `afterMount()` | Extension hook after insertion and listener setup. |
| `destroy()` | Release listeners, model binding, children, queued work, and DOM root. |

## Server public API

| Method | Behavior |
| --- | --- |
| `initialize()` | Render current state and initialize lifecycle. |
| `render()` | Render the template into stored HTML. |
| `toString()` | Return the most recently rendered HTML. |
| `setModel(model?)` | Move model binding and synchronously render new state. |
| `addChild(child)` | Register child ownership. |
| `releaseChild(child)` | Release ownership without destroying the child. |
| `initializeModelBinding()` | Subscribe to model `change` events. |
| `destroyModelBinding()` | Release model subscription. |
| `destroy()` | Destroy children, release subscriptions, and clear output. |

## Delegated browser events

Subclass View when a feature owns browser behavior:

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

Observable models must provide both `on()` and `removeListener()` so View can release its subscription. `setModel(nextModel)` moves the binding and renders immediately.

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

Coverage enforces 100% statements, branches, functions, and lines per implementation file. CI builds tracked `dist`, verifies public package subpaths from the packed artifact, and rejects generated-output drift.

Edit `src/*.ts` and regenerate `dist`; do not edit generated files directly.

## Design boundary

View owns rendering and rendering lifecycle. It intentionally does not own application state, routing, networking, CSS, sanitization policy, or application-wide events. Browser-specific behavior stays browser-specific; portable rendering concepts stay portable.