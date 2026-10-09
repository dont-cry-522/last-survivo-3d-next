import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../vendor/three.module.js';
import {FirstPersonView} from '../first-person-view.js';
import {makeHero} from '../hero-model.js';
import {shadowFocus} from '../shadow-gear.js';
import {createShadowAura,updateShadowAura,disposeShadowAura} from '../shadow-aura.js';
import {miasmaLantern} from '../mirage-appearance.js';
import {sporeLantern} from '../wuling-appearance.js';
import {boneBoomerang} from '../beast-model.js';
import {makeHarpoon} from '../coast-models.js';
import {HERO_LOADOUTS} from '../rules.js';

function weapon(id){return ['shade','shadowblade','grimoire'].includes(id)?shadowFocus(id):id==='miasmalantern'?miasmaLantern():id==='sporelantern'?sporeLantern():id==='boomerang'?boneBoomerang():id==='harpoon'?makeHarpoon():makeHero(id==='crossbow'?'silver':'scout',id).userData.weapon;}
const hero=gun=>({visible:false,userData:{gun}});

test('all 13 actual weapon graphs fit ahead of the camera, without mutating source poses or materials',()=>{
 const camera=new T.PerspectiveCamera(60,16/9,.1,200);camera.position.set(14,2,-8);camera.rotation.y=1.2;
 const view=new FirstPersonView(camera);assert.equal(view.root.parent,camera);
 try{for(const id of Object.values(HERO_LOADOUTS).flat()){
  const gun=weapon(id);gun.position.set(9,3,4);gun.rotation.set(1.4,.6,.3);gun.scale.setScalar(.65);
  const original=gun.matrix.clone(),flags=[];gun.traverse(m=>{if(m.isMesh)flags.push([m.material,m.material.depthTest,m.material.depthWrite,m.material.transparent]);});
  view.setHero(hero(gun),id);assert(view.weapon,id);assert(view.parts.length>0);
  for(const aspect of[16/9,390/844]){camera.aspect=aspect;camera.updateProjectionMatrix();view.update(1,.016,{visible:true,moving:1});camera.updateMatrixWorld(true);
   assert(view.root.visible);assert(view.root.position.z<-.6);assert(view.weapon.scale.x>0);
   const box=new T.Box3().setFromObject(view.weapon),size=box.getSize(new T.Vector3());assert(Math.max(size.x,size.y,size.z)<.8,id+' fills the view');
   for(const [source,clone]of view.parts){assert(clone.matrixWorld.elements.every(Number.isFinite));assert.deepEqual(clone.userData,{});if(clone.isMesh){assert.equal(clone.geometry,source.geometry);assert.notEqual(clone.material,source.material);assert.equal(clone.material.depthTest,false);assert.equal(clone.material.depthWrite,false);assert.equal(clone.material.transparent,true);assert(clone.renderOrder>=10000);assert.equal(clone.castShadow,false);}}
  }
  assert.deepEqual(gun.position.toArray(),[9,3,4]);assert.equal(gun.scale.x,.65);assert(gun.matrix.equals(original));
  for(const [m,depthTest,depthWrite,transparent]of flags){assert.equal(m.depthTest,depthTest);assert.equal(m.depthWrite,depthWrite);assert.equal(m.transparent,transparent);}
 }}finally{view.dispose();}
});

test('moving bow strings, pump, book page and lantern petals are mirrored via real node pairs',()=>{
 const view=new FirstPersonView(new T.PerspectiveCamera(60,1.5,.1,100));
 try{for(const id of['crossbow','shotgun','grimoire','miasmalantern']){
  const gun=weapon(id);view.setHero(hero(gun),id);
  const source=id==='crossbow'?gun.userData.crossbowStrings[0]:id==='shotgun'?gun.userData.pump:id==='grimoire'?gun.userData.page:gun.userData.petals[0];
  const clone=view.parts.find(([s])=>s===source)?.[1];assert(clone,id);
  const original=source.position.clone();source.position.z-=.03;source.rotation.y+=.2;source.visible=false;
  view.update(2,.016,{visible:true,attack:.09,attackDuration:.18});assert(clone.position.equals(source.position));assert(clone.quaternion.equals(source.quaternion));assert.equal(clone.visible,false);
  source.position.copy(original);
 }
 const gun=weapon('boomerang');view.setHero(hero(gun),'boomerang');gun.visible=false;view.update(2,.016,{visible:true});assert.equal(view.weapon.visible,false);assert(view.hands.every(h=>!h.visible));
 }finally{view.dispose();}
});

test('shader material hooks and uniform state survive cloning without aliasing owned containers',()=>{
 const gun=weapon('shade'),aura=createShadowAura('shade');gun.add(aura);const view=new FirstPersonView(new T.PerspectiveCamera(60,1.5,.1,100));
 try{view.setHero(hero(gun),'shade');const original=aura.children[0],clone=view.parts.find(([s])=>s===original)[1];
  assert.notEqual(clone.material,original.material);assert.notEqual(clone.material.uniforms,original.material.uniforms);assert.equal(clone.material.onBeforeCompile,original.material.onBeforeCompile);
  updateShadowAura(aura,2,4,.1,0);view.update(2,.016,{visible:true});
  for(const key of ['time','run','attack'])if(original.material.uniforms[key])assert.equal(clone.material.uniforms[key].value,original.material.uniforms[key].value);
  const position=view.root.position.clone(),rotation=view.root.quaternion.clone(),gait=view.gait;view.update(2,0,{visible:true});assert.equal(view.gait,gait);assert(view.root.position.equals(position));assert(view.root.quaternion.equals(rotation));
 }finally{view.dispose();disposeShadowAura(aura);}
});

test('rebinding and disposal release only owned materials/cuffs and remove the old graph',()=>{
 const camera=new T.PerspectiveCamera(60,1.5,.1,100),view=new FirstPersonView(camera),gun=weapon('crossbow');let sharedDisposed=0,ownedDisposed=0;
 const shared=new Set();gun.traverse(o=>{if(o.isMesh){shared.add(o.geometry);shared.add(o.material);}});for(const resource of shared)resource.addEventListener('dispose',()=>sharedDisposed++);
 view.setHero(hero(gun),'crossbow');const old=view.weapon,owned=[...view.materials.values(),...view.ownedGeometry];for(const resource of owned)resource.addEventListener('dispose',()=>ownedDisposed++);
 view.setHero(hero(weapon('grimoire')),'grimoire');assert.equal(old.parent,null);assert.equal(ownedDisposed,owned.length);assert.equal(sharedDisposed,0);
 view.dispose();view.dispose();assert.equal(sharedDisposed,0);assert.equal(view.root.parent,null);assert.equal(view.root.children.length,0);
 view.update(5,.016,{visible:true});assert.equal(view.root.visible,false);view.setHero(hero(gun),'crossbow');assert.equal(view.root.children.length,0);
});
