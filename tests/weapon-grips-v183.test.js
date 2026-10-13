import {test,before} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import * as T from '../vendor/three.module.js';
import {createHandGrips,poseGripFingers,GRIP_POINTS} from '../weapon-grips.js';
import {POISON} from '../poison-config.js';

function isolatedGrip(id,aimBlend=1){
 const bones=new Map();
 for(const side of['l','r']){
  bones.set('hand_'+side,new T.Bone());
  for(const name of['thumb','index','middle','ring','pinky'])for(let i=1;i<=3;i++){
   const bone=new T.Bone();bone.quaternion.setFromEuler(new T.Euler(.07,-.11,.13));bones.set(`${name}_0${i}_${side}`,bone);
  }
 }
 return{weaponId:id,aimBlend,handGrips:createHandGrips(bones),bones};
}
const rotations=d=>[...d.bones.values()].flatMap(b=>b.quaternion.toArray());

test('the ten other live weapons retain their v182 finger poses exactly',()=>{
 const samples=[];
 // Also retain the dormant hammer pose; the digest was captured from v182,
 // before the pouch/cup/hook changes, at full and partial aiming weights.
 for(const id of['rifle','shotgun','crossbow','shuriken','fire','dark','shade','shadowblade','grimoire','harpoon','hammer'])for(const blend of[.4,1]){
  const d=isolatedGrip(id,blend);poseGripFingers(d,{kick:.4,open:.7});
  for(const[key,bone]of d.bones)samples.push([id,blend,key,...bone.quaternion.toArray().map(n=>+n.toFixed(12))]);
 }
 assert.equal(createHash('sha256').update(JSON.stringify(samples)).digest('hex'),'6ac11c43e009082275a1ed9e81b58b6da4d543a8ed3ddec0c487f2bf65397fa6');
});

test('a held pod stays cupped through anticipation, then thumb and fingers release and recover together',()=>{
 const d=isolatedGrip('sporelantern');poseGripFingers(d,{open:0,kick:0});const closed=rotations(d);
 poseGripFingers(d,{open:0,kick:1});assert.deepEqual(rotations(d),closed,'arm anticipation opened the occupied hand');
 const thumb=d.bones.get('thumb_02_l').quaternion.clone(),finger=d.bones.get('index_02_l').quaternion.clone();
 poseGripFingers(d,{open:1,kick:1});assert(thumb.angleTo(d.bones.get('thumb_02_l').quaternion)>.4);assert(finger.angleTo(d.bones.get('index_02_l').quaternion)>.5);
 poseGripFingers(d,{open:0,kick:0});assert.deepEqual(rotations(d),closed,'release rotation accumulated into the next pod');
});

test('the sling pinches with its index and thumb while leaving the other fingers softer',()=>{
 const d=isolatedGrip('boomerang');poseGripFingers(d,{open:0});
 const index=d.bones.get('index_02_l').quaternion,other=d.bones.get('middle_02_l').quaternion;
 assert(index.angleTo(new T.Quaternion())>other.angleTo(new T.Quaternion())+.3);
 const before=d.bones.get('thumb_02_l').quaternion.clone();poseGripFingers(d,{open:1});assert(before.angleTo(d.bones.get('thumb_02_l').quaternion)>.4);
});

const world=new URL('../world.js',import.meta.url),entry=fs.readFileSync(world,'utf8').match(/from['"](.\/skinned-hero\.js[^'"]*)['"]/)[1];
const{loadHeroAssets,createSkinnedHero,animateSkinnedHero,disposeHero}=await import(new URL(entry,world));
before(async()=>{
 const original=Object.fromEntries(['fetch','self','ProgressEvent','createImageBitmap'].map(key=>[key,globalThis[key]]));
 try{
  globalThis.self=globalThis;globalThis.ProgressEvent=class{constructor(type,data){Object.assign(this,data);}};
  globalThis.createImageBitmap=async()=>({width:512,height:512,close(){}});
  globalThis.fetch=async input=>{const url=typeof input==='string'?input:input.url;return url.startsWith('file:')?new Response(fs.readFileSync(fileURLToPath(url))):original.fetch(input);};
  await loadHeroAssets();
 }finally{for(const[key,value]of Object.entries(original))if(value===undefined)delete globalThis[key];else globalThis[key]=value;}
});

test('actual lamp rigs retain palm contact and the pod release clock while moving and casting rapidly',()=>{
 for(const[kind,id]of[['wuling','sporelantern'],['mirage','miasmalantern']])for(const fps of[30,60])for(const period of[.08,.30,1.25]){
  const hero=createSkinnedHero(kind,id),d=hero.userData,dt=1/fps;let time=0;
  Object.assign(d,{aimActive:true,aimAngle:0,aimPitch:0,reloadDuration:period,shotSerial:0,reloadPhase:1});
  try{
   for(let i=0;i<fps;i++)animateSkinnedHero(hero,time+=dt,0,0,0);
   for(let frame=0;frame<fps*2;frame++){
    const elapsed=frame*dt,age=elapsed%period;d.shotSerial=1+Math.floor(elapsed/period);d.reloadPhase=age/period;d.aimPitch=Math.sin(elapsed*2)*.8;d.travelAngle=.4;
    animateSkinnedHero(hero,time+=dt,4,Math.max(0,.18-age),0);hero.updateMatrixWorld(true);
    const palm=d.support.rightHand.localToWorld(new T.Vector3(-.036,.097,0)),grip=d.gun.localToWorld(new T.Vector3(...GRIP_POINTS[id]));assert(palm.distanceTo(grip)<1e-6,'the carrying hand left the ring');
    if(kind==='wuling'){
     const cycle=Math.min(POISON.castRecovery,Math.max(.12,period*.9));
     assert.equal(d.sporePod.visible,age<cycle*POISON.releaseFraction||age>cycle*.76);
     const cup=d.support.hand.localToWorld(new T.Vector3(.036,.097,0));assert(cup.distanceTo(d.sporePod.getWorldPosition(new T.Vector3()))<1e-8,'pod no longer belongs to the actual left palm');
     // The opposed thumb was previously omitted entirely for this left hand.
     assert(d.handGrips.thumb.filter(t=>t.side==='l').every(t=>Number.isFinite(t.bone.quaternion.lengthSq())));
    }
    for(const f of [...d.handGrips.fingers,...d.handGrips.thumb])assert(f.bone.matrixWorld.elements.every(Number.isFinite));
   }
   d.shotSerial=0;d.reloadPhase=1;d.aimPitch=0;
   for(let i=0;i<fps;i++)animateSkinnedHero(hero,time+=dt,0,0,0);
   if(kind==='wuling')assert(d.sporePod.visible,'idle retained the last cast hidden pod');
  }finally{disposeHero(hero);}
 }
});

test('opening one hero hand does not mutate another hero or a newly created grip',()=>{
 for(const[kind,id]of[['lingya','boomerang'],['wuling','sporelantern'],['mirage','miasmalantern']]){
  const a=createSkinnedHero(kind,id),b=createSkinnedHero(kind,id);
  try{
   const before=b.userData.handGrips.thumb.map(t=>t.q.toArray());
   for(let i=0;i<20;i++)poseGripFingers(a.userData,{open:i%2,kick:1});
   assert.deepEqual(b.userData.handGrips.thumb.map(t=>t.q.toArray()),before);assert.deepEqual(a.userData.handGrips.thumb.map(t=>t.q.toArray()),before,'saved thumb rest was mutated');
  }finally{disposeHero(a);disposeHero(b);}
 }
});
