import test from 'node:test';
import assert from 'node:assert/strict';
import {actor,animateActor} from '../world.js';
import {advanceEnemyLocomotion} from '../enemy-motion.js';
import {Vector3} from '../vendor/three.module.js';

test('quadrupeds and heavy regional walkers support their real translation at full and slowed speed',()=>{
 const point=new Vector3();
 for(const kind of ['wolf','frostwolf','ashstalker','emberling','yeti','lavabrute'])for(const fps of [30,60,120])for(const speed of [.45,3.8]){
  const g=actor(kind),d=g.userData,previous=[];g.rotation.y=.51;let supported=0,hipYield=0;
  animateActor(g,0,0,0,0);
  for(let i=1;i<=fps*3;i++){
   g.position.set(Math.sin(.51)*speed*i/fps,0,Math.cos(.51)*speed*i/fps);
   advanceEnemyLocomotion(d,1/fps,speed/fps,true);animateActor(g,i/fps,speed,0,0);g.updateMatrixWorld(true);
   for(const [n,l]of d.legs.entries()){
    l.paw.getWorldPosition(point);const old=previous[n];
    if(i>fps&&l.planted&&old?.planted){assert(Math.hypot(point.x-old.x,point.z-old.z)<1e-5,kind+' support slides at '+fps+' FPS');supported++;}
    previous[n]={x:point.x,z:point.z,planted:l.planted};hipYield=Math.max(hipYield,l.joint.position.distanceTo(new Vector3(l.restX,l.restY,l.restZ)));
   }
  }
  assert(supported>fps,kind+' never establishes support');assert(hipYield<.11,kind+' hip separates from the body: '+hipYield);
  const phase=d.visualPhase;for(let i=1;i<=fps;i++){advanceEnemyLocomotion(d,1/fps,0,false);animateActor(g,3+i/fps,0,0,0);}assert.equal(d.visualPhase,phase);assert(d.stride<1e-5);
 }
});

test('distance pose never overwrites the AI cadence and agrees across rendering frame rates',()=>{
 for(const kind of ['wolf','frostwolf','ashstalker','emberling','yeti','lavabrute']){
  const samples=[];
  for(const fps of [30,60,120]){
   const g=actor(kind),d=g.userData;d.expressionSeed=.2;animateActor(g,0,0,0,0);
   for(let i=1;i<=fps*2;i++){advanceEnemyLocomotion(d,1/fps,2.8/fps,true);animateActor(g,i/fps,2.8,0,0);}
   const pose=[];g.traverse(o=>pose.push(...o.position.toArray(),...o.quaternion.toArray(),...o.scale.toArray()));samples.push(pose);
   const phase=d.visualPhase;advanceEnemyLocomotion(d,0,1,true);assert.equal(d.visualPhase,phase,'paused clock advances');
  }
  for(const p of samples.slice(1))assert(Math.max(...p.map((v,i)=>Math.abs(v-samples[0][i])))<1e-7,kind+' pose depends on FPS');
 }
});
