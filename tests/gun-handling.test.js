import test from 'node:test';
import assert from 'node:assert/strict';
import {weaponStats} from '../rules.js';
import {shotInterval,shotgunVolley,shotgunHit,SHOTGUN_PUSH} from '../gun-handling.js';
import {GameAudio} from '../audio.js';
import {weaponDuration,shotStarted} from '../weapon-performance.js';

const stats=(id,path,rank=1,haste=0)=>weaponStats({weaponId:id,weaponPath:path?{id:path,rank}:null,upgrades:{haste}});
const close=(a,b)=>assert(Math.abs(a-b)<1e-10,`${a} != ${b}`);
const foe=(x=0,z=3)=>({x,z,alive:true});
const contact=(x=0,y=1,z=3)=>({x,y,z});

test('rapid rifle keeps the existing damage and average rate budget at every rank and haste',()=>{
 for(const rank of [1,2,3])for(const haste of [0,1,2,3,4]){
  const w=stats('rifle','rifle_rapid',rank,haste),p={};
  close(w.rate,3*(1+.2*rank)*(1+.15*haste));close(w.damage,12*.92);
  close(w.range,14);assert.equal(w.count,1);
  const intervals=Array.from({length:9},()=>shotInterval(p,w));
  for(let i=0;i<9;i+=3){
   assert(intervals[i]===intervals[i+1]&&intervals[i+2]>intervals[i]);
   close(intervals.slice(i,i+3).reduce((a,b)=>a+b),3/w.rate);
   close(3*w.damage/intervals.slice(i,i+3).reduce((a,b)=>a+b),w.damage*w.rate);
  }
  assert.equal(p.rifleBurst,0);
 }
 for(const w of [stats('rifle'),stats('rifle','rifle_pierce'),stats('shotgun'),stats('crossbow','crossbow_hunt')]){
  const p={};for(let i=0;i<7;i++)close(shotInterval(p,w),1/w.rate);
  assert.equal(p.rifleBurst,undefined);
 }
});

test('a resumed partial burst still owes its recovery and a fresh player starts independently',()=>{
 const w=stats('rifle','rifle_rapid'),p={};
 close(shotInterval(p,w),.5/w.rate);assert.equal(p.rifleBurst,1);
 // Integration checks cover pause/input handling. Here the saved partial state
 // must lead to the third-shot recovery, never another pair of short intervals.
 close(shotInterval(p,w),.5/w.rate);assert.equal(p.rifleBurst,2);
 close(shotInterval(p,w),2/w.rate);assert.equal(p.rifleBurst,0);
 const next={};close(shotInterval(next,w),.5/w.rate);assert.equal(next.rifleBurst,1);
});

test('maximum haste still emits every real rifle shot and allows its pose to recover',()=>{
 const w=stats('rifle','rifle_rapid',3,4),p={},heard=[],audio={ctx:{currentTime:0},cooldowns:new Map(),available:()=>true,weapon:(...args)=>heard.push(args),allow:GameAudio.prototype.allow},pose={shotSerial:0};
 for(let i=0;i<12;i++){
  pose.shotSerial++;assert(shotStarted(pose,.16,.16));
  GameAudio.prototype.shot.call(audio,w.id);
  const interval=shotInterval(p,w);assert(weaponDuration(w.id,interval)<interval);
  audio.ctx.currentTime+=interval;
 }
 assert.equal(heard.length,12);assert(heard.every(args=>args[0]==='rifle'&&args[1]==='shot'));
});

test('one shotgun volley pushes once per target even when pellets arrive across frames',()=>{
 const origin={x:0,y:1,z:0},volley=shotgunVolley(stats('shotgun'),origin),a=foe(),b=foe(.5,3);
 origin.x=30;origin.z=-20;
 assert.equal(shotgunHit(volley,a,contact()),null);
 assert.equal(shotgunHit(volley,b,contact(.5)),null);
 assert.equal(shotgunHit(volley,a,contact()),null);
 const push=shotgunHit(volley,a,contact());assert.equal(push.target,a);close(push.dx,0);close(push.dz,1.1);
 // A later frame uses the same volley rather than a new per-frame counter.
 for(let i=0;i<6;i++)assert.equal(shotgunHit(volley,a,contact()),null);
 assert.equal(shotgunHit(volley,b,contact(.5)),null);
 const second=shotgunHit(volley,b,contact(.5));assert.equal(second.target,b);close(Math.hypot(second.dx,second.dz),1.1);
 assert.equal(volley.hits.get(a),9);assert.equal(volley.hits.get(b),3);
 const fresh=shotgunVolley(stats('shotgun'),{x:0,y:1,z:0});
 assert.equal(shotgunHit(fresh,a,contact()),null);assert.equal(fresh.hits.get(a),1);
});

test('shotgun range uses each actual 3D contact and never counts distant pellets',()=>{
 const w=stats('shotgun'),origin={x:0,y:1,z:0},target=foe(),volley=shotgunVolley(w,origin);
 for(const p of [contact(0,1,3.50001),contact(0,3,3)])for(let i=0;i<4;i++)assert.equal(shotgunHit(volley,target,p),null);
 assert.equal(volley.hits.size,0);
 for(let i=0;i<2;i++)assert.equal(shotgunHit(volley,target,contact(0,1,3.5)),null);
 assert(shotgunHit(volley,target,contact(0,1,3.5)));
 assert.equal(SHOTGUN_PUSH.stagger,.18);
});

test('slug, unrelated projectiles, bosses and dead targets never request a shotgun push',()=>{
 for(const w of [stats('shotgun','shotgun_slug'),stats('rifle'),stats('shuriken')])assert.equal(shotgunVolley(w,{x:0,y:1,z:0}),null);
 const volley=shotgunVolley(stats('shotgun','shotgun_fan',3),{x:0,y:1,z:0});
 for(const target of [{...foe(),boss:true},{...foe(),alive:false}])for(let i=0;i<9;i++)assert.equal(shotgunHit(volley,target,contact()),null);
 assert.equal(volley.hits.size,0);assert.equal(shotgunHit(null,foe(),contact()),null);
});
