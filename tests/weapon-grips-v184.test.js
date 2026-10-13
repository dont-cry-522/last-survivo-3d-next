import {test,before} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import * as T from '../vendor/three.module.js';
import {createHandGrips,poseGripFingers,GRIP_POINTS,SCYTHE_SUPPORT} from '../weapon-grips.js';
import {weaponGesture} from '../weapon-performance.js';

function grip(id){
 const bones=new Map();for(const side of['l','r']){
  bones.set('hand_'+side,new T.Bone());
  for(const name of['thumb','index','middle','ring','pinky'])for(let i=1;i<=3;i++){
   const bone=new T.Bone();bone.quaternion.setFromEuler(new T.Euler(.10,.12,-.06));bones.set(`${name}_0${i}_${side}`,bone);
  }
 }
 return{weaponId:id,aimBlend:1,reloadPhase:1,bones,handGrips:createHandGrips(bones)};
}
const q=(d,name)=>d.bones.get(name).quaternion.clone();
const pose=d=>[...d.bones.values()].flatMap(b=>b.quaternion.toArray());

test('trigger fingers press and reset while the holding fingers stay planted; pump hand braces independently',()=>{
 for(const id of['rifle','shotgun','crossbow']){
  const d=grip(id);poseGripFingers(d,{kick:0});const rest=pose(d),index=q(d,'index_02_r'),ring=q(d,'ring_02_r');
  poseGripFingers(d,{kick:1});assert(index.angleTo(q(d,'index_02_r'))>.1);assert(ring.angleTo(q(d,'ring_02_r'))<1e-7);
  poseGripFingers(d,{kick:0});assert.deepEqual(pose(d),rest,'finger curl accumulated after a shot');
 }
 const d=grip('shotgun');poseGripFingers(d,{draw:0});const fore=q(d,'middle_02_l'),trigger=q(d,'index_02_r');
 poseGripFingers(d,{draw:1});assert(fore.angleTo(q(d,'middle_02_l'))>.04);assert(trigger.angleTo(q(d,'index_02_r'))<1e-7);
});

test('crossbow cocking changes the index and thumb from supporting to pinching, then releases the slide',()=>{
 const d=grip('crossbow');poseGripFingers(d);const rest=pose(d),index=q(d,'index_02_l'),thumb=q(d,'thumb_02_l');
 d.reloadPhase=.5;poseGripFingers(d);assert(index.angleTo(q(d,'index_02_l'))>.15);assert(thumb.angleTo(q(d,'thumb_02_l'))>.1);
 d.reloadPhase=1;poseGripFingers(d);assert.deepEqual(pose(d),rest);
});

test('fire, dark, shadow and book each have a distinct free-hand gesture, without overriding lowered idle arms',()=>{
 const signatures=new Set();
 for(const id of['fire','dark','shade','grimoire']){
  const d=grip(id);d.aimBlend=0;const idle=q(d,'index_01_l');poseGripFingers(d,{kick:1,gather:1});assert(idle.angleTo(q(d,'index_01_l'))<1e-7);
  d.aimBlend=1;poseGripFingers(d,{kick:0,gather:0});const rest=pose(d),finger=q(d,'middle_02_l');
  signatures.add(JSON.stringify(['index_01_l','middle_02_l','thumb_02_l'].map(name=>q(d,name).toArray())));
  poseGripFingers(d,{kick:1,gather:0});assert(finger.angleTo(q(d,'middle_02_l'))>.05);
  poseGripFingers(d,{kick:0,gather:0});assert.deepEqual(pose(d),rest);
 }
 assert.equal(signatures.size,4);
 const book=grip('grimoire');poseGripFingers(book);assert(q(book,'index_02_l').angleTo(new T.Quaternion())<q(book,'ring_02_l').angleTo(new T.Quaternion())*.5,'reading hand has no leading finger');
});

