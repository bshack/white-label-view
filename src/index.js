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

        //extend base view
        for (overrideProp in overrideView) {
            baseView[overrideProp] = overrideView[overrideProp];
        }

        //extend view
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
