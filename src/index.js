import delegated from 'gator';

(() => {

    'use strict';

    const View = class {

        constructor(settings) {

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

        }

        initialize() {

            this.render();

            return this;

        }

        destroy() {

            //remove element from dom
            if (typeof this.parentElement === 'object' && this.parentElement.contains(this.element)) {
                this.parentElement.removeChild(this.element)
            }

            // remove all the events from the dom
            this.removeListeners();

            // remove all the events from the model
            this.destroyTwoWayBinding();

            // reset object to div
            this.element = document.createElement('div');

            return this;

        }

        initializeTwoWayBinding() {

            if (typeof this.model === 'object' && typeof this.model.on === 'function') {
                this.model.on('change', () => {
                    this.render();
                });
            }

        }

        destroyTwoWayBinding() {

            if (this.model && typeof this.model.removeAllListeners === 'function') {
                this.model.removeAllListeners('change');
            }

        }

        addListeners() {
            //bind events
            return this;
        }

        removeListeners() {
            //unbind events
            return this;
        }

        delegate(scope) {
            //use gator delegation libary
            return delegated(scope || this.element);

        }

        render() {

            let newElement;

            if (typeof this.template === 'function') {

                if (this.model && typeof this.model.get === 'function') {
                    newElement = this.template(this.model.get());
                } else if (typeof this.model === 'object') {
                    newElement = this.template(this.model);
                } else {
                    newElement = this.template({});
                }

                // if the template returns a string make it a dom object
                if (typeof newElement === 'string') {
                    newElement = new DOMParser().parseFromString(newElement.trim(), 'text/html')
                        .body.firstChild.cloneNode(true);
                }

                if (typeof this.parentElement === 'object' && typeof newElement === 'object') {

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

    module.exports = View;

})();
