# white-label-view

[![Build Status](https://travis-ci.org/bshack/white-label-view.svg?branch=master)](https://travis-ci.org/bshack/white-label-view) [![Coverage Status](https://coveralls.io/repos/github/bshack/white-label-view/badge.svg?branch=master)](https://coveralls.io/github/bshack/white-label-view?branch=master)

A simple ES6 JS view.

Learn more about ES6 classes here: https://babeljs.io/docs/learn-es2015/

## Install

Install the node module:

```
npm install white-label-view --save
```

## Import

```
import View from 'white-label-view';
```

## Instantiate

```
var myView = new View();
```

or extend the view class for your own needs:

```
const MyView = class extends View {
    someGreatFeature() {
        console.log('this is great!');
    }
};

const myView = new MyView();

myView.someGreatFeature();
```

## Initialize and Render

At instantiation both of these functions will execute if defined, first initialize and then render:

```
const MyView = class extends View {
    initialize() {
        console.log('view has initialized');
    }
    render() {
        console.log('render my view now');
    }
};

const myView = new MyView();
```

## Element

At instantiation you can set an element for the view:

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
```

If you do not set an element a div element will be created in memory and not added to the DOM.
