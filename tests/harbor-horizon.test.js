import{test}from'node:test';
import assert from'node:assert/strict';
import * as T from'../vendor/three.module.js';
import{installDistantLandscape}from'../environment-lighting.js';
import{installHarborHorizon,harborBayCut}from'../harbor-horizon.js';
import{groundWindTime,animateAdventureGroundDetail}from'../adventure-ground-detail.js?v=184';
import{biomeAt}from'../confluence.js';
import{buildWorld}from'../world.js';

globalThis.document={createElement:()=>({getContext:()=>({fillRect(){}})})};
const release=w=>w.group.traverse(o=>{if(o.isInstancedMesh)o.dispose();if(o.userData.ownedGeometry)o.geometry.dispose();});
function scene(id){const world={half:id==='confluence'?140:96,group:new T.Group()},ridge=installDistantLandscape(world,id,biomeAt);return{world,ridge,group:installHarborHorizon(world,id,biomeAt,ridge)};}

test('harbor settlements are broad, grounded offshore silhouettes with bounded rendering cost',()=>{
 for(const id of['coast','confluence']){
  const{world,ridge,group}=scene(id),records=group.userData.records;
  assert(records.length>=6&&records.length<=10,id+' needs several separated harbor clusters');
  assert.equal(group.children.length,3);assert.equal(group.position.length(),0);assert.equal(group.rotation.y,0);
  assert(group.children.reduce((n,m)=>n+m.geometry.index.count/3,0)<15000);
  const ray=new T.Raycaster(new T.Vector3(),new T.Vector3(0,-1,0),0,400);ridge.updateMatrixWorld(true);
  for(const p of records){
   assert(p.y-p.low<2.51,'steep hillside made an implausibly tall quay');assert.equal(p.supports.length,9);
   for(const q of p.supports){
    ray.ray.origin.set(q.x,200,q.z);const y=ray.intersectObject(ridge,false)[0]?.point.y;
    assert(Number.isFinite(y)&&Math.abs(y-q.y)<1e-6);assert(p.low<y&&p.y>=y,'footing must overlap the shore at its edges and centre');
   }
  }
  assert.equal(new Set(records.map(p=>p.variant)).size,3,'not just the same building repeated');
  for(const mesh of group.children){
   assert(mesh.isMesh&&!mesh.isInstancedMesh);assert(mesh.userData.ownedGeometry);assert(!mesh.castShadow&&!mesh.receiveShadow&&!mesh.material.transparent);
   assert(!mesh.material.map&&!mesh.material.normalMap);assert(mesh.material.isMeshStandardMaterial);
   const {position,normal,color}=mesh.geometry.attributes;assert.equal(normal.count,position.count);assert.equal(color.count,position.count);
   for(let i=0;i<position.count;i++){
    const x=position.getX(i),y=position.getY(i),z=position.getZ(i);assert(Number.isFinite(x+y+z));
    assert(Math.max(Math.abs(x),Math.abs(z))>=world.half+2,'visible geometry crossed into playable space');
    if(id==='confluence'){
     assert.equal(biomeAt(x,z),'coast');const scale=world.half/Math.max(Math.abs(x),Math.abs(z));assert.equal(biomeAt(x*scale,z*scale),'coast','group intrudes across a neighboring biome edge');
    }
   }
   assert(mesh.geometry.boundingBox.max.y<10.5,'silhouette became another oversized tower');
  }
  // Far sails curve in depth and the roofs are closed geometry, not billboards.
  assert(group.children[2].geometry.attributes.position.count>50);
  const record=records.find(p=>p.variant===1);assert(record);
  const before=group.children.map(m=>m.matrixWorld.toArray());new T.PerspectiveCamera().position.set(400,4,-20);world.group.updateMatrixWorld(true);
  assert.deepEqual(group.children.map(m=>m.matrixWorld.toArray()),before,'distant scenery must stay anchored to the world');
  release(world);
 }
});

