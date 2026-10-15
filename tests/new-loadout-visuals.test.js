import {test,before} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import * as T from '../vendor/three.module.js';
import {makeHero} from '../hero-model.js';
import {FirstPersonView} from '../first-person-view.js';
import {GRIP_POINTS,BRIARPOT_SUPPORT} from '../weapon-grips.js';
import {WEAPON_OUTLETS} from '../weapon-outlets.js';
import {weaponGesture,weaponDuration} from '../weapon-performance.js';

const loadouts=[['tide','arcstaff'],['lingya','briarpot']];
test('new held models share compact geometry, fixed grips and visible outlets in both orientations',()=>{
 const camera=new T.PerspectiveCamera(70,16/9,.1,100),view=new FirstPersonView(camera);
 try{for(const[kind,id]of loadouts){
  const gun=makeHero(kind,id).userData.weapon,actor={userData:{gun,kind,shotSerial:1,reloadDuration:id==='arcstaff'?.25:1/.85}};
  assert.deepEqual(gun.userData.weaponIdentity,{hero:kind,weapon:id});
  let meshes=0,triangles=0;gun.traverse(n=>{if(!n.isMesh)return;meshes++;triangles+=(n.geometry.index?.count||n.geometry.attributes.position.count)/3;assert([...n.geometry.attributes.position.array,...n.geometry.attributes.normal.array].every(Number.isFinite));});
  assert(meshes<=10&&triangles<2200);view.setHero(actor,id);assert.equal(view.profile.type,id==='arcstaff'?'staff':'pot');assert.equal(view.kind,kind);
  for(const[source,clone]of view.parts)if(source.isMesh)assert.equal(source.geometry,clone.geometry);
  for(const aspect of[16/9,844/390,390/844])for(const age of[0,.02,.10,.155,.25,.65,2]){
   camera.aspect=aspect;camera.updateProjectionMatrix();Object.assign(actor.userData,{attackAge:age,reloadPhase:age/actor.userData.reloadDuration});view.update(1,1/60,{visible:true});camera.updateMatrixWorld(true);
   const palm=view.hands[0].localToWorld(new T.Vector3(0,.045,-.023)),handle=view.model.localToWorld(new T.Vector3(...GRIP_POINTS[id]));assert(palm.distanceTo(handle)<1e-7);
   if(id==='briarpot'){const cup=view.hands[1].localToWorld(new T.Vector3(0,.045,-.023)),base=view.model.localToWorld(new T.Vector3(...BRIARPOT_SUPPORT));assert(cup.distanceTo(base)<1e-7);}
   const outlet=view.launchPoint(),authored=view.model.localToWorld(new T.Vector3(...WEAPON_OUTLETS[id]));assert(outlet.distanceTo(authored)<1e-8);
   const screen=outlet.project(camera);assert(Math.abs(screen.x)<1&&Math.abs(screen.y)<1,id+' outlet left the frame');
   view.root.traverse(n=>assert(n.matrixWorld.elements.every(Number.isFinite),id+' non-finite view model'));
  }
 }}finally{view.dispose();}
});

test('conductor makes a bounded wrist pulse and the pot releases its seed on the delayed throw clock',()=>{
 const camera=new T.PerspectiveCamera(70,16/9,.1,100),view=new FirstPersonView(camera);
 try{for(const[kind,id]of loadouts){
  const actor={userData:{gun:makeHero(kind,id).userData.weapon,kind,shotSerial:1}};view.setHero(actor,id);
  for(const period of[.10,.25,1/.85]){
   const duration=weaponDuration(id,period);Object.assign(actor.userData,{attackAge:2,reloadPhase:2/period,reloadDuration:period});view.update(1,1/60,{visible:true});const rest=view.weapon.quaternion.clone(),position=view.weapon.position.clone();
   for(let frame=0;frame<=60;frame++){
    const age=duration*frame/60;Object.assign(actor.userData,{attackAge:age,reloadPhase:age/period});view.update(1,1/60,{visible:true});
    if(id==='arcstaff'){assert(rest.angleTo(view.weapon.quaternion)<.03);assert(position.distanceTo(view.weapon.position)<.009);assert.equal(view.motion.gather,0);assert.equal(view.motion.sweep,0);}
    else assert.equal(view.model.getObjectByName('SM_Briarpot_LoadedSeed').visible,weaponGesture(id,age,age/period,period).seedHeld);
   }
   if(id==='briarpot'){assert(weaponGesture(id,duration*.24-1e-7,0,period).seedHeld);assert(!weaponGesture(id,duration*.24+1e-7,0,period).seedHeld);assert(weaponGesture(id,period,1,period).seedHeld);}
   const pose=view.weapon.matrix.clone();view.update(30,0,{visible:true});assert.deepEqual(view.weapon.matrix.elements,pose.elements);
  }
 }}finally{view.dispose();}
});

