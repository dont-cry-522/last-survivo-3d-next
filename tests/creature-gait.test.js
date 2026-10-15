import test from 'node:test';
import assert from 'node:assert/strict';
import {Group,Vector3} from '../vendor/three.module.js';
import {actor,animateActor} from '../world.js';
import {BOSS_STYLES,tickBoss} from '../boss-combat.js';
import {creatureGait,gaitStride,gaitDistance,footCycle,creatureAttackPose} from '../creature-gait.js';
import {leg,stepLeg} from '../creature-forms.js';
import {ENEMY_MOTION,advanceEnemyLocomotion} from '../enemy-motion.js';

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

test('creeping uses slower steps with useful stroke length',()=>{
 for(const kind of ['wolf','frostwolf','ashstalker','yeti','lavabrute']){
  const slow=creatureGait(kind,.45),normal=creatureGait(kind,2.5),slowStride=gaitStride(.45),normalStride=gaitStride(2.5);
  const slowRate=gaitDistance(.45,slow,slowStride),normalRate=gaitDistance(2.5,normal,normalStride);
  assert(slowRate<normalRate*.6,kind+' creeps with full-speed foot cadence');
  assert(slow.travel*slowStride>slow.travel*.3,kind+' takes tiny shuffling steps');
  assert.equal(gaitStride(0),0);assert.equal(gaitStride(20),1);
 }
});

test('a turning support foot lifts through a complete correction before touching down again',()=>{
 const point=new Vector3(),end=new Vector3();
 for(const fps of [30,60,120]){
  const actor=new Group(),rig=new Group();actor.add(rig);
  const l=leg(rig,'GaitCorrectionTest',{x:.28,y:.46,z:.30,a:.26,b:.28}),dt=1/fps;
  const pose=()=>{actor.updateMatrixWorld(true);return l.paw.getWorldPosition(new Vector3());};
  const sole=l.paw.children[0],solePoint=new Vector3(),soleHeight=()=>{let y=Infinity;const vertices=sole.geometry.attributes.position;for(let i=0;i<vertices.count;i++)y=Math.min(y,solePoint.fromBufferAttribute(vertices,i).applyMatrix4(sole.matrixWorld).y);return y;};
  actor.userData.lastTime=0;stepLeg(l,rig,0,1);const floor=pose().y,soleFloor=soleHeight();
  actor.position.z=.01;actor.userData.lastTime=dt;stepLeg(l,rig,0,1);let previous=pose(),wasPlanted=l.planted,airborne=0,lift=0,landed=false;
  actor.rotation.y=1;
  for(let i=2;i<=Math.ceil(fps*.4);i++){
   actor.userData.lastTime=i*dt;stepLeg(l,rig,0,1);point.copy(pose());
   if(!l.planted)airborne++;else if(airborne)landed=true;
   lift=Math.max(lift,point.y-floor);assert(point.y>=floor-1e-8,'correcting toe passes through floor');
   assert(soleHeight()>=soleFloor-1e-8,'visible sole passes through floor');
   assert(point.distanceTo(previous)<.18,'turn snaps the toe to its next contact');
   if(l.planted&&wasPlanted)assert(point.distanceTo(previous)<1e-8,'supported foot slides');
   end.set(0,-l.upperLength,0).applyMatrix4(l.upper.matrixWorld);assert(end.distanceTo(l.knee.getWorldPosition(new Vector3()))<1e-7);
   end.set(0,-l.lowerLength,0).applyMatrix4(l.knee.matrixWorld);assert(end.distanceTo(point)<1e-7);
   const paused=point.clone();stepLeg(l,rig,0,1);assert(pose().distanceTo(paused)<1e-8,'paused correction advances');
   previous.copy(point);wasPlanted=l.planted;
  }
  assert(airborne>=fps*.12&&landed,'turn releases and replants in a single frame');assert(lift>.025,'turn drags a toe along the floor');
 }
});

test('stopping partway through a swing finishes the landing while the walking phase remains still',()=>{
 const point=new Vector3();
 for(const kind of ['frostking','thornstag','dunescorpion','tidecrab','clawbeetle'])for(const fps of [30,60,120]){
  const m=actor(kind),d=m.userData;animateActor(m,0,0);d.bossStage='walk';let frame=0;
  do{frame++;m.position.z+=1.5/fps;animateActor(m,frame/fps,1.5);m.updateMatrixWorld(true);}while(frame<fps*2&&!d.legs.some(l=>!l.planted&&l.paw.getWorldPosition(point).y>l.rest.y*m.scale.y+.025));
  assert(frame<fps*2,kind+' never raised a foot');const phase=d.phase;
  for(let i=1;i<=Math.ceil(fps*.3);i++)animateActor(m,(frame+i)/fps,0);
  assert.equal(d.phase,phase);assert(d.legs.every(l=>l.planted),kind+' leaves a foot hanging after stopping');
  m.updateMatrixWorld(true);const contacts=d.legs.map(l=>l.paw.getWorldPosition(new Vector3()));
  for(let i=1;i<=fps;i++)animateActor(m,(frame+Math.ceil(fps*.3)+i)/fps,0);
  m.updateMatrixWorld(true);d.legs.forEach((l,n)=>{l.paw.getWorldPosition(point);assert(point.distanceTo(contacts[n])<1e-6,kind+' stopped toe keeps drifting');});
 }
});

