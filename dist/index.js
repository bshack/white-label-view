"use strict";
/** Native event delegation scoped to a view root. */
class DelegatedEvents {
    scope;
    listeners;
    /**
     * Create an instance with its own state and listener references.
     * @param scope - DOM root that bounds event delegation or navigation.
     */
    constructor(scope) {
        this.scope = scope;
        this.listeners = [];
    }
    /**
     * Delegate matching events within the root and preserve the matching element as callback context.
     * @param type - DOM event name.
     * @param selector - CSS selector used to match delegated targets.
     * @param callback - Listener to invoke or remove.
     * @returns This delegation registry for chaining.
     */
    on(type, selector, callback) {
        const listener = (event) => {
            const target = event.target && typeof event.target.closest === 'function'
                ? event.target.closest(selector)
                : null;
            if (target && (target === this.scope || this.scope.contains(target))) {
                callback.call(target, event);
            }
        };
        this.scope.addEventListener(type, listener);
        this.listeners.push({ callback, listener, selector, type });
        return this;
    }
    /**
     * Remove registrations matching the supplied event, optional selector, and optional callback.
     * @param type - DOM event name.
     * @param selector - CSS selector used to match delegated targets.
     * @param callback - Listener to invoke or remove.
     * @returns This delegation registry after matching listeners are removed.
     */
    off(type, selector, callback) {
        this.listeners = this.listeners.filter((registered) => {
            const matches = registered.type === type &&
                (!selector || registered.selector === selector) &&
                (!callback || registered.callback === callback);
            if (matches) {
                this.scope.removeEventListener(type, registered.listener);
            }
            return !matches;
        });
        return this;
    }
}
/** Render a model through a template and release owned listeners on teardown. */
class View {
    parentElement;
    element;
    model;
    template;
    modelChangeHandler;
    twoWayBindingInitialized;
    renderedTemplate;
    delegated;
    /**
     * Create an instance with its own state and listener references.
     * @param settings - Optional parent, element, model, and template settings.
     */
    constructor(settings) {
        if (settings && typeof settings.parentElement === 'object') {
            this.parentElement = settings.parentElement;
        }
        else {
            this.parentElement = undefined;
        }
        if (settings && typeof settings.template === 'function') {
            this.template = settings.template;
        }
        else {
            this.template = undefined;
        }
        if (settings && typeof settings.model === 'object') {
            this.model = settings.model;
        }
        else {
            this.model = undefined;
        }
        if (settings && typeof settings.element === 'object') {
            this.element = settings.element;
        }
        else {
            this.element = document.createElement('div');
        }
        // Keep a stable callback so this view can remove only its own model listener.
        this.modelChangeHandler = () => this.render();
        this.twoWayBindingInitialized = false;
        this.renderedTemplate = undefined;
        this.delegated = this.delegate(this.element);
    }
    /**
     * Start this instance and return it for lifecycle chaining.
     * @returns This instance for chaining.
     */
    initialize() {
        this.render();
        return this;
    }
    /**
     * Release owned state and listeners so the instance can leave the application lifecycle.
     * @returns This instance after cleanup.
     */
    destroy() {
        //remove element from dom
        if (typeof this.parentElement === 'object' && this.parentElement.contains(this.element)) {
            this.parentElement.removeChild(this.element);
        }
        // remove all the events from the dom
        this.removeListeners();
        // remove all the events from the model
        this.destroyTwoWayBinding();
        // reset object to div
        this.element = document.createElement('div');
        this.renderedTemplate = undefined;
        return this;
    }
    /**
     * Subscribe once to model changes using the stable render callback.
     * @returns No value.
     */
    initializeTwoWayBinding() {
        if (!this.twoWayBindingInitialized &&
            this.model &&
            typeof this.model.on === 'function') {
            this.model.on('change', this.modelChangeHandler);
            this.twoWayBindingInitialized = true;
        }
    }
    /**
     * Remove only this view's model subscription, leaving other subscribers intact.
     * @returns No value.
     */
    destroyTwoWayBinding() {
        if (this.twoWayBindingInitialized &&
            this.model &&
            typeof this.model.removeListener === 'function') {
            this.model.removeListener('change', this.modelChangeHandler);
        }
        this.twoWayBindingInitialized = false;
    }
    /**
     * Lifecycle hook for attaching listeners owned by a subclass.
     * @returns This instance for chaining.
     */
    addListeners() {
        //bind events
        return this;
    }
    /**
     * Release listeners owned by this instance; subclasses may extend the lifecycle hook.
     * @returns This instance for chaining.
     */
    removeListeners() {
        //unbind events
        return this;
    }
    /**
     * Create an event-delegation registry for the supplied root or the current view element.
     * @param scope - DOM root that bounds event delegation or navigation.
     * @returns A new event-delegation registry.
     */
    delegate(scope) {
        return new DelegatedEvents(scope || this.element);
    }
    /**
     * Render the current template, retaining an equal DOM tree and rebinding only after replacement.
     * @returns This view, whether its DOM changed or remained equal.
     */
    render() {
        let newElement;
        if (typeof this.template === 'function') {
            if (this.model && typeof this.model.get === 'function') {
                newElement = this.template(this.model.get());
            }
            else if (typeof this.model === 'object') {
                newElement = this.template(this.model);
            }
            else {
                newElement = this.template({});
            }
            // if the template returns a string make it a dom object
            if (typeof newElement === 'string') {
                if (newElement === this.renderedTemplate &&
                    typeof this.parentElement === 'object' &&
                    this.parentElement.contains(this.element)) {
                    return this;
                }
                this.renderedTemplate = newElement;
                const parsed = new DOMParser().parseFromString(newElement.trim(), 'text/html').body.firstChild;
                if (!parsed) {
                    throw new TypeError('The view template must return a root node');
                }
                newElement = parsed.cloneNode(true);
            }
            else {
                this.renderedTemplate = undefined;
            }
            if (typeof this.parentElement === 'object' && typeof newElement === 'object') {
                if (this.parentElement.contains(this.element) &&
                    typeof this.element.isEqualNode === 'function' &&
                    this.element.isEqualNode(newElement)) {
                    return this;
                }
                //render html changes
                this.removeListeners();
                this.destroyTwoWayBinding();
                if (this.parentElement.contains(this.element)) {
                    let oldDOMElement = this.element;
                    this.element = newElement;
                    this.delegated = this.delegate();
                    this.addListeners();
                    this.initializeTwoWayBinding();
                    this.parentElement.replaceChild(this.element, oldDOMElement);
                }
                else {
                    this.element = newElement;
                    this.delegated = this.delegate();
                    this.addListeners();
                    this.initializeTwoWayBinding();
                    this.parentElement.appendChild(this.element);
                }
            }
        }
        return this;
    }
}
;
module.exports = View;
//# sourceMappingURL=index.js.map