import View from '../dist/index.js';
const settings: View.Settings = {parentElement: document.body, template: () => '<p>Hello</p>'};
const view = new View(settings);
view.initialize().destroy();
