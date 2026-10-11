import test from'node:test';
import assert from'node:assert/strict';
import * as T from'../vendor/three.module.js';
import{buildWorld,animateWorld}from'../world.js';
import{installForestVista}from'../forest-vista.js';
import{installForestHabitats}from'../forest-habitats.js';
import{installExplorationLandmarks}from'../exploration-landmarks.js';
import{naturalRockGeometry}from'../biome-scenery.js?v=143';
import{wornStoneBlock}from'../environment-props.js?v=143';
globalThis.document={createElement:()=>({getContext:()=>({fillRect(){}})})};
const maps=['forest','snow','ash','sand','coast','confluence'];
const create=(id,seed)=>{const w=buildWorld(id,seed);installForestVista(w,id);installForestHabitats(w,id);return w;};
const clear=w=>w.group.traverse(o=>{if(o.isInstancedMesh)o.dispose();if(o.userData.ownedGeometry)o.geometry.dispose();});
const layout=w=>JSON.stringify({obstacles:w.obstacles.map(o=>[o.x,o.z,o.r,o.tactic]),sites:w.sites.map(s=>[s.x,s.z,s.type,s.event,s.availableAt,s.claimed,s.discovered,s.reveal,s.mesh.visible]),patches:w.patches.map(p=>[p.x,p.z,p.r,p.kind]),breakables:w.breakables.map(o=>[o.x,o.z,o.state]),details:w.regions?w.regions.map(r=>r.scenery.records):w.scenery.records});

test('each map and joined region gains one landmark tied to an existing site without changing gameplay layouts',()=>{
 for(const id of maps)for(const seed of[7,522,43837033]){
  const w=create(id,seed),before=layout(w),obstacles=w.obstacles.slice(),protectedRoots=[...w.sites.map(s=>s.mesh),...w.breakables.map(b=>b.mesh),...w.sites.flatMap(s=>(s.gates||[]).map(g=>g.mesh)),...(w.regions||[]).map(r=>r.beacon.parent)];
  const protectedState=protectedRoots.map(root=>[root,root.children.slice(),root.visible]),oldForest=w.forestHabitats?.elder?.mesh,oldForestChildren=oldForest?.children.slice();
  const markers=installExplorationLandmarks(w,id);
  assert.equal(markers.length,id==='confluence'?5:1,id+' '+seed);assert.equal(w.explorationLandmarkSkips.length,0);assert.equal(layout(w),before);
  assert.deepEqual(w.obstacles,obstacles);assert.strictEqual(installExplorationLandmarks(w,id),markers);
  for(const[root,children,visible]of protectedState){assert.deepEqual(root.children,children,'a gameplay object was replaced');assert.equal(root.visible,visible);}
  if(oldForest){assert.strictEqual(markers.find(m=>m.biome==='forest').mesh,oldForest);assert.deepEqual(oldForest.children,oldForestChildren);}
  for(const marker of markers){
   assert(w.sites.includes(marker.site));assert(w.obstacles.includes(marker.obstacle));assert.equal(marker.x,marker.obstacle.x);assert.equal(marker.z,marker.obstacle.z);
   assert(marker.mesh.visible);assert(Math.hypot(marker.x-marker.site.x,marker.z-marker.site.z)<=34,'landmark leads to empty space instead of a site');
   if(marker.biome!=='forest'){assert(marker.height>=6&&marker.height<=6.6);assert.equal(marker.mesh.parent,marker.obstacle.mesh);assert(!w.breakables.includes(marker.obstacle));assert(!marker.obstacle.tactic);assert(marker.mesh.userData.explorationLandmark);assert.equal(marker.obstacle.sceneryHeight,marker.height);}
  }
  clear(w);
 }
});

test('landmark bases stay within the old root, overhead silhouettes stay clear and budgets remain bounded',()=>{
 const materials=new Set(),point=new T.Vector3();
 for(const id of['snow','ash','sand','coast','confluence'])for(const seed of[7,522,43837033]){
  const w=create(id,seed),markers=installExplorationLandmarks(w,id);w.group.updateMatrixWorld(true);
  for(const marker of markers.filter(m=>m.biome!=='forest')){
   const meshes=marker.mesh.children;assert.equal(meshes.length,marker.biome==='coast'?3:2);
   assert(meshes.reduce((sum,m)=>sum+m.geometry.index.count/3,0)<2000);
   const shape=new T.Box3().setFromObject(marker.mesh).getSize(new T.Vector3());assert(Math.max(shape.x,shape.z)>2,'distant silhouette remains a thin pole');
   for(const m of meshes){
    assert(m.isMesh&&!m.isLight);assert(m.userData.ownedGeometry);assert(m.castShadow&&m.receiveShadow);assert(!m.material.transparent);materials.add(m.material);
    assert.equal(m.geometry.groups.length,0);for(const attribute of Object.values(m.geometry.attributes))assert([...attribute.array].every(Number.isFinite));
    const p=m.geometry.attributes.position;
    for(let i=0;i<p.count;i++){
     point.fromBufferAttribute(p,i).applyMatrix4(m.matrixWorld);
     if(point.y<3.2)assert(Math.hypot(point.x-marker.x,point.z-marker.z)<marker.obstacle.r,'low ornament exceeds the existing solid footprint');
     assert(Math.abs(point.x)<w.half&&Math.abs(point.z)<w.half,'landmark escapes map bounds');
    }
    // Test the clipped edges too: checking vertices alone misses a broad upper
    // corner whose triangle cuts back through the player's 3.2 m clearance.
    const index=m.geometry.index,a=new T.Vector3(),b=new T.Vector3();
    for(let i=0;i<index.count;i+=3)for(let edge=0;edge<3;edge++){
     a.fromBufferAttribute(p,index.getX(i+edge)).applyMatrix4(m.matrixWorld);b.fromBufferAttribute(p,index.getX(i+(edge+1)%3)).applyMatrix4(m.matrixWorld);
     if((a.y<3.2)!==(b.y<3.2)){point.copy(a).lerp(b,(3.2-a.y)/(b.y-a.y));assert(Math.hypot(point.x-marker.x,point.z-marker.z)<marker.obstacle.r,'overhang edge intrudes below the head-clearance plane');}
    }
   }
  }
  clear(w);
 }
 assert.equal(materials.size,3,'world rebuilds allocate new permanent materials');
});

