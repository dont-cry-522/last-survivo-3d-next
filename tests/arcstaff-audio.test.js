import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../vendor/three.module.js';
import {weaponSample,weaponTakeCount} from '../weapon-audio.js';
import {GameAudio} from '../audio.js';
import {recordEnemyHit,restoreEnemyHit,animateEnemyHit} from '../enemy-feedback.js';

test('arcstaff uses three short electrical takes with quiet contact and smooth bounded tails',()=>{
 assert.equal(weaponTakeCount('arcstaff'),3);
 for(const rate of [22050,44100,48000]){
  const signatures=new Set();
  for(let take=0;take<3;take++){
   const levels={};
   for(const event of ['shot','impact','mechanism']){
    const samples=weaponSample('arcstaff',event,rate,0,take);let energy=0,peak=0;
    assert(samples.length<=Math.ceil(rate*.22));
    for(const v of samples){assert(Number.isFinite(v));energy+=v*v;peak=Math.max(peak,Math.abs(v));}
    levels[event]=Math.sqrt(energy/samples.length);assert(levels[event]>.002);assert(peak<.35);
    assert.equal(Math.abs(samples[0]),0);assert(Math.abs(samples.at(-1))<.001);
    signatures.add(event+':'+Array.from({length:20},(_,i)=>samples[Math.floor((i+1)*samples.length/21)].toFixed(5)).join(','));
   }
   assert(levels.shot>.01);assert(levels.impact>.008);assert(levels.impact<levels.shot);assert(levels.mechanism<levels.impact);
  }
  assert.equal(signatures.size,9);
 }
});

test('arcstaff target contact stays a quiet shared layer and groups chained hits into one voice',()=>{
 const audio=new GameAudio({currentTime:1,state:'running'}),calls=[];audio.ready=true;audio.weapon=(...args)=>{calls.push(args);return true;};
 assert(audio.contact('arcstaff','wolf'));assert.equal(calls[0][0],'surface:fur');assert.equal(calls[0][3],.16);
 assert.equal(audio.contact('arcstaff','golem'),false);assert.equal(calls.length,1);
 audio.ctx.currentTime+=.25;assert(audio.contact('arcstaff','golem'));assert.equal(calls.at(-1)[0],'surface:rock');
 audio.impact('arcstaff',false,0,4,0);assert.equal(calls.at(-1)[0],'arcstaff');assert.equal(calls.at(-1)[1],'impact');
 audio.shot('arcstaff');assert.equal(calls.at(-1)[0],'arcstaff');assert.equal(calls.at(-1)[1],'shot');
});

test('arcstaff hit twitch settles between pulses without changing target collision position',()=>{
 const mesh=new T.Group(),rig=new T.Group();mesh.add(rig);mesh.userData.rig=rig;
 for(let pulse=0;pulse<4;pulse++){
  recordEnemyHit(mesh,{kind:'arcstaff',targetKind:'wolf',damage:12,maxHp:100});
  assert(mesh.userData.hitReaction.strength<.06);assert(mesh.userData.hitReaction.duration<.20);
  for(let step=0;step<15;step++){restoreEnemyHit(mesh);animateEnemyHit(mesh,1/60);assert.equal(mesh.position.length(),0);assert(rig.position.length()<.06);}
  assert.equal(mesh.userData.hitReaction,null);assert(rig.position.length()<1e-9);
 }
});

test('briarpot has three dry seed rattles and thorn splits distinct from electrical and explosive weapons',()=>{
 assert.equal(weaponTakeCount('briarpot'),3);
 for(const rate of [22050,44100,48000])for(const event of ['shot','impact']){
  const signatures=new Set();
  for(let take=0;take<3;take++){
   const samples=weaponSample('briarpot',event,rate,0,take);let energy=0;
   assert(samples.length<=Math.ceil(rate*.22));
   for(const v of samples){assert(Number.isFinite(v)&&Math.abs(v)<.5);energy+=v*v;}
   assert(Math.sqrt(energy/samples.length)>.01);assert.equal(Math.abs(samples[0]),0);assert(Math.abs(samples.at(-1))<.001);
   const signature=data=>Array.from({length:20},(_,i)=>data[Math.floor((i+1)*data.length/21)].toFixed(5)).join(',');
   signatures.add(signature(samples));
   for(const id of ['arcstaff','fire','sporelantern'])assert.notEqual(signature(samples),signature(weaponSample(id,event,rate,0,take)));
  }
  assert.equal(signatures.size,3);
 }
 const audio=new GameAudio({currentTime:1,state:'running'}),calls=[];audio.ready=true;audio.weapon=(...args)=>{calls.push(args);return true;};
 assert(audio.contact('briarpot','tidecrab'));assert.equal(calls[0][0],'surface:shell');assert.equal(calls[0][3],.30);
 assert.equal(audio.contact('briarpot','wolf'),false);
 const mesh=new T.Group();mesh.userData.rig=new T.Group();mesh.add(mesh.userData.rig);
 recordEnemyHit(mesh,{kind:'briarpot',damage:44,maxHp:100});assert(mesh.userData.hitReaction.strength<.13);assert.equal(mesh.userData.hitReaction.duration,.21);
});
