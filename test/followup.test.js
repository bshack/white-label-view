'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const {JSDOM} = require('jsdom');
const {EventEmitter} = require('node:events');
const View = require('../dist');
function setup(t, html = '<main></main>') {
    const window = new JSDOM(html).window;
    global.document = window.document; global.DOMParser = window.DOMParser;
    t.after(() => {window.close();delete global.document;delete global.DOMParser;});
    return {window, parent:document.querySelector('main')};
}
function observable(value) {return Object.assign(new EventEmitter(),{value,get(){return {value:this.value};}});}
function frames(window) {
    const queued=new Map();let id=0;
    window.requestAnimationFrame=callback=>{queued.set(++id,callback);return id;};
    window.cancelAnimationFrame=id=>queued.delete(id);
    return {queued,flush(){const pending=[...queued.values()];queued.clear();pending.forEach(callback=>callback(0));}};
}

test('adopts equal and template-free existing markup with listeners, binding and post-mount hook once', t => {
    const {parent,window}=setup(t,'<main><button>ready</button></main>');
    const model=observable('ready');const events=[];let clicks=0;
    class Button extends View {
        addListeners(){assert.ok(parent.contains(this.element));events.push('listeners');this.delegated.on('click','button',()=>clicks++);return this;}
        afterMount(){assert.ok(parent.contains(this.element));events.push('mounted');this.element.focus();return this;}
    }
    const root=parent.firstChild;
    const view=new Button({parentElement:parent,element:root,model,template:()=>'<button>ready</button>'}).initialize();
    view.render();view.initialize();
    root.dispatchEvent(new window.MouseEvent('click'));
    assert.equal(clicks,1);assert.equal(document.activeElement,root);
    assert.equal(model.listenerCount('change'),1);assert.deepEqual(events,['listeners','mounted']);
    view.destroy();assert.equal(model.listenerCount('change'),0);
    parent.innerHTML='<button>existing</button>';
    const adopted=new Button({parentElement:parent,element:parent.firstChild,model}).initialize();
    assert.equal(model.listenerCount('change'),1);adopted.destroy();
    assert.deepEqual(events,['listeners','mounted','listeners','mounted']);
});

test('prototype update hooks survive construction and explicit settings can override them', t => {
    const {parent}=setup(t);let updates=0;
    class Custom extends View {update(element,data){updates++;element.textContent=data.value;return true;}}
    const model=observable('first');
    const view=new Custom({parentElement:parent,model,template:()=>'<p>initial</p>'}).initialize();
    const root=view.element;model.value='next';model.emit('change');
    assert.equal(updates,1);assert.equal(view.element,root);assert.equal(root.textContent,'next');view.destroy();
    const explicit=new Custom({parentElement:parent,template:()=>'<p>fallback</p>',update:()=>false}).initialize();
    explicit.render();assert.equal(updates,1);explicit.destroy();
});

test('model assignment moves subscriptions and setModel renders immediately without leaking old emitters', t => {
    const {parent}=setup(t);const old=observable('old'),next=observable('new');let renders=0;
    const view=new View({parentElement:parent,model:old,template:data=>{renders++;return `<p>${data.value}</p>`;}}).initialize();
    view.model=next;
    assert.equal(old.listenerCount('change'),0);assert.equal(next.listenerCount('change'),1);
    old.emit('change');assert.equal(renders,1);
    next.emit('change');assert.equal(parent.textContent,'new');
    view.model=next;assert.equal(next.listenerCount('change'),1);
    view.setModel(old);assert.equal(parent.textContent,'old');assert.equal(next.listenerCount('change'),0);
    view.setModel();assert.equal(old.listenerCount('change'),0);
    view.setModel({value:'plain'});assert.equal(parent.textContent,'plain');
    view.destroy();
    let registrations=0;
    const incomplete=new View({model:{on(){registrations++;}}});incomplete.initializeTwoWayBinding();
    incomplete.model={removeListener(){}};incomplete.initializeTwoWayBinding();
    assert.equal(registrations,0);incomplete.destroy();
});

