import View from '../dist/index.js';
import ServerView from '../dist/server.js';
const settings: View.Settings = {parentElement: document.body, template: () => '<p>Hello</p>'};
const view = new View(settings);
view.initialize().destroy();

class ProfileView extends View {
    override update(element: Node, data: unknown): boolean {
        element.textContent = String(data);
        return true;
    }
    override afterMount() {
        (this.element as HTMLElement).focus();
        return this;
    }
}
const profile = new ProfileView({...settings, batchUpdates: true});
const controller = new AbortController();
profile.delegated.on('focus', 'input', function(event) {
    const matched: Element = this;
    void matched; void event;
}, {capture: true, passive: true, signal: controller.signal, once: true});
profile.delegated.off('focus', 'input', undefined, {capture: true});
profile.setModel({get: () => ({name: 'Ada'})}).requestRender();

// Model 7-style observable models may narrow the EventTarget API to the change event View actually uses.
declare const eventTargetObservable: {
    get(): {count: number};
    addEventListener(event: 'change', listener: (event: CustomEvent<{count: number}>) => void): unknown;
    removeEventListener(event: 'change', listener: (event: CustomEvent<{count: number}>) => void): unknown;
};
new View({model: eventTargetObservable});
new ServerView({model: eventTargetObservable, template: data => `<p>${String(data)}</p>`});

// Legacy EventEmitter-style observables remain accepted for compatibility.
declare const legacyObservable: {
    get(): {count: number};
    on(event: 'change', listener: (state: {count: number}) => void): unknown;
    removeListener(event: 'change', listener: (state: {count: number}) => void): unknown;
};
new View({model: legacyObservable});
new ServerView({model: legacyObservable, template: data => `<p>${String(data)}</p>`});

const child = new View();
profile.addChild(child).releaseChild(child);
const listenerOptions: View.ListenerOptions = {signal: controller.signal};
void listenerOptions;
// @ts-expect-error batching is explicitly boolean.
const invalid: View.Settings = {batchUpdates: 'always'};
// @ts-expect-error templates must return renderable markup, not arbitrary objects.
const invalidTemplate: View.Settings = {template: () => ({message: 'hello'})};
// @ts-expect-error models must be object-like data sources.
profile.setModel('Ada');
// @ts-expect-error child ownership only accepts View instances.
profile.addChild(document.body);
void [invalid, invalidTemplate];
