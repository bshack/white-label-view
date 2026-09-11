"use strict";
/** Native event delegation scoped to a view root. */
class DelegatedEvents {
    scope;
    listeners = [];
    constructor(scope) {
        this.scope = scope;
    }
    /** Register a matching listener. once is consumed only by a matching event. */
    on(type, selector, callback, options = {}) {
        const settings = typeof options === 'boolean' ? { capture: options } : options;
        if (settings.signal?.aborted)
            return this;
        const once = Boolean(settings.once);
        const registered = {
            type, selector, callback, capture: Boolean(settings.capture), signal: settings.signal,
            abort: () => this.remove(registered),
            listener: (event) => {
                const target = event.target && typeof event.target.closest === 'function'
                    ? event.target.closest(selector) : null;
                if (target && (target === this.scope || this.scope.contains(target))) {
                    // Remove before invocation so recursive dispatch cannot invoke a once listener twice.
                    if (once)
                        this.remove(registered);
                    callback.call(target, event);
                }
            }
        };
        this.scope.addEventListener(type, registered.listener, { capture: registered.capture, passive: settings.passive });
        this.listeners.push(registered);
        registered.signal?.addEventListener('abort', registered.abort, { once: true });
        return this;
    }
    /** Remove matching registrations; optionally restrict removal to a capture phase. */
    off(type, selector, callback, options) {
        const capture = typeof options === 'boolean' ? options : options?.capture;
        this.listeners = this.listeners.filter(registered => {
            const matches = registered.type === type && (!selector || registered.selector === selector) &&
                (!callback || registered.callback === callback) &&
                (capture === undefined || registered.capture === capture);
            if (matches)
                this.detach(registered);
            return !matches;
        });
        return this;
    }
    /** Remove both native and abort listeners so external controllers do not retain this registry. */
    remove(registered) {
        this.detach(registered);
        this.listeners = this.listeners.filter(item => item !== registered);
    }
    detach(registered) {
        this.scope.removeEventListener(registered.type, registered.listener, registered.capture);
        registered.signal?.removeEventListener('abort', registered.abort);
    }
    /** Remove every registration in one pass, including its abort callback. */
    clear() {
        const registrations = this.listeners;
        this.listeners = [];
        for (const registered of registrations)
            this.detach(registered);
        return this;
    }
}
/** Render a model through a template and release owned listeners and child views on teardown. */
class View {
    parentElement;
    element;
    /** Override to update the attached root in place; false uses the template fallback. */
    update(_element, _data) { return false; }
    batchUpdates;
    modelChangeHandler;
    modelBindingInitialized = false;
    renderedTemplate;
    delegated;
    currentModel;
    boundModel;
    mountedElement;
    pendingFrame;
    frameWindow;
    children = new Set();
    owner;
    constructor(settings) {
        this.parentElement = settings?.parentElement;
        const ownerDocument = settings?.element?.ownerDocument || settings?.parentElement?.ownerDocument || document;
        this.element = settings?.element || ownerDocument.createElement('div');
        // Only explicit settings override subclass prototype hooks.
        if (settings?.template)
            this.template = settings.template;
        if (settings?.update)
            this.update = settings.update;
        this.currentModel = settings?.model;
        this.batchUpdates = settings?.batchUpdates === true;
        this.modelChangeHandler = () => this.requestRender();
        this.delegated = this.delegate();
    }
    get model() { return this.currentModel; }
    /** Assignment moves an active subscription; use setModel() to render the new data immediately. */
    set model(value) {
        if (value === this.currentModel)
            return;
        const rebind = this.modelBindingInitialized;
        this.destroyModelBinding();
        this.currentModel = value;
        if (rebind)
            this.initializeModelBinding();
    }
    /** Replace the model and synchronously render its current data. */
    setModel(model) {
        this.model = model;
        return this.render();
    }
    initialize() { return this.render(); }
    /** Coalesce automatic updates when enabled, falling back to synchronous rendering without RAF. */
    requestRender() {
        const window = this.element.ownerDocument?.defaultView;
        if (!this.batchUpdates || !window?.requestAnimationFrame)
            return this.render();
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
    cancelRender() {
        if (this.pendingFrame !== undefined) {
            this.frameWindow.cancelAnimationFrame(this.pendingFrame);
            this.pendingFrame = undefined;
            this.frameWindow = undefined;
        }
    }
    /** Register ownership without mounting the child. Owned children are destroyed on root replacement. */
    addChild(child) {
        for (let ancestor = this; ancestor; ancestor = ancestor.owner) {
            if (ancestor === child)
                throw new TypeError('Child view ownership must not contain cycles');
        }
        if (child.owner && child.owner !== this)
            throw new TypeError('Child view already has an owner');
        this.children.add(child);
        child.owner = this;
        return this;
    }
    /** Relinquish ownership without destroying the child. */
    releaseChild(child) {
        if (this.children.delete(child))
            child.owner = undefined;
        return this;
    }
    /** Clean up all owned children, reporting failures after attempting each child. */
    destroyChildren() {
        const errors = [];
        for (const child of this.children) {
            this.releaseChild(child);
            try {
                child.destroy();
            }
            catch (error) {
                errors.push(error);
            }
        }
        if (errors.length)
            throw new AggregateError(errors, 'Unable to destroy child views');
    }
    /** Release listeners and owned children even if a subclass cleanup hook throws. */
    releaseRoot() {
        try {
            this.destroyChildren();
        }
        finally {
            try {
                this.removeListeners();
            }
            finally {
                this.delegated.clear();
                this.mountedElement = undefined;
            }
        }
    }
    /** Remove the owned root from its actual parent, including nested roots. May be initialized again. */
    destroy() {
        this.cancelRender();
        this.owner?.releaseChild(this);
        const ownerDocument = this.element.ownerDocument;
        try {
            this.releaseRoot();
        }
        finally {
            this.destroyModelBinding();
            this.element.parentNode?.removeChild(this.element);
            this.element = ownerDocument.createElement('div');
            this.delegated = this.delegate();
            this.renderedTemplate = undefined;
        }
        return this;
    }
    /** Subscribe once; observable models must expose a matching removal method. */
    initializeModelBinding() {
        if (this.boundModel !== this.model)
            this.destroyModelBinding();
        if (!this.modelBindingInitialized && this.model &&
            typeof this.model.on === 'function' && typeof this.model.removeListener === 'function') {
            this.boundModel = this.model;
            this.model.on('change', this.modelChangeHandler);
            this.modelBindingInitialized = true;
        }
    }
    /** Remove the subscription from the emitter originally bound and cancel queued rendering. */
    destroyModelBinding() {
        this.cancelRender();
        if (this.modelBindingInitialized)
            this.boundModel.removeListener('change', this.modelChangeHandler);
        this.boundModel = undefined;
        this.modelBindingInitialized = false;
    }
    /** Called once for each mounted root, including adopted existing markup. */
    addListeners() { return this; }
    /** Called before root replacement or destruction. */
    removeListeners() { return this; }
    /** Called after insertion/adoption and listener setup; safe for focus and parent-relative measurement. */
    afterMount() { return this; }
    delegate(scope) { return new DelegatedEvents(scope || this.element); }
    activateRoot() {
        this.initializeModelBinding();
        if (this.mountedElement !== this.element) {
            this.mountedElement = this.element;
            this.addListeners();
            this.afterMount();
        }
        return this;
    }
    /** Render synchronously, preserving equal roots while ensuring their lifecycle is initialized. */
    render() {
        this.cancelRender();
        const attached = this.parentElement?.contains(this.element);
        if (typeof this.template !== 'function')
            return attached ? this.activateRoot() : this;
        const data = this.model && typeof this.model.get === 'function' ? this.model.get() : this.model || {};
        if (attached && this.update(this.element, data)) {
            this.renderedTemplate = undefined;
            return this.activateRoot();
        }
        let newElement = this.template(data);
        const html = typeof newElement === 'string' ? newElement : undefined;
        if (html !== undefined) {
            if (html === this.renderedTemplate && attached)
                return this.activateRoot();
            // Parse in the view's own document so iframe/multi-document consumers do not depend on globals.
            const ownerDocument = this.element.ownerDocument;
            const template = ownerDocument.createElement('template');
            template.innerHTML = html.trim();
            const content = template.content;
            if (content.childNodes.length !== 1 || content.firstChild.nodeType !== 1) {
                throw new TypeError('The view template must return exactly one root node (an element)');
            }
            newElement = content.firstChild;
        }
        const root = newElement;
        if (!root || root.nodeType !== 1) {
            throw new TypeError('The view template must return exactly one root node (an element)');
        }
        if (!this.parentElement)
            return this;
        if (attached && this.element.isEqualNode(root)) {
            this.renderedTemplate = html;
            return this.activateRoot();
        }
        this.releaseRoot();
        if (attached)
            this.element.parentNode.replaceChild(root, this.element);
        else
            this.parentElement.appendChild(root);
        this.element = root;
        this.delegated = this.delegate();
        this.renderedTemplate = html;
        return this.activateRoot();
    }
}
module.exports = View;
//# sourceMappingURL=index.js.map