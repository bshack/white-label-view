import _ from 'lodash';

((_) => {

    'use strict';

    /*
    VIEW
    */

    const baseView = {
        initialize: () => {},
        render: () => {}
    };

    const View = function(options) {

        const extendedView = _.extend(baseView, options);
        let prop;

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

})(_);
