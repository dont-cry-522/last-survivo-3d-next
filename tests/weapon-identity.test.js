import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../vendor/three.module.js';
import {HERO_LOADOUTS} from '../rules.js';
import {makeHero} from '../hero-model.js';
import {shadowFocus} from '../shadow-gear.js';
import {makeHarpoon} from '../coast-models.js';
import {boneBoomerang} from '../beast-model.js';
import {sporeLantern} from '../wuling-appearance.js';
import {miasmaLantern} from '../mirage-appearance.js';

const make=(kind,id)=>kind==='wraith'?shadowFocus(id):id==='harpoon'?makeHarpoon():id==='boomerang'?boneBoomerang():id==='sporelantern'?sporeLantern():id==='miasmalantern'?miasmaLantern():makeHero(kind,id).userData.weapon;
// Source-space envelopes measured before the identity changes. These are also
// the envelopes used by the viewmodel framing, not combat collision dimensions.
const limits={rifle:[.1225,.426,1.069],shotgun:[.177,.379,1.069],fire:[.3723,1.6126,.23],crossbow:[.918,.3651,.775],shuriken:[.4669,.1559,.7401],dark:[.3723,1.6126,.23],shade:[.0819,.1533,.0208],shadowblade:[1.1151,1.4063,.1055],grimoire:[.4577,.0829,.2901],harpoon:[.2592,.0861,2.5386],boomerang:[.9833,.0918,.4795],sporelantern:[.2615,.5691,.2672],miasmalantern:[.2229,.5051,.2596]};

test('all thirteen named weapons keep their original framing and a bounded identity structure',()=>{
 let count=0;
 for(const [kind,ids]of Object.entries(HERO_LOADOUTS))for(const id of ids){
  count++;const g=make(kind,id);assert.deepEqual(g.userData.weaponIdentity,{hero:kind,weapon:id});
  g.removeFromParent();g.position.set(0,0,0);g.rotation.set(0,0,0);g.scale.setScalar(1);g.updateMatrixWorld(true);
  const size=new T.Box3().setFromObject(g).getSize(new T.Vector3()).toArray();size.forEach((v,i)=>assert(v<=limits[id][i]+.001,`${id} expands its viewmodel envelope on axis ${i}: ${v}`));
  let identity=0,meshes=0,triangles=0;
  g.traverse(o=>{if(!o.isMesh)return;meshes++;if(o.userData.identityDetail)identity++;triangles+=(o.geometry.index?.count||o.geometry.attributes.position.count)/3;assert([...o.geometry.attributes.position.array,...o.geometry.attributes.normal.array].every(Number.isFinite));});
  assert(identity>0,id+' has no identifiable structure');assert(meshes<=24,id+' adds a forest of ornaments');assert(triangles<5000,id+' exceeds the held-weapon mesh budget');
 }assert.equal(count,13);
});

test('spore and mirage lanterns keep their real moving cores but use different functional shades',()=>{
 const spore=sporeLantern(),mirage=miasmaLantern();
 assert(spore.userData.heart.isMesh&&mirage.userData.heart.isMesh);
 assert.equal(spore.userData.heart.parent,spore);assert.equal(mirage.userData.heart.parent,mirage);
 assert.deepEqual(spore.userData.heart.position.toArray(),[0,-.335,0]);assert.deepEqual(mirage.userData.heart.position.toArray(),[0,-.298,0]);
 assert(spore.getObjectByName('SM_Weapon_Spore_GilledCanopy'));assert(spore.getObjectByName('SM_Weapon_Spore_GillRibs'));assert.equal(mirage.userData.petals.length,4);
 for(const petal of mirage.userData.petals){assert(petal.isMesh&&petal.parent===mirage);assert(petal.userData.rest.isQuaternion);assert(petal.geometry.name.includes('MirrorPetal'));assert(petal.material.metalness>.3);}
 assert.notEqual(spore.userData.heart.material,mirage.userData.heart.material);
});

test('repeated factories share only immutable identity geometry, with independent moving nodes',()=>{
 for(const [kind,id]of[['scout','rifle'],['silver','crossbow'],['wraith','shadowblade'],['tide','harpoon'],['lingya','boomerang'],['wuling','sporelantern'],['mirage','miasmalantern']]){
  const a=make(kind,id),b=make(kind,id),parts=[];a.traverse(o=>{if(o.isMesh&&o.userData.identityDetail)parts.push(o);});
  for(const part of parts){const other=b.getObjectByName(part.name);assert(other&&other!==part);assert.equal(other.geometry,part.geometry,part.name+' needlessly rebuilds geometry');const old=other.position.clone();part.position.x+=.017;assert(other.position.equals(old),'moving one actor moves another');}
 }
});
