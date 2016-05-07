import Gator from 'gator';

(() => {

    'use strict';

    /*
    VIEW
    */

    const View = class {

        constructor() {

            this.element = (typeof document !== 'undefined')? document.createElement('div') : {};

        }

        initialize() {

            return this;

        }

        render() {

            return this;

        }

        addListeners() {

            return this;

        }

        delegate(scope) {

            return new Gator(scope || this.element);

        }

    };

    module.exports = View;

})();
