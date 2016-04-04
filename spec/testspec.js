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
        view = new View();
    });
    afterEach(function() {
        view = {};
    });
    it("is an object", function() {
        expect(view).toEqual(jasmine.any(Object));
    });
});
