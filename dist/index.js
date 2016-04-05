(function (global, factory) {
    if (typeof define === "function" && define.amd) {
        define(['module'], factory);
    } else if (typeof exports !== "undefined") {
        factory(module);
    } else {
        var mod = {
            exports: {}
        };
        factory(mod);
        global.index = mod.exports;
    }
})(this, function (module) {
    'use strict';

    (function () {

        'use strict';

        /*
        VIEW
        */

        var baseView = {
            initialize: function initialize() {},
            //for domless testing
            element: typeof document !== 'undefined' ? document.createElement('div') : {},
            render: function render() {}
        };

        var View = function View(overrideView) {

            var overrideProp = void 0;
            var baseProp = void 0;

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
});
