/** Data source consumed by the rendering lifecycle. */
interface ViewModel {
    get?: () => unknown;
    on?: (event: string, callback: () => void) => unknown;
    removeListener?: (event: string, callback: () => void) => unknown;
}
/** Constructor settings; template strings must contain a single root node. */
interface ViewSettings {
    parentElement?: Element;
    element?: Element;
    model?: object & ViewModel;
    template?: (data: unknown) => string | Node;
    update?: (element: Node, data: unknown) => boolean;
}
type DelegatedCallback = (this: Element, event: Event) => unknown;
/** Native event delegation scoped to a view root. */
class DelegatedEvents {
    scope: Element;
    listeners: Array<{type: string; selector: string; callback: DelegatedCallback; listener: EventListener}>;

    /**
     * Create an instance with its own state and listener references.
     * @param scope - DOM root that bounds event delegation or navigation.
     */
    constructor(scope: Element) {
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
    on(type: string, selector: string, callback: DelegatedCallback) {
        const listener = (event: Event) => {
            const target = event.target && typeof (event.target as Element).closest === 'function'
                ? (event.target as Element).closest(selector)
                : null;
            if (target && (target === this.scope || this.scope.contains(target))) {
                callback.call(target, event);
            }
        };
        this.scope.addEventListener(type, listener);
        this.listeners.push({callback, listener, selector, type});
        return this;
    }

    /**
     * Remove registrations matching the supplied event, optional selector, and optional callback.
     * @param type - DOM event name.
     * @param selector - CSS selector used to match delegated targets.
     * @param callback - Listener to invoke or remove.
     * @returns This delegation registry after matching listeners are removed.
     */
    off(type: string, selector?: string, callback?: DelegatedCallback) {
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

    /** Remove all listeners registered through this owned registry. */
    clear() {
        for (const registered of this.listeners) {
            this.scope.removeEventListener(registered.type, registered.listener);
        }
        this.listeners.length = 0;
        return this;
    }
}



    /** Render a model through a template and release owned listeners on teardown. */
class View {
    parentElement?: Element;
    element: Node;
    model?: object & ViewModel;
    template?: (data: unknown) => string | Node;
    update?: (element: Node, data: unknown) => boolean;
    modelChangeHandler: () => void;
    twoWayBindingInitialized: boolean;
    renderedTemplate?: string;
    delegated: DelegatedEvents;

        /**
         * Create an instance with its own state and listener references.
         * @param settings - Optional parent, element, model, and template settings.
         */
        constructor(settings?: ViewSettings) {

            if (settings && typeof settings.parentElement === 'object') {
                this.parentElement = settings.parentElement;
            } else {
                this.parentElement = undefined;
            }

            if (settings && typeof settings.template === 'function') {
                this.template = settings.template;
            } else {
                this.template = undefined;
            }

            if (settings && typeof settings.model === 'object') {
                this.model = settings.model;
            } else {
                this.model = undefined;
            }

            if (settings && typeof settings.element === 'object') {
                this.element = settings.element;
            } else {
                this.element = document.createElement('div');
            }

            this.update = settings?.update;

            // Keep a stable callback so this view can remove only its own model listener.
            this.modelChangeHandler = () => this.render();
            this.twoWayBindingInitialized = false;
            this.renderedTemplate = undefined;
            this.delegated = this.delegate(this.element as Element);

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
                this.parentElement.removeChild(this.element)
            }

            // remove all the events from the dom
            this.removeListeners();
            this.delegated.clear();

            // remove all the events from the model
            this.destroyTwoWayBinding();

            // reset object to div
            this.element = document.createElement('div');
            this.delegated = this.delegate();
            this.renderedTemplate = undefined;

            return this;

        }

        /**
         * Subscribe once to model changes using the stable render callback.
         * @returns No value.
         */
        initializeTwoWayBinding() {

            if (
                !this.twoWayBindingInitialized &&
                this.model &&
                typeof this.model.on === 'function'
            ) {
                this.model.on('change', this.modelChangeHandler);
                this.twoWayBindingInitialized = true;
            }

        }

        /**
         * Remove only this view's model subscription, leaving other subscribers intact.
         * @returns No value.
         */
        destroyTwoWayBinding() {

            if (
                this.twoWayBindingInitialized &&
                this.model &&
                typeof this.model.removeListener === 'function'
            ) {
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
        delegate(scope?: Element) {
            return new DelegatedEvents(scope || this.element as Element);

        }

        /**
         * Render the current template, retaining an equal DOM tree and rebinding only after replacement.
         * @returns This view, whether its DOM changed or remained equal.
         */
        render() {

            let newElement;

            if (typeof this.template === 'function') {

                const data = this.model && typeof this.model.get === 'function'
                    ? this.model.get() : this.model || {};
                // Opt-in updates preserve live controls and their selection/composition state.
                if (this.parentElement?.contains(this.element) && this.update?.(this.element, data)) {
                    this.renderedTemplate = undefined;
                    return this;
                }
                newElement = this.template(data);

                // if the template returns a string make it a dom object
                if (typeof newElement === 'string') {
                    if (
                        newElement === this.renderedTemplate &&
                        typeof this.parentElement === 'object' &&
                        this.parentElement.contains(this.element)
                    ) {
                        return this;
                    }
                    this.renderedTemplate = newElement;
                    const parsed = new DOMParser().parseFromString(newElement.trim(), 'text/html').body.firstChild;
                    if (!parsed) {
                        throw new TypeError('The view template must return a root node');
                    }
                    newElement = parsed;
                } else {
                    this.renderedTemplate = undefined;
                }

                if (typeof this.parentElement === 'object' && typeof newElement === 'object') {

                    if (
                        this.parentElement.contains(this.element) &&
                        typeof this.element.isEqualNode === 'function' &&
                        this.element.isEqualNode(newElement)
                    ) {
                        return this;
                    }

                    //render html changes
                    this.removeListeners();
                    this.delegated.clear();
                    this.destroyTwoWayBinding();

                    if (this.parentElement.contains(this.element)) {

                        let oldDOMElement = this.element;
                        this.element = newElement;
                        this.delegated = this.delegate();
                        this.addListeners();
                        this.initializeTwoWayBinding();
                        this.parentElement.replaceChild(this.element, oldDOMElement);

                    } else {

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

    };

    /** Public types for view configuration and model bindings. */
namespace View {
    export type Settings = ViewSettings;
    export type Model = ViewModel;
}
export = View;
