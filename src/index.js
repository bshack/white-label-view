import delegated from 'gator';

(() => {

    'use strict';

    const View = class {

        constructor() {

            // to hold your data
            this.model = {};

            // this holds the element for this view
            if (typeof document !== 'undefined') {
                this.element = document.createElement('div');
                this.delegated = this.delegate(this.element);
            } else {
                this.element = {};
                this.delegated = {};
            }

            // when the view has a parent view element, store it here
            this.parentElement = null;

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
