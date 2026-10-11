import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../vendor/three.module.js';
import {buildWorld} from '../world.js';
import {installForestVista} from '../forest-vista.js';
import {installForestHabitats} from '../forest-habitats.js';
import {installBiomePlaces} from '../biome-places.js';
import {installEnvironmentClusters} from '../environment-clusters.js';
import {installExplorationRoutes} from '../exploration-routes.js';
import {bridgeContains} from '../coast.js';
import {waterDepth} from '../water.js';
import {segmentDistance} from '../rules.js';
import {naturalRockGeometry} from '../biome-scenery.js?v=143';

globalThis.document={createElement:()=>({getContext:()=>({fillRect(){}})})};
const maps=['forest','snow','ash','sand','coast','confluence'];
const create=(id,seed)=>{const w=buildWorld(id,seed);installForestVista(w,id);installForestHabitats(w,id);installBiomePlaces(w,id);return w;};
const cleanup=w=>w.group.traverse(o=>{if(o.isInstancedMesh)o.dispose();if(o.userData.ownedGeometry)o.geometry.dispose();});
const gameplay=w=>JSON.stringify({spawn:w.spawn,sites:w.sites.map(s=>[s.x,s.z,s.type,s.event,s.availableAt,s.claimed,s.discovered,s.mesh.visible,s.trail.visible]),patches:w.patches.map(p=>[p.x,p.z,p.rx,p.rz,p.r,p.kind]),breakables:w.breakables.map(p=>[p.x,p.z,p.state]),roads:w.road,places:w.biomePlaces.map(p=>[p.x,p.z,p.angle,p.entrance,p.exit])});
const records=s=>s.records.map(({obstacle,...p})=>p);

test('six maps add broad, distinct midground groups within one-pass rendering and collision budgets',()=>{
 for(const id of maps)for(const seed of[7,522,43837033]){
  const w=create(id,seed),before=gameplay(w),original=w.obstacles.slice(),matrices=original.map(o=>[o.mesh.position.toArray(),o.mesh.rotation.toArray(),o.mesh.scale.toArray()]),foliage=w.foliage.slice();
  const state=installEnvironmentClusters(w,id);assert.strictEqual(w.environmentClusters,state);assert.strictEqual(installEnvironmentClusters(w,id),state);
  assert.equal(gameplay(w),before);assert.deepEqual(w.foliage,foliage);assert.deepEqual(w.obstacles.slice(0,original.length),original);assert.deepEqual(original.map(o=>[o.mesh.position.toArray(),o.mesh.rotation.toArray(),o.mesh.scale.toArray()]),matrices);
  assert.equal(state.records.length,id==='confluence'?30:14);assert.equal(w.obstacles.length-original.length,state.records.length);assert(state.records.length<=50);
  assert(state.draws<=(id==='confluence'?35:10));assert(state.triangles<40000,id+' triangles '+state.triangles);
  assert.equal(state.group.children.filter(o=>o.isInstancedMesh).length,state.draws);
  for(const r of state.records){
   assert(r.height>=1&&r.height<=3);assert(r.footprint>1.1&&r.footprint<2.1);assert.equal(r.obstacle.sceneryHeight,r.height);assert(r.obstacle.mesh.parent===state.group);
   if(w.regions){const scope=w.regions.find(s=>s.id===r.biome);assert(scope.obstacles.includes(r.obstacle));assert(scope.contains(r.x,r.z));assert.equal(state.records.filter(p=>p.biome===r.biome).length,6);}
  }
  const distances=state.records.map(r=>Math.hypot(r.x-w.spawn.x,r.z-w.spawn.z));assert(Math.max(...distances)>30,'clusters only frame the spawn');
  cleanup(w);
 }
});

