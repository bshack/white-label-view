# white-label-view

`white-label-view` is a small browser view class focused on DOM rendering, model-driven updates, delegated events, batching, child-view ownership, and lifecycle cleanup.

The package intentionally does **not** bundle a templating engine, CSS framework, component framework, sanitizer, or state library. A view receives a plain render function that returns either one DOM element or one trusted HTML root string. Styling and any higher-level rendering tools belong to the consuming application.

## Requirements

- Node.js `^22.18.0` or `>=24.11.0` for installation and development
- A browser DOM at runtime

## Install

```sh
npm install white-label-view
```

```js
import View from 'white-label-view';
```

## Basic use

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

The `template` setting is only a JavaScript callback. `white-label-view` does not ship or require a template language. DOM construction is the safest default for untrusted data. If an application returns HTML strings, that markup is trusted caller input and must already be safely escaped or sanitized for its context.

## Rendering lifecycle

`initialize()` calls synchronous `render()`.

When a model exposes `get()`, the view passes `model.get()` to the render callback. Otherwise it passes the model object. When the root is already attached, `update(element, data)` can return `true` to handle the update in place. Returning `false` falls back to normal rendering.

A successful mount or replacement:

1. inserts or replaces the root in its actual DOM parent;
2. initializes the model subscription when possible;
3. calls `addListeners()` once for that root;
4. calls `afterMount()` once for that root.

Equal HTML strings skip reparsing while attached. Equal DOM trees preserve the existing root. Existing markup can also be adopted when the supplied `element` is already within `parentElement`.

Render callbacks must return exactly one element. Empty strings, text nodes, comments, multiple roots, fragments, `null`, and other non-element results throw `TypeError`. Invalid output does not replace the last successful root.

String roots are parsed with a temporary `<template>` in the view's owning document. This avoids a global parser dependency, reduces parser setup, and keeps iframe or multi-document views in the correct document.

## Constructor settings

| Setting | Meaning |
| --- | --- |
| `parentElement` | DOM element that receives or contains the root. |
| `element` | Existing root element. Defaults to a new `div` in the owning document. |
| `model` | Plain data object or an object with optional `get()`, `on()`, and `removeListener()` methods. |
| `template` | Function receiving model data and returning one DOM node or one trusted single-root HTML string. |
| `update` | Optional in-place update hook. Return `true` when handled or `false` to use normal rendering. |
| `batchUpdates` | When `true`, coalesce automatic model updates into one animation frame. Manual `render()` stays synchronous. |

## Public methods

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
| `initializeTwoWayBinding()` | Add one model `change` listener when the model supports removable listeners. |
| `destroyTwoWayBinding()` | Remove this view's model listener and cancel queued rendering. |

Despite the historical method name, model binding is one-way: model changes trigger view rendering. Form input is not automatically written back to the model.

## Reusable views and delegated events

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

The matching element is the callback's `this` value.

Independent registries created with `delegate(scope)` are caller-owned; call their `clear()` method when they are no longer needed. The view-owned `delegated` registry is cleared automatically when the root is replaced or destroyed.

## In-place updates and focus preservation

Use `update()` when replacing a root would unnecessarily destroy focus, selection, or other browser state:

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

Set `batchUpdates: true` to coalesce model-driven renders into one `requestAnimationFrame` callback. The callback reads the latest model state. `render()`, `setModel()`, model replacement, binding teardown, and destruction cancel pending work. If the owning window does not provide `requestAnimationFrame`, rendering falls back to synchronous behavior.

## Owned child views

`addChild()` opts a child into parent ownership. It does not mount the child. Initialize the child explicitly with an appropriate parent element, commonly from `afterMount()`.

Parent root replacement and destruction destroy all owned children. In-place updates and equal-root renders preserve them. Duplicate registration is harmless. Ownership cycles and simultaneous ownership by two parents throw `TypeError`.

`releaseChild()` transfers cleanup responsibility without destroying the child. Destroying a child directly also removes it from its owner.

## Accessibility and indexing

The library manages lifecycle, not markup quality. Applications remain responsible for semantic HTML, accessible names, keyboard operation, focus visibility, reflow, contrast, live-region behavior, and other applicable accessibility requirements.

For public content, prefer meaningful server-rendered or static initial HTML and use View for progressive enhancement. This keeps primary content and crawlable links available before JavaScript executes.

## TypeScript

The implementation uses strict TypeScript and emits CommonJS JavaScript, source maps, and declarations into `dist`.

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

`View.Settings`, `View.Model`, and `View.ListenerOptions` expose the supported public types. Template data is `unknown`; application code should narrow it before reading domain-specific fields.

## Development

```sh
npm ci --ignore-scripts
npm run build
npm run typecheck
npm test
npm run coverage
npm run audit
```

Coverage is enforced at 100% for statements, branches, functions, and lines in every implementation file. CI also refreshes dependency metadata, builds tracked `dist`, runs the complete test/type/coverage/audit suite, uploads generated files, and verifies that committed `package-lock.json` and `dist` match generated output.

Edit `src/*.ts`, not generated `dist` files. The npm package publishes `dist` and this README.

## Scope

`white-label-view` is deliberately limited to view responsibilities:

- DOM root creation, adoption, replacement, and cleanup
- model-to-view change subscriptions
- optional frame batching
- delegated DOM events
- child-view ownership
- lifecycle hooks

Templating engines, CSS systems, application state choices, routing, networking, and sanitization are intentionally outside this package.
