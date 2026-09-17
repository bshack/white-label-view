import View from '../dist/index.js';
import ServerView from '../dist/server.js';
import {attributes, html, unsafeHTML, type HTMLMarkup} from '../dist/html.js';

const tagged: HTMLMarkup = html`<p ${attributes({hidden: false, 'data-id': 1})}>${'<Ada>'}${unsafeHTML('<strong>trusted</strong>')}</p>`;
const settings: View.Settings = {parentElement: document.body, template: () => tagged};
const view = new View(settings);
view.initialize().destroy();
new ServerView({template: () => tagged}).initialize();

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

// Observable models may narrow the EventTarget API to the change event View actually uses.
declare const eventTargetObservable: {
    get(): {count: number};
    addEventListener(event: 'change', listener: (event: CustomEvent<{count: number}>) => void): unknown;
    removeEventListener(event: 'change', listener: (event: CustomEvent<{count: number}>) => void): unknown;
};
new View({model: eventTargetObservable});
new ServerView({model: eventTargetObservable, template: data => html`<p>${String(data)}</p>`});

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
