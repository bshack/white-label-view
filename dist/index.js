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

        var VIEW = function VIEW(modelData) {

            // this is called whenever the mediator is instantiated
            this.initialize = function () {};

            // run it on instantiation
            this.initialize();
        };

        module.exports = VIEW;
    })();
});
