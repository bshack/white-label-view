/** Data source consumed by the rendering lifecycle. */
interface ViewModel {
    get?: () => unknown;
    on?: (event: string, callback: () => void) => unknown;
    removeListener?: (event: string, callback: () => void) => unknown;
}
/** Constructor settings; templates must return exactly one root element. */
interface ViewSettings {
    parentElement?: Element;
    element?: Element;
    model?: object & ViewModel;
    template?: (data: unknown) => string | Node;
    update?: (element: Node, data: unknown) => boolean;
    /** Coalesce model changes into one animation frame; manual render() stays synchronous. */
    batchUpdates?: boolean;
}
type DelegatedCallback = (this: Element, event: Event) => unknown;
interface Registration {
    type: string;
    selector: string;
    callback: DelegatedCallback;
    listener: EventListener;
    capture: boolean;
    signal?: AbortSignal;
    abort: () => void;
}
/** Native event delegation scoped to a view root. */
declare class DelegatedEvents {
    scope: Element;
    listeners: Registration[];
    constructor(scope: Element);
    /** Register a matching listener. once is consumed only by a matching event. */
    on(type: string, selector: string, callback: DelegatedCallback, options?: boolean | AddEventListenerOptions): this;
    /** Remove matching registrations; optionally restrict removal to a capture phase. */
    off(type: string, selector?: string, callback?: DelegatedCallback, options?: boolean | EventListenerOptions): this;
    /** Remove both native and abort listeners so external controllers do not retain this registry. */
    private remove;
    private detach;
    /** Remove every registration in one pass, including its abort callback. */
    clear(): this;
}
/** Render a model through a template and release owned listeners and child views on teardown. */
declare class View {
    parentElement?: Element;
    element: Node;
    template?: (data: unknown) => string | Node;
    /** Override to update the attached root in place; false uses the template fallback. */
    update(_element: Node, _data: unknown): boolean;
    batchUpdates: boolean;
    modelChangeHandler: () => void;
    modelBindingInitialized: boolean;
    renderedTemplate?: string;
    delegated: DelegatedEvents;
    private currentModel?;
    private boundModel?;
    private mountedElement?;
    private pendingFrame?;
    private frameWindow?;
    private children;
    private owner?;
    constructor(settings?: ViewSettings);
    get model(): (object & ViewModel) | undefined;
    /** Assignment moves an active subscription; use setModel() to render the new data immediately. */
    set model(value: (object & ViewModel) | undefined);
    /** Replace the model and synchronously render its current data. */
    setModel(model?: object & ViewModel): this;
    initialize(): this;
    /** Coalesce automatic updates when enabled, falling back to synchronous rendering without RAF. */
    requestRender(): this;
    private cancelRender;
    /** Register ownership without mounting the child. Owned children are destroyed on root replacement. */
    addChild(child: View): this;
    /** Relinquish ownership without destroying the child. */
    releaseChild(child: View): this;
    /** Clean up all owned children, reporting failures after attempting each child. */
    private destroyChildren;
    /** Release listeners and owned children even if a subclass cleanup hook throws. */
    private releaseRoot;
    /** Remove the owned root from its actual parent, including nested roots. May be initialized again. */
    destroy(): this;
    /** Subscribe once; observable models must expose a matching removal method. */
    initializeModelBinding(): void;
    /** Remove the subscription from the emitter originally bound and cancel queued rendering. */
    destroyModelBinding(): void;
    /** Called once for each mounted root, including adopted existing markup. */
    addListeners(): this;
    /** Called before root replacement or destruction. */
    removeListeners(): this;
    /** Called after insertion/adoption and listener setup; safe for focus and parent-relative measurement. */
    afterMount(): this;
    delegate(scope?: Element): DelegatedEvents;
    private activateRoot;
    /** Render synchronously, preserving equal roots while ensuring their lifecycle is initialized. */
    render(): this;
}
declare namespace View {
    type Settings = ViewSettings;
    type Model = ViewModel;
    type ListenerOptions = AddEventListenerOptions;
}
export = View;
