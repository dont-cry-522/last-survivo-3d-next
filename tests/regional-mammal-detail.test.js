import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../vendor/three.module.js';
import {actor,animateActor} from '../world.js';
import {animateRegionalAppearance} from '../regional-enemy-appearance.js';

const meshes=g=>{const parts=[];g.traverse(o=>{if(o.isMesh)parts.push(o);});return parts;};
const pose=g=>{const a=[];g.traverse(o=>a.push(...o.position.toArray(),...o.quaternion.toArray(),...o.scale.toArray(),...(o.morphTargetInfluences||[])));return a;};

test('hare ears bend continuously above their roots with independently delayed tips and shared immutable geometry',()=>{
 const a=actor('snowhare'),b=actor('snowhare'),d=a.userData,ear=d.ears[0].userData.softEar.mesh,other=b.userData.ears[0].userData.softEar.mesh;
 assert.equal(ear.geometry,other.geometry);assert.equal(ear.material,other.material);assert(!ear.isSkinnedMesh,'short ears should not allocate a bone texture per spawn');
 assert.notEqual(ear.morphTargetInfluences,other.morphTargetInfluences);assert.equal(ear.morphTargetInfluences.length,2);assert(ear.castShadow&&ear.receiveShadow);
 const geometry=ear.geometry,position=geometry.attributes.position,normal=geometry.attributes.normal,rest=position.array.slice(),nrest=normal.array.slice();
 for(const key of ['position','normal'])for(const attr of geometry.morphAttributes[key]){assert.equal(attr.count,position.count);assert(attr.array.every(Number.isFinite));}
 const base=new T.Vector3(),moved=new T.Vector3();let upperMotion=0;
 ear.morphTargetInfluences[0]=.4;ear.morphTargetInfluences[1]=-.25;
 for(let i=0;i<position.count;i++){
  base.fromBufferAttribute(position,i);ear.getVertexPosition(i,moved);
  if(base.y<.21)assert(moved.distanceTo(base)<1e-9,'ear root detached from head');
  if(base.y>.53)upperMotion=Math.max(upperMotion,moved.distanceTo(base));
 }
 assert(upperMotion>.02,'ear is still moving as a rigid rod');
 let independentLag=0,spread=0,prev;
 for(let i=0;i<=150;i++){
  const t=i/60,phase=t*10;d.previousAttack=0;animateRegionalAppearance(d,t,1,phase,0,0,0);
  const values=ear.morphTargetInfluences;independentLag=Math.max(independentLag,Math.abs(values[0]-values[1]));assert(values.every(v=>Number.isFinite(v)&&Math.abs(v)<1));
  if(prev)spread=Math.max(spread,...values.map((v,j)=>Math.abs(v-prev[j])));prev=[...values];
  const frozen=pose(a);animateRegionalAppearance(d,t,1,phase,0,0,0);assert.deepEqual(pose(a),frozen,'ear flex progressed at paused game time');
 }
 assert(independentLag>.12,'mid and tip flex remained in lockstep');assert(spread<.13,'ear flex snaps between adjacent frames');
 assert.deepEqual(other.morphTargetInfluences,[0,0]);assert.deepEqual(position.array,rest);assert.deepEqual(normal.array,nrest);assert.equal(position.version,0);
});

test('hare haunches, hocks and long paws form complete chains while the toes fold during recovery',()=>{
 const g=actor('snowhare'),d=g.userData,point=new T.Vector3(),target=new T.Vector3(),rear=d.legs.filter(l=>l.back);assert.equal(rear.length,2);assert(rear.every(l=>l.ankle));
 const footBounds=rear[0].paw.children[0].geometry.boundingBox,size=footBounds.getSize(new T.Vector3());assert(size.z>size.x*1.8);assert(footBounds.max.z>Math.abs(footBounds.min.z)*3,'long hind paw must extend in front of its heel');
 let flex=0,lift=0,fold=0;
 for(let i=0;i<180;i++){
  const phase=i/180*Math.PI*4;d.previousAttack=0;animateRegionalAppearance(d,i/60,1,phase,0,0,0);g.updateMatrixWorld(true);
  for(const l of d.legs){
   const bottom=new T.Box3().setFromObject(l.paw,true).min.y;assert(bottom>=.003,'real toe geometry penetrates the ground');lift=Math.max(lift,bottom);
   point.set(0,-l.upperLength,0).applyMatrix4(l.upper.matrixWorld);l.knee.getWorldPosition(target);assert(point.distanceTo(target)<1e-6);
   if(l.back){
    point.set(0,-l.lowerLength,0).applyMatrix4(l.knee.matrixWorld);l.ankle.getWorldPosition(target);assert(point.distanceTo(target)<1e-6);
    point.set(0,-Math.hypot(l.drop,.095),0).applyMatrix4(l.ankle.matrixWorld);target.set(0,.055,0).applyMatrix4(l.paw.matrixWorld);assert(point.distanceTo(target)<1e-6);
    flex=Math.max(flex,Math.abs(l.paw.rotation.x));fold=Math.max(fold,l.knee.position.z-l.ankle.position.z);
   }
  }
 }
 assert(flex>.25,'long hind paw never folds back during recovery');assert(fold>.18,'hind thigh and ankle straighten into one stick');assert(lift>.08);
});

