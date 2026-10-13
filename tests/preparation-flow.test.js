import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const source=readFileSync(new URL('../main.js',import.meta.url),'utf8');
const locks=source.slice(source.indexOf('function lockPreparation('),source.indexOf('async function warmCurrentScene('));
const entry=source.slice(source.indexOf('async function prepareStart('),source.indexOf('await prepareLobby();'));
const deferred=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return{promise,resolve,reject};};
function fixture(){
 const nodes={'#menu':{inert:false},'#start':{disabled:false},'#dialog':{close(){}},'#touch':{hidden:false}},events=[],gate=deferred(),reached=deferred();
 const context=vm.createContext({preparing:false,state:'menu',last:0,surfaceReady:Promise.resolve(),document:{hidden:false},performance:{now:()=>123},
  $:id=>nodes[id],keys:{clear(){}},releaseStick(){},clearAttack(){},unlockAudio(){events.push('audio');},restorePauseControls(){},
  sound:{stopWeapons(){},stopCreatures(){}},renderBudget:{reset(){events.push('reset');}},console:{error(){}},
  yieldPreparation:async()=>{},build(){events.push('build');},warmCurrentScene(...args){events.push(['warm',...args]);reached.resolve();return gate.promise;},
  start(prepared){events.push(['start',prepared]);context.state='playing';},pause(){events.push('pause');context.state='paused';},requestMouseLook(){events.push('mouse');},
  loadingScreen:{show(){events.push('show');},hide(){events.push('hide');},setLoadingProgress(){},fail(message,retry){context.retry=retry;events.push('fail');}}
 });
 vm.runInContext(locks+entry,context);return{context,nodes,events,gate,reached,start:()=>vm.runInContext('prepareStart()',context)};
}

test('real entry locks input and holds loading until preparation completes; repeated start cannot build twice',async()=>{
 const f=fixture(),pending=f.start();assert.equal(f.context.state,'loading');assert(f.context.preparing);assert(f.nodes['#menu'].inert&&f.nodes['#start'].disabled);assert.equal(f.events.filter(x=>x==='build').length,0);
 await f.reached.promise;await f.start();assert.equal(f.events.filter(x=>x==='build').length,1);assert.equal(f.events.filter(x=>Array.isArray(x)&&x[0]==='warm').length,1);assert(!f.events.some(x=>Array.isArray(x)&&x[0]==='start'));
 f.gate.resolve();await pending;assert.equal(f.context.state,'playing');assert.deepEqual(f.events.find(x=>Array.isArray(x)&&x[0]==='start'),['start',true]);assert(!f.context.preparing&&!f.nodes['#menu'].inert&&!f.nodes['#start'].disabled);assert.equal(f.context.last,123);assert(f.events.includes('hide'));
});

test('entry finishing in a hidden tab pauses instead of playing unseen or locking the pointer',async()=>{
 const f=fixture();f.context.document.hidden=true;const pending=f.start();await f.reached.promise;f.gate.resolve();await pending;
 assert.equal(f.context.state,'paused');assert(f.events.includes('pause'));assert(!f.events.includes('mouse'));assert(!f.context.preparing);
});

test('failed entry remains safe to retry and a successful retry releases all loading input locks',async()=>{
 const f=fixture(),pending=f.start();await f.reached.promise;f.gate.reject(Error('shader upload'));await pending;
 assert.equal(f.context.state,'loading');assert(f.context.preparing&&f.nodes['#menu'].inert&&f.nodes['#start'].disabled);assert.equal(typeof f.context.retry,'function');assert(!f.events.some(x=>Array.isArray(x)&&x[0]==='start'));
 f.context.warmCurrentScene=async()=>{};await f.context.retry();assert.equal(f.context.state,'playing');assert(!f.context.preparing&&!f.nodes['#menu'].inert&&!f.nodes['#start'].disabled);assert.equal(f.events.filter(x=>x==='build').length,2);
});

test('the actual animation entry advances neither simulation nor scenery during preparation',()=>{
 const frame=source.slice(source.indexOf('function frame(now){'),source.indexOf('// Hidden tabs perform no rendering;',source.indexOf('function frame(now){')))+'time++;sceneryTime++;}';
 const context=vm.createContext({preparing:true,last:0,time:6,sceneryTime:13,scheduled:0,requestAnimationFrame(){context.scheduled++;}});vm.runInContext(frame,context);
 for(let i=1;i<=30;i++)vm.runInContext(`frame(${i*16})`,context);
 assert.equal(context.time,6);assert.equal(context.sceneryTime,13);assert.equal(context.last,480);assert.equal(context.scheduled,30);
 context.preparing=false;vm.runInContext('frame(496)',context);assert.equal(context.time,7);
});

test('real warmCurrentScene draws both views and always removes samples/restores camera and target',async()=>{
 const warm=source.slice(source.indexOf('async function warmCurrentScene('),source.indexOf('async function prepareLobby('));
 for(const fail of [false,true]){
  const events=[],originalTarget={},scene={fog:{color:{}}},camera={},context=vm.createContext({scene,camera,vfx:{},mapId:'forest',player:{},yieldPreparation:async()=>{},renderBudget:{quality:1},
   sceneryTime:4,world:{},localBiome:()=> 'forest',hemisphere:{color:{}},sun:{color:{},intensity:3.25},environmentLighting:{direction:{},day:1},atmosphere:{update(time,camera,options){assert.equal(time,4);assert.equal(options.visible,true);events.push('sky');}},
   renderer:{getRenderTarget:()=>originalTarget,setRenderTarget:target=>events.push(['target',target]),shadowMap:{}},
   adventureCamera:{mode:'first',yaw:.5,pitch:0,setMode(mode){this.mode=mode;events.push(['mode',mode]);}},firstPerson:{update(time,dt,options){events.push(['fp',options.visible]);}},updateCamera(){},renderWorld(){},
   cinema:{enabled:true,sceneTarget:{},render(){events.push(['draw',context.adventureCamera.mode]);}},loadingScreen:{setLoadingProgress(){}},
   prepareCombatSamples:async()=>{events.push('samples');return()=>events.push('cleanup');},warmScene:async options=>{options.render(0);if(fail)throw Error('gpu lost');options.render(1);}
  });vm.runInContext(warm,context);
  const result=vm.runInContext('warmCurrentScene(30,98,{combat:true})',context);if(fail)await assert.rejects(result,/gpu lost/);else await result;
  assert.equal(events.filter(x=>x==='cleanup').length,1);assert.equal(context.adventureCamera.mode,'first');assert.equal(context.renderer.shadowMap.needsUpdate,true);assert.equal(events.filter(x=>Array.isArray(x)&&x[0]==='target').at(-1)[1],originalTarget);
  assert(events.some(x=>Array.isArray(x)&&x[0]==='draw'&&x[1]==='third'));if(!fail)assert(events.some(x=>Array.isArray(x)&&x[0]==='draw'&&x[1]==='first'));
 }
});
