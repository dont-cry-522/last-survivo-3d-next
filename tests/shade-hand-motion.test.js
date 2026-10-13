import {before,test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import * as T from '../vendor/three.module.js';
import {createHandGrips,poseGripFingers,GRIP_POINTS} from '../weapon-grips.js';

function grip(id,aimBlend=1){
 const bones=new Map();for(const side of['l','r']){
  bones.set('hand_'+side,new T.Bone());for(const name of['thumb','index','middle','ring','pinky'])for(let i=1;i<=3;i++){
   const b=new T.Bone();b.quaternion.setFromEuler(new T.Euler(.07,-.11,.13));bones.set(`${name}_0${i}_${side}`,b);
  }
 }
 return{weaponId:id,aimBlend,reloadPhase:.5,bones,handGrips:createHandGrips(bones)};
}
test('the shade pass leaves the other twelve live weapon hand poses unchanged',()=>{
 const samples=[];
 for(const id of['rifle','shotgun','crossbow','shuriken','fire','dark','shadowblade','grimoire','harpoon','boomerang','sporelantern','miasmalantern'])for(const blend of[.4,1]){
  const d=grip(id,blend);poseGripFingers(d,{kick:.4,open:.7,gather:.6,draw:.4});
  for(const[key,b]of d.bones)samples.push([id,blend,key,...b.quaternion.toArray().map(n=>+n.toFixed(12))]);
 }
 // Captured from the accepted v184 pose code before the shade-only refinement.
 assert.equal(createHash('sha256').update(JSON.stringify(samples)).digest('hex'),'02e67fb38f9ce98d5bb436c0fc4fc1350e2bf229fd23bc90239b7665889f1911');
});

test('shade fingers remain shallow and the opposed thumb opens without changing its saved rest',()=>{
 const d=grip('shade'),rest=d.handGrips.thumb.map(t=>t.q.toArray());
 for(const kick of[0,.5,1,0]){
  poseGripFingers(d,{kick,gather:0});
  for(const side of['l','r'])for(const name of['index','middle','ring','pinky'])for(const i of[2,3])assert(d.bones.get(`${name}_0${i}_${side}`).quaternion.angleTo(new T.Quaternion())<.27,'finger closes around an imaginary handle');
  for(const thumb of d.handGrips.thumb)assert(thumb.bone.quaternion.angleTo(thumb.q)>.29,'thumb remains wrapped over the palm');
 }
 assert.deepEqual(d.handGrips.thumb.map(t=>t.q.toArray()),rest);
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

test('the actual shade rig guides the focus with upward palms through repeated casts and recovery',()=>{
 for(const fps of[30,60,120])for(const period of[.25,.8]){
  const hero=createSkinnedHero('wraith','shade'),d=hero.userData,dt=1/fps;let time=0,previous=null,maxStep=0;
  Object.assign(d,{aimActive:true,aimAngle:0,aimPitch:0,reloadDuration:period,shotSerial:0,reloadPhase:1});
  try{
   for(let i=0;i<fps;i++)animateSkinnedHero(hero,time+=dt,0,0,0);
   for(let frame=0;frame<fps*3;frame++){
    const elapsed=frame*dt,age=elapsed%period;d.shotSerial=1+Math.floor(elapsed/period);d.reloadPhase=age/period;d.aimAngle=Math.sin(elapsed)*.25;d.travelAngle=.25;
    animateSkinnedHero(hero,time+=dt,elapsed>1?4:0,Math.max(0,.18-age),0);hero.updateMatrixWorld(true);
    const palm=d.support.rightHand.localToWorld(new T.Vector3(-.036,.097,0)),anchor=d.gun.localToWorld(new T.Vector3(...GRIP_POINTS.shade));assert(palm.distanceTo(anchor)<1e-6,'floating tear lost its original palm anchor');
    const positions=[];
    for(const hand of[d.support.rightHand,d.support.hand]){
     const rotation=hand.getWorldQuaternion(new T.Quaternion()),normal=new T.Vector3(0,0,1).applyQuaternion(rotation);assert(normal.y>.75,'guiding hand turns into an inward punch');
     positions.push(hand.getWorldPosition(new T.Vector3()));assert(hand.matrixWorld.elements.every(Number.isFinite));
    }
    if(previous)for(let i=0;i<2;i++)maxStep=Math.max(maxStep,positions[i].distanceTo(previous[i]));previous=positions;
   }
   assert(maxStep<.12,`${fps} Hz wrist motion snaps by ${maxStep} m`);
   d.reloadPhase=1;for(let i=0;i<fps;i++)animateSkinnedHero(hero,time+=dt,0,0,0);
   const recovered=d.handGrips.fingers.map(f=>f.bone.quaternion.clone());
   for(let i=0;i<fps;i++)animateSkinnedHero(hero,time+=dt,0,0,0);
   assert(d.handGrips.fingers.every((f,i)=>f.bone.quaternion.angleTo(recovered[i])<1e-6),'resting fingers retain a last-shot rotation');
  }finally{disposeHero(hero);}
 }
});
