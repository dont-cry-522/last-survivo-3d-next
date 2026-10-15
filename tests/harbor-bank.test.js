import test from'node:test';
import assert from'node:assert/strict';
import * as T from'../vendor/three.module.js';
import{buildWorld,moveActor}from'../world.js';
import{installBiomePlaces}from'../biome-places.js?v=209';
import{installForestVista}from'../forest-vista.js';
import{installForestHabitats}from'../forest-habitats.js';
import{terrainAt,waterDepth}from'../water.js';
import{updateTide}from'../coast.js';
import{naturalRockGeometry}from'../biome-scenery.js';

globalThis.document={createElement:()=>({getContext:()=>({fillRect(){}})})};
const cleanup=w=>w.group.traverse(o=>{if(o.isInstancedMesh)o.dispose();if(o.userData.ownedGeometry)o.geometry.dispose();});
test('harbor places face real water and their low piers keep actors dry at both tides',()=>{
 for(const id of['coast','confluence'])for(const seed of[7,19,522,43837033]){
  const w=buildWorld(id,seed);installForestVista(w,id);installForestHabitats(w,id);
  const original=w.bridges.length,sites=w.sites.map(s=>[s.x,s.z,s.availableAt,s.claimed]),protectedRoots=w.breakables.map(o=>o.mesh);
  const places=installBiomePlaces(w,id).filter(p=>p.biome==='coast');assert.equal(places.length,2);
  assert(places.some(p=>p.pier),id+' '+seed+' has no genuine waterside place');
  assert.equal(w.bridges.length,original+places.filter(p=>p.pier).length);assert.deepEqual(w.sites.map(s=>[s.x,s.z,s.availableAt,s.claimed]),sites);assert(protectedRoots.every(m=>m.parent));
  for(const p of places.filter(p=>p.pier)){
   const b=p.pier;assert(p.mesh.getObjectByName('SM_HarborBank_wood'));assert(b.width<=35);
   assert(w.ponds.some(q=>waterDepth(q,b.end.x,b.end.z)>=.35),'pier ends on dry ground');
   for(const time of[0,20]){
    updateTide(w,time);const actor={...b.start},dx=(b.end.x-b.start.x)/100,dz=(b.end.z-b.start.z)/100;
    for(let i=0;i<100;i++){
     moveActor(w,actor,dx,dz,.45);assert.equal(terrainAt(w,actor.x,actor.z).kind,'bridge');
    }
    assert(Math.hypot(actor.x-b.end.x,actor.z-b.end.z)<.01,'pier entry or centre is blocked');
   }
   const point=new T.Vector3();w.group.updateMatrixWorld(true);let triangles=0;
   for(const m of p.mesh.children.filter(m=>m.name.startsWith('SM_HarborBank_'))){
    assert(m.userData.ownedGeometry);triangles+=m.geometry.index.count/3;
    const a=m.geometry.attributes.position;for(let i=0;i<a.count;i++){
     point.fromBufferAttribute(a,i).applyMatrix4(m.matrixWorld);
     if(point.y>.30)assert(p.solids.some(o=>Math.hypot(point.x-o.x,point.z-o.z)<=o.r+.015&&point.y<=o.height+.015),'raised pier prop lacks collision');
    }
   }
   assert(triangles<4000,'pier geometry exceeded its static budget');
  }
  cleanup(w);
 }
});

test('pier meshes dispose per world without releasing shared material or touching another run',()=>{
 const a=buildWorld('coast',7),b=buildWorld('coast',522);installBiomePlaces(a,'coast');installBiomePlaces(b,'coast');
 const meshes=[];a.group.traverse(m=>{if(m.name.startsWith('SM_HarborBank_'))meshes.push(m);});assert(meshes.length);
 let geometries=0,materials=0;for(const m of meshes){m.geometry.addEventListener('dispose',()=>geometries++);m.material.addEventListener('dispose',()=>materials++);}
 cleanup(a);assert.equal(geometries,meshes.length);assert.equal(materials,0);assert(b.biomePlaces.every(p=>p.mesh.parent===b.group));cleanup(b);
});

