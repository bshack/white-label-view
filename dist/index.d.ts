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
declare class DelegatedEvents {
    scope: Element;
    listeners: Array<{
        type: string;
        selector: string;
        callback: DelegatedCallback;
        listener: EventListener;
    }>;
    /**
     * Create an instance with its own state and listener references.
     * @param scope - DOM root that bounds event delegation or navigation.
     */
    constructor(scope: Element);
    /**
     * Delegate matching events within the root and preserve the matching element as callback context.
     * @param type - DOM event name.
     * @param selector - CSS selector used to match delegated targets.
     * @param callback - Listener to invoke or remove.
     * @returns This delegation registry for chaining.
     */
    on(type: string, selector: string, callback: DelegatedCallback): this;
    /**
     * Remove registrations matching the supplied event, optional selector, and optional callback.
     * @param type - DOM event name.
     * @param selector - CSS selector used to match delegated targets.
     * @param callback - Listener to invoke or remove.
     * @returns This delegation registry after matching listeners are removed.
     */
    off(type: string, selector?: string, callback?: DelegatedCallback): this;
    /** Remove all listeners registered through this owned registry. */
    clear(): this;
}
/** Render a model through a template and release owned listeners on teardown. */
declare class View {
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
    constructor(settings?: ViewSettings);
    /**
     * Start this instance and return it for lifecycle chaining.
     * @returns This instance for chaining.
     */
    initialize(): this;
    /**
     * Release owned state and listeners so the instance can leave the application lifecycle.
     * @returns This instance after cleanup.
     */
    destroy(): this;
    /**
     * Subscribe once to model changes using the stable render callback.
     * @returns No value.
     */
    initializeTwoWayBinding(): void;
    /**
     * Remove only this view's model subscription, leaving other subscribers intact.
     * @returns No value.
     */
    destroyTwoWayBinding(): void;
    /**
     * Lifecycle hook for attaching listeners owned by a subclass.
     * @returns This instance for chaining.
     */
    addListeners(): this;
    /**
     * Release listeners owned by this instance; subclasses may extend the lifecycle hook.
     * @returns This instance for chaining.
     */
    removeListeners(): this;
    /**
     * Create an event-delegation registry for the supplied root or the current view element.
     * @param scope - DOM root that bounds event delegation or navigation.
     * @returns A new event-delegation registry.
     */
    delegate(scope?: Element): DelegatedEvents;
    /**
     * Render the current template, retaining an equal DOM tree and rebinding only after replacement.
     * @returns This view, whether its DOM changed or remained equal.
     */
    render(): this;
}
/** Public types for view configuration and model bindings. */
declare namespace View {
    type Settings = ViewSettings;
    type Model = ViewModel;
}
export = View;
