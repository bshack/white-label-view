"use strict";
const jsx_runtime_js_1 = require("./jsx-runtime.js");
/**
 * Server view lifecycle using the same model/template concepts as browser View.
 * DOM nodes, delegated events, focus, and mounting remain browser responsibilities.
 */
class View {
    renderedTemplate;
    modelChangeHandler;
    modelBindingInitialized = false;
    currentModel;
    boundModel;
    children = new Set();
    owner;
    constructor(settings) {
        if (settings?.template) {
            this.template = settings.template;
        }
        this.currentModel = settings?.model;
        this.modelChangeHandler = () => { this.render(); };
    }
    get model() { return this.currentModel; }
    set model(value) {
        if (value === this.currentModel) {
            return;
        }
        const rebind = this.modelBindingInitialized;
        this.destroyModelBinding();
        this.currentModel = value;
        if (rebind) {
            this.initializeModelBinding();
        }
    }
    /** Replace the model and synchronously render its current data. */
    setModel(model) {
        this.model = model;
        return this.render();
    }
    initialize() { return this.render(); }
    /** Register child ownership so teardown mirrors the browser lifecycle. */
    addChild(child) {
        for (let ancestor = this; ancestor; ancestor = ancestor.owner) {
            if (ancestor === child) {
                throw new TypeError('Child view ownership must not contain cycles');
            }
        }
        if (child.owner && child.owner !== this) {
            throw new TypeError('Child view already has an owner');
        }
        this.children.add(child);
        child.owner = this;
        return this;
    }
    /** Relinquish ownership without destroying the child. */
    releaseChild(child) {
        if (this.children.delete(child)) {
            child.owner = undefined;
        }
        return this;
    }
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
        if (errors.length) {
            throw new AggregateError(errors, 'Unable to destroy child views');
        }
    }
    /** Subscribe once to an observable model. */
    initializeModelBinding() {
        if (this.boundModel !== this.model) {
            this.destroyModelBinding();
        }
        if (!this.modelBindingInitialized && this.model &&
            typeof this.model.on === 'function' && typeof this.model.removeListener === 'function') {
            this.boundModel = this.model;
            this.model.on('change', this.modelChangeHandler);
            this.modelBindingInitialized = true;
        }
        return this;
    }
    /** Release the model subscription owned by this view. */
    destroyModelBinding() {
        if (this.modelBindingInitialized) {
            this.boundModel.removeListener('change', this.modelChangeHandler);
        }
        this.boundModel = undefined;
        this.modelBindingInitialized = false;
        return this;
    }
    /** Render the current template to an HTML string without requiring DOM globals. */
    render() {
        if (typeof this.template !== 'function') {
            this.initializeModelBinding();
            return this;
        }
        const data = this.model && typeof this.model.get === 'function' ? this.model.get() : this.model || {};
        const output = this.template(data);
        if ((0, jsx_runtime_js_1.isJSXMarkup)(output)) {
            this.renderedTemplate = output.value;
        }
        else if (typeof output === 'string') {
            // Direct strings intentionally keep browser View's trusted-markup semantics.
            this.renderedTemplate = output;
        }
        else {
            throw new TypeError('The server view template must return a string or White Label JSX markup');
        }
        this.initializeModelBinding();
        return this;
    }
    /** Return the most recently rendered HTML. */
    toString() { return this.renderedTemplate ?? ''; }
    /** Release owned children and subscriptions; the instance may be initialized again. */
    destroy() {
        this.owner?.releaseChild(this);
        try {
            this.destroyChildren();
        }
        finally {
            this.destroyModelBinding();
            this.renderedTemplate = undefined;
        }
        return this;
    }
}
module.exports = View;
//# sourceMappingURL=server.js.map