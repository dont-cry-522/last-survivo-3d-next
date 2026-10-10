import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../vendor/three.module.js';
import {buildWorld} from '../world.js';
import {waterDepth} from '../water.js';
import {bridgeContains} from '../coast.js';
import {segmentDistance} from '../rules.js';
import {installAdventureGroundDetail,installHabitatDetail,animateAdventureGroundDetail} from '../adventure-ground-detail.js';

globalThis.document={createElement:()=>({getContext:()=>({fillRect(){}})})};
const maps=['forest','snow','ash','sand','coast','confluence'];
const cleanup=world=>world.group.traverse(o=>{if(o.isInstancedMesh)o.dispose();if(o.userData.ownedGeometry)o.geometry.dispose();});
const state=world=>JSON.stringify({spawn:world.spawn,obstacles:world.obstacles.map(o=>[o.x,o.z,o.r,o.state]),patches:world.patches.map(p=>[p.x,p.z,p.rx,p.rz,p.kind]),sites:world.sites.map(s=>[s.x,s.z,s.claimed,s.discovered]),finds:world.discoveries.map(d=>[d.x,d.z,d.discovered,d.claimed]),roaming:world.roaming.map(r=>[r.x,r.z,r.state])});
const far=(p,q,r)=>assert(Math.hypot(p.x-q.x,p.z-q.z)>=r-1e-7,`${p.biome} ${p.kind} encroaches on protected ground`);

test('local maps use at most two bounded batches and the joined map three without moving gameplay data or raising the floor',()=>{
 for(const map of maps){
  const world=buildWorld(map,7),before=state(world),ground=world.ground.geometry.attributes.position.array.slice(),group=installAdventureGroundDetail(world,map);
  assert(group,map);assert.equal(group.parent,world.group);assert.equal(installAdventureGroundDetail(world,map),group);
  assert(group.children.length>0&&group.children.length<=(map==='confluence'?3:2));const records=group.userData.records;
  assert(records.length>100&&records.length<=(map==='confluence'?2200:1200));assert.equal(group.children.reduce((n,b)=>n+b.count,0),records.length);
  const shoulderCount=records.filter(p=>p.shoulder).length;assert(shoulderCount>0&&shoulderCount<=Math.ceil(records.length*.22),'roadside detail exceeds the reallocated budget');
  assert.equal(state(world),before);assert.deepEqual(world.ground.geometry.attributes.position.array,ground);
  if(map==='confluence')assert.deepEqual([...new Set(records.map(p=>p.biome))].sort(),maps.filter(id=>id!=='confluence').sort());
  for(const batch of group.children){
   assert(batch.isInstancedMesh);assert(batch.userData.ownedGeometry);assert(!batch.castShadow&&batch.receiveShadow);assert.equal(batch.material.roughness,1);assert(!batch.material.map&&!batch.material.transparent);
   assert(batch.geometry.groups.length===0);assert([...batch.instanceMatrix.array].every(Number.isFinite));assert([...batch.instanceColor.array].every(Number.isFinite));
   const matrix=new T.Matrix4(),box=new T.Box3();batch.geometry.computeBoundingBox();
   for(let i=0;i<batch.count;i++){batch.getMatrixAt(i,matrix);box.copy(batch.geometry.boundingBox).applyMatrix4(matrix);assert(box.max.y<.30&&box.min.y<-.03,'detail floats or becomes an uncollidable obstacle');}
  }
  const triangles=group.children.reduce((n,b)=>n+b.count*(b.geometry.index?.count??b.geometry.attributes.position.count)/3,0);
  assert(triangles<=(map==='confluence'?95000:55000),'low cover exceeded the fixed geometry budget');
  if(map==='forest'||map==='coast')assert(records.filter(p=>Math.hypot(p.x-world.spawn.x,p.z-world.spawn.z)<20).length>=80,'near view is missing low ground cover');
  cleanup(world);
 }
});

