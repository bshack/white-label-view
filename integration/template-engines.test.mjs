import assert from 'node:assert/strict';
import test from 'node:test';
import ejs from 'ejs';
import {Eta} from 'eta';
import Handlebars from 'handlebars';
import {JSDOM} from 'jsdom';
import Mustache from 'mustache';
import nunjucks from 'nunjucks';
import pug from 'pug';
import View from 'white-label-view';
import ServerView from 'white-label-view/server';

const eta = new Eta();
const nunjucksEnvironment = new nunjucks.Environment(null, {autoescape: true});
const model = {name: '<Ada & Grace>'};

const renderers = [
    ['Handlebars', Handlebars.compile('<section><h1>Hello {{name}}</h1></section>')],
    ['Eta', data => eta.renderString('<section><h1>Hello <%= it.name %></h1></section>', data)],
    ['EJS', data => ejs.render('<section><h1>Hello <%= name %></h1></section>', data)],
    ['Mustache', data => Mustache.render('<section><h1>Hello {{name}}</h1></section>', data)],
    ['Nunjucks', data => nunjucksEnvironment.renderString('<section><h1>Hello {{ name }}</h1></section>', data)],
    ['Pug', data => pug.render('section\n  h1 Hello #{name}', data)]
];

for (const [name, render] of renderers) {
    test(`${name} renders through browser View`, () => {
        const dom = new JSDOM('<main></main>');
        const parentElement = dom.window.document.querySelector('main');
        const view = new View({parentElement, model, template: render}).initialize();

        assert.equal(parentElement.children.length, 1);
        assert.equal(parentElement.firstElementChild?.tagName, 'SECTION');
        assert.equal(parentElement.querySelector('h1')?.textContent, 'Hello <Ada & Grace>');
        view.destroy();
    });

    test(`${name} renders through server View`, () => {
        const view = new ServerView({model, template: render}).initialize();
        const html = view.toString();

        assert.match(html, /^<section><h1>Hello /);
        assert.match(html, /&lt;Ada/);
        assert.doesNotMatch(html, /<Ada/);
        view.destroy();
    });
}
