import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../vendor/three.module.js';
import {buildWorld,moveActor,supportHeight} from '../world.js';
import {installBiomePlaces} from '../biome-places.js?v=210';
import {installForestVista} from '../forest-vista.js';
import {installForestHabitats} from '../forest-habitats.js';
import {installHarborLife} from '../harbor-life.js';
import {waterDepth,terrainAt} from '../water.js';
import {updateTide} from '../coast.js';
import {installEnvironmentClusters} from '../environment-clusters.js?v=210';
import {installExplorationRoutes} from '../exploration-routes.js?v=210';
import {installExplorationLandmarks} from '../exploration-landmarks.js';
import {installExplorationComposition} from '../exploration-composition.js?v=210';
import {installForestTerrain} from '../forest-terrain.js?v=210';
import {installEnvironmentGrounding} from '../environment-grounding.js?v=210';
import {installClimateLandforms} from '../climate-landforms.js';

globalThis.document={createElement:()=>({getContext:()=>({fillRect(){}})})};
const at=(p,x,z)=>({x:p.x+Math.cos(p.angle)*x+Math.sin(p.angle)*z,z:p.z-Math.sin(p.angle)*x+Math.cos(p.angle)*z});
const release=w=>w.group.traverse(o=>{if(o.isInstancedMesh)o.dispose();if(o.userData.ownedGeometry)o.geometry.dispose();});
function make(id,seed){const w=buildWorld(id,seed);installForestVista(w,id);installForestHabitats(w,id);installBiomePlaces(w,id);return w;}

test('working boats occupy real low-tide water beside both piers, preserving deck travel, rewards and world randomness',()=>{
 for(const id of ['coast','confluence'])for(const seed of [7,19,522,43837033]){
  const w=make(id,seed),oldObstacles=w.obstacles.slice(),bridges=w.bridges.slice(),spawn={...w.spawn},sites=w.sites.map(s=>[s.x,s.z,s.claimed,s.availableAt]),ponds=w.ponds.map(p=>[p.x,p.z,p.rx,p.rz,p.angle]);
  let randomCalls=0;for(const scope of w.regions||[w]){const random=scope.weather.random;scope.weather.random=()=>{randomCalls++;return random();};}
  try{
   const group=installHarborLife(w,id),records=group.userData.records;
   assert.equal(records.length,2,`${id} ${seed} has no safe mooring`);assert.equal(w.obstacles.length,oldObstacles.length+78);assert(oldObstacles.every((o,i)=>w.obstacles[i]===o));
   assert.deepEqual(w.bridges,bridges);assert.deepEqual(w.spawn,spawn);assert.deepEqual(w.sites.map(s=>[s.x,s.z,s.claimed,s.availableAt]),sites);assert.deepEqual(w.ponds.map(p=>[p.x,p.z,p.rx,p.rz,p.angle]),ponds);assert.equal(randomCalls,0);
   assert.doesNotThrow(()=>JSON.stringify(group.userData),'debug records contain cyclic scene references');
   for(const record of records){
    const place=w.biomePlaces.find(p=>p.biome==='coast'&&p.index===record.placeIndex),b=place.pier;
    assert(place&&b);assert.equal(record.angle,place.angle);assert.equal(record.ties.length,2);
    for(const tie of record.ties){
     const q=at(place,tie.post.x,tie.post.z);
     assert(place.solids.some(o=>Math.hypot(o.x-q.x,o.z-q.z)<1e-6),'rope misses the actual mooring post');
    }
    for(let j=0;j<=10;j++)for(const dx of [-.92,0,.92]){
     const q=at(place,record.x+dx,record.z-2.45+j*.49);
     assert(w.ponds.some(p=>p.biome==='coast'&&waterDepth(p,q.x,q.z)>=.18),'boat stranded above low-tide water');
     assert(Math.abs(q.x)<w.half-2&&Math.abs(q.z)<w.half-2);if(w.regions)assert(w.regions.find(r=>r.id==='coast').contains(q.x,q.z));
    }
    // Both the old deck and its open end remain usable at either tide.
    for(const time of [0,20]){
     updateTide(w,time);const actor={...b.start},dx=(b.end.x-b.start.x)/100,dz=(b.end.z-b.start.z)/100;
     for(let i=0;i<100;i++){moveActor(w,actor,dx,dz,.45);assert.equal(terrainAt(w,actor.x,actor.z).kind,'bridge');}
     assert(Math.hypot(actor.x-b.end.x,actor.z-b.end.z)<.01,'boat closed the pier centre lane');
    }
    updateTide(w,0);
    const start=at(place,record.x+record.side*2.5,record.z),goal=at(place,record.x,record.z),actor={...start};
    for(let i=0;i<100;i++)moveActor(w,actor,(goal.x-start.x)/100,(goal.z-start.z)/100,.45);
    assert(Math.hypot(actor.x-goal.x,actor.z-goal.z)>1.35,'swimmer passed through the solid boat');
    for(const [z,expected] of [[record.z,.1875],[record.z-.94,.491],[record.z+.88,.491]]){
     const q=at(place,record.x,z);assert(Math.abs(supportHeight(w,{...q,y:1.1})-expected)<1e-9,'jump landing floats above the actual floor/seat');
    }
   }
   assert.equal(installHarborLife(w,id),group);assert.equal(w.obstacles.length,oldObstacles.length+78,'second install duplicates colliders');
  }finally{release(w);}
 }
});

