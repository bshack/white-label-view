# white-label-view

[![Build Status](https://travis-ci.org/bshack/white-label-view.svg?branch=master)](https://travis-ci.org/bshack/white-label-view) [![Coverage Status](https://coveralls.io/repos/github/bshack/white-label-view/badge.svg?branch=master)](https://coveralls.io/github/bshack/white-label-view?branch=master)

A simple JS view.

Install the node module:

```
npm install white-label-view --save
```

## Require

```
var View = require('white-label-view');
```

## Instantiate

```
var myView = new View();
```

At instantiation you can extend the view for your own needs:

```
var myView = new View({
    someGreatFeature: function(data) {
        console.log('this is great!', data);
    }
});

myView.someGreatFeature({
    foo: 'bar'
});

```

### initialize and render

At instantiation both of these functions will execute if defined, first initialize and then render:

```
var myView = new View({
    initialize: function() {
        console.log('view has initialized');
    },
    render: function() {
        console.log('render my view here');
    }
});
```

### element

At instantiation you can set an element for the view:

```
var myView = new View({
    element: document.querySelector('a')
});
```

If you do not set an element a div element will be created. (memory only, not added to the DOM)