test('pole front hands guide and rear hands brace, while the dart pinches and opens without changing its anchor',()=>{
 for(const id of['shadowblade','harpoon']){
  const d=grip(id);poseGripFingers(d);assert(q(d,'index_02_r').angleTo(new T.Quaternion())>q(d,'index_02_l').angleTo(new T.Quaternion())+.15);
  const rest=pose(d),rear=q(d,'middle_02_r');poseGripFingers(d,{kick:1});assert(rear.angleTo(q(d,'middle_02_r'))>.05);poseGripFingers(d);assert.deepEqual(pose(d),rest);
 }
 const d=grip('shuriken');poseGripFingers(d);const held=q(d,'index_02_r');poseGripFingers(d,{kick:1});assert(held.angleTo(q(d,'index_02_r'))>.5);assert.deepEqual(GRIP_POINTS.shuriken,[-.07,0,.06]);
});

const world=new URL('../world.js',import.meta.url),entry=fs.readFileSync(world,'utf8').match(/from['"](.\/skinned-hero\.js[^'"]*)['"]/)[1];
const{loadHeroAssets,createSkinnedHero,animateSkinnedHero,disposeHero}=await import(new URL(entry,world));
before(async()=>{
 const original=Object.fromEntries(['fetch','self','ProgressEvent','createImageBitmap'].map(key=>[key,globalThis[key]]));
 try{
  globalThis.self=globalThis;globalThis.ProgressEvent=class{constructor(type,data){Object.assign(this,data);}};globalThis.createImageBitmap=async()=>({width:512,height:512,close(){}});
  globalThis.fetch=async input=>{const url=typeof input==='string'?input:input.url;return url.startsWith('file:')?new Response(fs.readFileSync(fileURLToPath(url))):original.fetch(input);};
  await loadHeroAssets();
 }finally{for(const[key,value]of Object.entries(original))if(value===undefined)delete globalThis[key];else globalThis[key]=value;}
});

test('four real hero rigs keep weapon palm anchors through standing, running and every melee combo',()=>{
 for(const[kind,id]of[['scout','rifle'],['scout','shotgun'],['scout','fire'],['silver','crossbow'],['silver','shuriken'],['silver','dark'],['wraith','shade'],['wraith','grimoire'],['wraith','shadowblade'],['tide','harpoon']]){
  const hero=createSkinnedHero(kind,id),d=hero.userData,dt=1/60,period=.8;let time=0,maxSupport=0;
  Object.assign(d,{aimActive:true,aimAngle:0,aimPitch:0,reloadDuration:period,shotSerial:0,reloadPhase:1});
  try{
   for(let i=0;i<60;i++)animateSkinnedHero(hero,time+=dt,0,0,0);
   for(let combo=0;combo<3;combo++)for(let frame=0;frame<=48;frame++){
    const age=frame*dt;d.shotSerial=combo+1;d.scytheCombo=combo;d.harpoonCombo=combo;d.reloadPhase=age/period;d.aimPitch=Math.sin(age*5)*.45;d.travelAngle=.35;
    animateSkinnedHero(hero,time+=dt,combo?4:0,Math.max(0,.18-age),0);hero.updateMatrixWorld(true);
    const palm=d.support.rightHand.localToWorld(new T.Vector3(-.036,.097,0)),anchor=d.gun.localToWorld(new T.Vector3(...GRIP_POINTS[id]));assert(palm.distanceTo(anchor)<1e-6,`${id} moved off the right palm`);
    if(id==='shadowblade'){
     const support=d.support.hand.localToWorld(new T.Vector3(.036,.097,0)),shaft=d.gun.localToWorld(new T.Vector3(...SCYTHE_SUPPORT));maxSupport=Math.max(maxSupport,support.distanceTo(shaft));
    }
    for(const f of [...d.handGrips.fingers,...d.handGrips.thumb]){assert(f.bone.matrixWorld.elements.every(Number.isFinite),`${id} non-finite finger pose`);assert(Math.abs(f.bone.quaternion.lengthSq()-1)<1e-6)}
   }
   // The existing coupled scythe solver retains its forward contact throughout
   // all three swings; neither finger shaping nor spell gestures move a wrist.
   if(id==='shadowblade')assert(maxSupport<.045,`scythe front hand gap ${maxSupport}`);
  }finally{disposeHero(hero);}
 }
});
