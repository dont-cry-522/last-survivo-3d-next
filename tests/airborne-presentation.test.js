import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../vendor/three.module.js';
import {AIR_ENEMIES,makeAirborne,animateAirborne} from '../airborne-enemies.js';

const make=(kind,id=1)=>({kind,id,mesh:makeAirborne(kind),flight:{stage:'orbit',timer:1.6},x:4,y:3,z:-2});
const pose=e=>{const d=e.mesh.userData;return[...[d.rig,d.head,...d.wings,...d.wingTips,...d.shells].flatMap(p=>[p.rotation.x,p.rotation.y,p.rotation.z]),...(d.body.morphTargetInfluences||[])];};
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
   for(let i=0;i<=fps*5;i++){const time=i/fps;e.flight.stage=stageAt(time);animateAirborne(e,time);const d=e.mesh.userData;flex=Math.max(flex,Math.abs(d.wingTips[0]?.rotation.z??d.body.morphTargetInfluences[0]));}
   assert(flex>.065,kind+' needs visible wing-tip articulation');sampled.push(pose(e));
  }
  assert(Math.max(...sampled[0].map((v,i)=>Math.abs(v-sampled[2][i])))<.035,kind+' frame-rate-dependent pose');
 }
});

test('combat height remains 0.6m and actual membrane vertices keep a closed folding hinge',()=>{
 for(const [kind,cfg]of Object.entries(AIR_ENEMIES)){
  const e=make(kind),d=e.mesh.userData;
  assert.equal(d.combatHeight,.6,kind+' hit height changed');
  let restTop=0;e.mesh.updateMatrixWorld(true);e.mesh.traverse(p=>{if(p.isMesh){const v=new T.Vector3(),points=p.geometry.attributes.position;for(let i=0;i<points.count;i++)restTop=Math.max(restTop,v.fromBufferAttribute(points,i).applyMatrix4(p.matrixWorld).y);}});assert(restTop<=.6);
  if(kind==='skyray')continue;
  const inner=d.wings[1].children[0],outer=d.wingTips[1].children[0],hinge=d.wingTips[1].position.x;
  const edge=(mesh,x)=>{const g=mesh.geometry,p=g.attributes.position,unique=new Map();for(let i=0;i<g.userData.membraneVertices;i++)if(Math.abs(p.getX(i)-x)<1e-7){const v=new T.Vector3().fromBufferAttribute(p,i);unique.set(v.z.toFixed(6),v);}return [...unique.values()].sort((a,b)=>a.z-b.z);};
  const a=edge(inner,hinge),b=edge(outer,0);assert.equal(a.length,13);assert.equal(a.length,b.length);
  for(let frame=0;frame<180;frame++){
   e.flight.stage=stageAt(frame/60);animateAirborne(e,frame/60);e.mesh.updateMatrixWorld(true);
   for(let j=0;j<a.length;j++){
    const inside=a[j].clone().applyMatrix4(inner.matrixWorld),outside=b[j].clone().applyMatrix4(outer.matrixWorld);
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
  assert(am.length<=7,kind+' too many draw calls');assert(triangles<=4500,kind+' exceeds the flyer geometry budget');
  assert.equal(am.length,bm.length);for(let i=0;i<am.length;i++){assert.equal(am[i].geometry,bm[i].geometry);assert.equal(am[i].material,bm[i].material);assert.notEqual(am[i],bm[i]);}
  const rest=pose(b);for(let i=0;i<30;i++){a.flight.stage='wind';animateAirborne(a,i/60);}assert.deepEqual(pose(b),rest);assert.notDeepEqual(pose(a),rest);
  assert(!a.mesh.userData.ownedGeometries&&!a.mesh.userData.ownedMaterials,'shared cache assets must not enter actor ownership');
 }
});

test('ray fins and whip tail use continuous geometry with independent GPU morph weights',()=>{
 const a=make('skyray'),b=make('skyray'),mesh=a.mesh.userData.body,g=mesh.geometry;
 assert(g.morphTargetsRelative);assert.equal(g.morphAttributes.position.length,3);assert.equal(g.morphAttributes.normal.length,3);assert.notEqual(mesh.morphTargetInfluences,b.mesh.userData.body.morphTargetInfluences);
 for(const entries of Object.values(g.morphAttributes))for(const v of entries){assert.equal(v.count,g.attributes.position.count);assert(v.array.every(Number.isFinite));}
 a.mesh.updateMatrixWorld(true);for(const x of[-1,-.4,0,.4,1]){const hit=new T.Raycaster(new T.Vector3(x,2,-.1),new T.Vector3(0,-1,0)).intersectObject(mesh)[0];assert(hit,'gap between ray disc and fin');assert(hit.face.normal.y>.6,'inverted ray upper surface');}
 const base=g.attributes.position;let flexible=0,anchored=0;for(let i=0;i<base.count;i++){const weight=Math.abs(g.morphAttributes.position[0].getY(i));if(Math.abs(base.getX(i))>.6){assert(weight>.015);flexible++;}else if(Math.abs(base.getX(i))<.15&&base.getZ(i)>.05){assert(weight<1e-8);anchored++;}}assert(flexible>100&&anchored>20);
 for(let i=0;i<60;i++)animateAirborne(a,i/60);assert.deepEqual(b.mesh.userData.body.morphTargetInfluences,[0,0,0]);
});
