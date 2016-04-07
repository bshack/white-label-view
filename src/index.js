(() => {

    'use strict';

    /*
    VIEW
    */

    const View = class {

        constructor() {

            this.element = (typeof document !== 'undefined')? document.createElement('div') : {};
            this.initialize();
            this.render();

        }

        initialize() {

            return this;

        }

        render() {

            return this;

        }
        
    };

    module.exports = View;

})();