test('nested roots replace and destroy in their actual parent', t => {
    const {parent}=setup(t,'<main><section><button>old</button></section></main>');
    const nested=parent.firstChild;
    const view=new View({parentElement:parent,element:nested.firstChild,template:()=>'<button>new</button>'}).initialize();
    assert.equal(nested.firstChild,view.element);assert.equal(nested.textContent,'new');
    view.destroy();assert.equal(nested.childNodes.length,0);assert.equal(parent.firstChild,nested);
    view.initialize();assert.equal(parent.lastChild,view.element);view.destroy();
});

test('invalid roots fail repeatedly without poisoning the successful render cache', t => {
    const {parent}=setup(t);const view=new View({parentElement:parent,template:()=>'<p>good</p>'}).initialize();
    const root=view.element;
    for(const result of ['', 'text', '<!--comment-->', '<p>one</p><p>two</p>', '<p>one</p>tail', null, document.createDocumentFragment(), document.createTextNode('text')]) {
        view.template=()=>result;
        for(let i=0;i<2;i++) assert.throws(()=>view.render(),/exactly one root/);
        assert.equal(view.element,root);assert.equal(parent.textContent,'good');
    }
    view.template=()=>'<p>recovered</p>';view.render();assert.equal(parent.textContent,'recovered');view.destroy();
});

test('batching coalesces model events, uses current data and cancels on manual render, model switch or destruction', t => {
    const {parent,window}=setup(t);const frame=frames(window);const model=observable(0);let renders=0;
    const view=new View({parentElement:parent,model,batchUpdates:true,template:data=>{renders++;return `<p>${data.value}</p>`;}}).initialize();
    for(let i=1;i<=100;i++){model.value=i;model.emit('change');}
    assert.equal(renders,1);assert.equal(frame.queued.size,1);frame.flush();
    assert.equal(renders,2);assert.equal(parent.textContent,'100');
    model.emit('change');view.render();assert.equal(frame.queued.size,0);assert.equal(renders,3);
    model.emit('change');view.model=observable('new');assert.equal(frame.queued.size,0);
    view.model.emit('change');view.destroy();frame.flush();assert.equal(renders,3);assert.equal(parent.childNodes.length,0);
    view.initialize();view.requestRender();view.destroyTwoWayBinding();assert.equal(frame.queued.size,0);view.destroy();
});

test('synchronous rendering remains default and batching falls back without an animation-frame API', t => {
    const {parent}=setup(t);const model=observable(0);let renders=0;
    const view=new View({parentElement:parent,model,template:data=>{renders++;return `<p>${data.value}</p>`;}}).initialize();
    model.value=1;model.emit('change');assert.equal(parent.textContent,'1');assert.equal(renders,2);
    view.batchUpdates=true;model.value=2;model.emit('change');assert.equal(parent.textContent,'2');view.destroy();
    const detached=Object.create(View.prototype);detached.element=document;detached.batchUpdates=true;detached.render=()=>detached;
    assert.equal(detached.requestRender(),detached);
});

test('delegated capture handles focus and removal distinguishes capture registrations', t => {
    const {parent,window}=setup(t,'<main><input><button></button></main>');
    const events=new View().delegate(parent);let count=0;
    function listener(){count++;}
    events.on('focus','input',listener,true);
    parent.querySelector('input').dispatchEvent(new window.FocusEvent('focus',{bubbles:false}));
    assert.equal(count,1);
    events.on('click','button',listener,{capture:true}).on('click','button',listener);
    events.off('click','button',listener,{capture:false});
    parent.querySelector('button').dispatchEvent(new window.MouseEvent('click',{bubbles:true}));assert.equal(count,2);
    events.off('click','button',listener,false);assert.equal(events.listeners.length,2);
    events.off('click','button',listener,true);assert.equal(events.listeners.length,1);
    events.off('focus','input',listener,{capture:true});assert.equal(events.listeners.length,0);
    parent.querySelector('input').dispatchEvent(new window.FocusEvent('focus'));assert.equal(count,2);
});

