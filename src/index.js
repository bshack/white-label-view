import delegated from 'gator';

(() => {

    'use strict';

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
            //setup the view
            return this;
        }
        
        template() {
            //holds the clientside template
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
