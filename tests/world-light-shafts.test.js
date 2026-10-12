import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../vendor/three.module.js';
import {installWorldLightShafts,installForestMist,updateWorldLightShafts} from '../world-light-shafts.js';
import {buildWorld} from '../world.js';
import {installForestVista} from '../forest-vista.js';
import {installForestHabitats} from '../forest-habitats.js';
import {installBiomePlaces} from '../biome-places.js';
import {installEnvironmentClusters} from '../environment-clusters.js';
import {installExplorationRoutes} from '../exploration-routes.js';
import {installExplorationLandmarks} from '../exploration-landmarks.js';
import {installExplorationComposition} from '../exploration-composition.js';
import {installAdventureGroundDetail,installHabitatDetail} from '../adventure-ground-detail.js';
import {installForestTerrain} from '../forest-terrain.js';

globalThis.document={createElement:()=>({getContext:()=>({fillRect(){}})})};

test('all maps keep deterministic clear light shafts without changing world rules',()=>{
 for(const map of ['forest','snow','coast','sand','ash','confluence']){
  const world=buildWorld(map,7),before=JSON.stringify({obstacles:world.obstacles.map(o=>[o.x,o.z,o.r]),patches:world.patches.map(p=>[p.x,p.z,p.kind]),sites:world.sites.map(s=>[s.x,s.z,s.type]),spawn:world.spawn});
  const again={...world,group:new T.Group()},random=Math.random;let mesh,second;
  // Three uses Math.random for UUIDs; changing it must not change the actual placement.
  try{Math.random=()=>.13;mesh=installWorldLightShafts(world,map);Math.random=()=>.87;second=installWorldLightShafts(again,map);}finally{Math.random=random;}
  assert(mesh&&mesh.count>0&&mesh.count<=6,map+' has no valid shafts or exceeds the budget');
  assert.deepEqual(second.userData.anchors,mesh.userData.anchors);assert.deepEqual(Array.from(second.instanceMatrix.array),Array.from(mesh.instanceMatrix.array));second.dispose();
  assert.equal(installWorldLightShafts(world,map),mesh,'install duplicated the draw');assert.equal(mesh.parent,world.group);
  assert.equal(mesh.geometry.index.count/3,6);assert.equal(mesh.material.depthWrite,false);assert.equal(mesh.material.forceSinglePass,true);assert(!mesh.castShadow&&!mesh.receiveShadow);
  const matrix=new T.Matrix4(),up=new T.Vector3(),expected=new T.Vector3(-18,30,14).normalize();
  for(let i=0;i<mesh.count;i++){
   mesh.getMatrixAt(i,matrix);assert(matrix.elements.every(Number.isFinite));up.setFromMatrixColumn(matrix,1).normalize();assert(up.distanceTo(expected)<1e-7,'shaft points away from the sun');
   const p=mesh.userData.anchors[i];assert(world.obstacles.every(o=>Math.hypot(p.x-o.x,p.z-o.z)>=(o.r||0)+1.1));assert(world.sites.every(s=>Math.hypot(p.x-s.x,p.z-s.z)>=3.2));
  }
  const transforms=Array.from(mesh.instanceMatrix.array);updateWorldLightShafts(world,12);updateWorldLightShafts(world,12);assert.equal(mesh.material.uniforms.shaftTime.value,12,'paused time advanced');updateWorldLightShafts(world,NaN);assert.equal(mesh.material.uniforms.shaftTime.value,12);
  world.spawn.x+=30;updateWorldLightShafts(world,14);assert.deepEqual(Array.from(mesh.instanceMatrix.array),transforms,'light follows a mutable player/spawn point');world.spawn.x-=30;
  assert.equal(JSON.stringify({obstacles:world.obstacles.map(o=>[o.x,o.z,o.r]),patches:world.patches.map(p=>[p.x,p.z,p.kind]),sites:world.sites.map(s=>[s.x,s.z,s.type]),spawn:world.spawn}),before);
  world.group.traverse(o=>{if(o.isInstancedMesh)o.dispose();if(o.userData.ownedGeometry)o.geometry.dispose();});
 }
});

test('world cleanup releases its clock material while shared geometry and another world survive',()=>{
 const make=()=>({half:96,group:new T.Group(),spawn:{x:0,z:0},sites:[{x:25,z:10}],obstacles:[],patches:[],ponds:[]});
 const a=make(),b=make(),one=installWorldLightShafts(a,'forest'),two=installWorldLightShafts(b,'snow');
 assert.equal(one.geometry,two.geometry);assert.notEqual(one.material,two.material);
 let released=0,sharedReleased=0;one.material.addEventListener('dispose',()=>released++);const onGeometry=()=>sharedReleased++;one.geometry.addEventListener('dispose',onGeometry);
 try{
  updateWorldLightShafts(a,4);updateWorldLightShafts(b,9);assert.equal(one.material.uniforms.shaftTime.value,4);assert.equal(two.material.uniforms.shaftTime.value,9);
  one.dispose();one.dispose();assert.equal(released,1);assert.equal(sharedReleased,0);updateWorldLightShafts(a,20);assert.equal(one.material.uniforms.shaftTime.value,4);updateWorldLightShafts(b,11);assert.equal(two.material.uniforms.shaftTime.value,11);
 }finally{one.geometry.removeEventListener('dispose',onGeometry);two.dispose();}
});

