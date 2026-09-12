/** @jsxImportSource white-label-view */
import View from 'white-label-view';
import {raw} from 'white-label-view/jsx-runtime';

interface Profile {name: string; count: number}

const template = (data: unknown) => {
    const profile = data as Profile;
    return (
        <section className="profile" data-count={profile.count}>
            <h1>Hello, {profile.name}</h1>
            <div>{raw('<strong>trusted</strong>')}</div>
        </section>
    );
};

const parentElement = document.createElement('main');
const model = {get: () => ({name: 'Ada', count: 1}), on: () => undefined, removeListener: () => undefined};
const view = new View({parentElement, model, template});
void view;
