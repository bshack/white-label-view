import {isHTMLMarkup} from './html.js';
import type {HTMLMarkup} from './html.js';

/**
 * The data a server View renders. If `get()` exists, its result is passed to the template; otherwise the
 * model object itself is. A model with `addEventListener()` and `removeEventListener()` is observed: each
 * `change` event re-renders synchronously.
 */
interface ViewModel {
    get?: () => unknown;
    addEventListener?: (event: 'change', callback: EventListener) => unknown;
    removeEventListener?: (event: 'change', callback: EventListener) => unknown;
}

/** Server View settings: the DOM-free subset of browser View settings. */
interface ViewSettings {
    model?: object & ViewModel;
    /** Returns a trusted HTML string or HTMLMarkup. */
    template?: (data: unknown) => string | HTMLMarkup;
}

/**
 * Server View: renders model data to an HTML string with the same model, template and child-ownership
 * concepts as the browser View, without needing `window` or `document`. DOM nodes, delegated events, focus,
 * mounting and animation-frame batching are browser-only.
 */
class View {
    declare template?: (data: unknown) => string | HTMLMarkup;
    /** HTML from the last render; returned by toString(). */
    renderedTemplate?: string;
    modelChangeHandler: () => void;
    modelBindingInitialized = false;
    private currentModel?: object & ViewModel;
    private boundModel?: object & ViewModel;
    private children = new Set<View>();
    private owner?: View;

    constructor(settings?: ViewSettings) {
        if (settings?.template) {this.template = settings.template;}
        this.currentModel = settings?.model;
        this.modelChangeHandler = () => {this.render();};
    }

    get model(): (object & ViewModel) | undefined {return this.currentModel;}

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

    /** Render the current state and subscribe to the model. Same as render(). */
    initialize() {return this.render();}

    /**
     * Take cleanup ownership of `child`; it is destroyed when this View is destroyed.
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

    private destroyChildren() {
        const errors: unknown[] = [];
        for (const child of this.children) {
            this.releaseChild(child);
            try {child.destroy();} catch (error) {errors.push(error);}
        }
        if (errors.length) {throw new AggregateError(errors, 'Unable to destroy child views');}
    }

    /** Subscribe to the model's `change` event once, if the model has both EventTarget listener methods. */
    initializeModelBinding() {
        if (this.boundModel !== this.model) {this.destroyModelBinding();}
        if (!this.modelBindingInitialized && this.model &&
            typeof this.model.addEventListener === 'function' && typeof this.model.removeEventListener === 'function') {
            this.boundModel = this.model;
            this.model.addEventListener('change', this.modelChangeHandler);
            this.modelBindingInitialized = true;
        }
        return this;
    }

    /** Remove the model subscription. State is reset before removal, so the View stays reusable if it throws. */
    destroyModelBinding() {
        const boundModel = this.boundModel;
        const initialized = this.modelBindingInitialized;
        this.boundModel = undefined;
        this.modelBindingInitialized = false;
        if (initialized) {
            boundModel!.removeEventListener!('change', this.modelChangeHandler);
        }
        return this;
    }

    /**
     * Render the template to an HTML string (read it with toString()) and make sure the model is bound.
     * Without a template, only the model binding is set up.
     *
     * @throws TypeError when the template returns something other than a string or HTMLMarkup.
     */
    render() {
        if (typeof this.template !== 'function') {
            this.initializeModelBinding();
            return this;
        }
        const data = this.model && typeof this.model.get === 'function' ? this.model.get() : this.model || {};
        const output = this.template(data);
        if (isHTMLMarkup(output)) {
            this.renderedTemplate = output.value;
        } else if (typeof output === 'string') {
            // Third-party and direct strings intentionally keep browser View's trusted-markup semantics.
            this.renderedTemplate = output;
        } else {
            throw new TypeError('The server view template must return a string or White Label HTML markup');
        }
        this.initializeModelBinding();
        return this;
    }

    /** Return the most recently rendered HTML. */
    toString() {return this.renderedTemplate ?? '';}

    /**
     * Leave the owner, destroy owned children, release the model subscription and clear the output. Every
     * step is attempted even if one throws; the instance can be initialized again.
     *
     * @throws The single cleanup error, or an AggregateError when several steps failed.
     */
    destroy() {
        const errors: unknown[] = [];
        try {this.owner?.releaseChild(this);} catch (error) {errors.push(error);}
        try {this.destroyChildren();} catch (error) {errors.push(error);}
        try {this.destroyModelBinding();} catch (error) {errors.push(error);}
        this.renderedTemplate = undefined;
        if (errors.length === 1) {throw errors[0];}
        if (errors.length > 1) {throw new AggregateError(errors, 'Unable to destroy server view');}
        return this;
    }
}

namespace View {
    export type Settings = ViewSettings;
    export type Model = ViewModel;
}
export = View;
