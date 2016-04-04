(function (global, factory) {
    if (typeof define === "function" && define.amd) {
        define(['module', 'lodash'], factory);
    } else if (typeof exports !== "undefined") {
        factory(module, require('lodash'));
    } else {
        var mod = {
            exports: {}
        };
        factory(mod, global.lodash);
        global.index = mod.exports;
    }
})(this, function (module, _lodash) {
    'use strict';

    var _lodash2 = _interopRequireDefault(_lodash);

    function _interopRequireDefault(obj) {
        return obj && obj.__esModule ? obj : {
            default: obj
        };
    }

    (function (_) {

        'use strict';

        /*
        VIEW
        */

        var View = function View(options) {

            var self = this;

            // this is called whenever the mediator is instantiated
            self.initialize = function () {};

            //render the view
            self.render = function () {};

            self = _.extend(self, options);

            // run it on instantiation
            self.initialize();

            // now run render on instantiation
            self.render();
        };

        module.exports = View;
    })(_lodash2.default);
});
