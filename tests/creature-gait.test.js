import test from 'node:test';
import assert from 'node:assert/strict';
import {Vector3} from '../vendor/three.module.js';
import {actor,animateActor} from '../world.js';
import {BOSS_STYLES,tickBoss} from '../boss-combat.js';
import {creatureGait,gaitDistance,footCycle,creatureAttackPose} from '../creature-gait.js';
import {ENEMY_MOTION} from '../enemy-motion.js';

test('feet meet support with continuous horizontal velocity and zero vertical velocity',()=>{
 const epsilon=1e-5;
 for(const stance of [.55,.58,.64,.70])for(const u of [stance,1]){
  const at=x=>footCycle(x*Math.PI*2,1,.15,stance),a=at(u-epsilon),b=at(u),c=at(u+epsilon);
  assert(Math.abs((b.travel-a.travel)/epsilon-(c.travel-b.travel)/epsilon)<.004);
  assert(Math.abs((c.lift-a.lift)/(2*epsilon))<.001);
 }
});

test('fast quadrupeds use longer strokes instead of only accelerating a tiny shuffle',()=>{
 for(const kind of ['wolf','frostwolf','ashstalker']){
  const slow=creatureGait(kind,1.5),fast=creatureGait(kind,4.5);
  assert(fast.travel>slow.travel);assert(fast.lift>slow.lift);assert(fast.support<slow.support);
  assert(gaitDistance(4.5,fast)<gaitDistance(4.5,slow)*.86);
 }
 assert(creatureGait('lavabrute',3.8).support>creatureGait('wolf',3.8).support);
});

test('all grounded bosses plant at their actual translated speed and retain connected limbs',()=>{
 const point=new Vector3(),end=new Vector3();
 for(const kind of Object.keys(BOSS_STYLES))for(const fps of [30,60,120]){
  const m=actor(kind),d=m.userData;if(!d.legs.length)continue;
  const speed=BOSS_STYLES[kind].speed*1.25,previous=[];let support=0;
  animateActor(m,0,0);d.bossStage='walk';m.rotation.y=.4;
  for(let i=1;i<=fps*2;i++){
   m.position.set(Math.sin(.4)*speed*i/fps,0,Math.cos(.4)*speed*i/fps);animateActor(m,i/fps,speed);m.updateMatrixWorld(true);
   for(const [n,l]of d.legs.entries()){
    l.paw.getWorldPosition(point);const old=previous[n];
    if(i>fps&&l.planted&&old?.planted){assert(Math.hypot(point.x-old.x,point.z-old.z)<1e-5,kind+' slides');support++;}
    previous[n]={x:point.x,z:point.z,planted:l.planted};
    end.set(0,-l.a,0).applyMatrix4(l.upper.matrixWorld);assert(end.distanceTo(l.knee.getWorldPosition(new Vector3()))<1e-6,kind+' thigh detaches');
    end.set(0,-l.b,0).applyMatrix4(l.knee.matrixWorld);assert(end.distanceTo(point)<1e-6,kind+' shin detaches');
   }
  }
  assert(support>fps,kind+' no ground support');
  const phase=d.phase;for(let i=1;i<=fps;i++)animateActor(m,2+i/fps,0);assert.equal(d.phase,phase);assert(d.walkStride<.0001);
 }
});

test('real antler/horn charge clocks drive legs, blocked charges cannot run in place',()=>{
 for(const kind of ['thornstag','moltenrhino'])for(const blocked of [false,true])for(const fps of [30,60,120]){
  const m=actor(kind),d=m.userData,b={kind,mesh:m,x:0,z:0,hp:2000,maxHp:2000,phase:1,stage:'walk',cool:0,turn:0};
  animateActor(m,0,0);let during=0,steps=0;
  const io={move:(b,x,z)=>{if(!blocked){b.x+=x;b.z+=z;}},visible:()=>true,zone(){},sound(){},notice(){}};
  for(let i=1;i<fps*5;i++){
   const old=d.phase,speed=tickBoss(b,{x:0,z:7},1/fps,io);animateActor(m,i/fps,speed);
   if(b.stage==='strike'&&speed>.1){during+=d.phase-old;steps++;}
   if(b.stage==='recover')break;
  }
  if(blocked){assert.equal(b.z,0);assert.equal(during,0);}else{assert(b.z>6.9);assert(during>Math.PI*2,kind+' slides through charge with frozen legs');assert(steps>fps/3);}
 }
});

test('placing a fresh creature and teleporting a walker never drags feet to the previous location',()=>{
 for(const kind of ['frostking','thornstag','dunescorpion','tidecrab','clawbeetle']){
  const m=actor(kind),d=m.userData;m.position.set(80,0,-60);animateActor(m,0,0);
  for(let i=1;i<=61;i++){
   if(i===61)m.position.set(-90,0,30);else m.position.z+=1/60;
   animateActor(m,i/60,i===61?0:1);
   for(const l of d.legs)assert(l.joint.position.distanceTo(new Vector3(l.hip.x,l.hip.y,l.hip.z))<.2,kind+' spawn/teleport stretches a limb');
  }
 }
});

test('sand/coast anticipation spans actual wind-ups and cancellation never plays another strike',()=>{
 for(const kind of ['foamling','tidecrab','reefturtle','jellyseer','tidestar','sandworm','clawbeetle','sandguard','sandspitter','duneoracle']){
  const cfg=ENEMY_MOTION[kind],d={};let p=creatureAttackPose(d,cfg.wind,0,cfg.recover);assert.equal(p.wind,0);assert.equal(p.strike,0);
  p=creatureAttackPose(d,cfg.wind*.5,cfg.wind*.5,cfg.recover);assert(p.wind>.85);assert.equal(p.strike,0);
  p=creatureAttackPose(d,.000001,cfg.wind*.5,cfg.recover);assert(p.strike>.99);
  const released=creatureAttackPose(d,0,0,cfg.recover);assert(Math.abs(p.strike-released.strike)<1e-5);
  assert.equal(creatureAttackPose(d,0,cfg.recover,cfg.recover).strike,0);
  creatureAttackPose(d,cfg.wind,0,cfg.recover);d.cancelled=true;assert.equal(creatureAttackPose(d,0,1/60,cfg.recover).strike,0);
 }
});

test('all fifteen bosses hand off both attacks continuously and freeze every joint on pause',()=>{
 const pose=m=>{const values=[];m.traverse(o=>values.push(...o.position.toArray(),...o.quaternion.toArray(),...o.scale.toArray()));return values;};
 for(const [kind,cfg]of Object.entries(BOSS_STYLES)){
  const m=actor(kind),d=m.userData;animateActor(m,0,0);
  for(const move of cfg.moves){
   Object.assign(d,{bossMove:move,bossStage:'wind',windProgress:1,lift:0});animateActor(m,1,0);const wind=pose(m);
   Object.assign(d,{bossStage:'strike',strikeProgress:0});animateActor(m,1,0);assert(Math.max(...pose(m).map((v,i)=>Math.abs(v-wind[i])))<1e-7,kind+' wind snap');
   d.strikeProgress=1;animateActor(m,1,0);const strike=pose(m);
   Object.assign(d,{bossStage:'recover',recoverProgress:0});animateActor(m,1,0);assert(Math.max(...pose(m).map((v,i)=>Math.abs(v-strike[i])))<1e-7,kind+' recovery snap');
   const paused=pose(m);animateActor(m,1,0);assert.deepEqual(pose(m),paused,kind+' pause drift');
  }
 }
});