test('the continuous hull and interior are lit, bounded to two batches per boat, and covered by visible-height solids',()=>{
 const w=make('coast',522);
 try{
  const group=installHarborLife(w,'coast');w.group.updateMatrixWorld(true);let triangles=0,draws=0;
  for(const [index,boat] of group.children.entries()){
   const record=group.userData.records[index],hull=boat.getObjectByName('SM_Harbor_Workboat_Hull');assert(hull);assert.equal(boat.children.filter(o=>o.isMesh).length,2);
   const bounds=hull.geometry.boundingBox;assert(bounds.max.z-bounds.min.z>4.8&&bounds.max.x-bounds.min.x>1.8,'hull lost its boat silhouette');
   // Eye-level down-rays see gunwales, two seats and a continuous raised floor.
   const probe=new T.Mesh(hull.geometry,hull.material),ray=new T.Raycaster(new T.Vector3(),new T.Vector3(0,-1,0));probe.updateMatrixWorld(true);
   for(const [z,min,max] of [[-.94,.48,.51],[.88,.48,.51],[0,.18,.20]]){
    ray.ray.origin.set(0,2,z);const hit=ray.intersectObject(probe,false)[0];assert(hit&&hit.point.y>=min&&hit.point.y<=max,'missing floor or transverse seat');
   }
   for(const mesh of boat.children.filter(o=>o.isMesh)){
    draws++;triangles+=mesh.geometry.index.count/3;assert(mesh.castShadow&&mesh.receiveShadow&&mesh.material.isMeshStandardMaterial);assert(!mesh.material.transparent);
    assert([...mesh.geometry.attributes.position.array,...mesh.geometry.attributes.normal.array].every(Number.isFinite));
   }
   const p=hull.geometry.attributes.position,point=new T.Vector3();
   for(let i=0;i<p.count;i++){
    point.fromBufferAttribute(p,i).applyMatrix4(hull.matrixWorld);if(point.y<=.3)continue;
    assert(record.solids.some(s=>Math.hypot(point.x-s.x,point.z-s.z)<=s.r+.015&&point.y<=s.height),`hull/seat has no matching solid at local ${p.getX(i)}, ${p.getY(i)}, ${p.getZ(i)}`);
   }
  }
  assert.equal(draws,4);assert.equal(triangles,5992);assert(group.children.every(b=>b.children.find(o=>o.name==='SM_Harbor_MooringAndNet').userData.ownedGeometry));
 }finally{release(w);}
});

test('cleanup releases each run’s rope geometry but keeps shared boat surfaces valid for other worlds',()=>{
 const a=make('coast',7),b=make('confluence',19),ga=installHarborLife(a,'coast'),gb=installHarborLife(b,'confluence');
 let owned=0,shared=0;const hulls=[],cloth=[];
 ga.traverse(o=>{if(o.name==='SM_Harbor_Workboat_Hull'){hulls.push(o);o.geometry.addEventListener('dispose',()=>shared++);o.material.addEventListener('dispose',()=>shared++);}if(o.name==='SM_Harbor_MooringAndNet'){cloth.push(o);o.geometry.addEventListener('dispose',()=>owned++);o.material.addEventListener('dispose',()=>shared++);}});
 const otherHull=gb.getObjectByName('SM_Harbor_Workboat_Hull'),otherCloth=gb.getObjectByName('SM_Harbor_MooringAndNet');
 assert.equal(hulls[0].geometry,otherHull.geometry);assert.equal(hulls[0].material,otherHull.material);assert.notEqual(cloth[0].geometry,otherCloth.geometry);
 release(a);assert.equal(owned,2);assert.equal(shared,0);assert(otherCloth.geometry.attributes.position.count>0);release(b);assert.equal(shared,0);
});

test('unrelated biomes and occupied berths do not receive boats or moved scenery',()=>{
 for(const id of ['forest','snow','ash','sand']){const w={group:new T.Group(),obstacles:[]};assert.equal(installHarborLife(w,id),null);assert.equal(w.group.children.length,0);}
 const w=make('coast',7);for(const place of w.biomePlaces.filter(p=>p.biome==='coast')){
  const q=at(place,0,place.pier.localEndZ);w.obstacles.push({...q,r:12,mesh:new T.Group()});
 }
 const old=w.obstacles.slice(),group=installHarborLife(w,'coast');assert.equal(group.userData.records.length,0);assert.deepEqual(w.obstacles,old);release(w);
});

test('later route, cluster, terrain and grounding passes preserve the mooring, collision and water datum',()=>{
 for(const [id,seed] of [['coast',522],['confluence',19]]){
  const w=make(id,seed);installClimateLandforms(w,id);const group=installHarborLife(w,id),solids=w.obstacles.filter(o=>o.harborLife);
  w.group.updateMatrixWorld(true);const before=group.children.map(o=>o.matrixWorld.toArray());
  try{
   assert.equal(group.userData.records.length,2);
   installEnvironmentClusters(w,id);installExplorationRoutes(w);installExplorationLandmarks(w,id);installExplorationComposition(w,id);installForestTerrain(w,id);installEnvironmentGrounding(w);
   w.group.updateMatrixWorld(true);assert.deepEqual(group.children.map(o=>o.matrixWorld.toArray()),before);
   for(const o of solids){
    assert(w.obstacles.includes(o)&&o.mesh.parent?.parent===group,'later scenery removed a boat solid');
    const p=o.mesh.getWorldPosition(new T.Vector3());assert(Math.hypot(o.x-p.x,o.z-p.z)<1e-6);
    assert.equal(w.groundHeightAt?.(o.x,o.z)??0,0,'later terrain raised the boat out of the water');
    if(w.regions)assert(w.regions.find(r=>r.id==='coast').obstacles.includes(o));
   }
   for(const record of group.userData.records){const q=at(record.origin?{...record.origin,angle:record.angle}:record,record.x,record.z);assert(Math.abs(supportHeight(w,{...q,y:1.1})-.1875)<1e-9);}
  }finally{release(w);}
 }
});
