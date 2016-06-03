import delegated from 'gator';

(() => {

    'use strict';

    /*
    VIEW
    */

    const View = class {

        constructor() {

            if (typeof document !== 'undefined') {
                this.element = document.createElement('div');
                this.delegated = this.delegate(this.element);
            } else {
                this.element = {};
                this.delegated = {};
            }

        }

        initialize() {
            return this;
        }
        
        template() {
            return this;
        }

        render() {
            return this;
        }

        addListeners() {
            return this;
        }

        delegate(scope) {
            return delegated(scope || this.element);
        }

        destroy() {
            return this;
        }

        removeListeners() {
            return this;
        }

    };

    module.exports = View;

})();