test('ordinary-dressing clearance at a pier end never removes a protected district just beyond its rounded safety margin',async()=>{
 const {harborPierPlan}=await import('../harbor-bank-layout.js?v=209');
 const {bridgeContains}=await import('../coast.js?v=209');
 const baseline=buildWorld('coast',7),target=installBiomePlaces(baseline,'coast').find(p=>p.pier),b=target.pier;
 const ux=Math.cos(b.angle),uz=-Math.sin(b.angle),vx=Math.sin(b.angle),vz=Math.cos(b.angle);
 const world=buildWorld('coast',7),root=new T.Group();root.userData.district=true;
 const protectedObject={x:b.end.x+ux*1.28+vx*2.68,z:b.end.z+uz*1.28+vz*2.68,r:.65,mesh:root};
 root.position.set(protectedObject.x,0,protectedObject.z);world.group.add(root);world.obstacles.push(protectedObject);
 // This is outside the rectangular deck plus its rounded r+1 safety margin,
 // but inside the more conservative square r+.7 dressing-removal envelope.
 assert(harborPierPlan(world,target),'test obstacle unexpectedly invalidated the pier plan');
 assert(bridgeContains(b,protectedObject.x,protectedObject.z,protectedObject.r+.7),'test misses the removal-envelope corner');
 const placed=installBiomePlaces(world,'coast').find(p=>Math.hypot(p.x-target.x,p.z-target.z)<.001);
 assert(placed?.pier,'the relevant pier was not actually installed');
 assert.strictEqual(root.parent,world.group,'pier cleanup detached a protected district');
 assert(world.obstacles.includes(protectedObject),'pier cleanup removed protected collision');
 cleanup(baseline);cleanup(world);
});

test('the actual plank tops stay above the water surface along the whole pier',()=>{
 const world=buildWorld('coast',7),places=installBiomePlaces(world,'coast').filter(p=>p.pier),ray=new T.Raycaster(),down=new T.Vector3(0,-1,0);
 assert(places.length);world.group.updateMatrixWorld(true);
 for(const p of places){
  const wood=p.mesh.getObjectByName('SM_HarborBank_wood'),count=Math.ceil(p.pier.width/.42),step=p.pier.width/count;
  for(let i=0;i<count;i++){
   // Sample the middle of each real board, not its intentional narrow seam.
   const localZ=p.pier.localStartZ-(i+.5)*step,x=p.x+Math.sin(p.angle)*localZ,z=p.z+Math.cos(p.angle)*localZ;
   ray.set(new T.Vector3(x,3,z),down);const hit=ray.intersectObject(wood,false)[0];
   assert(hit,'plank is missing under its registered bridge');
   assert(hit.point.y>.095,'the water surface overlays the walkable plank');
   assert(hit.point.y<.15,'the low pier gained an unexpected raised step');
   assert.equal(terrainAt(world,x,z).kind,'bridge');
  }
 }
 cleanup(world);
});

test('shore slabs stay buried and inside their original jumpable solids without adding triangles',()=>{
 const original=naturalRockGeometry.attributes.position.array.slice(),point=new T.Vector3();
 for(const map of['coast','confluence']){
  const world=buildWorld(map,7);installBiomePlaces(world,map);world.group.updateMatrixWorld(true);
  for(const place of world.biomePlaces.filter(p=>p.pier)){
   const mesh=place.mesh.getObjectByName('SM_HarborBank_stone'),g=mesh.geometry,solids=place.solids.filter(o=>o.mesh.name==='COL_HarborBank'&&o.height===.32);
   assert.equal(g.index.count/3,solids.length*120,'shore detail added geometry instead of reshaping the old stones');
   let low=Infinity,high=-Infinity,minShade=Infinity,maxShade=0;
   for(let i=0;i<g.attributes.position.count;i++){
    point.fromBufferAttribute(g.attributes.position,i).applyMatrix4(mesh.matrixWorld);low=Math.min(low,point.y);high=Math.max(high,point.y);
    assert(solids.some(o=>Math.hypot(point.x-o.x,point.z-o.z)<o.r&&point.y<o.height),'shore slab exceeds its actual collision');
    const shade=g.attributes.color.getX(i);minShade=Math.min(minShade,shade);maxShade=Math.max(maxShade,shade);
   }
   assert(low<-.03&&high>.12&&high<.25,'slabs must enter the floor and retain a low broken crown');
   assert(maxShade-minShade>.025,'damp lower faces and exposed mineral top lost their contrast');
  }
  cleanup(world);
 }
 assert.deepEqual(naturalRockGeometry.attributes.position.array,original,'shared scenery rock was mutated');
});