test('forest leaf litter replaces its old stones within the same placement and footprint budget',()=>{
 const matrix=new T.Matrix4(),point=new T.Vector3(),center=new T.Vector3();let stonePositions;
 for(const map of maps){
  const world=buildWorld(map,43837033),group=installAdventureGroundDetail(world,map),forest=group.getObjectByName('adventure-ground-forest-litter'),stone=group.getObjectByName('adventure-ground-litter');
  const leaves=group.userData.records.filter(p=>p.biome==='forest'&&p.kind==='litter');
  assert.equal(forest?.count||0,leaves.length);
  if(forest){
   const geometry=forest.geometry,p=geometry.attributes.position;assert(p.count/3<=80,'forest litter exceeds its small shared geometry budget');
   for(let i=0;i<p.count;i++){assert.equal(geometry.attributes.groundFlex.getX(i),0);assert(Math.hypot(p.getX(i),p.getZ(i))*1.14<.55);}
   for(let i=0;i<forest.count;i++){
    forest.getMatrixAt(i,matrix);center.setFromMatrixPosition(matrix);assert(Math.abs(center.x-leaves[i].x)<1e-5);assert(Math.abs(center.z-leaves[i].z)<1e-5);
    for(let j=0;j<p.count;j++){point.fromBufferAttribute(p,j).applyMatrix4(matrix);assert(point.y<.11,'dry litter or fungus reaches above ankle height');}
   }
  }else assert(!['forest','confluence'].includes(map));
  if(stone){
   assert.equal(stone.count,group.userData.records.filter(p=>p.biome!=='forest'&&p.kind==='litter').length);
   if(stonePositions)assert.deepEqual(stone.geometry.attributes.position.array,stonePositions);else stonePositions=stone.geometry.attributes.position.array.slice();
   if(forest)assert.notDeepEqual(forest.geometry.attributes.position.array,stonePositions);
  }else assert.equal(map,'forest');
  cleanup(world);
 }
});

test('wind moves only flexible blade tips, with one shared game-time uniform and no new textures',()=>{
 const w=buildWorld('forest',7),group=installAdventureGroundDetail(w,'forest'),shader={uniforms:{},vertexShader:T.ShaderLib.standard.vertexShader,fragmentShader:T.ShaderLib.standard.fragmentShader};
 group.children[0].material.onBeforeCompile(shader);animateAdventureGroundDetail(12);
 assert.equal(shader.uniforms.groundWindTime.value,12);animateAdventureGroundDetail(NaN);assert.equal(shader.uniforms.groundWindTime.value,12);
 for(const batch of group.children){
  const flex=batch.geometry.attributes.groundFlex,p=batch.geometry.attributes.position;assert.equal(flex.count,p.count);
  for(let i=0;i<p.count;i++){assert(Number.isFinite(flex.getX(i))&&flex.getX(i)>=0&&flex.getX(i)<=1);if(batch.name.endsWith('litter')||p.getY(i)<-.034)assert.equal(flex.getX(i),0);}
 }
 cleanup(w);
});

test('curved low leaves use their triangle budget and stay inside the reserved wind footprint',()=>{
 const world=buildWorld('forest',7),group=installAdventureGroundDetail(world,'forest'),geometry=group.getObjectByName('adventure-ground-tuft').geometry,p=geometry.attributes.position,n=geometry.attributes.normal,index=geometry.index;
 const a=new T.Vector3(),b=new T.Vector3(),c=new T.Vector3();
 assert(index.count/3<=36,'leaf detail exceeds its per-instance budget');
 for(let i=0;i<index.count;i+=3){
  a.fromBufferAttribute(p,index.getX(i));b.fromBufferAttribute(p,index.getX(i+1));c.fromBufferAttribute(p,index.getX(i+2));
  assert(b.sub(a).cross(c.sub(a)).lengthSq()>1e-12,'collapsed leaf-tip triangles waste geometry and give unstable normals');
 }
 let raised=0,lowerOuter=0;
 for(let i=0;i<p.count;i++){
  assert(Math.abs(Math.hypot(n.getX(i),n.getY(i),n.getZ(i))-1)<1e-5,'leaf normal is invalid');
  const radius=Math.hypot(p.getX(i),p.getZ(i));
  assert(radius*1.14+.035<.55,'curled leaves cross the reserved placement footprint in the wind');
  if(p.getY(i)>.21)raised++;
  if(radius>.25&&p.getY(i)<.17)lowerOuter++;
 }
 assert(raised>0&&lowerOuter>0,'low cover lost its high inner blades and drooping outer leaves');cleanup(world);
});

