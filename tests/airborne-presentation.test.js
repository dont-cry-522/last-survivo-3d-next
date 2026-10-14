import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../vendor/three.module.js';
import {AIR_ENEMIES,makeAirborne,animateAirborne} from '../airborne-enemies.js';

const make=(kind,id=1)=>({kind,id,mesh:makeAirborne(kind),flight:{stage:'orbit',timer:1.6},x:4,y:3,z:-2});
const pose=e=>{const d=e.mesh.userData;return[d.rig,d.head,...d.wings,...d.wingTips,...d.shells,...(d.tail?[d.tail]:[])].flatMap(p=>[p.rotation.x,p.rotation.y,p.rotation.z]);};
const stageAt=t=>t<.9?'orbit':t<1.8?'wind':t<3?'strike':t<4.5?'recover':'orbit';

test('five flight styles blend across wind, strike and recovery instead of snapping the wings',()=>{
 const signatures=new Set();
 for(const kind of Object.keys(AIR_ENEMIES))for(const fps of[30,60,120])for(const id of[1,2,3]){
  const e=make(kind,id);let previous=null;
  for(let i=0;i<=fps*6;i++){
   const time=i/fps;e.flight.stage=stageAt(time);const flight={...e.flight};animateAirborne(e,time);const current=pose(e);
   assert.deepEqual(e.flight,flight,'visual posing must not advance the attack clock');
   assert(current.every(Number.isFinite));
   if(previous)assert(Math.max(...current.map((v,j)=>Math.abs(v-previous[j])))<.28,`${kind} ${fps} FPS stage ${e.flight.stage} at ${time}`);
   previous=current;
  }
  const paused=pose(e);for(let i=0;i<4;i++)animateAirborne(e,6);assert.deepEqual(pose(e),paused);
  assert.deepEqual([e.x,e.y,e.z],[4,3,-2]);assert.equal(e.mesh.position.length(),0);
  if(fps===60&&id===1)signatures.add(pose(e).map(v=>v.toFixed(4)).join(','));
 }
 assert.equal(signatures.size,5);
});

test('visual envelopes agree across frame rates and the delayed wing tips actually flex',()=>{
 for(const kind of Object.keys(AIR_ENEMIES)){
  const sampled=[];
  for(const fps of[30,60,120]){
   const e=make(kind);let flex=0;
   for(let i=0;i<=fps*5;i++){const time=i/fps;e.flight.stage=stageAt(time);animateAirborne(e,time);flex=Math.max(flex,Math.abs(e.mesh.userData.wingTips[0].rotation.z));}
   assert(flex>.065,kind+' needs visible wing-tip articulation');sampled.push(pose(e));
  }
  assert(Math.max(...sampled[0].map((v,i)=>Math.abs(v-sampled[2][i])))<.035,kind+' frame-rate-dependent pose');
 }
});

test('rest bounds retain the existing derived hit height and membranes share a closed hinge row',()=>{
 for(const [kind,cfg]of Object.entries(AIR_ENEMIES)){
  const e=make(kind),bounds=new T.Box3().setFromObject(e.mesh);
  assert.equal(Math.max(.6,bounds.max.y),.6,kind+' spawn-derived hit height changed');
  assert(bounds.min.x>=-(.12+1.25*cfg.span)-1e-6&&bounds.max.x<=.12+1.25*cfg.span+1e-6);
  const d=e.mesh.userData,inner=d.wings[1].children[0].geometry.getAttribute('position'),outer=d.wingTips[1].children[0].geometry.getAttribute('position'),hinge=d.wingTips[1].position.x;
  for(let j=0;j<9;j++){
   const i=inner.count-9+j;
   assert(Math.abs(inner.getX(i)-outer.getX(j)-hinge)<1e-6);assert.equal(inner.getY(i),outer.getY(j));assert.equal(inner.getZ(i),outer.getZ(j));
  }
  for(let frame=0;frame<180;frame++){
   e.flight.stage=stageAt(frame/60);animateAirborne(e,frame/60);e.mesh.updateMatrixWorld(true);
   for(let j=0;j<9;j++){
    const inside=new T.Vector3().fromBufferAttribute(inner,inner.count-9+j).applyMatrix4(d.wings[1].children[0].matrixWorld),outside=new T.Vector3().fromBufferAttribute(outer,j).applyMatrix4(d.wingTips[1].children[0].matrixWorld);
    assert(inside.distanceTo(outside)<1e-6,'folding the wrist must not open a membrane crack');
   }
  }
 }
});

test('geometry/material caches are shared; moving one flock member leaves the other unchanged',()=>{
 for(const kind of Object.keys(AIR_ENEMIES)){
  const a=make(kind),b=make(kind),am=[],bm=[];let triangles=0;
  a.mesh.traverse(p=>{if(p.isMesh){am.push(p);triangles+=(p.geometry.index?.count||p.geometry.getAttribute('position').count)/3;for(const n of['position','normal'])assert([...p.geometry.getAttribute(n).array].every(Number.isFinite));assert(p.castShadow&&p.receiveShadow);}});
  b.mesh.traverse(p=>{if(p.isMesh)bm.push(p);});
  assert(am.length<=10,kind+' too many draw calls');assert(triangles<=1900,kind+' exceeds the flyer geometry budget');
  assert.equal(am.length,bm.length);for(let i=0;i<am.length;i++){assert.equal(am[i].geometry,bm[i].geometry);assert.equal(am[i].material,bm[i].material);assert.notEqual(am[i],bm[i]);}
  const rest=pose(b);for(let i=0;i<30;i++){a.flight.stage='wind';animateAirborne(a,i/60);}assert.deepEqual(pose(b),rest);assert.notDeepEqual(pose(a),rest);
  assert(!a.mesh.userData.ownedGeometries&&!a.mesh.userData.ownedMaterials,'shared cache assets must not enter actor ownership');
 }
});
