'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

(function () {

    'use strict';

    /*
    VIEW
    */

    var View = function () {
        function View() {
            _classCallCheck(this, View);

            this.element = typeof document !== 'undefined' ? document.createElement('div') : {};
        }

        _createClass(View, [{
            key: 'initialize',
            value: function initialize() {

                return this;
            }
        }, {
            key: 'render',
            value: function render() {

                return this;
            }
        }, {
            key: 'addListeners',
            value: function addListeners() {

                return this;
            }
        }]);

        return View;
    }();

    module.exports = View;
})();
