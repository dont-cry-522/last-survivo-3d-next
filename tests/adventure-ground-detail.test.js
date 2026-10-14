import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../vendor/three.module.js';
import {buildWorld} from '../world.js';
import {waterDepth} from '../water.js';
import {bridgeContains} from '../coast.js';
import {segmentDistance} from '../rules.js';
import {installForestHabitats,forestHabitatAt} from '../forest-habitats.js';
import {polishEnvironmentModels} from '../environment-props.js';
import {installForestVista} from '../forest-vista.js';
import {installBiomePlaces} from '../biome-places.js?v=193';
import {installEnvironmentClusters} from '../environment-clusters.js?v=193';
import {installExplorationRoutes} from '../exploration-routes.js';
import {installExplorationLandmarks} from '../exploration-landmarks.js';
import {installExplorationComposition} from '../exploration-composition.js';
import {installForestTerrain} from '../forest-terrain.js';
import {installAdventureGroundDetail,installHabitatDetail,animateAdventureGroundDetail} from '../adventure-ground-detail.js';
import {naturalRockGeometry} from '../biome-scenery.js?v=193';
import {surfaceUniforms} from '../surface-textures.js?v=193';

globalThis.document={createElement:()=>({getContext:()=>({fillRect(){}})})};
const maps=['forest','snow','ash','sand','coast','confluence'];
const cleanup=world=>world.group.traverse(o=>{if(o.isInstancedMesh)o.dispose();if(o.userData.ownedGeometry)o.geometry.dispose();});
const state=world=>JSON.stringify({spawn:world.spawn,obstacles:world.obstacles.map(o=>[o.x,o.z,o.r,o.state]),patches:world.patches.map(p=>[p.x,p.z,p.rx,p.rz,p.kind]),sites:world.sites.map(s=>[s.x,s.z,s.claimed,s.discovered]),finds:world.discoveries.map(d=>[d.x,d.z,d.discovered,d.claimed]),roaming:world.roaming.map(r=>[r.x,r.z,r.state])});
const far=(p,q,r)=>assert(Math.hypot(p.x-q.x,p.z-q.z)>=r-1e-7,`${p.biome} ${p.kind} encroaches on protected ground`);

test('local maps use at most two bounded batches and the joined map ten without moving gameplay data or raising the floor',()=>{
 for(const map of maps){
  const world=buildWorld(map,7),before=state(world),ground=world.ground.geometry.attributes.position.array.slice(),group=installAdventureGroundDetail(world,map);
  assert(group,map);assert.equal(group.parent,world.group);assert.equal(installAdventureGroundDetail(world,map),group);
  assert(group.children.length>0&&group.children.length<=(map==='confluence'?10:2));const records=group.userData.records;
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
  assert(triangles<=(map==='confluence'?130000:map==='forest'?115000:55000),'low cover exceeded the fixed geometry budget');
  if(map==='forest'||map==='coast')assert(records.filter(p=>Math.hypot(p.x-world.spawn.x,p.z-world.spawn.z)<20).length>=80,'near view is missing low ground cover');
  cleanup(world);
 }
});

test('forest leaf litter replaces its old stones within the same placement and footprint budget',()=>{
 const matrix=new T.Matrix4(),point=new T.Vector3(),center=new T.Vector3(),litterShapes=new Map();
 for(const map of maps){
  const world=buildWorld(map,43837033),group=installAdventureGroundDetail(world,map),forest=group.getObjectByName('adventure-ground-forest-litter');
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
  for(const batch of group.children.filter(m=>m.userData.kind==='litter'&&m.userData.biome!=='forest')){
   const biome=batch.userData.biome,p=batch.geometry.attributes.position;
   assert.equal(batch.count,group.userData.records.filter(r=>r.biome===biome&&r.kind==='litter').length);
   if(litterShapes.has(biome))assert.deepEqual(p.array,litterShapes.get(biome));else litterShapes.set(biome,p.array.slice());
   for(let i=0;i<p.count;i++){assert.equal(batch.geometry.attributes.groundFlex.getX(i),0);assert(Math.hypot(p.getX(i),p.getZ(i))*1.14<.55);}
  }
  cleanup(world);
 }
 assert.equal(new Set([...litterShapes.values()].map(a=>Array.from(a).join(','))).size,4,'biome litter is still the same stones in four colors');
});

