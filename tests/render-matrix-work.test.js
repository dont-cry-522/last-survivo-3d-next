import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../vendor/three.module.js';
import {FirstPersonView} from '../first-person-view.js';
import {HeroPreview} from '../hero-preview.js';

// Model the matrix-update entry in the bundled WebGLRenderer, without claiming
// this CPU operation count measures GPU work or an actual browser frame rate.
function renderer({repeatScene=false,onRender=()=>{}}={}){
 return{autoClear:true,clearDepth(){this.depthClears=(this.depthClears||0)+1;},render(scene,camera){
  if(scene.matrixWorldAutoUpdate||repeatScene)scene.updateMatrixWorld();
  if(camera.parent===null&&camera.matrixWorldAutoUpdate)camera.updateMatrixWorld();
  onRender(scene,camera);
 }};
}
function crowdedScene(){
 const scene=new T.Scene(),staticNodes=[];
 for(let b=0;b<100;b++){
  const branch=new T.Group();branch.position.set(b%10*3,0,Math.floor(b/10)*3);scene.add(branch);staticNodes.push(branch);
  for(let i=0;i<24;i++){const n=new T.Object3D();n.position.set(i*.04,Math.sin(i)*.1,i*.03);n.rotation.y=i*.07;branch.add(n);staticNodes.push(n);}
 }
 let calls=0;for(const n of staticNodes){const update=n.updateMatrixWorld;n.updateMatrixWorld=function(force){calls++;return update.call(this,force);};}
 return{scene,staticNodes,get calls(){return calls;}};
}
function matrices(nodes){return nodes.map(n=>n.matrixWorld.toArray());}

test('first-person overlay visits 2500 static nodes once across the two unchanged draw passes',()=>{
 function run(legacy){
  const fixture=crowdedScene(),{scene}=fixture,camera=new T.PerspectiveCamera(65,1.7,.1,320),view=new FirstPersonView(camera);scene.add(camera);
  // An actual held branch is included in the main pass matrix update even when
  // only layer 0 is rendered, exactly as in the production scene graph.
  view.weapon=new T.Group();view.weapon.position.set(.4,-.3,-.8);view.root.add(view.weapon);view.root.visible=true;camera.position.set(2,1.6,4);camera.rotation.y=.35;
  const draws=[],r=renderer({repeatScene:legacy,onRender:(s,c)=>draws.push({layer:c.layers.mask,matrices:matrices(fixture.staticNodes),held:view.weapon.matrixWorld.toArray(),camera:c.matrixWorld.toArray()})});
  try{
   r.render(scene,camera);view.render(r,scene);
   assert.equal(draws.length,2);assert.equal(draws[0].layer,1);assert.equal(draws[1].layer,2);assert.deepEqual(draws[1].held,draws[0].held);
   assert.equal(r.depthClears,1);assert.equal(scene.matrixWorldAutoUpdate,true);assert.equal(camera.layers.mask,1);assert.equal(r.autoClear,true);
   return{calls:fixture.calls,draws};
  }finally{view.dispose();}
 }
 const before=run(true),after=run(false);
 assert.equal(before.calls,5000);assert.equal(after.calls,2500);assert.deepEqual(after.draws,before.draws,'saved matrix traversal changes rendering transforms');
});

test('overlay restores scene, camera and renderer state when the draw throws or auto matrices were already disabled',()=>{
 for(const autoMatrix of[true,false]){
  const scene=new T.Scene(),camera=new T.PerspectiveCamera(),view=new FirstPersonView(camera),background=new T.Color(0x7291a3);scene.add(camera);scene.background=background;scene.matrixWorldAutoUpdate=autoMatrix;
  view.weapon=new T.Group();view.root.add(view.weapon);view.root.visible=true;camera.layers.set(3);
  const r=renderer({onRender:s=>{assert.equal(s.matrixWorldAutoUpdate,false);assert.equal(s.background,null);throw Error('draw failure');}});r.autoClear=false;
  try{assert.throws(()=>view.render(r,scene),/draw failure/);assert.equal(scene.matrixWorldAutoUpdate,autoMatrix);assert.equal(scene.background,background);assert.equal(camera.layers.mask,8);assert.equal(r.autoClear,false);}
  finally{view.dispose();}
 }
});