test('footprints avoid maximum tide, irregular shores, trails, main roads and all hidden interaction clearings',()=>{
 for(const map of maps){
  const world=buildWorld(map,19),group=installAdventureGroundDetail(world,map),routes=[];
  if(world.road)routes.push({points:world.road,width:5.8});
  for(const site of world.sites){const p=site.trail.geometry.attributes.position,points=[];for(let i=0;i<p.count;i+=4)points.push({x:(p.getX(i+1)+p.getX(i+2))*.5,z:(p.getZ(i+1)+p.getZ(i+2))*.5});routes.push({points,width:3.6});}
  for(const p of group.userData.records){
   far(p,world.spawn,4.55);assert(Math.abs(p.x)<world.half-2.55&&Math.abs(p.z)<world.half-2.55);
   for(const o of world.obstacles)far(p,o,o.r+.75);
   for(const s of world.sites){far(p,s,(s.event?7:5.5)+.55);for(const n of s.nodes||[])far(p,n,2.55);}
   for(const d of world.discoveries)far(p,d,3.55);for(const r of world.roaming)far(p,r,(r.kind==='camp'?6:3)+.55);
   for(const region of world.regions||[])far(p,region,6.55);
   for(const d of[...(world.districts||[]),...(world.regions||[]).flatMap(r=>r.districts||[])])far(p,d,(['gate','court'].includes(d.kind)?10:7)+.55);
   for(const patch of world.patches)if(patch.kind==='vent'||patch.kind==='ice')far(p,patch,patch.kind==='vent'?patch.r+1.55:patch.r*1.2+.55);
   for(const b of world.bridges||[])assert(!bridgeContains(b,p.x,p.z,1.35));
   for(const f of world.fords||[])assert(!bridgeContains({...f,width:f.half*2,length:f.width},p.x,p.z,1.35));
   for(const pond of world.ponds){
    const tide=pond.baseRx===undefined?pond:{...pond,rx:pond.baseRx*1.19,rz:pond.baseRz*1.19,r:Math.max(pond.baseRx,pond.baseRz)*1.19*1.12};
    // Probe the entire conservative footprint, not just the instance center.
    for(let i=0;i<12;i++){const a=i*Math.PI/6;assert.equal(waterDepth(tide,p.x+Math.sin(a)*.55,p.z+Math.cos(a)*.55),0,map+' detail is flooded');}
   }
   for(const route of routes)for(let i=1;i<route.points.length;i++){const a=route.points[i-1],b=route.points[i];assert(segmentDistance(p.x,p.z,a.x,a.z,b.x,b.z)>=(p.shoulder?(route.width===5.8?4.2:1.65):route.width)+.55-1e-7);}
  }
  cleanup(world);
 }
});

test('layout-derived and explicit seeds are stable across unrelated randomness and change with the world seed',()=>{
 const first=buildWorld('forest',7),same=buildWorld('forest',7),different=buildWorld('forest',19),random=Math.random;
 let a,b,c;
 try{Math.random=()=>.11;a=installAdventureGroundDetail(first,'forest');Math.random=()=>.89;b=installAdventureGroundDetail(same,'forest');c=installAdventureGroundDetail(different,'forest');}finally{Math.random=random;}
 assert.deepEqual(a.userData.records,b.userData.records);assert.notDeepEqual(a.userData.records,c.userData.records);
 for(let i=0;i<a.children.length;i++){assert.deepEqual(a.children[i].instanceMatrix.array,b.children[i].instanceMatrix.array);assert.deepEqual(a.children[i].instanceColor.array,b.children[i].instanceColor.array);}
 const make=seed=>({seed,half:40,group:new T.Group(),spawn:{x:0,z:0},obstacles:[],sites:[],ponds:[],patches:[]});
 const worlds=[make(12),make(12),make(13)],groups=worlds.map(w=>installAdventureGroundDetail(w,'sand'));
 assert.deepEqual(groups[0].userData.records,groups[1].userData.records);assert.notDeepEqual(groups[0].userData.records,groups[2].userData.records);
 for(const w of[first,same,different,...worlds])cleanup(w);
});

test('existing cleanup releases each owned geometry but keeps the bounded shared material usable',()=>{
 const one=buildWorld('snow',7),two=buildWorld('coast',7),a=installAdventureGroundDetail(one,'snow'),b=installAdventureGroundDetail(two,'coast');
 let geometries=0,instances=0,materials=0;const shared=a.children[0].material,onMaterial=()=>materials++;
 shared.addEventListener('dispose',onMaterial);
 for(const mesh of a.children){mesh.geometry.addEventListener('dispose',()=>geometries++);mesh.addEventListener('dispose',()=>instances++);assert.equal(mesh.material,shared);}
 try{
  cleanup(one);assert.equal(geometries,a.children.length);assert.equal(instances,a.children.length);assert(a.userData.disposed);assert(a.children.every(m=>!m.visible));assert.equal(materials,0);
  assert.equal(b.children[0].material,shared);assert(b.children.every(m=>m.visible));assert(!b.userData.disposed);cleanup(two);assert.equal(materials,0);
 }finally{shared.removeEventListener('dispose',onMaterial);}
});

