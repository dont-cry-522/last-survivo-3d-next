import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import * as T from '../vendor/three.module.js';
import {slingshotMechanism} from '../weapon-performance.js';

const world=new URL('../world.js',import.meta.url),entry=fs.readFileSync(world,'utf8').match(/from['"](.\/skinned-hero\.js[^'"]*)['"]/)[1];
const {loadHeroAssets,createSkinnedHero,animateSkinnedHero,disposeHero}=await import(new URL(entry,world));

test('actual Lingya skeleton keeps both sling contacts through continuous fire and haste',async t=>{
 const saved=Object.fromEntries(['fetch','self','ProgressEvent','createImageBitmap'].map(k=>[k,globalThis[k]]));
 try{
  globalThis.self=globalThis;globalThis.ProgressEvent=class{constructor(type,data){Object.assign(this,data);}};globalThis.createImageBitmap=async()=>({width:512,height:512,close(){}});
  globalThis.fetch=async input=>{const url=typeof input==='string'?input:input.url;return url.startsWith('file:')?new Response(fs.readFileSync(fileURLToPath(url))):saved.fetch(input);};
  await loadHeroAssets();
  for(const fps of [30,60])for(const period of [.67,.25,.08])await t.test(`${fps} fps, ${period} second cycle`,()=>{
   const hero=createSkinnedHero('lingya','boomerang'),d=hero.userData,dt=1/fps;
   const palm=new T.Vector3(),pouch=new T.Vector3(),grip=new T.Vector3(),right=new T.Vector3();
   Object.assign(d,{aimActive:true,aimAngle:0,aimPitch:0,reloadDuration:period,shotSerial:0,reloadPhase:1});let time=0;
   try{
    assert.equal(d.kineticActions,null,'the old whole-body throwing clip is still enabled');
    for(let i=0;i<fps;i++){time+=dt;animateSkinnedHero(hero,time,0,0,0);}
    for(let frame=0;frame<Math.ceil(8*period/dt);frame++){
     const elapsed=frame*dt,age=elapsed%period,mechanism=slingshotMechanism(age,period);
     time+=dt;d.shotSerial=1+Math.floor(elapsed/period);d.reloadPhase=age/period;d.travelAngle=.4;d.aimPitch=Math.sin(frame/(8*period/dt)*Math.PI*2)*1.2;
     animateSkinnedHero(hero,time,frame<4*period/dt?0:4,Math.max(0,.16-age),0);hero.updateMatrixWorld(true);
     assert(Math.abs(d.attackGesture-mechanism.kick)<1e-8,'body and fingers lag a different shot clock');
     assert(d.gun.visible&&d.gun.parent===d.support.rightHand,'the wooden fork was thrown or hidden');
     assert.equal(d.gun.userData.projectile.visible,mechanism.stoneVisible,'loaded stone disagrees with release clock');
     assert(Math.abs(d.gun.userData.pouch.position.z-(-.07-.30*mechanism.pull))<1e-8);
     d.support.rightHand.localToWorld(right.set(-.036,.097,0));d.gun.localToWorld(grip.set(0,-.13,0));assert(right.distanceTo(grip)<1e-6,'right palm lost the leather grip');
     // Before release the fingers must stay on the pouch, including partial draw.
     // Afterwards they follow their slower return, not the recoiling rubber.
     d.support.hand.localToWorld(palm.set(.036,.097,0));d.gun.localToWorld(pouch.set(0,.22,-.07-.30*mechanism.handPull));
     assert(palm.distanceTo(pouch)<.085,`left palm detached by ${palm.distanceTo(pouch).toFixed(3)} m at ${age.toFixed(4)} s`);
     for(const bone of [d.aimArm,d.firingForearm,d.offArm,d.offForearm,d.support.hand])assert(bone.matrixWorld.elements.every(Number.isFinite));
    }
   }finally{disposeHero(hero);}
  });
 }finally{for(const [key,value]of Object.entries(saved))if(value===undefined)delete globalThis[key];else globalThis[key]=value;}
});
