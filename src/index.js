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
            
            this.script = false;
            this.style = false;

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
        
        loadScripts() {
            if (this.script === false) {
                return this;
            }
            const newScript = document.createElement('script');
            const firstScript = document.getElementsByTagName('script')[0];
            newScript.src = this.script;
            firstScript.parentNode.insertBefore(newScript, firstScript);
        }
        
        loadStyles() {
            if (this.style === false) {
                return this;
            }
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