test('wolf shoulders have muscle taper above an articulated elbow and keep the support chain inside the chest',()=>{
 const g=actor('frostwolf'),d=g.userData,fore=d.legs.filter(l=>!l.back),source=fore[0].softLimb;
 const widthAt=(mesh,y)=>{const m=new T.Mesh(mesh.geometry,mesh.material);m.updateMatrixWorld(true);const hits=new T.Raycaster(new T.Vector3(1,y,0),new T.Vector3(-1,0,0)).intersectObject(m);assert(hits.length,'limb cross section is open');return hits[0].point.x;};
 assert(widthAt(source,.01)>widthAt(source,-.30)*1.5,'upper foreleg is still a uniform cylinder');
 assert(widthAt(source,-fore[0].upperLength-.04)>widthAt(source,-fore[0].upperLength-.27)*1.25,'wrist has no anatomical taper');
 let elbowFold=0;
 for(let i=0;i<120;i++){
  d.previousAttack=0;animateRegionalAppearance(d,i/60,1,i/120*Math.PI*2,0,0,0);g.updateMatrixWorld(true);
  for(const l of fore){elbowFold=Math.max(elbowFold,Math.abs(l.knee.position.z));assert(l.joint.position.distanceTo(new T.Vector3(l.restX,l.restY,l.restZ))<.075,'shoulder slides out of the coat');assert(new T.Box3().setFromObject(l.paw,true).min.y>.003);}
 }
 assert(elbowFold>.13,'wolf forelimbs stay fully extended through their stride');
});

test('new fur and limb surfaces remain cached and finite during real water, hit, attack and restart poses',()=>{
 for(const [id,drawBudget,triBudget]of [['snowhare',17,10200],['frostwolf',19,9300]]){
  const a=actor(id),b=actor(id),parts=meshes(a),copies=meshes(b),d=a.userData,positions=parts.map(m=>m.geometry.attributes.position.array.slice());let triangles=0;
  assert.equal(parts.length,drawBudget);
  parts.forEach((m,i)=>{assert.equal(m.geometry,copies[i].geometry);assert.equal(m.material,copies[i].material);assert(!m.material.transparent);triangles+=(m.geometry.index?.count||m.geometry.attributes.position.count)/3;});assert(triangles<=triBudget);
  assert(parts.some(m=>m.geometry.userData.shortCoat),'coat is still only a shader stripe');
  for(let i=0;i<=180;i++){
   const t=i/60;d.waterDepth=t>.4&&t<1.5?.8:0;d.pounce=t>.15&&t<.4?(.4-t)/.25:0;
   animateActor(a,t,t<2?2.5:0,t<.5?.6-t:0,0);const frozen=pose(a);animateActor(a,t,t<2?2.5:0,t<.5?.6-t:0,0);assert.deepEqual(pose(a),frozen);assert(frozen.every(Number.isFinite));
  }
  parts.forEach((m,i)=>assert.deepEqual(m.geometry.attributes.position.array,positions[i],'animation wrote shared coat geometry'));
  assert.equal(d.waterBlend,0);const fresh=actor(id);assert.deepEqual(fresh.position.toArray(),[0,0,0]);assert.equal(fresh.userData.combatHeight,d.combatHeight);assert.deepEqual(pose(fresh),pose(b));
 }
});
