(function (global, factory) {
  if (typeof define === "function" && define.amd) {
    define(["gator"], factory);
  } else if (typeof exports !== "undefined") {
    factory(require("gator"));
  } else {
    var mod = {
      exports: {}
    };
    factory(global.gator);
    global.index = mod.exports;
  }
})(typeof globalThis !== "undefined" ? globalThis : typeof self !== "undefined" ? self : this, function (_gator) {
  "use strict";

  _gator = _interopRequireDefault(_gator);
  function _interopRequireDefault(e) { return e && e.__esModule ? e : { "default": e }; }
  function _typeof(o) { "@babel/helpers - typeof"; return _typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function (o) { return typeof o; } : function (o) { return o && "function" == typeof Symbol && o.constructor === Symbol && o !== Symbol.prototype ? "symbol" : typeof o; }, _typeof(o); }
  function _classCallCheck(a, n) { if (!(a instanceof n)) throw new TypeError("Cannot call a class as a function"); }
  function _defineProperties(e, r) { for (var t = 0; t < r.length; t++) { var o = r[t]; o.enumerable = o.enumerable || !1, o.configurable = !0, "value" in o && (o.writable = !0), Object.defineProperty(e, _toPropertyKey(o.key), o); } }
  function _createClass(e, r, t) { return r && _defineProperties(e.prototype, r), t && _defineProperties(e, t), Object.defineProperty(e, "prototype", { writable: !1 }), e; }
  function _toPropertyKey(t) { var i = _toPrimitive(t, "string"); return "symbol" == _typeof(i) ? i : i + ""; }
  function _toPrimitive(t, r) { if ("object" != _typeof(t) || !t) return t; var e = t[Symbol.toPrimitive]; if (void 0 !== e) { var i = e.call(t, r || "default"); if ("object" != _typeof(i)) return i; throw new TypeError("@@toPrimitive must return a primitive value."); } return ("string" === r ? String : Number)(t); }
  (function () {
    'use strict';

    var View = /*#__PURE__*/function () {
      function View(settings) {
        var _this = this;
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

        // Keep a stable callback so this view can remove only its own model listener.
        this.modelChangeHandler = function () {
          return _this.render();
        };
        this.renderedTemplate = undefined;
        this.delegated = this.delegate(this.element);
      }
      return _createClass(View, [{
        key: "initialize",
        value: function initialize() {
          this.render();
          return this;
        }
      }, {
        key: "destroy",
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
          this.renderedTemplate = undefined;
          return this;
        }
      }, {
        key: "initializeTwoWayBinding",
        value: function initializeTwoWayBinding() {
          if (_typeof(this.model) === 'object' && typeof this.model.on === 'function') {
            this.model.on('change', this.modelChangeHandler);
          }
        }
      }, {
        key: "destroyTwoWayBinding",
        value: function destroyTwoWayBinding() {
          if (this.model && typeof this.model.removeListener === 'function') {
            this.model.removeListener('change', this.modelChangeHandler);
          }
        }
      }, {
        key: "addListeners",
        value: function addListeners() {
          //bind events
          return this;
        }
      }, {
        key: "removeListeners",
        value: function removeListeners() {
          //unbind events
          return this;
        }
      }, {
        key: "delegate",
        value: function delegate(scope) {
          //use gator delegation libary
          return (0, _gator["default"])(scope || this.element);
        }
      }, {
        key: "render",
        value: function render() {
          var newElement;
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
              if (newElement === this.renderedTemplate && _typeof(this.parentElement) === 'object' && this.parentElement.contains(this.element)) {
                return this;
              }
              this.renderedTemplate = newElement;
              newElement = new DOMParser().parseFromString(newElement.trim(), 'text/html').body.firstChild.cloneNode(true);
            } else {
              this.renderedTemplate = undefined;
            }
            if (_typeof(this.parentElement) === 'object' && _typeof(newElement) === 'object') {
              if (this.parentElement.contains(this.element) && typeof this.element.isEqualNode === 'function' && this.element.isEqualNode(newElement)) {
                return this;
              }

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
    }();
    module.exports = View;
  })();
});
