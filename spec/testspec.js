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
        let self = this;
        this.initFunction = function() {};
        this.renderFunction = function() {};
        this.addListenersFunction = function() {};
        spyOn(this,'initFunction');
        spyOn(this,'renderFunction');
        spyOn(this,'addListenersFunction');
        const ViewTest = class extends View {
            constructor() {
                super();
            }
            something() {
            }
            initialize() {
                self.initFunction();
            }
            render() {
                self.renderFunction();
            }
            addListeners() {
                self.addListenersFunction();
            }
        };
        view = new ViewTest();
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
    it("is has a addListeners function", function() {
        expect(view.addListeners).toEqual(jasmine.any(Function));
    });
    it("is has an element object", function() {
        expect(view.element).toEqual(jasmine.any(Object));
    });
    it("is extendable", function() {
        expect(view.something).toEqual(jasmine.any(Function));
    });
    it("fires initialize function", function() {
        view.initialize();
        expect(this.initFunction).toHaveBeenCalled();
    });
    it("fires render function", function() {
        view.render();
        expect(this.renderFunction).toHaveBeenCalled();
    });
    it("fires addListeners function", function() {
        view.addListeners();
        expect(this.addListenersFunction).toHaveBeenCalled();
    });
});
