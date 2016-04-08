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

    };

    module.exports = View;

})();
