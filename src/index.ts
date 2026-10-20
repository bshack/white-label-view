import {isHTMLMarkup} from './html.js';
import type {HTMLMarkup} from './html.js';

/**
 * The data a View renders. If `get()` exists, its result is passed to the template and update hook;
 * otherwise the model object itself is. A model that also has `addEventListener()` and
 * `removeEventListener()` (the native EventTarget methods) is observed: each `change` event re-renders.
 */
interface ViewModel {
    get?: () => unknown;
    addEventListener?: (event: 'change', callback: EventListener) => unknown;
    removeEventListener?: (event: 'change', callback: EventListener) => unknown;
}
/** Browser View constructor settings. */
interface ViewSettings {
    /** Element the View inserts its root into. Without it, render() builds output but mounts nothing. */
    parentElement?: Element;
    /** Existing element to adopt as the root, such as server-rendered markup. Defaults to a detached <div>. */
    element?: Element;
    model?: object & ViewModel;
    /** Returns one element, or a trusted HTML string / HTMLMarkup that parses to exactly one element. */
    template?: (data: unknown) => string | Node | HTMLMarkup;
    /** Updates an attached root in place. Return true if handled; false falls back to the template. */
    update?: (element: Node, data: unknown) => boolean;
    /** Coalesce model changes into one animation frame; manual render() stays synchronous. */
    batchUpdates?: boolean;
}
/** Delegated handler; `this` is the element that matched the selector. */
type DelegatedCallback = (this: Element, event: Event) => unknown;
/** One delegated listener: the native listener on the scope plus what is needed to remove it. */
interface Registration {
    type: string;
    selector: string;
    callback: DelegatedCallback;
    listener: EventListener;
    capture: boolean;
    signal?: AbortSignal;
    abort: () => void;
}

// The arguments needed to call on() again for a registration: type, selector, callback, options.
type RetainedRegistration = [string, string, DelegatedCallback, AddEventListenerOptions | undefined];

// Registration options needed to re-register a View-lifetime listener on a replacement root.
const registrationOptions = new WeakMap<Registration, AddEventListenerOptions>();
// Registrations made while a View had no mounted root. They belong to the View rather than to one root, so
// they are re-registered on every replacement root and only released by destroy().
const lifetimeRegistrations = new WeakSet<Registration>();

function appendError(errors: unknown[], error: unknown) {
    errors.push(error);
}

/**
 * Event delegation on one scope element. Each registration adds one native listener to the scope; it calls
 * the callback when the nearest element matching the selector (starting at the event target) is the scope
 * itself or inside it.
 */
class DelegatedEvents {
    /** Active registrations, in registration order. */
    listeners: Registration[] = [];

    constructor(public scope: Element) {}

    /**
     * Listen for `type` events whose target is inside an element matching `selector`.
     *
     * @param options - `true`/`false` for capture, or listener options. `once` removes the listener after the
     *   first event that matches the selector (non-matching events do not count). An already aborted `signal`
     *   registers nothing; aborting it later removes the listener.
     * @returns This registry, for chaining.
     */
    on(type: string, selector: string, callback: DelegatedCallback, options: boolean | AddEventListenerOptions = {}) {
        const settings = typeof options === 'boolean' ? {capture: options} : options;
        if (settings.signal?.aborted) {return this;}
        const once = Boolean(settings.once);
        const registered: Registration = {
            type, selector, callback, capture: Boolean(settings.capture), signal: settings.signal,
            abort: () => this.remove(registered),
            listener: (event: Event) => {
                const target = event.target && typeof (event.target as Element).closest === 'function'
                    ? (event.target as Element).closest(selector) : null;
                if (target && (target === this.scope || this.scope.contains(target))) {
                    // Remove before invocation so recursive dispatch cannot invoke a once listener twice.
                    if (once) {this.remove(registered);}
                    callback.call(target, event);
                }
            }
        };
        this.scope.addEventListener(type, registered.listener, {capture: registered.capture, passive: settings.passive});
        this.listeners.push(registered);
        registrationOptions.set(registered, {capture: registered.capture, once, passive: settings.passive, signal: settings.signal});
        registered.signal?.addEventListener('abort', registered.abort, {once: true});
        return this;
    }

    /**
     * Remove registrations for `type`. Omitted `selector` or `callback` matches any; `options` (or a boolean)
     * restricts removal to the capture or bubble phase.
     *
     * @returns This registry, for chaining.
     */
    off(type: string, selector?: string, callback?: DelegatedCallback, options?: boolean | EventListenerOptions) {
        const capture = typeof options === 'boolean' ? options : options?.capture;
        this.listeners = this.listeners.filter(registered => {
            const matches = registered.type === type && (!selector || registered.selector === selector) &&
                (!callback || registered.callback === callback) &&
                (capture === undefined || registered.capture === capture);
            if (matches) {this.detach(registered);}
            return !matches;
        });
        return this;
    }