test('installing distant harbor does not change generated obstacles, rewards or world random state',()=>{
 for(const id of['coast','confluence'])for(const seed of[7,522,43837033]){
  const world=buildWorld(id,seed),obstacles=world.obstacles.slice(),sites=world.sites.slice(),roaming=world.roaming.slice(),discoveries=world.discoveries.slice();
  let randomCalls=0;for(const scope of world.regions||[world]){const random=scope.weather.random;scope.weather.random=()=>{randomCalls++;return random();};}
  const ridge=installDistantLandscape(world,id,biomeAt),group=installHarborHorizon(world,id,biomeAt,ridge);
  assert(group&&group.userData.records.length>=6);assert.deepEqual(world.obstacles,obstacles);assert.deepEqual(world.sites,sites);assert.deepEqual(world.roaming,roaming);assert.deepEqual(world.discoveries,discoveries);assert.equal(randomCalls,0);
  const bay=world.harborBay;assert(bay?.source&&world.ponds.includes(bay.source),'offshore direction must come from a real coastal lagoon');
  assert.equal(bay.boats.length,2);assert.equal(bay.mesh.children.length,2);assert(bay.mesh.children.reduce((n,m)=>n+m.geometry.index.count/3,0)<=800,'offshore water and sails exceeded their 2-draw low-poly budget');
  const ray=new T.Raycaster(new T.Vector3(),new T.Vector3(0,-1,0),0,400);ridge.updateMatrixWorld(true);
  for(const boat of bay.boats)for(let i=0;i<32;i++){
   const a=i/32*Math.PI*2,c=Math.cos(boat.angle),s=Math.sin(boat.angle),u=Math.cos(a)*5.4,v=Math.sin(a)*3.3,x=boat.x+c*u+s*v,z=boat.z-s*u+c*v;
   ray.ray.origin.set(x,200,z);assert(ray.intersectObject(ridge,false)[0].point.y<bay.y-.13,'boat orbit crosses exposed land');
   const angle=Math.atan2(x,z),delta=Math.abs(Math.atan2(Math.sin(angle-bay.angle),Math.cos(angle-bay.angle))),edge=world.half/Math.max(Math.abs(Math.sin(angle)),Math.abs(Math.cos(angle))),offset=Math.hypot(x,z)-edge;
   assert(delta<bay.halfAngle&&offset>bay.inner&&offset<bay.outer,'boat orbit leaves actual water geometry');assert(Math.max(Math.abs(x),Math.abs(z))>world.half+2);
  }
  for(const mesh of bay.mesh.children){assert(mesh.userData.ownedGeometry&&!mesh.material.map&&!mesh.castShadow);const p=mesh.geometry.attributes.position;for(let i=0;i<p.count;i++)assert(Math.max(Math.abs(p.getX(i)),Math.abs(p.getZ(i)))>world.half+2);}
  const outside=bay.angle+bay.halfAngle*1.4,s=Math.sin(outside),c=Math.cos(outside),edge=world.half/Math.max(Math.abs(s),Math.abs(c));assert.equal(harborBayCut(bay,s*(edge+25),c*(edge+25)),0,'headlands outside the bay were lowered');
  assert.strictEqual(installHarborHorizon(world,id,biomeAt,ridge),group);
  assert.equal(world.group.children.filter(o=>o.name==='SM_Harbor_Horizon_A').length,1);assert.equal(world.group.children.filter(o=>o.name==='SM_Harbor_Bay_A').length,1);let released=0;for(const m of bay.mesh.children)m.geometry.addEventListener('dispose',()=>released++);release(world);assert.equal(released,2);assert(bay.disposed&&!bay.mesh.visible);
 }
});

test('offshore animation shares the pause-aware scenery clock and keeps motion bounds on the GPU',()=>{
 const world=buildWorld('coast',522);installDistantLandscape(world,'coast',biomeAt);const bay=world.harborBay,compiled=[];
 for(const mesh of bay.mesh.children){const shader={uniforms:{},vertexShader:T.ShaderLib.standard.vertexShader,fragmentShader:T.ShaderLib.standard.fragmentShader};mesh.material.onBeforeCompile(shader);assert.strictEqual(shader.uniforms.harborTime,groundWindTime);assert(mesh.material.fog);compiled.push(shader);}
 const old=groundWindTime.value;animateAdventureGroundDetail(37.5);assert(compiled.every(s=>s.uniforms.harborTime.value===37.5));animateAdventureGroundDetail(37.5);assert(compiled.every(s=>s.uniforms.harborTime.value===37.5),'unchanged game time advanced the offshore scene');
 animateAdventureGroundDetail(38);assert(compiled.every(s=>s.uniforms.harborTime.value===38));animateAdventureGroundDetail(old);
 assert(compiled[1].vertexShader.includes('objectNormal.xz=harborRotation()'),'turning ships leave lighting normals behind');assert(compiled[1].vertexShader.includes('harborPivot.xz'),'moving ships do not retain their fixed offshore anchor');
 assert(bay.sails.geometry.boundingSphere.radius>5.5,'shader orbit is absent from culling bounds');
 release(world);
});

test('other biomes and missing coast sectors do not install a harbor',()=>{
 for(const id of['forest','snow','ash','sand']){
  const world={half:96,group:new T.Group()};assert.equal(installHarborHorizon(world,id,()=>id),null);assert.equal(world.group.children.length,0);assert.equal(world.harborHorizon,undefined);
 }
 const world={half:140,group:new T.Group()},ridge=installDistantLandscape(world,'snow');
 assert.equal(installHarborHorizon(world,'confluence',()=> 'forest',ridge),null);assert.equal(world.harborHorizon,undefined);release(world);
 const empty={half:96,group:new T.Group()};assert.equal(installHarborHorizon(empty,'coast'),null);assert.equal(empty.group.children.length,0);
});

test('world cleanup disposes only owned batches and a subsequent run keeps shared materials healthy',()=>{
 const first=scene('coast'),shared=first.group.children.map(m=>m.material),positions=first.group.children.map(m=>Array.from(m.geometry.attributes.position.array));
 let disposedGeometry=0,disposedMaterial=0;
 for(const mesh of first.group.children){mesh.geometry.addEventListener('dispose',()=>disposedGeometry++);mesh.material.addEventListener('dispose',()=>disposedMaterial++);}
 release(first.world);assert.equal(disposedGeometry,3);assert.equal(disposedMaterial,0);assert(first.group.userData.disposed&&!first.group.visible);
 const next=scene('coast');
 for(let i=0;i<3;i++){
  assert.strictEqual(next.group.children[i].material,shared[i]);assert.notStrictEqual(next.group.children[i].geometry,first.group.children[i].geometry);
  assert.deepEqual(Array.from(next.group.children[i].geometry.attributes.position.array),positions[i]);
 }
 assert(!next.group.userData.disposed&&next.group.visible);release(next.world);
 // Reinstalling after cleanup replaces the stale group instead of retaining it.
 const rebuilt=installHarborHorizon(first.world,'coast',biomeAt,first.ridge);assert.notStrictEqual(rebuilt,first.group);
 assert.equal(first.world.group.children.filter(o=>o.name==='SM_Harbor_Horizon_A').length,1);release(first.world);
});