const world=new URL('../world.js',import.meta.url),entry=fs.readFileSync(world,'utf8').match(/from['"](.\/skinned-hero\.js[^'"]*)['"]/)[1];
const{loadHeroAssets,createSkinnedHero,animateSkinnedHero,disposeHero}=await import(new URL(entry,world));
before(async()=>{
 const original=Object.fromEntries(['fetch','self','ProgressEvent','createImageBitmap'].map(key=>[key,globalThis[key]]));
 try{
  globalThis.self=globalThis;globalThis.ProgressEvent=class{constructor(type,data){Object.assign(this,data);}};globalThis.createImageBitmap=async()=>({width:512,height:512,close(){}});
  globalThis.fetch=async input=>{const url=typeof input==='string'?input:input.url;return url.startsWith('file:')?new Response(fs.readFileSync(fileURLToPath(url))):original.fetch(input);};await loadHeroAssets();
 }finally{for(const[key,value]of Object.entries(original))if(value===undefined)delete globalThis[key];else globalThis[key]=value;}
});

test('later heroes keep finite real rigs, planted primary hands and weapon-specific attacks',()=>{
 for(const[kind,id]of loadouts){
  const hero=createSkinnedHero(kind,id),d=hero.userData,period=id==='arcstaff'?.25:1/.85,dt=1/60;let t=0,maxSupport=0;
  try{
   assert.equal(d.kineticActions,null,'new ranged loadout inherited the harpoon strike');Object.assign(d,{aimActive:true,aimAngle:0,aimPitch:0,reloadDuration:period,shotSerial:0,reloadPhase:1});
   for(let i=0;i<90;i++)animateSkinnedHero(hero,t+=dt,0,0,0);
   for(let frame=0;frame<180;frame++){
    const age=(frame*dt)%period;d.shotSerial=1+Math.floor(frame*dt/period);d.reloadPhase=age/period;d.aimPitch=Math.sin(t)*.4;d.travelAngle=.2;animateSkinnedHero(hero,t+=dt,frame>90?3:0,age<dt?.15:0,0);hero.updateMatrixWorld(true);
    hero.traverse(n=>assert(n.matrixWorld.elements.every(Number.isFinite),id+' has non-finite transforms'));
    const palm=d.support.rightHand.localToWorld(new T.Vector3(-.036,.097,0)),grip=d.gun.localToWorld(new T.Vector3(...GRIP_POINTS[id]));assert(palm.distanceTo(grip)<1e-6,id+' grip slips');
    if(id==='briarpot'){const cup=d.support.hand.localToWorld(new T.Vector3(.036,.097,0)),base=d.gun.localToWorld(new T.Vector3(...BRIARPOT_SUPPORT));maxSupport=Math.max(maxSupport,cup.distanceTo(base));assert.equal(d.gun.userData.briarSeed.visible,weaponGesture(id,age,d.reloadPhase,period).seedHeld);}
    else if(frame<80)assert(Math.abs(d.rig.rotation.x)<.02,'rapid conductor shot triggers a body swing');
   }
   if(id==='briarpot')assert(maxSupport<.045,'basket support separates: '+maxSupport);
  }finally{disposeHero(hero);}
 }
});

