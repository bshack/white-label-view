import _ from 'lodash';

((_) => {

    'use strict';

    /*
    VIEW
    */

    const View = function(options) {

        let self = this;

        // this is called whenever the mediator is instantiated
        self.initialize = () => {};

        //render the view
        self.render = () => {};

        self = _.extend(self, options);

        // run it on instantiation
        self.initialize();

        // now run render on instantiation
        self.render();

    };

    module.exports = View;

})(_);
