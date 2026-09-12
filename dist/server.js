"use strict";
const jsx_runtime_js_1 = require("./jsx-runtime.js");
/** Server rendering lifecycle that mirrors the browser View's model/template API without a DOM. */
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
    setModel(model) {
        this.model = model;
        return this.render();
    }
    initialize() { return this.render(); }
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
    releaseChild(child) {
        if (this.children.delete(child)) {
            child.owner = undefined;
        }
        return this;
    }
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
    destroyModelBinding() {
        if (this.modelBindingInitialized) {
            this.boundModel.removeListener('change', this.modelChangeHandler);
        }
        this.boundModel = undefined;
        this.modelBindingInitialized = false;
        return this;
    }
    addListeners() { return this; }
    removeListeners() { return this; }
    afterMount() { return this; }
    /** Render the current model to an escaped JSX string or caller-provided trusted string. */
    render() {
        const data = this.model && typeof this.model.get === 'function' ? this.model.get() : this.model || {};
        if (typeof this.template !== 'function') {
            this.initializeModelBinding();
            return this;
        }
        const output = this.template(data);
        if (typeof output !== 'string' && !(0, jsx_runtime_js_1.isJSXMarkup)(output)) {
            throw new TypeError('The server view template must return a string or JSX markup');
        }
        this.renderedTemplate = typeof output === 'string' ? output : output.value;
        this.initializeModelBinding();
        this.addListeners();
        this.afterMount();
        return this;
    }
    /** Return the latest server-rendered markup. */
    toString() { return this.renderedTemplate || ''; }
    destroy() {
        this.owner?.releaseChild(this);
        const children = [...this.children];
        this.children.clear();
        for (const child of children) {
            child.owner = undefined;
            child.destroy();
        }
        this.removeListeners();
        this.destroyModelBinding();
        this.renderedTemplate = undefined;
        return this;
    }
}
module.exports = View;
//# sourceMappingURL=server.js.map