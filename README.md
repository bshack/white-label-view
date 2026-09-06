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

The constructor accepts `parentElement`, `element`, `model`, and `template`. Calling `initialize()` renders the view.

```js
import View from 'white-label-view';
import {Model} from 'white-label-model';

const model = new Model({name: 'Ada'});

const profileView = new View({
    parentElement: document.querySelector('main'),
    model,
    template(data) {
        return `<section class="profile"><h1>Hello, ${data.name}</h1></section>`;
    }
});

profileView.initialize();

// The model emits "change", so the view renders the new value automatically.
model.update({name: 'Grace'});

// Remove the DOM element and listeners when the view is no longer needed.
profileView.destroy();
```

## Rendering lifecycle

`initialize()` calls `render()`. During a successful render, the view:

1. Reads model data with `model.get()` when that method exists; otherwise it passes the model object directly to the template.
2. Converts a returned HTML string into a DOM element.
3. Appends the element on the first render or replaces the previous element later.
4. Recreates delegated event handling for the new element.
5. Subscribes to the model's `change` event when the model provides `on()`.

If a template produces the same HTML string as the previous render, the view skips DOM parsing and replacement. Repeated binding initialization is also safe: it does not add duplicate model listeners.

The template should return one root element. If it returns an HTML string, leading and trailing whitespace is trimmed before the first root node is selected.

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

Use matching `addListeners()` and `removeListeners()` implementations because rendering can replace the root element. Stable callback references make it possible to remove exactly the listener that was added.

## Manual model binding

Automatic binding occurs after the view successfully renders into `parentElement`. You can also control it directly:

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
| `template` | Function receiving model data and returning a DOM element or HTML string. |

## Public methods

| Method | Behavior |
| --- | --- |
| `initialize()` | Renders the current template and returns the view. |
| `render()` | Updates the DOM when a valid template and parent are available. |
| `destroy()` | Removes the element, delegated events, and model listener. |
| `addListeners()` | Extension hook called after a rendered element is installed. |
| `removeListeners()` | Extension hook called before replacement or destruction. |
| `delegate(scope)` | Creates a Gator delegated-event instance for `scope` or the view element. |
| `initializeTwoWayBinding()` | Adds one model `change` listener. |
| `destroyTwoWayBinding()` | Removes this view's model listener without removing other subscribers. |

## Development

```sh
npm ci
npm run build
npm test
npm run audit
```

The npm package publishes the compiled `dist` file and this README.
