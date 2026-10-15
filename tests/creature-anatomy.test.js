import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../vendor/three.module.js';
import {actor,animateActor} from '../world.js';
import {MAP_ROSTERS} from '../map-enemies.js';
import {ADDITIONAL_BOSSES} from '../boss-roster.js';
import {AIR_ENEMIES,makeAirborne,animateAirborne} from '../airborne-enemies.js';
import {advanceEnemyLocomotion} from '../enemy-motion.js';

const ground=[...Object.values(MAP_ROSTERS).flatMap(Object.values),...Object.keys(ADDITIONAL_BOSSES)];
const pose=g=>{const a=[];g.traverse(o=>a.push(...o.position.toArray(),...o.quaternion.toArray(),...o.scale.toArray(),...(o.morphTargetInfluences||[])));return a;};

test('all 45 species retain independent finite anatomy through movement, windup, recovery and pause',()=>{
 assert.equal(ground.length+Object.keys(AIR_ENEMIES).length,45);
 for(const kind of ground){
  const g=actor(kind),copy=actor(kind),d=g.userData;assert(d.anatomy,kind);const original=pose(copy),height=d.combatHeight;
  for(let frame=0;frame<=240;frame++){
   const t=frame/60,attack=t>1&&t<2?2-t:0;d.bossStage=t<1?'walk':t<2?'wind':t<3?'strike':'recover';d.windProgress=t-1;d.strikeProgress=t-2;d.recoverProgress=t-3;
   advanceEnemyLocomotion(d,1/60,frame<60?2/60:0,frame<60);animateActor(g,t,frame<60?2:0,attack);const values=pose(g);assert(values.every(Number.isFinite),kind);
   animateActor(g,t,frame<60?2:0,attack);assert.deepEqual(pose(g),values,kind+' changes while paused');
  }
  assert.deepEqual(pose(copy),original,kind+' changed another actor');assert.equal(d.combatHeight,height);
 }
 for(const kind of Object.keys(AIR_ENEMIES)){
  const e={kind,id:2,mesh:makeAirborne(kind),flight:{stage:'orbit'}};assert(e.mesh.userData.anatomy);
  for(const stage of ['orbit','wind','strike','recover']){e.flight.stage=stage;for(let i=0;i<60;i++){animateAirborne(e,i/60);assert(pose(e.mesh).every(Number.isFinite));}const frozen=pose(e.mesh);animateAirborne(e,59/60);assert.deepEqual(pose(e.mesh),frozen);}
 }
});

test('continuous limb endpoints follow the existing IK at arbitrary bend planes without bone textures or vertex uploads',()=>{
 const p=new T.Vector3(),expected=new T.Vector3(),q=new T.Vector3();
 for(const kind of ['wolf','snowhare','frostwolf','yeti','rimefang','thornstag','frostking','reefturtle']){
  const g=actor(kind),copy=actor(kind),d=g.userData,limbs=d.anatomy.chains.filter(l=>l.softLimb);assert(limbs.length>0,kind);
  for(let frame=0;frame<90;frame++){
   advanceEnemyLocomotion(d,1/60,2/60,true);animateActor(g,frame/60,2,0);g.updateMatrixWorld(true);
   for(const l of limbs){
    const m=l.softLimb,geo=m.geometry,a=l.upperLength,positions=geo.attributes.position;
    assert(!m.isSkinnedMesh);assert.equal(positions.version,0);assert.equal(geo.morphAttributes.position.length,2);
    // Lower rings, where the skin is fully attached to the shin, must have
    // the same center as that shin; zero seams is not merely a visual claim.
    const {limbRows:rows,limbSides:sides}=geo.userData;for(let row=Math.ceil(rows*.75);row<rows;row++){
     const start=row*sides,along=-positions.getY(start);if(along<a+l.lowerLength*.25)continue;
     p.set(0,0,0);for(let i=0;i<sides;i++)p.add(m.getVertexPosition(start+i,q));p.multiplyScalar(1/sides).applyMatrix4(m.matrixWorld);
     expected.set(0,-along+a,0).applyMatrix4(l.knee.matrixWorld);assert(p.distanceTo(expected)<2e-6,kind+' continuous skin leaves its shin');
    }
   }
  }
  const other=copy.userData.anatomy.chains.filter(l=>l.softLimb);limbs.forEach((l,i)=>assert.equal(l.softLimb.geometry,other[i].softLimb.geometry));
 }
});

test('living torso deformation stays local and finite while rigid shell creatures retain rigid plates',()=>{
 for(const kind of ['wolf','frostwolf','snowhare','yeti','rimefang','thornstag','dunedevourer','spitter','jellyseer']){
  const g=actor(kind),d=g.userData,m=d.anatomy.flex;assert(m,kind);const source=m.geometry.attributes.position.array.slice();let span=0;
  for(let i=0;i<120;i++){animateActor(g,i/60,2,0);span=Math.max(span,...m.morphTargetInfluences.map(Math.abs));}
  assert(span>.1,kind+' torso is static');assert.deepEqual(m.geometry.attributes.position.array,source);assert.equal(m.geometry.attributes.position.version,0);
  if(kind==='wolf'||kind==='rimefang')for(const normal of m.geometry.morphAttributes.normal)assert(Math.max(...normal.array.map(Math.abs))<.1,kind+' subtle muscle flex facets the authored smooth coat');
 }
 for(const kind of ['golem','lavabrute','moltenrhino','dunescorpion','wreckwarden','clawbeetle','tidecrab','obeliskwarden'])assert.equal(actor(kind).userData.anatomy.flex,null,kind+' rigid armor bends like jelly');
});
