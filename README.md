# white-label-view

[![Build Status](https://travis-ci.org/bshack/white-label-view.svg?branch=master)](https://travis-ci.org/bshack/white-label-view)

A simple ES6 JS view.

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

this example's filename: ./view/default.js

This is the simplelist example of creating a view with two what binding automaticly enabled.

```
import View from 'white-label-view';
import myModel from '../model/global'; // this is a white-label-model in this instance that emits a 'change' event
import myTemplate from '../template/element/a'; // precompiled handlebars template: function(data)....

(() => {
    'use strict';
    module.exports = class extends View {
        constructor() {
            super();
            this.parentElement = document.querySelector('body');
            this.model = myModel;
            this.template = myTemplate;
        }
        addListeners() {
           this.delegated.on('click', 'a', function (e) {
               e.preventDefault();
               console.log('anchor clicked');
            });
        }
        removeListners() {
             this.delegated.off('click', 'a');
        }
    };
})();

```

## Instantiate and Initialize

```
import ViewDefault from './view/default';

const viewDefault = new ViewDefault();

viewDefault.initialize();
```

## Basic Structure

This view provides a basic structure to extend off of to promote consistancy through out the application. In general is it is a good idea to follow this structure when possible. NOTE: redefining these methods may destroy any default functionality of the view which you would have do manually if you wish to restore.

```
const MyView = class extends View {
    initialize() {
        //setup the view
        return this;
    }
    destroy() {
        //tear down the view
        return this;
    }
    addListeners() {
        //bind events
        return this;
    }
    removeListeners() {
        //unbind events
        return this;
    }
    render() {
        //render html changes
        return this;
    }
};
```

### this.parentElement, this.model & this.template

At instantiation you can set the parentElement, model and template to be used by the view. When you do it this way two way binding is automaticly setup. Two way binding requires all three of these be defined to work.

## Event Delegation

The Gator event delegation library is bundled in the view and accessible with the 'delegate' method.

By default the delegation scope is the view:

```
const MyView = class extends View {
    constructor() {
        super();
        this.element = document.querySelector('ul');
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
        let groupDelegate = this.delegate(this.element.querySelector('ul'));
        groupDelegate.on('click', 'a', function (e) {
            e.preventDefault();
            console.log('anchor in unordered list clicked');
        });
    }
};
```

full delegation documentation here:

https://craig.is/riding/gators

## Manually Toggling Two Way Binding On and Off

When you define a model, parentElement and template in the constructor two way binding will automaticly be enabled. To manually enable or disable two way binding as needed you can call these:

```
myView.initializeTwoWayBinding();
```

```
myView.destroyTwoWayBinding();
```
