/** @jsxImportSource white-label-view */
import View from 'white-label-view';
import {raw} from 'white-label-view/jsx-runtime';

interface Profile {name: string; count: number}

const template = (profile: Profile) => (
    <section className="profile" data-count={profile.count}>
        <h1>Hello, {profile.name}</h1>
        <div>{raw('<strong>trusted</strong>')}</div>
    </section>
);

const parentElement = document.createElement('main');
const view = new View({parentElement, model: {name: 'Ada', count: 1}, template});
void view;
