import {before,test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import * as T from '../vendor/three.module.js';
import {actor,animateActor} from '../world.js';
import {crossbowMechanism} from '../weapon-performance.js';

const worldURL=new URL('../world.js',import.meta.url);
const entry=fs.readFileSync(worldURL,'utf8').match(/from['"](.\/skinned-hero\.js[^'"]*)['"]/)[1];
const {loadHeroAssets,disposeHero}=await import(new URL(entry,worldURL));
before(async()=>{
 const original=Object.fromEntries(['fetch','self','ProgressEvent','createImageBitmap'].map(key=>[key,globalThis[key]]));
 try{
  globalThis.self=globalThis;globalThis.ProgressEvent=class{constructor(type,data){Object.assign(this,data);}};
  globalThis.createImageBitmap=async()=>({width:512,height:512,close(){}});
  globalThis.fetch=async input=>{const url=typeof input==='string'?input:input.url;return url.startsWith('file:')?new Response(fs.readFileSync(fileURLToPath(url))):original.fetch(input);};
  await loadHeroAssets();
 }finally{for(const [key,value]of Object.entries(original))if(value===undefined)delete globalThis[key];else globalThis[key]=value;}
});

test('the actual silver rig keeps its trigger hand planted while the left hand operates and releases the cocking slide',()=>{
 for(const fps of[30,60,120])for(const speed of[0,6])for(const pitch of[-1.2,-.65,0,.65,1.2]){
  const hero=actor('silver','crossbow'),d=hero.userData;let time=0,maxGap=0,maxPhase=0;
  try{
   d.aimActive=true;d.aimPitch=pitch;d.reloadDuration=.8;d.reloadPhase=1;
   for(let i=0;i<fps;i++){time+=1/fps;animateActor(hero,time,speed,0,0);}
   d.shotSerial=1;
   for(let i=0;i<=fps*.8;i++){
    const phase=Math.min(1,i/fps/.8),mechanism=crossbowMechanism(phase);d.reloadPhase=phase;time+=1/fps;animateActor(hero,time,speed,Math.max(0,.18-i/fps),0);hero.updateMatrixWorld(true);
    assert(Math.abs(d.gun.userData.stringPull-mechanism.pull)<1e-9);assert.equal(d.gun.userData.crossbowBolt.visible,mechanism.boltVisible);
    const trigger=d.support.rightHand.localToWorld(new T.Vector3(-.036,.097,0)),grip=d.gun.localToWorld(new T.Vector3(0,-.08,.01));assert(trigger.distanceTo(grip)<.002,'trigger hand detached');
    const target=new T.Vector3(0,-.05,.18).lerp(new T.Vector3(.06,.13,.29-mechanism.pull),mechanism.hand),support=d.support.hand.localToWorld(new T.Vector3(.036,.097,0));d.gun.localToWorld(target);
    if(support.distanceTo(target)>maxGap){maxGap=support.distanceTo(target);maxPhase=phase;}
   }
   assert(maxGap<.015,`support hand misses mechanism: fps=${fps} speed=${speed} pitch=${pitch} phase=${maxPhase} gap=${maxGap}`);
  }finally{disposeHero(hero);}
 }
});