test('passive listeners cannot cancel events and non-passive listeners can', t => {
    const {parent,window}=setup(t,'<main><button></button></main>');const events=new View().delegate(parent);
    const button=parent.firstChild;const cancel=event=>event.preventDefault();
    events.on('wheel','button',cancel,{passive:true});
    const passive=new window.WheelEvent('wheel',{bubbles:true,cancelable:true});button.dispatchEvent(passive);
    assert.equal(passive.defaultPrevented,false);events.clear();
    events.on('wheel','button',cancel,{passive:false});
    const active=new window.WheelEvent('wheel',{bubbles:true,cancelable:true});button.dispatchEvent(active);
    assert.equal(active.defaultPrevented,true);events.clear();
});

test('signals clean registry references, aborted signals skip registration and once counts matching events only', t => {
    const {parent,window}=setup(t,'<main><button></button><span></span></main>');
    const events=new View().delegate(parent);const controller=new window.AbortController();let calls=0;
    let abortListeners=0;const signal=controller.signal;
    const add=signal.addEventListener.bind(signal),remove=signal.removeEventListener.bind(signal);
    signal.addEventListener=(...args)=>{abortListeners++;return add(...args);};
    signal.removeEventListener=(...args)=>{abortListeners--;return remove(...args);};
    const click=()=>parent.firstChild.dispatchEvent(new window.MouseEvent('click',{bubbles:true}));
    events.on('click','button',()=>calls++,{signal});click();assert.equal(calls,1);
    controller.abort();assert.equal(events.listeners.length,0);assert.equal(abortListeners,0);click();assert.equal(calls,1);
    events.on('click','button',()=>calls++,{signal});assert.equal(events.listeners.length,0);
    const another=new window.AbortController();
    events.on('click','button',()=>calls++,{signal:another.signal});events.clear();another.abort();click();assert.equal(calls,1);
    const opts={once:true};
    events.on('click','button',()=>{calls++;click();},opts);opts.once=false;
    parent.lastChild.dispatchEvent(new window.MouseEvent('click',{bubbles:true}));assert.equal(events.listeners.length,1);
    click();assert.equal(calls,2);assert.equal(events.listeners.length,0);
});

test('owned children are cleaned on replacement and destruction; ownership release and cycles are explicit', t => {
    const {parent}=setup(t);let label='first';
    const owner=new View({parentElement:parent,template:()=>`<section>${label}</section>`}).initialize();
    const model=observable('child');
    const child=new View({parentElement:owner.element,model,template:()=>'<p>child</p>'}).initialize();
    owner.addChild(child).addChild(child);assert.equal(model.listenerCount('change'),1);
    assert.throws(()=>owner.addChild(owner),/cycles/);assert.throws(()=>child.addChild(owner),/cycles/);
    const other=new View();assert.throws(()=>other.addChild(child),/already has an owner/);
    owner.render();assert.equal(model.listenerCount('change'),1);
    label='second';owner.render();assert.equal(model.listenerCount('change'),0);assert.equal(parent.textContent,'second');
    const released=new View({model});released.initializeTwoWayBinding();owner.addChild(released).releaseChild(released).releaseChild(released);
    owner.destroy();assert.equal(model.listenerCount('change'),1);released.destroy();
    const direct=new View();other.addChild(direct);direct.destroy();other.destroy();
});

test('cleanup continues after a child or subclass hook fails', t => {
    const {parent,window}=setup(t);const model=observable('parent');const owner=new View({parentElement:parent,model,template:()=>'<section></section>'}).initialize();
    let cleaned=0;
    class Bad extends View {destroy(){super.destroy();throw Error('child failure');}}
    class Good extends View {destroy(){cleaned++;return super.destroy();}}
    owner.addChild(new Bad()).addChild(new Good());
    assert.throws(()=>owner.destroy(),/Unable to destroy child/);assert.equal(cleaned,1);assert.equal(model.listenerCount('change'),0);assert.equal(parent.childNodes.length,0);
    let fail=false,calls=0;
    class Hook extends View {removeListeners(){if(fail)throw Error('hook failure');return this;}}
    const hooked=new Hook({parentElement:parent,model,template:()=>'<button></button>'}).initialize();const root=hooked.element;
    hooked.delegated.on('click','button',()=>calls++);fail=true;
    assert.throws(()=>hooked.destroy(),/hook failure/);root.dispatchEvent(new window.MouseEvent('click'));
    assert.equal(calls,0);assert.equal(model.listenerCount('change'),0);assert.equal(parent.childNodes.length,0);
});
