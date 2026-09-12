import type { JSXMarkup } from './jsx-runtime.js';
/** Data source consumed by the server rendering lifecycle. */
interface ViewModel {
    get?: () => unknown;
    on?: (event: string, callback: () => void) => unknown;
    removeListener?: (event: string, callback: () => void) => unknown;
}
/** Server settings mirror the portable subset of browser View settings. */
interface ViewSettings {
    model?: object & ViewModel;
    template?: (data: unknown) => string | JSXMarkup;
}
/**
 * Server view lifecycle using the same model/template concepts as browser View.
 * DOM nodes, delegated events, focus, and mounting remain browser responsibilities.
 */
declare class View {
    template?: (data: unknown) => string | JSXMarkup;
    renderedTemplate?: string;
    modelChangeHandler: () => void;
    modelBindingInitialized: boolean;
    private currentModel?;
    private boundModel?;
    private children;
    private owner?;
    constructor(settings?: ViewSettings);
    get model(): (object & ViewModel) | undefined;
    set model(value: (object & ViewModel) | undefined);
    /** Replace the model and synchronously render its current data. */
    setModel(model?: object & ViewModel): this;
    initialize(): this;
    /** Register child ownership so teardown mirrors the browser lifecycle. */
    addChild(child: View): this;
    /** Relinquish ownership without destroying the child. */
    releaseChild(child: View): this;
    private destroyChildren;
    /** Subscribe once to an observable model. */
    initializeModelBinding(): this;
    /** Release the model subscription owned by this view. */
    destroyModelBinding(): this;
    /** Render the current template to an HTML string without requiring DOM globals. */
    render(): this;
    /** Return the most recently rendered HTML. */
    toString(): string;
    /** Release owned children and subscriptions; the instance may be initialized again. */
    destroy(): this;
}
declare namespace View {
    type Settings = ViewSettings;
    type Model = ViewModel;
}
export = View;
