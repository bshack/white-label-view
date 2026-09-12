import ServerView = require('white-label-view/server');

const model = {
    get: () => ({name: 'Ada'}),
    on: (_event: string, _callback: () => void) => undefined,
    removeListener: (_event: string, _callback: () => void) => undefined
};

const view = new ServerView({
    model,
    template: data => `<h1>${String((data as {name: string}).name)}</h1>`
});

view.initialize().render().destroy();
view.setModel(model);
const output: string = view.toString();
void output;
