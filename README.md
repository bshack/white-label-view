# white-label-view

`white-label-view` is a small browser view class for rendering a template into the DOM, responding to model changes, and managing delegated DOM events.

It is intentionally unopinionated: your template can be any function that returns a DOM element or an HTML string, and your model can be a plain object or an event-emitting object such as [`white-label-model`](https://github.com/bshack/white-label-model).

## Requirements

- Node.js `^22.18.0` or `>=24.11.0` for installation and development
- A browser environment with `document`, `DOMParser`, and standard DOM APIs at runtime

## Install and import

```sh
npm install white-label-view
```

```js
import View from 'white-label-view';
```

## Complete example

The constructor accepts `parentElement`, `element`, `model`, `template`, `update`, and `batchUpdates`. Calling `initialize()` renders the view.

```js
import View from 'white-label-view';
import {Eta} from 'eta/core';
import {Model} from 'white-label-model';

const model = new Model({name: 'Ada'});
const eta = new Eta({autoEscape: true});
const profileTemplate = eta.compile(
    '<section class="profile"><h1>Hello, <%= it.name %></h1></section>'
);

const profileView = new View({
    parentElement: document.querySelector('main'),
    model,
    template: (data) => eta.render(profileTemplate, data)
});

profileView.initialize();

// The model emits "change", so the view renders the new value automatically.
model.update({name: 'Grace'});

// Remove the DOM element and listeners when the view is no longer needed.
profileView.destroy();
```

Eta is intentionally not a runtime dependency of `white-label-view`; the view accepts any function returning a DOM node or single-root HTML string. Applications that choose Eta should install it directly and use `eta/core` for browser bundles. Eta escapes `<%=` values by default; never compile user-controlled template source.

## Accessibility and indexability

The view lifecycle does not make rendered markup conformant by itself. Templates must use semantic HTML, accessible names and status behavior, keyboard-operable controls, visible/unobscured focus, sufficient contrast, reflow, and applicable WCAG 2.2 Level AA requirements. Prefer updating a stable live region over replacing focused interactive elements. Public primary content should be rendered into the initial server or static HTML; use this class for progressive enhancement so search crawlers and no-JavaScript users retain the content and crawlable links.

## Rendering lifecycle

`initialize()` calls synchronous `render()`. The view reads `model.get()` when available, otherwise passes the model object to its template. On an attached root, `update(element, data)` can return `true` to handle the update in place. Its default returns `false` to use the template.

A new root is appended or replaces the previous root in its actual parent, including when nested under `parentElement`. After insertion or adoption, the view initializes its model subscription, calls `addListeners()`, then calls `afterMount()`. Both hooks run once per root, including existing markup that already matches the template. `afterMount()` is suitable for focus and measurement relative to the parent; an externally detached parent is still detached from the document.

Equal template strings skip parsing and replacement. Equal DOM trees also preserve the existing root. These fast paths still initialize listeners and binding when needed. A supplied existing element can be initialized without a template when already inside `parentElement`. Adoption is not a general hydration/diff engine.

Templates must return exactly one element, either directly or as a single-root HTML string. Empty strings, text/comment roots, additional root nodes, null, and fragments throw a `TypeError`. Leading/trailing whitespace is trimmed. Invalid output leaves the last successful render cache intact, so repeated invalid renders still throw. HTML remains trusted caller input; View does not sanitize it.

## Create a reusable view

Extend `View` when the component needs custom DOM events:

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
        console.log(event.target.href);
    }
}
```

Use matching `addListeners()` and `removeListeners()` implementations because rendering can replace the root element. Stable callback references make it possible to remove exactly the listener that was added. Delegation uses native `addEventListener()` and `closest()` APIs and does not require a runtime dependency.

## Manual model binding

Automatic binding occurs after insertion or adoption in `parentElement`. Observable models must provide both `on()` and `removeListener()` so subscriptions can be released; objects without that pair are treated as non-observable data. You can also control it directly:

```js
profileView.initializeTwoWayBinding();
profileView.destroyTwoWayBinding();
```

The binding listens in one direction: model changes trigger view rendering. Form input is not written back to the model automatically; application code must handle that in a DOM event listener.

## Constructor settings

| Setting | Meaning |
| --- | --- |
| `parentElement` | DOM node that receives or contains the view's root element. |
| `element` | Existing root DOM node. Defaults to a new `div`. |
| `model` | Plain data object or an object with `get()`, `on()`, and `removeListener()` methods. |
| `template` | Function receiving model data and returning exactly one element or a single-root HTML string. |
| `update` | Optional in-place update hook; return true when handled or false for template rendering. |
| `batchUpdates` | Opt-in animation-frame batching for model changes/requestRender(); defaults to false. |

## Public methods

| Method | Behavior |
| --- | --- |
| `initialize()` | Renders the current template and returns the view. |
| `render()` | Updates the DOM when a valid template and parent are available. |
| `destroy()` | Cancels queued work and removes the root, owned children, delegated events, and model subscription. |
| `addListeners()` | Extension hook called after a rendered element is installed. |
| `removeListeners()` | Extension hook called before replacement or destruction. |
| `afterMount()` | Hook after insertion/adoption and listener setup; runs once per root. |
| `setModel(model)` | Moves the model subscription and immediately renders the new data; omit to clear the model. |
| `requestRender()` | Requests an optionally batched render. |
| `addChild(child)` | Registers child ownership without mounting it. |
| `releaseChild(child)` | Relinquishes ownership without destroying the child. |
| `delegate(scope)` | Creates a native delegated-event instance for `scope` or the view element. |
| `initializeTwoWayBinding()` | Adds one model `change` listener. |
| `destroyTwoWayBinding()` | Removes this view's model listener without removing other subscribers. |

## Development

```sh
npm ci
npm run build
npm run typecheck
npm test
npm run coverage
npm run audit
```

The npm package publishes the compiled `dist` file and this README.

## TypeScript development and version 4.0.0 migration

Implementation code now uses strict TypeScript. Builds emit JavaScript, source maps with embedded source, and `.d.ts` declarations into `dist`. JavaScript callers can still use the package without compiling TypeScript themselves. JSDoc comments describe parameters, return values, lifecycle behavior, and validation at the implementation, and are retained in declarations.

```ts
import View from 'white-label-view';

