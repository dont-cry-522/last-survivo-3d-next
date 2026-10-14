import test from 'node:test';
import assert from 'node:assert/strict';
import {actor,animateActor} from '../world.js';
import {advanceEnemyLocomotion} from '../enemy-motion.js';
import {Vector3} from '../vendor/three.module.js';

test('forest flexible cap and elbows share finite GPU targets and freeze on pause',()=>{
 for(const [kind,name]of [['mushroom','mushroom-cap'],['golem','golem-arm']]){
  const m=actor(kind),n=actor(kind),mesh=m.getObjectByName(name),copy=n.getObjectByName(name),g=mesh.geometry;
  assert.equal(g,copy.geometry);assert.notEqual(mesh.morphTargetInfluences,copy.morphTargetInfluences);
  for(const key of ['position','normal']){assert.equal(g.morphAttributes[key][0].count,g.attributes.position.count);assert(g.morphAttributes[key][0].array.every(Number.isFinite));}
  const base=g.attributes.position.array.slice();let largest=0;
  for(let i=0;i<180;i++){
   m.userData.walkPhase=i/60*5;animateActor(m,i/60,i<60?2.5:0,i>=60&&i<110?(110-i)/60:0,0);
   largest=Math.max(largest,mesh.morphTargetInfluences[0]);const paused=mesh.morphTargetInfluences.slice();animateActor(m,i/60,i<60?2.5:0,i>=60&&i<110?(110-i)/60:0,0);assert.deepEqual(mesh.morphTargetInfluences,paused);
  }
  assert(largest>.2);assert.deepEqual(g.attributes.position.array,base,'CPU vertex uploads during motion');assert.equal(copy.morphTargetInfluences[0],0,'pose leaked into other creature');
 }
});

test('forest casters keep planted feet on the floor during translated walking and do not run in place',()=>{
 const point=new Vector3();
 for(const kind of ['spitter','shaman'])for(const fps of [30,60,120])for(const speed of [.5,2.8]){
  const m=actor(kind),d=m.userData,previous=[];let contacts=0;
  animateActor(m,0,0,0,0);
  for(let i=1;i<=fps*3;i++){
   m.position.z=speed*i/fps;advanceEnemyLocomotion(d,1/fps,speed/fps,true);animateActor(m,i/fps,speed,0,0);m.updateMatrixWorld(true);
   for(const [n,foot]of d.feet.entries()){
    foot.getWorldPosition(point);const u=((d.walkPhase+n*Math.PI)/(2*Math.PI)%1+1)%1,planted=u<.64;
    assert(point.y>=.07999&&point.y<.136);
    if(i>fps&&planted&&previous[n]?.planted){assert(Math.hypot(point.x-previous[n].x,point.z-previous[n].z)<1e-5,kind+' support slide');contacts++;}
    previous[n]={x:point.x,z:point.z,planted};
   }
  }
  assert(contacts>fps);const phase=d.visualPhase;for(let i=1;i<=fps;i++){advanceEnemyLocomotion(d,1/fps,0,false);animateActor(m,3+i/fps,0,0,0);}assert.equal(d.visualPhase,phase);
 }
});
