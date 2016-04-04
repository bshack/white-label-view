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

        var baseView = {
            initialize: function initialize() {},
            render: function render() {}
        };

        var View = function View(options) {

            var extendedView = _.extend(baseView, options);
            var prop = void 0;

            //end
            for (prop in extendedView) {
                this[prop] = extendedView[prop];
            }

            // run it on instantiation
            this.initialize();

            // now run render on instantiation
            this.render();
        };

        module.exports = View;
    })(_lodash2.default);
});
