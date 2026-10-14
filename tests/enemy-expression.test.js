import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../vendor/three.module.js';
import {actor,animateActor} from '../world.js';
import {recordEnemyHit} from '../enemy-feedback.js';

const faces={mushroom:[.083,.70],wolf:[.162,.083],spitter:[.213,.091],snowhare:[.135,.047],frostwolf:[.148,.058],yeti:[.102,.034],emberling:[.096,.025]};
const snapshot=g=>{const result=[];g.traverse(n=>result.push(...n.position.toArray(),...n.quaternion.toArray(),...n.scale.toArray()));return result;};

test('paired eyelids close over the existing eyes and use shared geometry without changing actors',()=>{
 for(const [id,[spread,height]]of Object.entries(faces)){
  const g=actor(id),other=actor(id),d=g.userData,lids=d.expressionLids;
  assert(lids,'missing expression '+id);assert.equal(lids.children.length,1);
  assert.equal(lids.children[0].geometry,other.userData.expressionLids.children[0].geometry);
  assert.equal(lids.children[0].material,other.userData.expressionLids.children[0].material);
  assert.notEqual(d.expressionSeed,other.userData.expressionSeed,'all creatures blink in lockstep');
  lids.scale.y=1;g.updateMatrixWorld(true);
  for(const side of [-1,1]){
   const origin=new T.Vector3(side*spread,height,lids.position.z+.3).applyMatrix4(lids.parent.matrixWorld),direction=new T.Vector3(0,0,-1).transformDirection(lids.parent.matrixWorld);
   const hit=new T.Raycaster(origin,direction).intersectObject(lids.parent,true)[0];
   assert.equal(hit?.object,lids.children[0],id+' closed eyelid is behind the visible eye');
  }
  assert.deepEqual(g.position.toArray(),[0,0,0]);assert.deepEqual(g.scale.toArray(),[1,1,1]);
 }
});

test('idle face events pause exactly and are suppressed throughout windup and recovery',()=>{
 for(const id of Object.keys(faces)){
  const g=actor(id),d=g.userData;d.expressionSeed=0;let blink=0,sniff=0;
  for(let i=0;i<=420;i++){
   const t=i/60;animateActor(g,t,0,0,0);blink=Math.max(blink,d.expressionBlink);sniff=Math.max(sniff,Math.abs(d.expressionSniff));
   if(i%30===0){const before=snapshot(g);for(let n=0;n<4;n++)animateActor(g,t,0,0,0);assert.deepEqual(snapshot(g),before,id+' face drifts on pause');}
  }
  assert(blink>.9,id+' never blinked');assert(sniff>.9,id+' idle event never occurred');
  for(let i=1;i<=120;i++){
   const attack=i<50?.9-i/60:0;animateActor(g,7+i/60,0,attack,0);
   if(attack>0||d.release>0){assert.equal(d.expressionBlink,0);assert.equal(d.expressionSniff,0);assert.equal(d.expressionAlert,0);if(d.expressionNose)assert.deepEqual(d.expressionNose.position.toArray(),d.expressionNose.userData.rest);}
  }
 }
});

test('real nose batches retain their surface identity and move without writing shared geometry',()=>{
 for(const id of ['wolf','snowhare','frostwolf']){
  const g=actor(id),d=g.userData,other=actor(id),nose=d.expressionNose.children[0],positions=nose.geometry.attributes.position.array.slice();d.expressionSeed=0;
  assert.equal(nose.userData.creatureFinish,'nose');assert.equal(nose.geometry,other.userData.expressionNose.children[0].geometry);
  let motion=0;for(let i=0;i<210;i++){animateActor(g,i/60,0,0,0);motion=Math.max(motion,Math.abs(d.expressionNose.position.y-d.expressionNose.userData.rest[1]));}
  assert(motion>.0015,id+' nose did not follow the brief sniff');assert.deepEqual(nose.geometry.attributes.position.array,positions);
 }
});

test('real recorded hits squint once, freeze at the same game time, and retain the shared contact tint lifecycle',()=>{
 for(const id of Object.keys(faces)){
  const g=actor(id),other=actor(id),d=g.userData;d.expressionSeed=0;animateActor(g,0,0,0,0);
  const rest=d.expressionLids.scale.y,body=d.expressionLids.children[0],base=body.material;
  recordEnemyHit(g,{kind:'rifle',damage:10,maxHp:100});const tint=body.material;
  assert.notEqual(tint,base);assert.equal(other.userData.expressionLids.children[0].material,base,'hit leaked to another creature');
  animateActor(g,.04,0,0,.08);assert(d.expressionLids.scale.y>rest+.1,id+' real hit did not squint');assert.equal(body.material,tint);
  const before=snapshot(g),age=d.hitReaction.age;
  for(let i=0;i<4;i++){animateActor(g,.04,0,0,.08);assert.deepEqual(snapshot(g),before,id+' hit expression drifts at a paused time');assert.equal(d.hitReaction.age,age);assert.equal(body.material,tint);}
  for(let frame=5;frame<=30;frame++)animateActor(g,frame/100,0,0,0);
  assert.equal(d.hitReaction,null);assert.equal(body.material,base,'contact material outlived the original reaction');assert.equal(d.expressionLids.scale.y,rest);
 }
});