test('snow and sand fragments have irregular low tops and every separate piece enters the actual ground plane',()=>{
 const matrix=new T.Matrix4(),point=new T.Vector3();
 for(const map of ['snow','sand'])for(const seed of [7,43837033]){
  const world=buildWorld(map,seed),group=installAdventureGroundDetail(world,map),mesh=group.children.find(m=>m.userData.kind==='litter'),p=mesh.geometry.attributes.position;
  // Three equal-sized pieces; inspect each underside after the complete instance transform.
  const part=p.count/3;assert(Number.isInteger(part));assert(p.count/3<=90);
  for(let i=0;i<mesh.count;i++){
   mesh.getMatrixAt(i,matrix);
   for(let piece=0;piece<3;piece++){
    let bottom=Infinity,top=-Infinity;
    for(let j=piece*part;j<(piece+1)*part;j++){point.fromBufferAttribute(p,j).applyMatrix4(matrix);bottom=Math.min(bottom,point.y);top=Math.max(top,point.y);}
    assert(bottom<-.031,'fragment floats above the ground at y=-.03');assert(top>-.025&&top<.055,'fragment vanished or became a tall geometric obstacle');
   }
  }
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
 assert(index.count/3<=84,'leaf detail exceeds its per-instance budget');
 for(let i=0;i<index.count;i+=3){
  a.fromBufferAttribute(p,index.getX(i));b.fromBufferAttribute(p,index.getX(i+1));c.fromBufferAttribute(p,index.getX(i+2));
  assert(b.sub(a).cross(c.sub(a)).lengthSq()>1e-12,'collapsed leaf-tip triangles waste geometry and give unstable normals');
 }
 let raised=0,lowerOuter=0;
 for(let i=0;i<p.count;i++){
  assert(Math.abs(Math.hypot(n.getX(i),n.getY(i),n.getZ(i))-1)<1e-5,'leaf normal is invalid');
  const radius=Math.hypot(p.getX(i),p.getZ(i));
  assert(radius*1.14+.035<.55,'curled leaves cross the reserved placement footprint in the wind');
  if(p.getY(i)>.165)raised++;
  if(radius>.25&&p.getY(i)<.17)lowerOuter++;
 }
 assert(raised>0&&lowerOuter>0,'low cover lost its high inner blades and drooping outer leaves');cleanup(world);
});

test('non-forest low plants use their own geometry within the same footprint and triangle budget',()=>{
 const silhouettes=new Set(),point=new T.Vector3(),center=new T.Vector3(),matrix=new T.Matrix4();
 for(const map of ['snow','ash','sand','coast']){
  const world=buildWorld(map,43837033),group=installAdventureGroundDetail(world,map),mesh=group.children.find(m=>m.userData.kind==='tuft'),g=mesh.geometry,p=g.attributes.position;
  silhouettes.add(Array.from(p.array).join(','));assert(g.index.count/3<=35);
  if(map==='ash')assert(Array.from(g.attributes.groundFlex.array).every(v=>v===0),'charred branches sway like living grass');
  for(let i=0;i<mesh.count;i++){
   mesh.getMatrixAt(i,matrix);center.setFromMatrixPosition(matrix);
   for(let j=0;j<p.count;j++){point.fromBufferAttribute(p,j).applyMatrix4(matrix);assert(Math.hypot(point.x-center.x,point.z-center.z)+.035<.55);assert(point.y<.30);}
  }
  cleanup(world);
 }
 assert.equal(silhouettes.size,4,'biome plants still share a recolored silhouette');
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

test('habitat scree uses grounded mineral sides and shared rock maps without moving placed stones',()=>{
 const first=buildWorld('forest',7),second=buildWorld('snow',7);installForestHabitats(first,'forest');
 const a=installHabitatDetail(first,'forest'),b=installHabitatDetail(second,'snow'),stones=a.children.filter(m=>m.name==='habitat-stone'),original=naturalRockGeometry.attributes.position;
 assert(stones.length>0);const shared=stones[0].material;assert.equal(shared.name,'M_Habitat_Stone_A');assert.equal(shared.transparent,false);assert.equal(shared.flatShading,true);assert.equal(shared.side,T.FrontSide);assert.equal(shared.roughness,.96);
 const actual=new T.Matrix4(),expected=new T.Object3D(),color=new T.Color();let wet=0,disposed=0;
 for(const group of[a,b])for(const batch of group.children.filter(m=>m.name==='habitat-stone')){
  assert.strictEqual(batch.material,shared);const {position:p,groundFlex,stoneDamp}=batch.geometry.attributes;assert.equal(batch.geometry.index.count/3,120);assert.equal(stoneDamp.count,batch.count);assert(stoneDamp.isInstancedBufferAttribute);
  assert.equal(p.count,original.count);for(let i=0;i<p.count;i++){
   const ox=original.getX(i),oy=original.getY(i),oz=original.getZ(i);
   assert(Math.abs(p.getX(i))<=Math.abs(ox)+1e-7&&Math.abs(p.getZ(i))<=Math.abs(oz)+1e-7,'rock enlarged its footprint');
   assert(p.getY(i)<=oy+1e-7,'rock raised its established silhouette');if(oy<-.05)assert.equal(p.getY(i),oy,'buried underside moved');assert.equal(groundFlex.getX(i),0);
  }
  batch.getMatrixAt(0,actual);const q=Number(actual.elements[12]>=0)+Number(actual.elements[14]>=0)*2;
  const records=group.userData.records.filter(p=>p.kind==='stone'&&(Number(p.x>=0)+Number(p.z>=0)*2)===q);assert.equal(records.length,batch.count);
  for(const[i,r]of records.entries()){
   expected.position.set(r.x,-.055,r.z);expected.scale.set(r.width,r.height,r.width);expected.rotation.set(0,r.angle,0);expected.updateMatrix();batch.getMatrixAt(i,actual);
   assert.deepEqual(Float32Array.from(actual.elements),Float32Array.from(expected.matrix.elements),'stone instance transform changed');
   assert(stoneDamp.getX(i)>=0&&stoneDamp.getX(i)<=1);if(r.biome==='forest'){wet+=stoneDamp.getX(i);batch.getColorAt(i,color);assert(Math.max(color.r,color.g,color.b)<.21,'forest scree retained a pale paper colour');}else assert.equal(stoneDamp.getX(i),0);
  }
 }
 assert(wet>1,'wet banks lost their damp stone finish');
 const shader={uniforms:{},vertexShader:T.ShaderLib.standard.vertexShader,fragmentShader:T.ShaderLib.standard.fragmentShader};shared.onBeforeCompile(shader);
 for(const key of['rockColor','rockHeight','rockReady'])assert.strictEqual(shader.uniforms[key],surfaceUniforms[key]);
 assert.equal((shader.fragmentShader.match(/texture2D\(/g)||[]).length,2);assert(shader.fragmentShader.includes('stoneRelief'));assert(shader.fragmentShader.includes('roughnessFactor-habitatStoneDamp*.08'));assert(!shader.vertexShader.includes('groundWindTime'));assert(!shader.fragmentShader.includes('leafBacklight'));
 const onDispose=()=>disposed++;shared.addEventListener('dispose',onDispose);cleanup(first);cleanup(second);assert.equal(disposed,0);shared.removeEventListener('dispose',onDispose);
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

test('fuller forest understory stays inside reserved footprints, under the sight line and within its original batch budget',()=>{
 const matrix=new T.Matrix4(),point=new T.Vector3(),center=new T.Vector3();
 for(const map of ['forest','confluence'])for(const seed of [7,522,43837033]){
  const w=buildWorld(map,seed);installForestHabitats(w,map);
  const floor=installAdventureGroundDetail(w,map),habitat=installHabitatDetail(w,map);
  assert.equal(floor.userData.records.length,map==='forest'?1200:2200);
  assert(habitat.userData.centers.length<=(map==='forest'?300:500));assert(habitat.children.length<=16);
  const plants=habitat.userData.records.filter(p=>p.biome==='forest'&&['fern','shrub'].includes(p.kind));
  assert(Math.max(...plants.map(p=>p.width))-Math.min(...plants.map(p=>p.width))>.4,'understory becomes uniformly sized');
  let triangles=0;
  for(const mesh of [...floor.children,...habitat.children]){
   const p=mesh.geometry.attributes.position,n=mesh.geometry.attributes.normal,index=mesh.geometry.index;
   if(mesh.parent===habitat)triangles+=mesh.count*index.count/3;
   for(let i=0;i<p.count;i++)assert(Math.abs(Math.hypot(n.getX(i),n.getY(i),n.getZ(i))-1)<1e-5);
   for(let i=0;i<mesh.count;i++){
    mesh.getMatrixAt(i,matrix);center.setFromMatrixPosition(matrix);
    for(let j=0;j<p.count;j++){
     point.fromBufferAttribute(p,j).applyMatrix4(matrix);
     assert(Math.hypot(point.x-center.x,point.z-center.z)+.035<(mesh.parent===floor?.55:1.15),'wind-swept vegetation exceeds its reserved collision-free footprint');
     assert(point.y<(mesh.parent===floor?.30:.7),'vegetation blocks combat sight lines');
    }
   }
  }
  assert(triangles<235000);cleanup(w);
 }
});

const scenicWorld=(id,seed)=>{
 const w=buildWorld(id,seed);polishEnvironmentModels(w);installForestVista(w,id);installForestHabitats(w,id);installBiomePlaces(w,id);installEnvironmentClusters(w,id);installExplorationRoutes(w);installExplorationLandmarks(w,id);installExplorationComposition(w,id);return w;
};
const detailBudget=g=>({count:g.userData.records.length,draws:g.children.length,triangles:g.children.reduce((n,b)=>n+b.count*(b.geometry.index?.count??b.geometry.attributes.position.count)/3,0)});
const releaseDetail=g=>{g.traverse(o=>{if(o.isInstancedMesh)o.dispose();if(o.userData.ownedGeometry)o.geometry.dispose();});g.removeFromParent();};

test('scenery edges reassign existing cover across six maps, keeping original shoulders, near-spawn cover and exact GPU budgets',()=>{
 for(const id of maps)for(const seed of[7,522]){
  const w=scenicWorld(id,seed),clusters=w.environmentClusters,places=w.biomePlaces,before=state(w),obstacles=w.obstacles.slice(),transforms=obstacles.map(o=>o.mesh.matrix.toArray()),routes=JSON.stringify(w.explorationRoutes.map(r=>r.points));
  // Same real solids, passages and composition, with only edge-source metadata hidden.
  // This compares against the original distribution without a second world RNG.
  w.environmentClusters=null;w.biomePlaces=places.map(p=>({...p,solids:[]}));
  const original=[installAdventureGroundDetail(w,id),installHabitatDetail(w,id)],baseline=original.map(g=>({records:g.userData.records,budget:detailBudget(g)}));
  original.forEach(releaseDetail);w.environmentClusters=clusters;w.biomePlaces=places;
  const layers=[installAdventureGroundDetail(w,id),installHabitatDetail(w,id)];
  assert.equal(state(w),before);assert.deepEqual(w.obstacles,obstacles);assert.deepEqual(obstacles.map(o=>o.mesh.matrix.toArray()),transforms);assert.equal(JSON.stringify(w.explorationRoutes.map(r=>r.points)),routes);
  for(const [layer,g]of layers.entries()){
   const records=g.userData.records,old=baseline[layer].records,edge=records.filter(p=>p.edge),footprint=layer?1.15:.55;
   assert.deepEqual(detailBudget(g),baseline[layer].budget,id+' changed the instance, triangle or draw budget');
   assert(edge.length>=records.length*.08&&edge.length<=Math.floor(records.length*.32),id+' missing or excessive scenery-edge redistribution');
   assert(edge.some(p=>p.edge==='cluster')&&edge.some(p=>p.edge==='place'),`${id} seed ${seed} layer ${layer} missing a scenery type`);
   for(let i=0;i<records.length;i++){
    const p=records[i],was=old[i];assert.equal(p.kind,was.kind);assert.equal(p.biome,was.biome);
    assert.equal(Number(p.x>=0)+Number(p.z>=0)*2,Number(was.x>=0)+Number(was.z>=0)*2,'relocation creates an extra culling batch');
    if(!p.edge){assert.deepEqual(p,was);continue;}
    assert(!was.shoulder);far(was,w.spawn,20);assert(!(p.biome==='forest'&&['reed','stone'].includes(p.kind)),'wet-bank habitat moved into dry scenery');
    const source=p.edge==='cluster'?clusters.records[p.edgeIndex]:places[p.edgeIndex];assert(source);assert.equal(p.biome,source.biome);
    const solids=p.edge==='cluster'?[{...source,r:source.footprint}]:source.solids;
    assert(Math.min(...solids.map(o=>Math.hypot(p.x-o.x,p.z-o.z)-o.r))<=footprint+2.95,'edge tag refers to distant scenery');
    if(w.regions)assert(w.regions.find(r=>r.id===p.biome).contains(p.x,p.z));
    for(const o of w.obstacles)far(p,o,o.r+footprint+.2);
    for(const route of w.explorationRoutes)for(let j=1;j<route.points.length;j++){const a=route.points[j-1],b=route.points[j];assert(segmentDistance(p.x,p.z,a.x,a.z,b.x,b.z)>=2+footprint-1e-7,'new edge growth fills a traversable route');}
    for(const place of places){const c=Math.cos(place.angle),s=Math.sin(place.angle),dx=p.x-place.x,dz=p.z-place.z;assert(Math.abs(c*dx-s*dz)>=3.1+footprint||Math.abs(s*dx+c*dz)>=10+footprint,'new growth fills the scene passage');}
    for(const site of w.sites){far(p,site,(site.event?7:5.5)+footprint);for(const node of site.nodes||[])far(p,node,2+footprint);}
    for(const find of w.discoveries)far(p,find,3+footprint);for(const event of w.roaming)far(p,event,(event.kind==='camp'?6:3)+footprint);
    for(const bridge of w.bridges||[])assert(!bridgeContains(bridge,p.x,p.z,footprint+.8));
    for(const pond of w.ponds){const k=pond.baseRx===undefined?1:1.19,tide={...pond,rx:(pond.baseRx??pond.rx)*k,rz:(pond.baseRz??pond.rz)*k};for(let j=0;j<8;j++)assert.equal(waterDepth(tide,p.x+Math.cos(j*Math.PI/4)*footprint,p.z+Math.sin(j*Math.PI/4)*footprint),0,'edge cover enters high water');}
   }
   const nearest=rs=>clusters.records.reduce((n,a)=>n+Math.min(...rs.map(p=>Math.hypot(p.x-a.x,p.z-a.z)-a.footprint)),0)/clusters.records.length;
   // New composition can put scenery into cover that was already close. Such
   // sources need a safe joining fringe, not an ever-tighter mandatory ring.
   assert(nearest(records)<Math.max(footprint+.55,nearest(old)*.8),`${id} seed ${seed} layer ${layer} did not join nearby scenery: ${nearest(records)}/${nearest(old)}`);
   assert(new Set(edge.map(p=>p.edge+':'+p.edgeIndex)).size>=(id==='confluence'?30:12),`${id} seed ${seed} layer ${layer}: redistribution only affects a few scenery islands`);
   const distances=edge.filter(p=>p.edge==='cluster').map(p=>{const a=clusters.records[p.edgeIndex];return Math.hypot(p.x-a.x,p.z-a.z)-a.footprint;});
   assert(Math.max(...distances)-Math.min(...distances)>1.4,'edge cover forms a regular narrow ring');
   const core=[],fringe=[];
   for(let i=0;i<records.length;i++){
    const p=records[i];if(!p.edge)continue;
    if(p.edgeGrowth>.8)core.push(p.height/old[i].height);if(p.edgeGrowth<.25)fringe.push(p.height/old[i].height);
   }
   const mean=values=>values.reduce((n,v)=>n+v,0)/values.length;
   assert(core.length>=3&&fringe.length>=3,'scenery cover has no distinct inner and outer fringe');
   assert(mean(core)>mean(fringe)*1.22,'existing plants remain equally tall across the scenery-to-ground transition');
   const linked=edge.filter(p=>edge.some(q=>p!==q&&p.biome===q.biome&&Math.hypot(p.x-q.x,p.z-q.z)<1.7));
   assert(linked.length>edge.length*.6,'redistributed cover is still made of isolated specimens');
   let released=0;for(const batch of g.children)batch.geometry.addEventListener('dispose',()=>released++);
   releaseDetail(g);assert.equal(released,g.children.length);assert(g.userData.disposed);assert(g.children.every(b=>!b.visible));
  }
  cleanup(w);
 }
});

test('edge redistribution is deterministic after cleanup and leaves a surviving world untouched',()=>{
 const first=scenicWorld('confluence',522),other=scenicWorld('forest',7),alive=[installAdventureGroundDetail(other,'forest'),installHabitatDetail(other,'forest')],shared=alive[0].children[0].material,random=Math.random;
 let disposedMaterial=0;const onDispose=()=>disposedMaterial++;shared.addEventListener('dispose',onDispose);
 try{
  Math.random=()=>.03;const initial=[installAdventureGroundDetail(first,'confluence'),installHabitatDetail(first,'confluence')],records=initial.map(g=>g.userData.records),matrices=initial.map(g=>g.children.map(b=>b.instanceMatrix.array.slice()));initial.forEach(releaseDetail);
  Math.random=()=>.91;const rebuilt=[installAdventureGroundDetail(first,'confluence'),installHabitatDetail(first,'confluence')];
  for(let i=0;i<rebuilt.length;i++){assert.deepEqual(rebuilt[i].userData.records,records[i]);assert.deepEqual(rebuilt[i].children.map(b=>b.instanceMatrix.array),matrices[i]);}
  assert.equal(disposedMaterial,0);assert(alive.every(g=>!g.userData.disposed&&g.children.every(b=>b.visible)));
 }finally{Math.random=random;shared.removeEventListener('dispose',onDispose);cleanup(first);cleanup(other);}
});

test('biome edges connect both cover layers with lee pockets, broken scree, wind trails and shoreline bands',()=>{
 for(const id of maps){
  const world=scenicWorld(id,522),low=installAdventureGroundDetail(world,id).userData.records,high=installHabitatDetail(world,id).userData.records;
  for(const biome of id==='confluence'?maps.slice(0,5):[id]){
   const floor=low.filter(p=>p.biome===biome),upper=high.filter(p=>p.biome===biome&&p.edge),cluster=floor.filter(p=>p.edge==='cluster');
   assert(cluster.length>12,id+': '+biome+' has no visible transition beside its scenery groups');
   const connected=upper.filter(p=>floor.some(q=>Math.hypot(p.x-q.x,p.z-q.z)<3.5));
   assert(connected.length>upper.length*.65,biome+' upper plants sit apart from the low ground layer');
   if(biome==='forest'){
    for(const records of[low,high]){
     const roots=records.filter(p=>p.transition==='root');assert(roots.length>=4,'vista tree bases are still isolated from both cover layers');
     for(const p of roots)assert(world.forestVista.anchors.some(a=>Math.hypot(p.x-a.x,p.z-a.z)<8),'root cover moved away from the existing vista trees');
    }
    continue;
   }
   let along=0,across=0,lee=0,inner=0,outer=0;
   for(const p of cluster){
    const source=world.environmentClusters.records[p.edgeIndex],dx=p.x-source.x,dz=p.z-source.z;
    let axis=biome==='sand'?-.7:biome==='snow'?source.angle+2.7:source.angle+Math.sin(source.x*.27+source.z*.19)*.7;
    if(biome==='coast'){
     const pond=world.ponds.reduce((best,q)=>!best||Math.hypot(source.x-q.x,source.z-q.z)-Math.max(q.rx,q.rz)<Math.hypot(source.x-best.x,source.z-best.z)-Math.max(best.rx,best.rz)?q:best,null);
     axis=Math.atan2(source.z-pond.z,pond.x-source.x);
    }
    const forward=dx*Math.sin(axis)+dz*Math.cos(axis),side=dx*Math.cos(axis)-dz*Math.sin(axis);along+=forward**2;across+=side**2;if(forward>0)lee++;
    if(biome==='ash'){
     const distance=Math.hypot(dx,dz)-source.footprint-.55-.24;
     assert(distance<.95||distance>1.77,'charred rubble lost its bare interval between loose bands');
     if(distance<.95)inner++;else outer++;
    }
   }
   if(biome==='snow')assert(lee>cluster.length*.6&&across/along>.10,'snow cover is a thin straight border instead of broad lee pockets');
   else assert(across/along<.10,biome+' ground cover lost its shared directional shape');
   if(biome==='ash')assert(inner>5&&outer>5,'one of the separated scree bands disappeared');
   if(biome==='sand')for(const p of floor.filter(p=>p.edge))assert(Math.abs(p.angle+.7)<.31,'desert plants no longer follow the prevailing wind');
  }
  cleanup(world);
 }
});

test('forest transitions join low cover and understory at real banks and groves within the existing instance budget',()=>{
 for(const [seed,habitatCount]of[[7,1151],[522,1122],[43837033,1116]]){
  const w=buildWorld('forest',seed);installForestHabitats(w,'forest');const before=state(w),floor=installAdventureGroundDetail(w,'forest'),understory=installHabitatDetail(w,'forest');
  assert.equal(state(w),before);assert.equal(floor.userData.records.length,1200);assert.equal(understory.userData.records.length,habitatCount);
  assert.equal(floor.children.length,2);assert(understory.children.length<=16);
  const low=floor.userData.records.filter(p=>p.transition),high=understory.userData.records.filter(p=>p.transition);
  for(const [all,connected,footprint]of[[floor.userData.records,low,.55],[understory.userData.records,high,1.15]]){
   assert(connected.length>=all.length*.10&&connected.length<=Math.floor(all.length*.18));
   assert(connected.some(p=>p.transition==='bank')&&connected.some(p=>p.transition==='shade'));
   for(const p of connected){
    assert.equal(p.biome,'forest');assert(!p.edge,'later scenery placement breaks the connected patches');
    const h=forestHabitatAt(w,p.x,p.z);
    if(p.transition==='bank')assert(h.bank>=.22,'shore plants were moved into a dry meadow');
    if(p.transition==='shade')assert(h.shade>=.2,'ferns were moved out of their sheltered grove');
    if(p.transition==='shoulder'&&footprint===.55)assert(p.shoulder);
    far(p,w.spawn,4+footprint);for(const obstacle of w.obstacles)far(p,obstacle,obstacle.r+footprint+.2);
    for(const site of w.sites){far(p,site,(site.event?7:5.5)+footprint);for(const node of site.nodes||[])far(p,node,2+footprint);}
    for(const pond of w.ponds)for(let i=0;i<8;i++)assert.equal(waterDepth(pond,p.x+Math.sin(i*Math.PI/4)*footprint,p.z+Math.cos(i*Math.PI/4)*footprint),0);
   }
  }
  const linked=high.filter(p=>low.some(q=>p.transitionIndex===q.transitionIndex&&Math.hypot(p.x-q.x,p.z-q.z)<3.5));
  assert(linked.length>high.length*.62,'mid-height plants remain isolated instead of sharing low ground cover');
  // Bank growth varies inland depth instead of forming a fixed-offset ring.
  const depths=low.filter(p=>p.transition==='bank').map(p=>Math.min(...w.ponds.map(q=>{
   const c=Math.cos(q.angle||0),s=Math.sin(q.angle||0),x=p.x-q.x,z=p.z-q.z;
   return(Math.hypot((c*x-s*z)/q.rx,(s*x+c*z)/q.rz)-1)*Math.min(q.rx,q.rz);
  })));
  assert(Math.max(...depths)-Math.min(...depths)>2.5,'shore cover forms a narrow planted border');
  cleanup(w);
 }
});

test('forest road shoulders taper toward the bare walking corridor and relocation rebuilds deterministically',()=>{
 const a=buildWorld('forest',522),b=buildWorld('forest',522);for(const w of[a,b])installForestHabitats(w,'forest');
 const first=installAdventureGroundDetail(a,'forest'),same=installAdventureGroundDetail(b,'forest');assert.deepEqual(first.userData.records,same.userData.records);
 const routes=[];if(a.road)routes.push({points:a.road,width:4.2});
 for(const site of a.sites){const p=site.trail.geometry.attributes.position,points=[];for(let i=0;i<p.count;i+=4)points.push({x:(p.getX(i+1)+p.getX(i+2))*.5,z:(p.getZ(i+1)+p.getZ(i+2))*.5});routes.push({points,width:1.65});}
 const inner=[],outer=[];
 for(const p of first.userData.records.filter(p=>p.kind==='tuft'&&p.shoulder)){
  let d=Infinity;for(const route of routes)for(let i=1;i<route.points.length;i++){const x=route.points[i-1],y=route.points[i];d=Math.min(d,segmentDistance(p.x,p.z,x.x,x.z,y.x,y.z)-route.width);}
  assert(d>=.55-1e-7,'shoulder fills the clear walking corridor');if(d<1.1)inner.push(p.height);else if(d>1.7)outer.push(p.height);
 }
 assert(inner.length>10&&outer.length>10);const mean=list=>list.reduce((n,x)=>n+x,0)/list.length;
 assert(mean(inner)<mean(outer)*.8,'the road ends at a uniform wall of equally tall grass');
 cleanup(a);cleanup(b);
});

test('forest transition planting keeps rotated scenery passages clear in both forest and joined maps',()=>{
 for(const [id,seed]of[['forest',43837033],['confluence',522]]){
  const world=scenicWorld(id,seed),layers=[installAdventureGroundDetail(world,id),installHabitatDetail(world,id)];
  assert(world.biomePlaces.length>0);
  for(const [layer,group]of layers.entries()){
   const footprint=layer?1.15:.55,records=group.userData.records.filter(p=>p.transition);assert(records.length>10);
   for(const p of records)for(const place of world.biomePlaces){
    const c=Math.cos(place.angle||0),s=Math.sin(place.angle||0),dx=p.x-place.x,dz=p.z-place.z;
    assert(Math.abs(c*dx-s*dz)>=3.1+footprint||Math.abs(s*dx+c*dz)>=10+footprint,`${id} ${p.kind} fills a scenery passage`);
   }
  }
  cleanup(world);
 }
});

test('near-shore approaches retain a clear walking strip while the same cover budget frames its sides',()=>{
 for(const seed of[7,522,43837033]){
  const world=scenicWorld('forest',seed),approach=world.forestHabitats.approach;assert(approach);
  const snapshot=state(world),layers=[installAdventureGroundDetail(world,'forest'),installHabitatDetail(world,'forest')];
  assert.equal(layers[0].userData.records.length,1200);assert.equal(layers[0].children.length,2);assert(layers[1].children.length<=16);assert.equal(state(world),snapshot);
  for(const [layer,group]of layers.entries()){
   const footprint=layer?1.15:.55;let framed=0;
   for(const p of group.userData.records){
    let distance=Infinity;for(let i=1;i<approach.points.length;i++){const a=approach.points[i-1],b=approach.points[i];distance=Math.min(distance,segmentDistance(p.x,p.z,a.x,a.z,b.x,b.z));}
    assert(distance>=1.65+footprint-1e-7,'new cover fills the dry walking approach');if(distance<9)framed++;
   }
   assert(framed>8,'the walking approach lost its foreground vegetation');
  }
  cleanup(world);
 }
});

test('opening forest cover forms two bounded path-side masses and keeps roots, gameplay and terrain attachment',()=>{
 const matrix=new T.Matrix4(),point=new T.Vector3();
 for(const [id,seed,highCount]of[["forest",7,1130],["forest",522,1104],["forest",43837033,1114],["confluence",7,2114],["confluence",522,2103],["confluence",43837033,2131]]){
  const world=scenicWorld(id,seed),before=state(world),habitat=world.forestHabitats;
  const length=route=>route?.points.reduce((n,p,i,points)=>n+(i?Math.hypot(p.x-points[i-1].x,p.z-points[i-1].z):0),0)||0;
  const route=length(habitat.approach)>=14?habitat.approach:world.explorationRoutes.find(r=>r.site===habitat.relic);
  assert(route);if(id==='confluence'||seed===7)assert.equal(route.site,habitat.relic,'short or missing shore approach did not use the existing relic route');
  const layers=[installAdventureGroundDetail(world,id),installHabitatDetail(world,id)];
  assert.equal(layers[0].userData.records.length,id==='forest'?1200:2200);assert.equal(layers[1].userData.records.length,highCount);
  installForestTerrain(world,id);assert.equal(state(world),before);
  for(const [layer,group]of layers.entries()){
   const footprint=layer?1.15:.55,records=group.userData.records,forest=records.filter(p=>p.biome==='forest'),focused=forest.filter(p=>p.transition==='approach'),budget=Math.floor(forest.length*.18);
   assert(forest.filter(p=>p.transition).length<=budget);assert(forest.filter(p=>p.transition==='root').length>=4,'focused planting stripped existing tree roots');
   assert(forest.some(p=>p.transition==='shade')&&forest.some(p=>p.transition==='bank'),'focused planting consumed the entire habitat budget');
   for(const side of[0,1]){
    const mass=focused.filter(p=>p.transitionIndex===side);assert(mass.length>=8&&mass.length<=Math.floor(budget*(side===0?.32:.18)),'missing or unbounded opening mass');
    assert(mass.filter(p=>mass.some(q=>q!==p&&Math.hypot(p.x-q.x,p.z-q.z)<2.2)).length>mass.length*.8,'opening mass scattered into isolated plants');
   }
   const pending=new Set(focused);
   for(const p of focused){
    assert(!p.edge);assert.equal(p.biome,'forest');let nearPath=false,walked=0;
    for(let i=1;i<route.points.length;i++){
     const a=route.points[i-1],b=route.points[i],dx=b.x-a.x,dz=b.z-a.z,l=Math.hypot(dx,dz);if(!l)continue;
     const t=((p.x-a.x)*dx+(p.z-a.z)*dz)/(l*l),along=walked+t*l,across=((p.x-a.x)*dz-(p.z-a.z)*dx)/l;walked+=l;
     if(t>=-1e-7&&t<=1+1e-7&&along>=8-1e-7&&along<=24+1e-7&&Math.abs(across)>=4.8-1e-7&&Math.abs(across)<=8.2+1e-7)nearPath=true;
    }
    assert(nearPath,'opening plants left the actual first 8–24 m of the route');far(p,world.spawn,4+footprint);
    for(const o of world.obstacles)far(p,o,o.r+footprint+.2);
    for(const pond of world.ponds)for(let i=0;i<8;i++)assert.equal(waterDepth(pond,p.x+Math.sin(i*Math.PI/4)*footprint,p.z+Math.cos(i*Math.PI/4)*footprint),0);
    for(const r of world.explorationRoutes)for(let i=1;i<r.points.length;i++)assert(segmentDistance(p.x,p.z,r.points[i-1].x,r.points[i-1].z,r.points[i].x,r.points[i].z)>=2+footprint-1e-7);
   }
   for(const mesh of group.children)for(let i=0;i<mesh.count;i++){
    mesh.getMatrixAt(i,matrix);point.setFromMatrixPosition(matrix);const record=focused.find(p=>Math.hypot(point.x-p.x,point.z-p.z)<1e-5);if(!record)continue;
    pending.delete(record);const bottom=point.y+mesh.geometry.boundingBox.min.y*record.height;
    assert(Math.abs(bottom-world.groundHeightAt(record.x,record.z)+.042)<1e-5,'plant metadata no longer matches its grounded instance');
   }
   assert.equal(pending.size,0,'focused records were lost from their culling batches');
  }
  cleanup(world);
 }
});