test('conductor keeps a diagonal side stance while the pot bends its knees and drives forward from its own release clock',()=>{
 const arc=createSkinnedHero('tide','arcstaff'),pot=createSkinnedHero('lingya','briarpot');
 try{
  for(const hero of[arc,pot]){Object.assign(hero.userData,{aimActive:true,aimAngle:0,aimPitch:0,reloadDuration:hero===arc?.25:1/.85,shotSerial:0,reloadPhase:1});for(let n=0;n<90;n++)animateSkinnedHero(hero,n/60,0,0,0);hero.updateMatrixWorld(true);}
  const a=arc.userData,up=new T.Vector3(0,1,0).applyQuaternion(a.gun.getWorldQuaternion(new T.Quaternion()));assert(up.x<-.35&&up.y<.9,'conductor returns to an upright staff or crosses the face');
  const diagonal=a.gun.getWorldQuaternion(new T.Quaternion()),torso=a.spine.quaternion.clone();
  for(let n=0;n<90;n++){a.shotSerial=1+Math.floor(n/15);a.reloadPhase=(n%15)/15;animateSkinnedHero(arc,1.5+n/60,0,n%15===0?.15:0,0);arc.updateMatrixWorld(true);assert(diagonal.angleTo(a.gun.getWorldQuaternion(new T.Quaternion()))<.08,'conductor repeatedly swings its staff');assert(torso.angleTo(a.spine.quaternion)<.03,'conductor repeats a torso strike at 4 Hz');}
  const d=pot.userData,restKnee=d.swimLeftKnee.quaternion.clone(),restTorso=d.spine.quaternion.clone(),restHand=d.support.rightHand.getWorldPosition(new T.Vector3()),restY=d.rig.position.y,duration=weaponDuration('briarpot',d.reloadDuration);let lowest=restY,kneeBend=0,torsoTurn=0,forward=0;
  d.shotSerial=1;for(let n=0;n<=90;n++){const age=n/120;d.reloadPhase=age/d.reloadDuration;animateSkinnedHero(pot,1.5+age,0,n===0?.15:0,0);pot.updateMatrixWorld(true);lowest=Math.min(lowest,d.rig.position.y);kneeBend=Math.max(kneeBend,restKnee.angleTo(d.swimLeftKnee.quaternion));torsoTurn=Math.max(torsoTurn,restTorso.angleTo(d.spine.quaternion));forward=Math.max(forward,d.support.rightHand.getWorldPosition(new T.Vector3()).z-restHand.z);assert.equal(d.gun.userData.briarSeed.visible,age<duration*.24||age>duration*.78);}
  assert(lowest<restY-.03,'pot has no anticipatory dip');assert(kneeBend>.45,'pot has no independent knee bend');assert(torsoTurn>.10,'pot has no torso weight transfer');assert(forward>.09,'two hands only lift instead of delivering the pot');assert(Math.abs(d.rig.position.y-restY)<1e-8,'pot keeps its crouch after recovery');
  assert(pot.position.equals(new T.Vector3())&&arc.position.equals(new T.Vector3()),'presentation changed gameplay displacement');
 }finally{disposeHero(arc);disposeHero(pot);}
});

test('two-hand pot delivery keeps its cup contact while aiming steeply or throwing rapidly',()=>{
 for(const pitch of[-1.1,1.1])for(const period of[.25,1/.85]){
  const hero=createSkinnedHero('lingya','briarpot'),d=hero.userData,dt=1/120;let time=0,gap=0;
  try{Object.assign(d,{aimActive:true,aimAngle:0,aimPitch:pitch,reloadDuration:period,reloadPhase:1,shotSerial:0});for(let n=0;n<180;n++)animateSkinnedHero(hero,time+=dt,0,0,0);
   for(let n=0;n<240;n++){const age=(n*dt)%period;d.shotSerial=1+Math.floor(n*dt/period);d.reloadPhase=age/period;animateSkinnedHero(hero,time+=dt,0,age<dt?.15:0,0);hero.updateMatrixWorld(true);const palm=d.support.hand.localToWorld(new T.Vector3(.036,.097,0)),base=d.gun.localToWorld(new T.Vector3(...BRIARPOT_SUPPORT));gap=Math.max(gap,palm.distanceTo(base));}
   assert(gap<.055,`pot cup gap ${gap} at pitch ${pitch}, period ${period}`);
  }finally{disposeHero(hero);}
 }
});