    /** Remove both native and abort listeners so external controllers do not retain this registry. */
    private remove(registered: Registration) {
        this.detach(registered);
        this.listeners = this.listeners.filter(item => item !== registered);
    }

    private detach(registered: Registration) {
        this.scope.removeEventListener(registered.type, registered.listener, registered.capture);
        registered.signal?.removeEventListener('abort', registered.abort);
    }

    /** Remove every registration, including abort-signal listeners. Returns this registry. */
    clear() {
        const registrations = this.listeners;
        this.listeners = [];
        for (const registered of registrations) {this.detach(registered);}
        return this;
    }
}

/**
 * Browser View: renders model data into one root element inside `parentElement`, or adopts an existing
 * element, and owns that root's lifecycle (listeners, model subscription, child views, teardown).
 */
class View {
    parentElement?: Element;
    element: Node;
    declare template?: (data: unknown) => string | Node | HTMLMarkup;
    /**
     * Update the attached root in place. Return true when the DOM is up to date, or false to render the
     * template instead. Overridden by subclasses or the `update` setting.
     */
    update(_element: Node, _data: unknown): boolean { return false; }
    batchUpdates: boolean;
    modelChangeHandler: () => void;
    modelBindingInitialized = false;
    /** HTML of the last template render, used to skip re-parsing identical output. */
    renderedTemplate?: string;
    /** Delegated events scoped to the current root. See claimRegistrations() for ownership rules. */
    delegated: DelegatedEvents;
    private currentModel?: object & ViewModel;
    private boundModel?: object & ViewModel;
    // The root whose addListeners()/afterMount() completed; undefined until a root mounts successfully.
    private mountedElement?: Node;
    private pendingFrame?: number;
    private frameWindow?: Window;
    private children = new Set<View>();
    private owner?: View;

    constructor(settings?: ViewSettings) {
        this.parentElement = settings?.parentElement;
        const ownerDocument = settings?.element?.ownerDocument || settings?.parentElement?.ownerDocument || document;
        this.element = settings?.element || ownerDocument.createElement('div');
        // Only explicit settings override subclass prototype hooks.
        if (settings?.template) {this.template = settings.template;}
        if (settings?.update) {this.update = settings.update;}
        this.currentModel = settings?.model;
        this.batchUpdates = settings?.batchUpdates === true;
        this.modelChangeHandler = () => this.requestRender();
        this.delegated = this.delegate();
    }

    get model(): (object & ViewModel) | undefined { return this.currentModel; }

    /** Assignment moves an active subscription; use setModel() to render the new data immediately. */
    set model(value: (object & ViewModel) | undefined) {
        if (value === this.currentModel) {return;}
        const rebind = this.modelBindingInitialized;
        this.destroyModelBinding();
        this.currentModel = value;
        if (rebind) {this.initializeModelBinding();}
    }

    /** Replace the model and synchronously render its current data. */
    setModel(model?: object & ViewModel) {
        this.model = model;
        return this.render();
    }

    /** Render (or adopt) the current state and start the lifecycle. Same as render(). */
    initialize() { return this.render(); }

    /**
     * Render now, or with `batchUpdates` schedule one render for the next animation frame. Falls back to a
     * synchronous render when the document has no requestAnimationFrame.
     */
    requestRender() {
        const window = this.element.ownerDocument?.defaultView;
        if (!this.batchUpdates || !window?.requestAnimationFrame) {return this.render();}
        if (this.pendingFrame === undefined) {
            this.frameWindow = window;
            this.pendingFrame = window.requestAnimationFrame(() => {
                this.pendingFrame = undefined;
                this.frameWindow = undefined;
                this.render();
            });
        }
        return this;
    }

    private cancelRender() {
        if (this.pendingFrame !== undefined) {
            const pendingFrame = this.pendingFrame;
            const frameWindow = this.frameWindow!;
            this.pendingFrame = undefined;
            this.frameWindow = undefined;
            frameWindow.cancelAnimationFrame(pendingFrame);
        }
    }

    /**
     * Take cleanup ownership of `child` without mounting it. Owned children are destroyed when this View's
     * root is replaced or the View is destroyed.
     *
     * @throws TypeError if ownership would form a cycle or `child` already has another owner.
     */
    addChild(child: View) {
        for (let ancestor: View | undefined = this; ancestor; ancestor = ancestor.owner) {
            if (ancestor === child) {throw new TypeError('Child view ownership must not contain cycles');}
        }
        if (child.owner && child.owner !== this) {throw new TypeError('Child view already has an owner');}
        this.children.add(child);
        child.owner = this;
        return this;
    }

