import {before,test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import * as T from '../vendor/three.module.js';
import {SCOUT_ROLL_DURATION,rollWeight,rollTravel} from '../dodge-motion.js';

const worldURL=new URL('../world.js',import.meta.url),entry=fs.readFileSync(worldURL,'utf8').match(/from['"](.\/skinned-hero\.js[^'"]*)['"]/)[1];
const {loadHeroAssets,createSkinnedHero,animateSkinnedHero,disposeHero}=await import(new URL(entry,worldURL));
before(async()=>{
 const original=Object.fromEntries(['fetch','self','ProgressEvent','createImageBitmap'].map(key=>[key,globalThis[key]]));
 try{
  globalThis.self=globalThis;globalThis.ProgressEvent=class{constructor(type,data){Object.assign(this,data);}};
  globalThis.createImageBitmap=async()=>({width:512,height:512,close(){}});
  globalThis.fetch=async input=>{const url=typeof input==='string'?input:input.url;return url.startsWith('file:')?new Response(fs.readFileSync(fileURLToPath(url))):original.fetch(input);};
  await loadHeroAssets();
 }finally{for(const [key,value]of Object.entries(original))if(value===undefined)delete globalThis[key];else globalThis[key]=value;}
});
const delta=(a,b)=>Math.atan2(Math.sin(a-b),Math.cos(a-b));
const point=(hero,name)=>hero.userData.model.skeleton.bones.find(b=>b.name===name).getWorldPosition(new T.Vector3());

test('all scout weapons roll along four world travel directions despite a lagging parent turn and changing aim',()=>{
 for(const weapon of ['rifle','shotgun','fire'])for(const base of [0,2.8])for(const turn of [0,Math.PI/2,-Math.PI/2,Math.PI]){
  const hero=createSkinnedHero('scout',weapon),aligned=createSkinnedHero('scout',weapon),heading=base+turn;
  try{
   hero.rotation.y=base;aligned.rotation.y=heading;
   for(let frame=0;frame<20;frame++)for(const g of [hero,aligned])animateSkinnedHero(g,frame/60,0,0,0);
   let matched=0;
   for(let frame=0;frame<=64;frame++){
    const elapsed=frame/120,remaining=Math.max(0,SCOUT_ROLL_DURATION-elapsed),weight=rollWeight(remaining),travel=rollTravel(remaining);
    // Model the parent's ordinary turn independently from a camera/aim yaw moving away.
    hero.rotation.y=base+turn*Math.min(1,elapsed/.40);const parentYaw=hero.rotation.y;
    for(const g of [hero,aligned]){Object.assign(g.userData,{dashTime:remaining,dashAngle:heading,aimAngle:base-elapsed*7,aimActive:true,travelAngle:heading});g.position.set(Math.sin(heading)*travel,0,Math.cos(heading)*travel);animateSkinnedHero(g,1+elapsed,0,0,0);g.updateMatrixWorld(true);}
    assert.equal(hero.rotation.y,parentYaw,'pose changed the parent/gameplay facing');
    const axis=new T.Vector3(0,0,1).applyQuaternion(hero.userData.rig.getWorldQuaternion(new T.Quaternion())),error=Math.abs(delta(Math.atan2(axis.x,axis.z),heading));
    assert(error<=Math.abs(delta(parentYaw,heading))*(1-weight)+1e-6,'roll axis does not blend onto its world travel direction');
    if(weight>.999999){for(const name of ['Head','pelvis','hand_r','hand_l','calf_r','calf_l'])assert(point(hero,name).distanceTo(point(aligned,name))<1e-5,name+' still follows the pre-dodge facing');matched++;}
    assert([...hero.position].every(Number.isFinite));
   }
   assert(matched>20);assert(Math.abs(hero.userData.rig.rotation.y)<1e-12,'roll heading remains after recovery');assert.equal(hero.userData.rollYaw,0);
  }finally{disposeHero(hero);disposeHero(aligned);}
 }
});

test('roll yaw recovers without accumulation and leaves swimming strokes unrotated',()=>{
 const hero=createSkinnedHero('scout','rifle'),d=hero.userData;let time=0;
 try{
  d.rig.rotation.y=.035;
  for(const target of [Math.PI/2,-Math.PI/2,Math.PI,0]){
   hero.rotation.y=.2;d.dashAngle=target;
   for(let frame=0;frame<70;frame++){d.dashTime=Math.max(0,SCOUT_ROLL_DURATION-frame/120);animateSkinnedHero(hero,time+=1/120,0,0,0);}
   assert(Math.abs(d.rig.rotation.y-.035)<1e-12,'repeat rolls accumulate or erase the pre-existing rig offset');
  }
  for(const state of [{waterDepth:.6,waterDash:false},{waterDepth:0,waterDash:true},{waterDepth:0,waterDash:false,dashAngle:NaN}]){
   Object.assign(d,{dashTime:.3,dashAngle:Math.PI/2},state);animateSkinnedHero(hero,time+=1/60,3,0,0);
   assert(Math.abs(d.rig.rotation.y-.035)<1e-12);assert.equal(d.rollYaw,0);
  }
 }finally{disposeHero(hero);}
});
