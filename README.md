# white-label-view

`white-label-view` provides explicit view lifecycle primitives for both browser and server runtimes. The default `white-label-view` entrypoint owns DOM rendering, model-driven updates, delegated events, batching, child-view ownership, and lifecycle cleanup. The separate `white-label-view/server` entrypoint uses the same model/template concepts to render trusted strings or White Label JSX without requiring DOM globals.

The package includes an optional, framework-independent JSX runtime but intentionally does **not** bundle React, Preact, a CSS framework, component framework, sanitizer, or state library. Styling and higher-level rendering choices remain in the consuming application.

The package can be installed and used independently; it has no runtime dependency on the other White Label packages.

## Requirements

- Node.js `^22.18.0` or `>=24.11.0` for installation, development, and server rendering.
- A browser DOM only when using the default browser View entrypoint.
- No `window` or `document` globals are required by `white-label-view/server`.

## Versioning policy

Backward compatibility is not maintained through aliases, deprecated method names, fallback signatures, or other runtime shims. Breaking public API changes are communicated with a Semantic Versioning major release and release notes outside this README.

## Install

```sh
npm install white-label-view
```

Browser View:

```js
import View from 'white-label-view';
```

Server View:

```js
import View from 'white-label-view/server';
```

Both entrypoints can consume the same observable model contract and the same first-party JSX runtime. DOM mounting, delegated events, focus, and animation-frame batching remain deliberately browser-only.

## Browser use

```js
import View from 'white-label-view';
import {Model} from 'white-label-model';

const model = new Model({name: 'Ada'});
const parentElement = document.querySelector('main');

const profileView = new View({
    parentElement,
    model,
    template: data => {
        const section = parentElement.ownerDocument.createElement('section');
        const heading = parentElement.ownerDocument.createElement('h1');
        heading.textContent = `Hello, ${data.name}`;
        section.append(heading);
        return section;
    }
}).initialize();

model.update({name: 'Grace'});
profileView.destroy();
```

DOM construction remains the safest default when a consuming application needs direct control over untrusted data. If an application returns an HTML string, that string is trusted caller input and must already be safely escaped or sanitized for its context.

## Server use

Use the explicit `/server` entrypoint for request-time or other DOM-free rendering:

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
model.destroy();
```

Direct string templates intentionally have the same trusted-markup boundary as browser string templates. Escape or sanitize untrusted values before placing them in a raw HTML string. Prefer the first-party JSX runtime when you want expression escaping by default.

Create request-specific Model/View instances for request-specific state rather than sharing mutable view state across concurrent requests.

## JSX templating

White Label View ships an automatic JSX runtime at `white-label-view/jsx-runtime`. It renders JSX to escaped markup understood by both browser and server View entrypoints, with no React or Preact dependency.

Configure TypeScript with:

```json
{
  "compilerOptions": {
    "jsx": "react-jsx",
    "jsxImportSource": "white-label-view"
  }
}
```

Then use `.tsx` templates normally:

```tsx
import View from 'white-label-view';
import {Model} from 'white-label-model';

type Profile = {
    name: string;
    count: number;
};

const model = new Model<Profile>({name: 'Ada', count: 1});

const view = new View({
    parentElement: document.querySelector('main')!,
    model,
    template(data) {
        const profile = data as Profile;
        return (
            <section className="profile">
                <h1>Hello, {profile.name}</h1>
                <p>Count: {profile.count}</p>
            </section>
        );
    }
}).initialize();
```

JSX child text and attribute values are escaped by default. Fragments, arrays of children, function components, standard boolean attributes, `className`, `htmlFor`, and style objects are supported. Intrinsic event-handler attributes such as `onClick` are intentionally not serialized; use View's delegated event lifecycle in the browser instead.

For markup that has already been independently trusted or sanitized, `raw()` is an explicit escape hatch:

```tsx
import {raw} from 'white-label-view/jsx-runtime';