    /** Relinquish ownership without destroying the child. */
    releaseChild(child: View) {
        if (this.children.delete(child)) {child.owner = undefined;}
        return this;
    }

    /** Clean up all owned children, reporting failures after attempting each child. */
    private destroyChildren() {
        const errors: unknown[] = [];
        for (const child of this.children) {
            this.releaseChild(child);
            try { child.destroy(); } catch (error) { errors.push(error); }
        }
        if (errors.length) {throw new AggregateError(errors, 'Unable to destroy child views');}
    }

    /** Release everything tied to the current root (children, listeners), attempting every step before throwing. */
    private releaseRoot() {
        const errors: unknown[] = [];
        // removeListeners() pairs with a completed addListeners(); failed mounts already rolled it back.
        const mounted = this.mountedElement !== undefined;
        this.mountedElement = undefined;
        try { this.destroyChildren(); } catch (error) { appendError(errors, error); }
        if (mounted) {
            try { this.removeListeners(); } catch (error) { appendError(errors, error); }
        }
        try { this.delegated.clear(); } catch (error) { appendError(errors, error); }
        if (errors.length === 1) {throw errors[0];}
        if (errors.length > 1) {throw new AggregateError(errors, 'Unable to release view root');}
    }

    /**
     * Cancel queued renders, leave the owner, destroy children, call removeListeners() (only if a root was
     * mounted), release the model subscription, and remove the root from wherever it is in the document.
     * Every step is attempted even if an earlier one throws. The View then holds a fresh detached root and
     * can be initialized again.
     *
     * @throws The single cleanup error, or an AggregateError when several steps failed.
     */
    destroy() {
        const errors: unknown[] = [];
        const ownerDocument = this.element.ownerDocument!;
        try { this.cancelRender(); } catch (error) {appendError(errors, error);}
        try { this.owner?.releaseChild(this); } catch (error) {appendError(errors, error);}
        try { this.releaseRoot(); } catch (error) {appendError(errors, error);}
        try { this.destroyModelBinding(); } catch (error) {appendError(errors, error);}
        try { this.element.parentNode?.removeChild(this.element); } catch (error) {appendError(errors, error);}
        this.element = ownerDocument.createElement('div');
        try { this.delegated = this.delegate(); } catch (error) {
            appendError(errors, error);
            this.delegated = new DelegatedEvents(this.element as Element);
        }
        this.renderedTemplate = undefined;
        if (errors.length === 1) {throw errors[0];}
        if (errors.length > 1) {throw new AggregateError(errors, 'Unable to destroy view');}
        return this;
    }

    /** Subscribe to the model's `change` event once, if the model has both EventTarget listener methods. */
    initializeModelBinding() {
        if (this.boundModel !== this.model) {this.destroyModelBinding();}
        const model = this.model;
        if (!this.modelBindingInitialized && model &&
            typeof model.addEventListener === 'function' && typeof model.removeEventListener === 'function') {
            model.addEventListener('change', this.modelChangeHandler);
            this.boundModel = model;
            this.modelBindingInitialized = true;
        }
    }

    /** Remove the model subscription and cancel any queued render. State is reset even if removal throws. */
    destroyModelBinding() {
        this.cancelRender();
        const boundModel = this.boundModel;
        const initialized = this.modelBindingInitialized;
        this.boundModel = undefined;
        this.modelBindingInitialized = false;
        if (initialized) {
            boundModel!.removeEventListener!('change', this.modelChangeHandler);
        }
    }

    /** Hook: called once for each newly mounted root, including adopted markup. Add listeners here. */
    addListeners() { return this; }
    /**
     * Hook: called before a mounted root is replaced or destroyed, and when a mount fails part way. Never
     * called for a View that has not mounted a root. Must tolerate setup that did not finish.
     */
    removeListeners() { return this; }
    /** Hook: called after the root is in the document and addListeners() ran; safe for focus and measurement. */
    afterMount() { return this; }

    /** Create a separate delegated-event registry on `scope` (default: the current root). The caller owns it. */
    delegate(scope?: Element) { return new DelegatedEvents(scope || this.element as Element); }

    /**
     * Before any root has mounted, mark existing delegated registrations (for example from a constructor) as
     * View-lifetime so they move to each replacement root. Registrations made after mounting, including in
     * addListeners(), belong to that root and are cleared when it is replaced.
     */
    private claimRegistrations() {
        if (this.mountedElement === undefined) {
            // Tolerate prototype-constructed views that never created a delegated registry.
            for (const registered of this.delegated?.listeners ?? []) {lifetimeRegistrations.add(registered);}
        }
    }