test('composed joined maps cover all five regions before extra forest shafts and attach low mist to real terrain',()=>{
 let raisedMist=0;
 for(const seed of[7,522,43837033]){
  const world=buildWorld('confluence',seed);
  for(const install of[installForestVista,installForestHabitats,installBiomePlaces,installEnvironmentClusters,installExplorationRoutes,installExplorationLandmarks,installExplorationComposition])install(world,'confluence');
  const shafts=installWorldLightShafts(world,'confluence'),mist=installForestMist(world,'confluence'),before=new Map([shafts,mist].map(layer=>[layer,Array.from(layer.instanceMatrix.array)]));
  assert.equal(shafts.count,6);
  for(const region of world.regions){const anchors=shafts.userData.anchors.filter(p=>p.biome===region.id);assert(anchors.length>0,region.id+' lost its shaft to an earlier forest focus');assert(anchors.every(p=>region.contains(p.x,p.z)));}
  installAdventureGroundDetail(world,'confluence');installHabitatDetail(world,'confluence');installForestTerrain(world,'confluence');updateWorldLightShafts(world,10);
  for(const[layer,offset]of[[shafts,.4],[mist,.08]]){
   const matrix=new T.Matrix4();
   for(const[i,p]of layer.userData.anchors.entries()){
    layer.getMatrixAt(i,matrix);const h=world.groundHeightAt(p.x,p.z);assert(Math.abs(matrix.elements[13]-offset-h)<1e-6,'air layer remained underneath the raised soil');if(layer===mist&&h>.01)raisedMist++;
    for(let k=0;k<16;k++)if(k!==13)assert.equal(matrix.elements[k],before.get(layer)[i*16+k],'terrain attachment moved the horizontal anchor or orientation');
   }
   const version=layer.instanceMatrix.version;updateWorldLightShafts(world,10);assert.equal(layer.instanceMatrix.version,version,'paused attachment rewrote its instance buffer');
  }
  world.group.traverse(o=>{if(o.isInstancedMesh)o.dispose();if(o.userData.ownedGeometry)o.geometry.dispose();});
 }
 assert(raisedMist>0,'test must cover actual mist anchors on raised terrain');
});

test('fully blocked and unsupported maps stay empty',()=>{
 const world={half:96,group:new T.Group(),spawn:{x:0,z:0},sites:[],obstacles:[{x:0,z:0,r:20}],patches:[],ponds:[]};
 assert.equal(installWorldLightShafts(world,'forest'),null);assert.equal(installWorldLightShafts(world,'unknown'),null);assert.equal(world.group.children.length,0);updateWorldLightShafts(world,1);
});

test('broad tapered sheets cover side views without additional draws, lights or textures',()=>{
 const world={half:96,group:new T.Group(),spawn:{x:0,z:0},sites:[],obstacles:[],patches:[],ponds:[]};
 const mesh=installWorldLightShafts(world,'forest'),position=mesh.geometry.attributes.position,normal=mesh.geometry.attributes.normal;
 assert.equal(world.group.children.length,1);assert.equal(mesh.geometry.index.count,18);assert.equal(position.count,12);
 assert(Object.values(mesh.material.uniforms).every(u=>!u.value?.isTexture));assert.equal(mesh.material.blending,T.AdditiveBlending);
 const normals=[],a=new T.Vector3(),b=new T.Vector3(),matrix=new T.Matrix4();mesh.getMatrixAt(0,matrix);
 for(let sheet=0;sheet<3;sheet++){
  const index=sheet*4;
  a.fromBufferAttribute(position,index).applyMatrix4(matrix);b.fromBufferAttribute(position,index+1).applyMatrix4(matrix);
  const baseWidth=a.distanceTo(b);assert(baseWidth>2.5&&baseWidth<3.5,'light shaft still has a narrow pencil footprint');
  a.fromBufferAttribute(position,index+2).applyMatrix4(matrix);b.fromBufferAttribute(position,index+3).applyMatrix4(matrix);
  assert(a.distanceTo(b)>baseWidth*.6&&a.distanceTo(b)<baseWidth,'shaft pinches to a sharp ray');
  normals.push(new T.Vector3().fromBufferAttribute(normal,index));
 }
 for(let degree=0;degree<360;degree+=5){
  const angle=degree*Math.PI/180,view=new T.Vector3(Math.cos(angle),0,Math.sin(angle));
  assert(Math.max(...normals.map(n=>Math.abs(n.dot(view))))>.85,'all sheets become too oblique at a side view');
 }
 mesh.dispose();
});
