# white-label-view

[![Build Status](https://travis-ci.org/bshack/white-label-view.svg?branch=master)](https://travis-ci.org/bshack/white-label-view)

A simple ES6 JS view.

Learn more about ES6 classes here:

https://babeljs.io/docs/learn-es2015/

## Install

Install the node module:

```
npm install white-label-view --save
```

## Import

```
import View from 'white-label-view';
```

## Extend

```
const MyView = class extends View {
    someGreatFeature() {
        console.log('this is great!');
    }
};
```

## Instantiate

```
const myView = new MyView();

myView.someGreatFeature();
```

## Basic Structure

This view provides a basic structure to build off of to promote consistancy through out the application. In general is it is a good idea to follow this structure when possible.
```
const MyView = class extends View {
    initialize() {
        //setup the view
        return this;
    }
    template() {
        //holds the client side template
        return this;
    }
    render() {
        //render html changes
        return this;
    }
    addListeners() {
        //bind events
        return this;
    }
    destroy() {
        //tear down the view
        return this;
    }
    removeListeners() {
        //unbind events
        return this;
    }
};
```

### Element

At instantiation you can set an element scope for the view:

```
const MyView = class extends View {
    constructor() {
        super();
        this.element = document.querySelector('a');
    }
    render() {
        console.log('render my view now');
    }
};

const myView = new MyView();

myView.render();
```

### Parent Element

At instantiation you can set the reference of the view's parent view element scope:

```
const MyView = class extends View {
    constructor(parentElementContainer) {
        super();
        this.parentElement = parentElementContainer;
    }
    render() {
        console.log('render my view now');
    }
};

const myView = new MyView();

myView.render();
```

If you do not set an element a div element will be created in memory and not added to the DOM.

## Event Delegation

The Gator event delegation library is bundled in the view and accessible with the 'delegate' method.

By default the delegation scope is the view's element scope:

```
const MyView = class extends View {
    constructor() {
        super();
        this.element = document.querySelector('ul');
        this.delegated = this.delegate();
    }
    addListeners() {
         this.delegated.on('click', 'a', function (e) {
            e.preventDefault();
            console.log('anchor in unordered list clicked');
        });
    }
};

const myView = new MyView();
```

you can also set your own custom scope:

```
const MyView = class extends View {
    addListeners() {
        const groupDelegate = this.delegate(document.querySelector('ul'));
        groupDelegate.on('click', 'a', function (e) {
            e.preventDefault();
            console.log('anchor in unordered list clicked');
        });
    }
};

const myView = new MyView();
```

full delegation documentation here:

https://craig.is/riding/gators

### Model

At instantiation you can save your data for the view in the model object:

```
const MyView = class extends View {
    constructor() {
        super();
        this.model = {
            foo: 'bar'
        };
    }
    render() {
        console.log('render my view now');
    }
};

const myView = new MyView();

myView.render();
```