    /** Snapshot the View-lifetime registrations so they can be re-registered on a new root. */
    private retainedRegistrations(): RetainedRegistration[] {
        return this.delegated.listeners
            .filter(registered => lifetimeRegistrations.has(registered))
            .map(registered => [registered.type, registered.selector, registered.callback, registrationOptions.get(registered)]);
    }

    /** Re-register View-lifetime registrations on the current registry and keep them marked as such. */
    private restoreRegistrations(retained: RetainedRegistration[]) {
        const delegated = this.delegated;
        for (const [type, selector, callback, options] of retained) {
            const count = delegated.listeners.length;
            delegated.on(type, selector, callback, options);
            // An aborted signal registers nothing.
            if (delegated.listeners.length > count) {lifetimeRegistrations.add(delegated.listeners[count]!);}
        }
    }

    /**
     * Make sure the model is bound and, for a root that has not mounted yet, run addListeners() then
     * afterMount(). If either throws, undo the mount (removeListeners(), drop root-owned registrations, and
     * unbind the model if this call bound it) so a later render can retry, then rethrow.
     */
    private activateRoot() {
        const bindingWasInitialized = this.modelBindingInitialized;
        this.initializeModelBinding();
        if (this.mountedElement === this.element) {return this;}
        this.claimRegistrations();
        const errors: unknown[] = [];
        try {
            this.addListeners();
            this.afterMount();
            this.mountedElement = this.element;
            return this;
        } catch (error) {
            appendError(errors, error);
            this.mountedElement = undefined;
            try { this.removeListeners(); } catch (cleanupError) {appendError(errors, cleanupError);}
            try {
                const retained = this.retainedRegistrations();
                this.delegated.clear();
                this.restoreRegistrations(retained);
            } catch (cleanupError) {appendError(errors, cleanupError);}
            if (!bindingWasInitialized) {
                try { this.destroyModelBinding(); } catch (cleanupError) {appendError(errors, cleanupError);}
            }
            if (errors.length === 1) {throw errors[0];}
            throw new AggregateError(errors, 'Unable to mount view', {cause: error});
        }
    }

    /**
     * Render synchronously:
     * 1. If the root is attached and update() returns true, keep the root.
     * 2. Otherwise render the template. Identical HTML, or an equal DOM tree, keeps the existing root.
     * 3. Otherwise replace the root (or insert it into parentElement) and mount the new one.
     *
     * @throws TypeError when template output is not exactly one element; the previous root is kept.
     */
    render() {
        this.cancelRender();
        const attached = this.parentElement?.contains(this.element);
        const data = this.model && typeof this.model.get === 'function' ? this.model.get() : this.model || {};
        if (attached && this.update(this.element, data)) {
            this.renderedTemplate = undefined;
            return this.activateRoot();
        }
        if (typeof this.template !== 'function') {return attached ? this.activateRoot() : this;}
        let newElement = this.template(data);
        const html = isHTMLMarkup(newElement) ? newElement.value : typeof newElement === 'string' ? newElement : undefined;
        if (html !== undefined) {
            if (html === this.renderedTemplate && attached) {return this.activateRoot();}
            // Parse in the view's own document so iframe/multi-document views do not depend on globals.
            const ownerDocument = this.element.ownerDocument!;
            const template = ownerDocument.createElement('template');
            template.innerHTML = html.trim();
            const content = template.content;
            if (content.childNodes.length !== 1 || content.firstChild!.nodeType !== 1) {
                throw new TypeError('The view template must return exactly one root node (an element)');
            }
            newElement = content.firstChild!;
        }
        const root = newElement as Node;
        if (!root || root.nodeType !== 1) {
            throw new TypeError('The view template must return exactly one root node (an element)');
        }
        if (!this.parentElement) {return this;}
        if (attached && this.element.isEqualNode(root)) {
            this.renderedTemplate = html;
            return this.activateRoot();
        }
        this.claimRegistrations();
        const retained = this.retainedRegistrations();
        this.releaseRoot();
        if (attached) {this.element.parentNode!.replaceChild(root, this.element);}
        else {
            // An adopted root outside parentElement is still owned; move ownership rather than duplicate it.
            this.element.parentNode?.removeChild(this.element);
            this.parentElement.appendChild(root);
        }
        this.element = root;
        this.delegated = this.delegate();
        this.restoreRegistrations(retained);
        this.renderedTemplate = html;
        return this.activateRoot();
    }
}

namespace View {
    export type Settings = ViewSettings;
    export type Model = ViewModel;
    export type ListenerOptions = AddEventListenerOptions;
}
export = View;