test('unsupported or fully obstructed worlds do not allocate a detail draw',()=>{
 const world={seed:1,half:12,group:new T.Group(),spawn:{x:0,z:0},obstacles:[{x:0,z:0,r:50}],sites:[],ponds:[],patches:[]};
 assert.equal(installAdventureGroundDetail(world,'unknown'),null);assert.equal(installAdventureGroundDetail(world,'forest'),null);assert.equal(world.group.children.length,0);
});


test('habitat clusters support all biomes, protect gameplay and release bounded GPU batches',()=>{
 for(const map of maps){
  const w=buildWorld(map,7),before=state(w),g=installHabitatDetail(w,map),records=g.userData.records;
  assert.equal(installHabitatDetail(w,map),g);assert.equal(state(w),before);
  assert(records.length>100&&records.length<=3500,map+' missing or unbounded cover');assert(g.children.length<=16);
  if(map==='confluence')assert.equal(new Set(records.map(p=>p.biome)).size,5);
  const matrix=new T.Matrix4(),box=new T.Box3();let triangles=0,released=0;
  for(const m of g.children){
   assert(!m.castShadow&&!m.material.transparent&&m.userData.ownedGeometry);m.geometry.addEventListener('dispose',()=>released++);
   triangles+=m.count*m.geometry.index.count/3;
   for(let i=0;i<m.count;i++){m.getMatrixAt(i,matrix);assert(matrix.elements.every(Number.isFinite));box.copy(m.geometry.boundingBox).applyMatrix4(matrix);assert(box.max.y<.7&&box.min.y<0,'cover floats or blocks eye-level combat');}
  }
  assert(triangles<180000,'habitat exceeded triangle budget');
  for(const p of records){
   far(p,w.spawn,5.15);for(const o of w.obstacles)far(p,o,o.r+1.35);
   for(const site of w.sites)far(p,site,(site.event?7:5.5)+1.15);
   for(const pond of w.ponds)assert.equal(waterDepth(pond,p.x,p.z),0);
   assert(Math.abs(p.x)<w.half-3.15&&Math.abs(p.z)<w.half-3.15);
  }
  cleanup(w);assert(g.userData.disposed);assert.equal(released,g.children.length);
 }
 const a=buildWorld('forest',7),b=buildWorld('forest',7);assert.deepEqual(installHabitatDetail(a,'forest').userData.records,installHabitatDetail(b,'forest').userData.records);cleanup(a);cleanup(b);
});


test('fern stems follow their curved midrib without filling the arch with triangular sheets',()=>{
 const world=buildWorld('forest',7),group=installHabitatDetail(world,'forest'),mesh=group.children.find(m=>m.name==='habitat-fern'),g=mesh.geometry,p=g.attributes.position,index=g.index;
 const a=new T.Vector3(),b=new T.Vector3(),c=new T.Vector3();let maxArea=0;
 for(let i=0;i<index.count;i+=3){a.fromBufferAttribute(p,index.getX(i));b.fromBufferAttribute(p,index.getX(i+1)).sub(a);c.fromBufferAttribute(p,index.getX(i+2)).sub(a);maxArea=Math.max(maxArea,b.cross(c).length()*.5);}
 assert(maxArea<.018,'a broad green sheet still fills the space below a curved stem');
 world.group.traverse(o=>{if(o.isInstancedMesh)o.dispose();if(o.userData.ownedGeometry)o.geometry.dispose();});
});


test('forest shrubs replace fern patches within the same count and sightline budget, never leak to other biomes',()=>{
 for(const map of maps){const w=buildWorld(map,43837033),g=installHabitatDetail(w,map),records=g.userData.records,shrubs=records.filter(p=>p.kind==='shrub');
  if(['forest','confluence'].includes(map)){assert(shrubs.length>20);assert(records.some(p=>p.kind==='fern'));}else assert.equal(shrubs.length,0);
  for(const p of shrubs)assert.equal(p.biome,'forest');
  for(const mesh of g.children.filter(m=>m.name==='habitat-shrub')){const geo=mesh.geometry;assert(geo.index.count/3<=132);assert(geo.boundingBox.max.y<.65);const p=geo.attributes.position;for(let i=0;i<p.count;i++)assert(Math.hypot(p.getX(i),p.getZ(i))+.035<1.15);}
  cleanup(w);
 }
});