const settings: View.Settings = {
    parentElement: document.body,
    template: () => '<p>Hello, Ada</p>'
};
const greeting = new View(settings).initialize();
greeting.destroy();
```

`View.Settings` describes the optional parent, existing element, model, template, update hook, and batching flag. `View.Model` describes the observable methods used for binding. Template input is `unknown`; narrow it before reading application-specific properties. Templates return a DOM node or trusted HTML with a root node. Empty HTML now throws an explicit error. HTML is not sanitized by the view.

This is a major release because the distribution is now CommonJS emitted by TypeScript, replacing the previous UMD wrapper. CommonJS `require` and the documented ESM imports remain supported. Direct AMD loading or browser script tags that depended on UMD globals must migrate to a browser bundler. Edit `src/*.ts`, then run `npm run build`; do not edit generated `dist` files. The obsolete Babel build dependencies have been removed.

### Verification and coverage

```sh
npm ci --ignore-scripts
npm run typecheck
npm test
npm run coverage
npm pack --dry-run
```

`npm test` builds the code, checks TypeScript consumer examples against the emitted declarations, and runs the tests. `npm run coverage` additionally enforces **100% statements, branches, functions, and lines for each implementation file**. Unexecuted implementation files count toward the result; declaration-only files contain no executable code and are excluded. Reports are written to `coverage`, including `lcov.info` for coverage viewers. CI runs the same gate and checks committed build output for drift.

Tests exercise the compiled JavaScript interface used by downstream callers. Coverage is an execution metric, not proof that all possible inputs or external integrations are correct.

To undo this migration, revert its commit and run `npm ci` from the restored lockfile. No npm release, database migration, or production deployment is performed by these development changes.

## Unreleased rendering and cleanup changes

An optional `update(element, data): boolean` constructor setting can update an attached root in place. Return `true` when handled; return `false` to run normal template rendering. This lets applications retain focused inputs and selection without replacing their DOM. Use `textContent` or equivalent safe property updates for untrusted data. Default template rendering still replaces the root.

Replacement and destruction clear all listeners in the view-owned delegated registry, even when a subclass removal hook omits one. Independent registries created with `delegate(scope)` remain caller-owned; call their `clear()` method on teardown.

## Model replacement and batching

Assigning `view.model = nextModel` moves an active subscription off the old emitter and onto the new one. Assignment itself does not render; use `view.setModel(nextModel)` for an immediate render. Destroying the view removes its callback from the emitter it actually subscribed to. Manually paused binding stays paused across assignment; rendering initializes binding as usual.

Synchronous rendering remains the default. Set `batchUpdates: true` to coalesce model changes into one `requestAnimationFrame` callback that reads the latest model state. `render()` and `setModel()` remain synchronous and cancel pending frames. Model replacement, binding teardown, and destruction cancel queued work. Without an animation-frame API the view renders synchronously. Do not rely on batched rendering having occurred immediately after a model event.

## Delegated listener options

```js
const controller = new AbortController();
view.delegated.on('focus', 'input', handleFocus, {
    capture: true,
    signal: controller.signal
});
view.delegated.on('wheel', '.scroll-panel', observeWheel, {passive: true});
controller.abort(); // Removes the focus registration and its registry references.
```

`on(type, selector, callback, options)` accepts a capture boolean or browser-style listener options:

- `capture`: observe the capture phase, including descendant focus/blur events that do not bubble.
- `passive`: the listener cannot cancel default browser behavior with `preventDefault()`; useful for observing touch/wheel input.
- `signal`: abort removes the registration. An already-aborted signal registers nothing. `clear()`, `off()`, and consumed once listeners also detach the signal callback so external controllers do not retain the registry.
- `once`: invoke once for a **matching** event. Unmatched events do not consume it, and removal occurs before callback invocation to handle recursive dispatch.

`off(type, selector?, callback?, options?)` optionally accepts a capture boolean or `{capture}` to restrict removal. Omit it to remove matching registrations in either phase. `clear()` removes all registrations. The matching element remains the callback's `this` value. Independent registries from `delegate(scope)` are caller-owned; destroy them with `clear()`.

## Owned child views

Call `parentView.addChild(childView)` to opt into ownership. The child is not automatically mounted; initialize it explicitly using a parent element within the parent view, typically from `afterMount()`. Parent root replacement and destruction destroy owned children, which releases their model subscriptions, events, queued frames, and their own children. In-place updates and equal-root renders preserve children. Registering the same child twice is harmless; cycles and simultaneous ownership by two parents are rejected.

Call `releaseChild(childView)` to transfer cleanup responsibility without destroying it. Destroying a child directly also removes it from its owner's registry. Cleanup attempts every owned child before reporting failures; root and model cleanup still run if a child or removal hook throws.

## Follow-up compatibility notes

The new lifecycle methods and options are additive. Two corrections affect existing code: `addListeners()` now runs after insertion (matching its documented contract), and malformed multi-root/non-element templates now throw instead of being silently truncated or accepted. Models exposing only `on()` are no longer automatically subscribed because they cannot be cleaned up. Review these cases before release. No package version, dependencies, or consumer pins have been changed. There is still no automatic form-to-model binding or HTML sanitization.