const template = () => <section>{raw('<strong>Trusted markup</strong>')}</section>;
```

Never pass untrusted user content to `raw()`. Ordinary JSX expressions already escape strings correctly.

DOM-node templates are supported by browser View. String and JSX templates are supported by both browser and server View. The server entrypoint does not accept DOM nodes because it intentionally has no DOM dependency.

## Compatible templating engines

`white-label-view` is template-engine agnostic. Any renderer that can be called from JavaScript and produce one compatible render result can sit in front of View. The built-in JSX runtime is the dependency-free first-party option.

- Browser View accepts one DOM element, one trusted single-root HTML string, or White Label JSX output.
- Server View accepts one trusted HTML string or White Label JSX output and exposes the result through `toString()`.

External renderers such as Handlebars, Eta, Mustache, Nunjucks, or application-specific JavaScript can be used by calling them inside the `template` callback. They are not package dependencies. HTML-string output remains trusted caller input.

## Browser rendering lifecycle

`initialize()` calls synchronous `render()`.

When a model exposes `get()`, the view passes `model.get()` to the render callback. Otherwise it passes the model object. When the root is already attached, `update(element, data)` can return `true` to handle the update in place. Returning `false` falls back to normal rendering.

A successful browser mount or replacement:

1. inserts or replaces the root in its actual DOM parent;
2. initializes the model subscription when possible;
3. calls `addListeners()` once for that root;
4. calls `afterMount()` once for that root.

Equal HTML/JSX output skips reparsing while attached. Equal DOM trees preserve the existing root. Existing markup can also be adopted when the supplied `element` is already within `parentElement`.

Browser render callbacks must resolve to exactly one element. Empty strings, text nodes, comments, multiple roots, top-level JSX fragments with multiple elements, `null`, and other non-element results throw `TypeError`. Invalid output does not replace the last successful root.

String and JSX roots are parsed with a temporary `<template>` in the view's owning document, keeping iframe or multi-document views in the correct document.

## Browser constructor settings

| Setting | Meaning |
| --- | --- |
| `parentElement` | DOM element that receives or contains the root. |
| `element` | Existing root element. Defaults to a new `div` in the owning document. |
| `model` | Plain data object or an object with optional `get()`, `on()`, and `removeListener()` methods. |
| `template` | Function receiving model data and returning one DOM node, one trusted single-root HTML string, or White Label JSX output. |
| `update` | Optional in-place update hook. Return `true` when handled or `false` to use normal rendering. |
| `batchUpdates` | When `true`, coalesce automatic model updates into one animation frame. Manual `render()` stays synchronous. |

## Browser public methods

| Method | Behavior |
| --- | --- |
| `initialize()` | Render current state and return the view. |
| `render()` | Synchronously update or mount the root. |
| `destroy()` | Cancel queued work, destroy owned children, remove listeners and model binding, remove the root, and reset the view for reuse. |
| `setModel(model?)` | Move the model subscription and immediately render current state. |
| `requestRender()` | Render now or request one batched animation-frame render. |
| `addListeners()` | Extension hook called after a root is installed. |
| `removeListeners()` | Extension hook called before root replacement or destruction. |
| `afterMount()` | Extension hook called after insertion/adoption and listener setup. |
| `addChild(child)` | Register child ownership without mounting it. |
| `releaseChild(child)` | Relinquish ownership without destroying the child. |
| `delegate(scope?)` | Create a native delegated-event registry for a scope or the current root. |
| `initializeModelBinding()` | Add one model `change` listener when the model supports removable listeners. |
| `destroyModelBinding()` | Remove this view's model listener and cancel queued rendering. |

Model binding is one-way: model changes trigger view rendering. Form input is not automatically written back to the model.

## Server public methods

The server entrypoint intentionally exposes only the portable lifecycle subset:

| Method | Behavior |
| --- | --- |
| `initialize()` | Render current state and return the view. |
| `render()` | Render the template to the stored HTML string. |
| `toString()` | Return the most recently rendered HTML string. |
| `setModel(model?)` | Move the model subscription and synchronously render the new state. |
| `addChild(child)` | Register child ownership. |
| `releaseChild(child)` | Relinquish child ownership without destroying it. |
| `initializeModelBinding()` | Subscribe to model `change` when the model supports removable listeners. |
| `destroyModelBinding()` | Release that subscription. |
| `destroy()` | Destroy owned children, release subscriptions, clear rendered output, and return the view. |

Server View does not emulate DOM nodes, delegated events, focus, `requestAnimationFrame`, or mounting. Those remain browser concerns.

## Reusable views and delegated events

The following APIs apply to the browser entrypoint:

```js
import View from 'white-label-view';