function previewEnvironment(fn){
 const names=['document','innerWidth','innerHeight'],saved=names.map(k=>Object.getOwnPropertyDescriptor(globalThis,k)),control={setAttribute(){}};
 Object.defineProperties(globalThis,{document:{configurable:true,value:{querySelector:()=>({...control})}},innerWidth:{configurable:true,value:1440},innerHeight:{configurable:true,value:900}});
 try{return fn({getBoundingClientRect:()=>({width:670,height:740,left:720,top:90}),addEventListener(){}});}
 finally{names.forEach((k,i)=>saved[i]?Object.defineProperty(globalThis,k,saved[i]):delete globalThis[k]);}
}
function previewActors(scene){
 const hero=new T.Group(),geometry=new T.BoxGeometry(.5,1.3,.35),material=new T.MeshStandardMaterial(),body=new T.Mesh(geometry,material),head=new T.Object3D();
 body.position.y=.8;head.position.y=1.55;hero.add(body,head);hero.position.set(1,0,2);hero.userData={kind:'lingya',head};scene.add(hero);
 const pet=new T.Mesh(geometry,material);pet.scale.set(.7,.3,.7);pet.position.set(-2,.2,1);scene.add(pet);
 return{hero,pet,material,geometry};
}

test('preview retains fresh camera, fill and pet transforms with one full-scene matrix pass',()=>previewEnvironment(element=>{
 function run(legacy,portrait){
  const fixture=crowdedScene(),{scene}=fixture,{hero,pet,material,geometry}=previewActors(scene);scene.fog=new T.FogExp2(0x8ba193,.0078);
  let preview;const draws=[],r=renderer({repeatScene:legacy,onRender:(s,c)=>draws.push({camera:c.matrixWorld.toArray(),projection:c.projectionMatrix.toArray(),fill:preview.fill.matrixWorld.toArray(),hero:hero.matrixWorld.toArray(),pet:pet.matrixWorld.toArray(),visible:pet.visible,clipped:material.clippingPlanes?.length||0,world:matrices(fixture.staticNodes)})});
  preview=new HeroPreview(r,element);preview.setPortrait(portrait);const petPosition=pet.position.clone();
  try{
   preview.render(scene,hero,pet);hero.position.x+=.3;preview.needsFit=true;preview.render(scene,hero,pet);
   assert.equal(scene.matrixWorldAutoUpdate,true);assert.equal(preview.fill.parent,null);assert.equal(scene.fog.density,.0078);assert(pet.position.equals(petPosition));assert.equal(pet.visible,true);assert.equal(material.clippingPlanes,null);
   assert.notDeepEqual(draws[0].fill,draws[1].fill,'new fill position was not uploaded');assert.notDeepEqual(draws[0].hero,draws[1].hero);
   assert(draws.every(d=>d.clipped===(portrait?4:0)&&d.visible===!portrait));
   return{calls:fixture.calls,draws};
  }finally{geometry.dispose();material.dispose();}
 }
 for(const portrait of[false,true]){const before=run(true,portrait),after=run(false,portrait);assert.equal(before.calls,10000);assert.equal(after.calls,5000);assert.deepEqual(after.draws,before.draws);}
}));

test('preview exception restores clipping, pet, fog, fill and caller matrix policy',()=>previewEnvironment(element=>{
 for(const autoMatrix of[true,false]){
  const scene=new T.Scene(),{hero,pet,material,geometry}=previewActors(scene),r=renderer({onRender:()=>{throw Error('preview failure');}}),preview=new HeroPreview(r,element);
  scene.matrixWorldAutoUpdate=autoMatrix;scene.fog=new T.FogExp2(0xaabbcc,.008);const petPosition=pet.position.clone(),planes=[new T.Plane(new T.Vector3(0,1,0),2)];material.clippingPlanes=planes;preview.setPortrait(true);
  try{assert.throws(()=>preview.render(scene,hero,pet),/preview failure/);assert.equal(scene.matrixWorldAutoUpdate,autoMatrix);assert.equal(material.clippingPlanes,planes);assert.equal(scene.fog.density,.008);assert.equal(preview.fill.parent,null);assert(pet.position.equals(petPosition));assert.equal(pet.visible,true);}
  finally{geometry.dispose();material.dispose();}
 }
}));
