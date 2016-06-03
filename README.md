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

##Let's look at an example:

import the view module
```
import View from 'white-label-view';
```
create the view
```
const MyView = class extends View {
    initialize() {
        this.addListeners();
    }
    addListeners() {
        window.addEventListener('scroll', (e) => {
            window.console.log('window is scrolling', e);
        }, false);
    }
};
```
instantiate the view
```
const myView = new MyView();
```
initialize the view
```
myView.initialize();
```
