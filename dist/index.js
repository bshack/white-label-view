(function (global, factory) {
    if (typeof define === "function" && define.amd) {
        define(['module', 'gator'], factory);
    } else if (typeof exports !== "undefined") {
        factory(module, require('gator'));
    } else {
        var mod = {
            exports: {}
        };
        factory(mod, global.gator);
        global.index = mod.exports;
    }
})(this, function (module, _gator) {
    'use strict';

    var _gator2 = _interopRequireDefault(_gator);

    function _interopRequireDefault(obj) {
        return obj && obj.__esModule ? obj : {
            default: obj
        };
    }

    function _classCallCheck(instance, Constructor) {
        if (!(instance instanceof Constructor)) {
            throw new TypeError("Cannot call a class as a function");
        }
    }

    var _createClass = function () {
        function defineProperties(target, props) {
            for (var i = 0; i < props.length; i++) {
                var descriptor = props[i];
                descriptor.enumerable = descriptor.enumerable || false;
                descriptor.configurable = true;
                if ("value" in descriptor) descriptor.writable = true;
                Object.defineProperty(target, descriptor.key, descriptor);
            }
        }

        return function (Constructor, protoProps, staticProps) {
            if (protoProps) defineProperties(Constructor.prototype, protoProps);
            if (staticProps) defineProperties(Constructor, staticProps);
            return Constructor;
        };
    }();

    (function () {

        'use strict';

        var View = function () {
            function View() {
                _classCallCheck(this, View);

                // to hold your data
                this.model = {};

                // this holds the element for this view
                if (typeof document !== 'undefined') {
                    this.element = document.createElement('div');
                    this.delegated = this.delegate(this.element);
                } else {
                    this.element = {};
                    this.delegated = {};
                }

                // when the view has a parent view element, store it here
                this.parentElement = null;
            }

            _createClass(View, [{
                key: 'initialize',
                value: function initialize() {
                    //setup the view
                    return this;
                }
            }, {
                key: 'template',
                value: function template() {
                    //holds the client side template
                    return this;
                }
            }, {
                key: 'render',
                value: function render() {
                    //render html changes
                    return this;
                }
            }, {
                key: 'addListeners',
                value: function addListeners() {
                    //bind events
                    return this;
                }
            }, {
                key: 'destroy',
                value: function destroy() {
                    //tear down the view
                    return this;
                }
            }, {
                key: 'removeListeners',
                value: function removeListeners() {
                    //unbind events
                    return this;
                }
            }, {
                key: 'delegate',
                value: function delegate(scope) {
                    return (0, _gator2.default)(scope || this.element);
                }
            }]);

            return View;
        }();

        module.exports = View;
    })();
});
