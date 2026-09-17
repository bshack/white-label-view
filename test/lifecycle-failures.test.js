'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {JSDOM} = require('jsdom');
const View = require('../dist');

function dom(t) {
    const window = new JSDOM('<main></main>').window;
    global.document = window.document;
    global.DOMParser = window.DOMParser;
    t.after(() => {window.close(); delete global.document; delete global.DOMParser;});
    return window;
}

function messages(error) {
    return error instanceof AggregateError
        ? error.errors.flatMap(messages)
        : [error.message];
}

test('failed addListeners rolls back owned listeners and can retry cleanly', t => {
    const window = dom(t);
    const parentElement = document.querySelector('main');
    let adds = 0;
    let removes = 0;
    const model = {
        get: () => ({}),
        addEventListener() {adds += 1;},
        removeEventListener() {removes += 1;}
    };

    class RetryView extends View {
        fail = true;
        calls = 0;
        direct = () => {this.calls += 1;};
        addListeners() {
            this.element.addEventListener('click', this.direct);
            this.delegated.on('click', 'button', () => {this.calls += 1;});
            if (this.fail) {
                this.fail = false;
                throw new Error('add failed');
            }
            return this;
        }
        removeListeners() {
            this.element.removeEventListener('click', this.direct);
            return this;
        }
    }

    const view = new RetryView({parentElement, model, template: () => '<button>Go</button>'});
    assert.throws(() => view.initialize(), /add failed/);
    assert.equal(view.modelBindingInitialized, false);
    assert.equal(view.delegated.listeners.length, 0);
    assert.equal(adds, 1);
    assert.equal(removes, 1);

    assert.equal(view.initialize(), view);
    assert.equal(view.modelBindingInitialized, true);
    view.element.dispatchEvent(new window.MouseEvent('click', {bubbles: true}));
    assert.equal(view.calls, 2);
    assert.equal(adds, 2);
    view.destroy();
});

test('failed afterMount aggregates rollback failures without marking the root mounted', t => {
    dom(t);
    const parentElement = document.querySelector('main');
    const model = {
        get: () => ({}),
        addEventListener() {},
        removeEventListener() {throw new Error('model cleanup');}
    };

    class BrokenMountView extends View {
        mountStarted = false;
        addListeners() {
            this.mountStarted = true;
            this.delegated.on('click', 'div', () => {});
            return this;
        }
        afterMount() {throw new Error('after mount');}
        removeListeners() {
            if (this.mountStarted) {throw new Error('listener cleanup');}
            return this;
        }
    }

    const view = new BrokenMountView({parentElement, model, template: () => '<div>broken</div>'});
    assert.throws(() => view.initialize(), error => {
        assert.deepEqual(messages(error), ['after mount', 'listener cleanup', 'model cleanup']);
        return true;
    });
    assert.equal(view.modelBindingInitialized, false);
    assert.equal(view.delegated.listeners.length, 0);
});

test('failed mount preserves delegated cleanup failures', t => {
    dom(t);
    const parentElement = document.querySelector('main');

    class BrokenDelegatedRollbackView extends View {
        addListeners() {
            this.delegated.clear = () => {throw new Error('delegated rollback');};
            throw new Error('mount failed');
        }
    }

    const view = new BrokenDelegatedRollbackView({parentElement, template: () => '<div>broken</div>'});
    assert.throws(() => view.initialize(), error => {
        assert.deepEqual(messages(error), ['mount failed', 'delegated rollback']);
        return true;
    });
});

test('failed replacement preserves an already-active model binding for retry', t => {
    dom(t);
    const parentElement = document.querySelector('main');
    const model = new EventTarget();
    model.get = () => ({});

    class ReplacementView extends View {
        failNext = false;
        addListeners() {
            if (this.failNext) {
                this.failNext = false;
                throw new Error('replacement failed');
            }
            return this;
        }
    }

    let value = 'one';
    const view = new ReplacementView({parentElement, model, template: () => `<div>${value}</div>`}).initialize();
    assert.equal(view.modelBindingInitialized, true);
    value = 'two';
    view.failNext = true;
    assert.throws(() => view.render(), /replacement failed/);
    assert.equal(view.modelBindingInitialized, true);
    assert.equal(view.render(), view);
    view.destroy();
});

test('destroy attempts every cleanup phase and preserves all failures', t => {
    dom(t);
    const parentElement = document.querySelector('main');
    const model = {
        get: () => ({}),
        addEventListener() {},
        removeEventListener() {throw new Error('model cleanup');}
    };

    class Child extends View {
        constructor(message) {super(); this.message = message;}
        destroy() {throw new Error(this.message);}
    }

    class BrokenDestroyView extends View {
        failCleanup = false;
        failDelegate = false;
        removeListeners() {
            if (this.failCleanup) {throw new Error('listener cleanup');}
            return this;
        }
        delegate(scope) {
            if (this.failDelegate) {throw new Error('delegate cleanup');}
            return super.delegate(scope);
        }
    }

    const view = new BrokenDestroyView({parentElement, model, template: () => '<div>root</div>'}).initialize();
    view.addChild(new Child('child one'));
    view.addChild(new Child('child two'));
    view.failCleanup = true;
    view.failDelegate = true;
    const originalRemoveChild = parentElement.removeChild.bind(parentElement);
    parentElement.removeChild = () => {throw new Error('dom cleanup');};

    assert.throws(() => view.destroy(), error => {
        assert.deepEqual(messages(error), [
            'child one', 'child two', 'listener cleanup', 'model cleanup', 'dom cleanup', 'delegate cleanup'
        ]);
        return true;
    });

    parentElement.removeChild = originalRemoveChild;
    assert.equal(view.modelBindingInitialized, false);
    assert.equal(view.element.parentNode, null);
    assert.equal(view.delegated.scope, view.element);
});

test('destroy preserves cancel, owner-release, and delegated-registry cleanup failures', t => {
    const window = dom(t);
    const parentElement = document.querySelector('main');
    window.requestAnimationFrame = () => 7;
    window.cancelAnimationFrame = () => {throw new Error('frame cleanup');};

    const owner = new View();
    const child = new View({parentElement, batchUpdates: true, template: () => '<div>child</div>'}).initialize();
    owner.addChild(child);
    owner.releaseChild = () => {throw new Error('owner cleanup');};
    child.requestRender();
    child.delegated.clear = () => {throw new Error('delegated cleanup');};

    assert.throws(() => child.destroy(), error => {
        assert.deepEqual(messages(error), ['frame cleanup', 'owner cleanup', 'delegated cleanup']);
        return true;
    });
    assert.equal(child.element.parentNode, null);
});

test('destroy rethrows a single cleanup failure after resetting reusable state', t => {
    dom(t);
    const parentElement = document.querySelector('main');
    const model = {
        get: () => ({}),
        addEventListener() {},
        removeEventListener() {throw new Error('only failure');}
    };
    const view = new View({parentElement, model, template: () => '<div>root</div>'}).initialize();
    const previous = view.element;

    assert.throws(() => view.destroy(), /only failure/);
    assert.equal(view.modelBindingInitialized, false);
    assert.notEqual(view.element, previous);
    assert.equal(parentElement.contains(previous), false);
    assert.equal(view.delegated.scope, view.element);
});