test('whole cluster footprints protect roads, high water, crossings, rewards, places and tactical objects',()=>{
 for(const id of maps)for(const seed of[19,43837033]){
  const w=create(id,seed),old=w.obstacles.slice(),state=installEnvironmentClusters(w,id);
  const water=w.ponds.map(p=>{const k=p.baseRx===undefined?1:1.19;return{...p,rx:(p.baseRx??p.rx)*k,rz:(p.baseRz??p.rz)*k};});
  const clearings=[{...w.spawn,r:7},...(w.regions||[]).map(s=>({...s,r:7})),...w.sites.map(s=>({...s,r:s.event?8:5})),...w.discoveries.flatMap(d=>[{...d,r:5},...(d.nodes||[]).map(p=>({...p,r:4.5}))])];
  const crossings=[...(w.bridges||[]),...(w.fords||[]).map(f=>({...f,width:f.half*2,length:f.width}))];
  for(const r of state.records){
   for(const p of clearings)assert(Math.hypot(r.x-p.x,r.z-p.z)>=r.footprint+p.r);
   for(const o of old)assert(Math.hypot(r.x-o.x,r.z-o.z)>=r.footprint+o.r+1.04,'cluster pinches an old obstacle');
   for(const other of state.records)if(other!==r)assert(Math.hypot(r.x-other.x,r.z-other.z)>=r.footprint+other.footprint+2,'clusters join into an impassable continuous wall');
   for(const b of crossings)assert(!bridgeContains(b,r.x,r.z,r.footprint+1.19));
   for(const p of w.biomePlaces){const c=Math.cos(p.angle),s=Math.sin(p.angle),dx=r.x-p.x,dz=r.z-p.z;assert(Math.abs(c*dx-s*dz)>=9.4+r.footprint+.34||Math.abs(s*dx+c*dz)>=8.4+r.footprint+.34);}
   for(const p of w.patches)if(p.kind==='vent')assert(Math.hypot(r.x-p.x,r.z-p.z)>r.footprint+p.r+1.49);
   for(let n=0;n<24;n++){const a=n/24*Math.PI*2,x=r.x+Math.cos(a)*r.footprint,z=r.z+Math.sin(a)*r.footprint;for(const p of water)assert.equal(waterDepth(p,x,z),0,'cluster enters the high-tide water');}
   if(w.road)for(let i=1;i<w.road.length;i++)assert(segmentDistance(r.x,r.z,w.road[i-1].x,w.road[i-1].z,w.road[i].x,w.road[i].z)>=5.8+r.footprint);
   for(const site of w.sites){const a=site.trail.geometry.attributes.position;let previous;for(let i=0;i+3<a.count;i+=4){const p={x:(a.getX(i+1)+a.getX(i+2))/2,z:(a.getZ(i+1)+a.getZ(i+2))/2};if(previous)assert(segmentDistance(r.x,r.z,previous.x,previous.z,p.x,p.z)>=2+r.footprint);previous=p;}}
  }
  cleanup(w);
 }
});

test('every rendered vertex is inside its registered cylinder and finite owned batches clean up independently',()=>{
 const point=new T.Vector3(),instance=new T.Matrix4(),source=naturalRockGeometry.attributes.position.array.slice();let sharedDisposals=0;const shared=()=>sharedDisposals++;naturalRockGeometry.addEventListener('dispose',shared);
 for(const id of maps){
  const a=create(id,43837033),b=create(id,522),state=installEnvironmentClusters(a,id),other=installEnvironmentClusters(b,id),counts=new Map();
  for(const batch of state.group.children.filter(o=>o.isInstancedMesh)){
   assert(batch.userData.ownedGeometry&&batch.castShadow&&batch.receiveShadow);assert(!batch.material.transparent);assert(!batch.isLight);
   for(const attr of Object.values(batch.geometry.attributes))assert(attr.array.every(Number.isFinite));
   counts.set(batch.geometry,0);batch.geometry.addEventListener('dispose',()=>counts.set(batch.geometry,counts.get(batch.geometry)+1));
   const p=batch.geometry.attributes.position;
   for(let i=0;i<batch.count;i++){
    batch.getMatrixAt(i,instance);const center=new T.Vector3().setFromMatrixPosition(instance),record=state.records.find(r=>Math.hypot(r.x-center.x,r.z-center.z)<.0001);assert(record);
    for(let n=0;n<p.count;n++){point.fromBufferAttribute(p,n).applyMatrix4(instance);assert(point.y<=record.height+.00001);assert(Math.hypot(point.x-record.x,point.z-record.z)<record.footprint+.00001,'visual exceeds collision envelope');}
   }
  }
  cleanup(a);assert([...counts.values()].every(n=>n===1));assert(state.group.children.filter(o=>o.isInstancedMesh).every(o=>!o.visible));assert(other.group.children.filter(o=>o.isInstancedMesh).every(o=>o.visible));assert.equal(sharedDisposals,0);cleanup(b);
 }
 naturalRockGeometry.removeEventListener('dispose',shared);assert.deepEqual(naturalRockGeometry.attributes.position.array,source);
});

test('routes remain navigable after clusters register their real collision footprints',()=>{
 for(const id of maps)for(const seed of[7,43837033]){
  const w=create(id,seed),state=installEnvironmentClusters(w,id),routes=installExplorationRoutes(w);
  for(const route of routes){
   assert(route.points.length>=2,id+' seed '+seed+' no longer has a full route');
   for(let i=1;i<route.points.length;i++)for(const r of state.records)assert(segmentDistance(r.x,r.z,route.points[i-1].x,route.points[i-1].z,route.points[i].x,route.points[i].z)>r.footprint+.55);
  }
  cleanup(w);
 }
});

test('placement is independent of global randomness, and sealed worlds skip without adding scene resources',()=>{
 const a=create('coast',7),b=create('coast',7),old=Math.random;
 try{Math.random=()=>.11;const first=installEnvironmentClusters(a,'coast');Math.random=()=>.89;const second=installEnvironmentClusters(b,'coast');assert.deepEqual(records(first),records(second));}finally{Math.random=old;cleanup(a);cleanup(b);}
 const w=create('forest',7),children=w.group.children.length,obstacles=w.obstacles.length;w.patches.push({x:0,z:0,r:1000,kind:'vent'});const none=installEnvironmentClusters(w,'forest');assert.equal(none.records.length,0);assert.equal(none.group,null);assert.equal(w.group.children.length,children);assert.equal(w.obstacles.length,obstacles);cleanup(w);
 assert.equal(installEnvironmentClusters({},'unsupported'),null);
});
