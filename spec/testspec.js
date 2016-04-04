'use strict';

const View = require('../dist/index');
let view = {};

// canary
describe("A suite", function() {
    it("contains spec with an expectation", function() {
        expect(true).toBe(true);
    });
});

describe("A View", function() {
    beforeEach(function() {
        view = new View({
            initialize: function() {
                console.log('initialized');
            }
        });
    });
    afterEach(function() {
        view = {};
    });
    it("is an object", function() {
        expect(view).toEqual(jasmine.any(Object));
    });
    it("is has an initialize function", function() {
        expect(view.initialize).toEqual(jasmine.any(Function));
    });
    it("is has a render function", function() {
        expect(view.render).toEqual(jasmine.any(Function));
    });
});
