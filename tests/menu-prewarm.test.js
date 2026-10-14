import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import * as T from '../vendor/three.module.js';
import {HERO_LOADOUTS,weaponFor} from '../rules.js';
import {warmScene} from '../render-prewarm.js';
import {CinematicRenderer} from '../cinematic-renderer.js';

const source=readFileSync(new URL('../main.js',import.meta.url),'utf8');
const cacheSource=source.slice(source.indexOf('const menuHeroes='),source.indexOf('function rebuildHero('));
const prepareSource=source.slice(source.indexOf('async function prepareMenuHeroes('),source.indexOf('async function prepareLobby('));
const loadouts=Object.entries(HERO_LOADOUTS).flatMap(([kind,list])=>list.map((weapon,index)=>({kind,weapon,index})));

function fixture({enabled=true,fail=null,visible=true,petVisible=true,current='silver'}={}){
 const scene=new T.Scene(),camera=new T.PerspectiveCamera(),previewCamera=new T.PerspectiveCamera(),originalTarget={name:'original target'},events=[],created=[],pets=[],disposed=[],drawn=new Set();
 let target=originalTarget,preview=null;
 camera.layers.set(4);
 const renderer={
  extensions:{has:()=>enabled},capabilities:{maxSamples:2},info:{autoReset:true,reset(){}},shadowMap:{needsUpdate:false},
  getRenderTarget:()=>target,setRenderTarget(value){target=value;},getDrawingBufferSize(out){return out.set(640,360);},initTexture(){},
  async compileAsync(s,c){
   assert.equal(s,scene);assert.equal(c,previewCamera);assert(preview.sample.visible);assert.equal(preview.sample.parent,scene);
   if(preview.pet)assert.equal(preview.pet.parent,scene);
   events.push({type:'compile',sample:preview.sample,target});
   if(fail==='compile'&&preview.sample.userData.kind==='lingya')throw Error('injected compile failure');
  },
  render(s,c){
   if(s!==scene)return; // Actual CinematicRenderer also draws its postprocess scene.
   assert.equal(c,previewCamera);const sample=preview.sample;
   events.push({type:'draw',sample,target});drawn.add(sample);
   if(sample.userData.kind==='lingya'&&((fail==='hdrDraw'&&target===cinema.sceneTarget)||(fail==='directDraw'&&target===originalTarget)))throw Error('injected draw failure');
  }
 };
 const cinema=new CinematicRenderer(renderer),renderCinema=cinema.render.bind(cinema);
 cinema.render=(draw,quality)=>{events.push({type:'cinema',quality});return renderCinema(draw,quality);};
 function actor(kind,weapon){
  const group=new T.Group();group.userData={kind,weapon};group.name=kind+':'+weapon;
  const geometry=new T.BoxGeometry(.2,1,.2),material=new T.MeshStandardMaterial();group.add(new T.Mesh(geometry,material));
  geometry.addEventListener('dispose',()=>disposed.push(group));material.addEventListener('dispose',()=>disposed.push(group));created.push(group);return group;
 }
 const companionMesh=new T.Group();companionMesh.visible=petVisible;scene.add(companionMesh);
 const context=vm.createContext({HERO_LOADOUTS,weaponFor,actor,scene,camera,renderer,cinema,warmScene,renderBudget:{quality:1},companionMesh,
  hero:null,state:'menu',time:12,kills:3,
  loadingScreen:{setLoadingProgress(){}},yieldPreparation:async()=>{},
  heroPreview:{landscapeYaw:.66,needsFit:false,render(s,sample,pet,draw){preview={sample,pet};return draw?draw(s,previewCamera):renderer.render(s,previewCamera);}},
  makeBadger(){const pet=new T.Group();pet.name='temporary badger';pets.push(pet);return pet;},
  animateActor(sample,time,speed){assert.equal(time,0);assert.equal(speed,0);events.push({type:'pose',sample});},
  disposeHero(sample){disposed.push(sample);},update(){assert.fail('previews must not simulate combat');},spawn(){assert.fail('previews must not spawn combat');}
 });
 vm.runInContext(cacheSource+prepareSource,context);
 context.hero=vm.runInContext(`previewHero('${current}',0)`,context);const hero=context.hero;hero.visible=visible;hero.position.set(4,.2,-7);scene.add(hero);
 return{scene,camera,renderer,cinema,originalTarget,context,events,created,pets,disposed,drawn,hero,companionMesh,
  run:()=>vm.runInContext('prepareMenuHeroes(72,94)',context),
  cleanup(){cinema.dispose();for(const group of created)group.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});}
 };
}

function restored(f,visible,petVisible){
 assert.equal(f.hero.visible,visible);assert.equal(f.companionMesh.visible,petVisible);
 assert.equal(f.hero.parent,f.scene);assert.equal(f.companionMesh.parent,f.scene);
 assert.deepEqual(new Set(f.scene.children),new Set([f.hero,f.companionMesh]));
 assert.equal(f.renderer.getRenderTarget(),f.originalTarget);assert.equal(f.camera.layers.mask,1<<4);
 assert(f.context.heroPreview.needsFit&&f.renderer.shadowMap.needsUpdate);
 assert.equal(f.context.state,'menu');assert.equal(f.context.time,12);assert.equal(f.context.kills,3);
 assert.equal(f.disposed.length,0,'cached actors must keep their warmed GPU resources');
 assert(f.pets.every(p=>p.parent===null),'temporary companion escaped preview cleanup');
}

test('real menu preparation compiles and draws all cached loadouts through HDR and direct paths without running combat',async()=>{
 for(const enabled of [true,false]){
  const f=fixture({enabled,visible:true,petVisible:false});
  try{
   await f.run();restored(f,true,false);assert.equal(f.created.length,loadouts.length);assert.equal(f.drawn.size,loadouts.length);
   assert.equal(f.events.filter(e=>e.type==='cinema').length,loadouts.length);
   for(const {kind,weapon} of loadouts){
    const sample=f.created.find(g=>g.userData.kind===kind&&g.userData.weapon===weapon);assert(sample);
    const expected=enabled?[f.cinema.sceneTarget,f.originalTarget]:[f.originalTarget];
    assert.deepEqual(f.events.filter(e=>e.type==='compile'&&e.sample===sample).map(e=>e.target),expected,'wrong compile target for '+sample.name);
    assert.deepEqual(f.events.filter(e=>e.type==='draw'&&e.sample===sample).map(e=>e.target),expected,'wrong draw target for '+sample.name);
   }
   const actors=f.created.slice();await f.run();restored(f,true,false);assert.deepEqual(f.created,actors,'retry recreated cached loadouts');
  }finally{f.cleanup();}
 }
});

test('failed compile, HDR draw or direct fallback removes preview samples and pets and restores exact original state',async()=>{
 for(const fail of ['compile','hdrDraw','directDraw'])for(const current of ['silver','lingya']){
  const f=fixture({fail,current,visible:false,petVisible:true});
  try{
   await assert.rejects(f.run(),/injected (compile|draw) failure/);restored(f,false,true);
   assert.equal(f.pets.length,1,'failure did not exercise the temporary pet path');
   const failed=f.created.find(g=>g.userData.kind==='lingya');assert(failed);
   assert.equal(failed.visible,current==='lingya'?false:true,'sample visibility was not restored');
  }finally{f.cleanup();}
 }
});
