import delegated from 'gator';

(() => {

    'use strict';

    const View = class {

        constructor(settings) {

            // to hold your data
            if (settings && settings.model) {
                this.model = settings.model;
            } else {
                this.model = {};
            }

            // to hold your view
            if (settings && settings.element) {
                this.element = settings.element;
            } else {
                this.element = document.createElement('div');
            }
            this.delegated = this.delegate(this.element);

            // to hold your parent container
            if (settings && settings.parentElement) {
                this.parentElement = settings.parentElement;
            } else {
                this.parentElement = null;
            }

        }

        initialize() {
            //setup the view
            return this;
        }

        template() {
            //holds the client side template
            return this;
        }

        render() {
            //render html changes
            return this;
        }

        addListeners() {
            //bind events
            return this;
        }

        destroy() {
            //tear down the view
            return this;
        }

        removeListeners() {
            //unbind events
            return this;
        }

        delegate(scope) {
            return delegated(scope || this.element);
        }

    };

    module.exports = View;

})();