test('ordinary and elite creatures turn with fixed support, connected hips, and pause without moving a toe',()=>{
 const walkers=['wolf','frostwolf','ashstalker','yeti','lavabrute'],point=new Vector3(),vertex=new Vector3();
 const pose=m=>{const values=[];m.traverse(o=>values.push(...o.position.toArray(),...o.quaternion.toArray(),...o.scale.toArray()));return values;};
 for(const kind of [...walkers,'tidecrab','clawbeetle','frostking','thornstag'])for(const size of [1,1.14])for(const fps of [30,60,120]){
  const m=actor(kind),d=m.userData,previous=[];m.scale.multiplyScalar(size);animateActor(m,0,0);d.bossStage='walk';let contacts=0;
  for(let i=1;i<=fps*1.8;i++){
   const t=i/fps,yaw=Math.max(0,Math.min(1,(t-.6)/.6))*Math.PI*.75;m.rotation.y=yaw;
   m.position.x+=Math.sin(yaw)*2/fps;m.position.z+=Math.cos(yaw)*2/fps;
   if(walkers.includes(kind))advanceEnemyLocomotion(d,1/fps,2/fps,true);
   animateActor(m,t,2);m.updateMatrixWorld(true);
   for(const [n,l]of d.legs.entries()){
    l.paw.getWorldPosition(point);const old=previous[n],hip=l.hip||{x:l.restX,y:l.restY,z:l.restZ};
    if(l.planted&&old?.planted){assert(Math.hypot(point.x-old.x,point.z-old.z)<1e-6,kind+' turns by sliding a supported foot');contacts++;}
    assert(l.joint.position.distanceTo(new Vector3(hip.x,hip.y,hip.z))<.11,kind+' turn pulls the hip out of its body');
    previous[n]={x:point.x,z:point.z,planted:l.planted};
    if(l.planted&&i%Math.ceil(fps/10)===0)l.paw.traverse(o=>{if(o.isMesh){const p=o.geometry.attributes.position;for(let j=0;j<p.count;j++)assert(vertex.fromBufferAttribute(p,j).applyMatrix4(o.matrixWorld).y>-.001,kind+' planted sole crosses the floor');}});
   }
   if(i===fps){const before=pose(m);animateActor(m,t,2);assert(Math.max(...pose(m).map((v,n)=>Math.abs(v-before[n])))<1e-10,kind+' paused turn changes its pose');}
  }
  assert(contacts>fps,kind+' never supports its weight while turning');const phase=d.visualPhase??d.phase;
  for(let i=1;i<=Math.ceil(fps*.35);i++){if(walkers.includes(kind))advanceEnemyLocomotion(d,1/fps,0,false);animateActor(m,1.8+i/fps,0);}
  assert.equal(d.visualPhase??d.phase,phase);assert(d.legs.every(l=>l.planted),kind+' stops with a foot suspended');
 }
});

test('a running wolf can stop or slow down without throwing a forepaw across its stroke',()=>{
 const point=new Vector3();
 for(const fps of [30,60,120])for(const speed of [3.8,4.5])for(const nextSpeed of [0,.45])for(const duration of [40/60,58/60,71/60,92/60]){
  const m=actor('wolf'),d=m.userData,frames=Math.round(duration*fps);animateActor(m,0,0);
  for(let i=1;i<=frames;i++){m.position.z+=speed/fps;advanceEnemyLocomotion(d,1/fps,speed/fps,true);animateActor(m,i/fps,speed);}
  m.updateMatrixWorld(true);const previous=d.legs.map(l=>l.paw.getWorldPosition(new Vector3())),phase=d.visualPhase;
  for(let i=1;i<=Math.ceil(fps*.35);i++){
   m.position.z+=nextSpeed/fps;const contact=advanceEnemyLocomotion(d,1/fps,nextSpeed/fps,nextSpeed>0);animateActor(m,(frames+i)/fps,nextSpeed);m.updateMatrixWorld(true);
   if(!nextSpeed)assert.equal(contact,0,'stopping emits a new walking footstep');
   d.legs.forEach((l,n)=>{l.paw.getWorldPosition(point);const distance=point.distanceTo(previous[n]);assert(distance<11/fps,'speed change teleports a paw');if(!nextSpeed&&i===1)assert(distance<1e-7,'stop changes the airborne foot position before its settling step');previous[n].copy(point);});
  }
  if(!nextSpeed){assert.equal(d.visualPhase,phase);assert(d.legs.every(l=>l.planted),'running stop leaves a paw raised');}
  else assert(d.visualPhase>phase,'slowdown freezes walking');
 }
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