export default class MenuView extends View {
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

Delegation uses native `addEventListener()` and `closest()`. `on(type, selector, callback, options)` accepts a capture boolean or normal listener options including `capture`, `passive`, `signal`, and `once`. A `once` registration is consumed only after a matching delegated event. Aborting a supplied signal removes both the native registration and the registry reference. `off()` can filter by type, selector, callback, and capture phase. `clear()` removes all registrations.

The matching element is the callback's `this` value. Independent registries created with `delegate(scope)` are caller-owned and should be cleared when no longer needed. The view-owned `delegated` registry is cleared automatically when the root is replaced or destroyed.

## In-place updates and focus preservation

Use browser View's `update()` when replacing a root would unnecessarily destroy focus, selection, or other browser state:

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

Returning `false` from `update()` runs the normal render callback instead.

## Model replacement and batching

Assigning `view.model = nextModel` moves an active subscription from the old emitter to the new one but does not render immediately. Use `view.setModel(nextModel)` when the new state should render immediately.

Observable models must provide both `on()` and `removeListener()` so the view can release its subscription. Objects that do not provide both methods are treated as non-observable data.

Browser View can set `batchUpdates: true` to coalesce model-driven renders into one `requestAnimationFrame` callback. The callback reads the latest model state. `render()`, `setModel()`, model replacement, binding teardown, and destruction cancel pending work. If the owning window does not provide `requestAnimationFrame`, rendering falls back to synchronous behavior.

Server View renders model changes synchronously and does not emulate animation-frame batching.

## Owned child views

`addChild()` opts a child into parent ownership. Browser View does not mount the child automatically; initialize the child explicitly with an appropriate parent element, commonly from `afterMount()`.

Parent root replacement and destruction destroy all owned browser children. In-place updates and equal-root renders preserve them. Server View destroys owned children during its own teardown. Duplicate registration is harmless. Ownership cycles and simultaneous ownership by two parents throw `TypeError`.

`releaseChild()` transfers cleanup responsibility without destroying the child. Destroying a child directly also removes it from its owner.

## Accessibility and indexing

The library manages lifecycle and rendering mechanics, not markup quality. Applications remain responsible for semantic HTML, accessible names, keyboard operation, focus visibility, reflow, contrast, live-region behavior, and other applicable accessibility requirements.

For public content, prefer meaningful server-rendered or static initial HTML and use browser View for progressive enhancement. `white-label-view/server` can participate in that initial HTML path while the default View owns browser-only lifecycle after hydration/progressive startup. The package does not provide automatic hydration or claim to reconcile server DOM with browser state.

## TypeScript

Both entrypoints use strict TypeScript and emit CommonJS JavaScript, source maps, and declarations into `dist`.

Browser example:

```ts
import View from 'white-label-view';

const settings: View.Settings = {
    parentElement: document.body,
    template: () => '<p>Hello</p>',
    batchUpdates: true
};

const view = new View(settings).initialize();
view.destroy();
```

Server example:

```ts
import View from 'white-label-view/server';

const view = new View({template: () => '<p>Hello</p>'}).initialize();
const html: string = view.toString();
view.destroy();
```

`View.Settings`, `View.Model`, and the browser-specific listener/settings types expose the supported public contracts. Template data is `unknown`; application code should narrow it before reading domain-specific fields. The JSX runtime also exports `JSXMarkup`, `JSXChild`, `raw()`, and the automatic runtime entry points used by TypeScript and compatible bundlers.

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

Coverage is enforced at 100% for statements, branches, functions, and lines in every implementation file. CI refreshes dependency metadata, builds tracked `dist`, runs the complete test/type/coverage/audit suite, verifies every public package subpath from the packed npm artifact in a clean temporary project, and verifies that committed generated output matches the build.

Edit `src/*.ts`, not generated `dist` files. The npm package publishes `dist` and this README.

## Scope

`white-label-view` is deliberately limited to view responsibilities:

- browser DOM root creation, adoption, replacement, and cleanup;
- server string rendering through the explicit `/server` entrypoint;
- model-to-view change subscriptions;
- optional browser frame batching;
- delegated browser DOM events;
- child-view ownership;
- lifecycle hooks;
- optional first-party JSX-to-markup rendering.

External templating engines, CSS systems, application state choices, routing, networking, and sanitization remain outside the package.
