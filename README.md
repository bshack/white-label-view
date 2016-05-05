# white-label-view

[![Build Status](https://travis-ci.org/bshack/white-label-view.svg?branch=master)](https://travis-ci.org/bshack/white-label-view) [![Coverage Status](https://coveralls.io/repos/github/bshack/white-label-view/badge.svg?branch=master)](https://coveralls.io/github/bshack/white-label-view?branch=master)

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

## Event Delegation

The Financial Times event delegation library 'ftdomdelegate' is bundled in the view and accessible with the 'delegate' method.

By default the delegation scope is the view's element scope:

```
const MyView = class extends View {
    constructor() {
        super();
        this.element = document.querySelector('ul');
    }
    addListeners() {
        const groupDelegate = this.delegate();
        groupDelegate.on('click', 'a', function (e) {
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
        const groupDelegate = this.delegate('ul');
        groupDelegate.on('click', 'a', function (e) {
            e.preventDefault();
            console.log('anchor in unordered list clicked');
        });
    }
};

const myView = new MyView();
```

Full delegation documentation here:

https://github.com/ftlabs/ftdomdelegate
