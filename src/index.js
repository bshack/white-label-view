(() => {

    'use strict';

    /*
    VIEW
    */

    let baseView = {
        initialize: () => {},
        //for domless testing
        element: (typeof document !== 'undefined')? document.createElement('div') : {},
        render: () => {}
    };

    const View = function(overrideView) {

        let overrideProp;
        let baseProp;

        //extend he base view with overrides
        for (overrideProp in overrideView) {
            baseView[overrideProp] = overrideView[overrideProp];
        }

        //add view properties to this
        for (baseProp in baseView) {
            this[baseProp] = baseView[baseProp];
        }

        // run it on instantiation
        this.initialize();

        // now run render on instantiation
        this.render();

    };

    module.exports = View;

})();
