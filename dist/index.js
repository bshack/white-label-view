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

    var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) {
        return typeof obj;
    } : function (obj) {
        return obj && typeof Symbol === "function" && obj.constructor === Symbol ? "symbol" : typeof obj;
    };

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
            function View(settings) {
                _classCallCheck(this, View);

                if (settings && _typeof(settings.parentElement) === 'object') {
                    this.parentElement = settings.parentElement;
                } else {
                    this.parentElement = undefined;
                }

                if (settings && typeof settings.template === 'function') {
                    this.template = settings.template;
                } else {
                    this.template = undefined;
                }

                if (settings && _typeof(settings.model) === 'object') {
                    this.model = settings.model;
                } else {
                    this.model = undefined;
                }

                if (settings && _typeof(settings.element) === 'object') {
                    this.element = settings.element;
                } else {
                    this.element = document.createElement('div');
                }
            }

            _createClass(View, [{
                key: 'initialize',
                value: function initialize() {

                    this.render();

                    return this;
                }
            }, {
                key: 'destroy',
                value: function destroy() {

                    //remove element from dom
                    if (_typeof(this.parentElement) === 'object' && this.parentElement.contains(this.element)) {
                        this.parentElement.removeChild(this.element);
                    }

                    // remove all the events from the dom
                    this.removeListeners();

                    // remove all the events from the model
                    this.destroyTwoWayBinding();

                    // reset object to div
                    this.element = document.createElement('div');

                    return this;
                }
            }, {
                key: 'initializeTwoWayBinding',
                value: function initializeTwoWayBinding() {
                    var _this = this;

                    if (_typeof(this.model) === 'object' && typeof this.model.on === 'function') {
                        this.model.on('change', function () {
                            _this.render();
                        });
                    }
                }
            }, {
                key: 'destroyTwoWayBinding',
                value: function destroyTwoWayBinding() {

                    if (this.model && typeof this.model.removeAllListeners === 'function') {
                        this.model.removeAllListeners('change');
                    }
                }
            }, {
                key: 'addListeners',
                value: function addListeners() {
                    //bind events
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
                    //use gator delegation libary
                    return (0, _gator2.default)(scope || this.element);
                }
            }, {
                key: 'render',
                value: function render() {

                    var newElement = void 0;

                    if (typeof this.template === 'function') {

                        if (this.model && typeof this.model.get === 'function') {
                            newElement = this.template(this.model.get());
                        } else if (_typeof(this.model) === 'object') {
                            newElement = this.template(this.model);
                        } else {
                            newElement = this.template({});
                        }

                        // if the template returns a string make it a dom object
                        if (typeof newElement === 'string') {
                            newElement = new DOMParser().parseFromString(newElement.trim(), 'text/html').body.firstChild.cloneNode(true);
                        }

                        if (_typeof(this.parentElement) === 'object' && (typeof newElement === 'undefined' ? 'undefined' : _typeof(newElement)) === 'object') {

                            //render html changes
                            this.removeListeners();
                            this.destroyTwoWayBinding();

                            if (this.parentElement.contains(this.element)) {

                                var oldDOMElement = this.element;
                                this.element = newElement;
                                this.delegated = this.delegate();
                                this.addListeners();
                                this.initializeTwoWayBinding();
                                this.parentElement.replaceChild(this.element, oldDOMElement);
                            } else {

                                this.element = newElement;
                                this.delegated = this.delegate();
                                this.addListeners();
                                this.initializeTwoWayBinding();
                                this.parentElement.appendChild(this.element);
                            }
                        }
                    }

                    return this;
                }
            }]);

            return View;
        }();

        module.exports = View;
    })();
});