test('the tower uses existing wide roots when available and its actual visual height excludes hidden trees',()=>{
 for(const id of['snow','sand','coast','confluence'])for(const seed of[7,522,43837033]){
  const w=create(id,seed),markers=installExplorationLandmarks(w,id);
  for(const marker of markers.filter(m=>m.biome!=='forest')){
   if(marker.biome==='coast')assert.equal(marker.obstacle.r,1.5,'a wide harbor rock was overlooked');
   if(id==='sand')assert.equal(marker.obstacle.r,.96,'a wide ruined pillar was overlooked');
   assert.equal(marker.mesh.scale.x,marker.obstacle.r/.62);
   const visible=new T.Box3().setFromObject(marker.mesh);assert.equal(marker.obstacle.sceneryHeight,visible.max.y);
   assert(marker.obstacle.mesh.children.filter(c=>c!==marker.mesh).every(c=>!c.visible));
  }
  clear(w);
 }
});

test('replaced snow crowns leave both animation lists, while untouched foliage keeps swaying',()=>{
 for(const id of['snow','confluence']){
  const w=create(id,43837033),entries=[...w.foliage,...(w.regions||[]).flatMap(r=>r.foliage)],markers=installExplorationLandmarks(w,id),snow=markers.find(m=>m.biome==='snow');
  const removed=entries.filter(f=>f.leaf.parent===snow.obstacle.mesh);assert(removed.length>0);
  for(const scope of[w,...(w.regions||[])])for(const f of removed)assert(!scope.foliage.includes(f),'hidden snow crown remains in the animation list');
  const poses=removed.map(f=>f.leaf.position.toArray());animateWorld(w,3,w.spawn.x,w.spawn.z);
  removed.forEach((f,i)=>{assert(!f.leaf.visible);assert.deepEqual(f.leaf.position.toArray(),poses[i]);});
  const live=(w.regions?w.regions.find(r=>r.id==='snow'):w).foliage.find(f=>f.leaf.visible),x=live.leaf.position.x;animateWorld(w,4,w.spawn.x,w.spawn.z);assert.notEqual(live.leaf.position.x,x);
  clear(w);
 }
});

test('owned landmark copies clean up once without disposing shared sources or a surviving world',()=>{
 const a=create('coast',7),b=create('coast',522),sourceArrays=[wornStoneBlock,naturalRockGeometry].map(g=>g.attributes.position.array.slice()),ma=installExplorationLandmarks(a,'coast')[0],mb=installExplorationLandmarks(b,'coast')[0];
 let sharedDisposed=0;const shared=()=>sharedDisposed++;
 for(const g of[wornStoneBlock,naturalRockGeometry])g.addEventListener('dispose',shared);
 const counts=new Map();for(const m of ma.mesh.children){counts.set(m.geometry,0);m.geometry.addEventListener('dispose',()=>counts.set(m.geometry,counts.get(m.geometry)+1));}
 clear(a);assert([...counts.values()].every(n=>n===1));assert(ma.mesh.children.every(m=>!m.visible));assert(mb.mesh.children.every(m=>m.visible&&m.geometry.attributes.position.count>0));assert.equal(sharedDisposed,0);
 for(const[i,g]of[wornStoneBlock,naturalRockGeometry].entries()){assert.deepEqual(g.attributes.position.array,sourceArrays[i]);g.removeEventListener('dispose',shared);}
 assert.notEqual(ma.mesh.children[0].geometry,mb.mesh.children[0].geometry);assert.strictEqual(ma.mesh.children[0].material,mb.mesh.children[0].material);clear(b);
});

test('an unavailable safe root skips conservatively rather than adding an obstacle or revealing rewards',()=>{
 const w=create('sand',7);w.obstacles=[];const before=layout(w),children=w.group.children.length;
 assert.deepEqual(installExplorationLandmarks(w,'sand'),[]);assert.deepEqual(w.explorationLandmarkSkips,[{biome:'sand',reason:'no-safe-root-near-site'}]);assert.equal(w.group.children.length,children);assert.equal(layout(w),before);clear(w);
});
