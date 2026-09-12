import type { JSXMarkup } from './jsx-runtime.js';
interface ViewModel {
    get?: () => unknown;
    on?: (event: string, callback: () => void) => unknown;
    removeListener?: (event: string, callback: () => void) => unknown;
}
interface ViewSettings {
    model?: object & ViewModel;
    template?: (data: unknown) => string | JSXMarkup;
}
/** Server rendering lifecycle that mirrors the browser View's model/template API without a DOM. */
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
    setModel(model?: object & ViewModel): this;
    initialize(): this;
    addChild(child: View): this;
    releaseChild(child: View): this;
    initializeModelBinding(): this;
    destroyModelBinding(): this;
    addListeners(): this;
    removeListeners(): this;
    afterMount(): this;
    /** Render the current model to an escaped JSX string or caller-provided trusted string. */
    render(): this;
    /** Return the latest server-rendered markup. */
    toString(): string;
    destroy(): this;
}
declare namespace View {
    type Settings = ViewSettings;
    type Model = ViewModel;
}
export = View;
