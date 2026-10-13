import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../vendor/three.module.js';
import {makeSlingshot,poseSlingshot} from '../slingshot-model.js';
import {sporeLantern} from '../wuling-appearance.js';
import {miasmaLantern} from '../mirage-appearance.js';
import {FirstPersonView} from '../first-person-view.js';

function assertClosed(g){
 const edges=new Map(),p=g.attributes.position,index=g.index.array,a=new T.Vector3(),b=new T.Vector3(),c=new T.Vector3();
 for(let i=0;i<index.length;i+=3){
  a.fromBufferAttribute(p,index[i]);b.fromBufferAttribute(p,index[i+1]);c.fromBufferAttribute(p,index[i+2]);
  assert(b.sub(a).cross(c.sub(a)).lengthSq()>1e-14,'zero-area face');
  for(let j=0;j<3;j++){const x=index[i+j],y=index[i+(j+1)%3],key=[Math.min(x,y),Math.max(x,y)].join(':');edges.set(key,(edges.get(key)||0)+1);}
 }
 for(const count of edges.values())assert.equal(count,2,'open boundary or overlapping shell');
}

test('the sling has a closed concave leather pouch and inset bindings without changing contacts',()=>{
 const sling=makeSlingshot(),pouch=sling.getObjectByName('SM_Slingshot_LeatherPouch'),g=pouch.geometry,p=g.attributes.position;
 assertClosed(g);assert(p.getZ(0)<-.5,'the loading face is still a solid convex oval');
 assert(Math.max(...Array.from({length:p.count},(_,i)=>p.getZ(i)))<.2);
 const binding=sling.getObjectByName('SM_Slingshot_BandBinding_-1');assert.equal(binding.geometry.type,'LatheGeometry');assert(binding.material.vertexColors);
 assert(new Set(binding.geometry.parameters.points.map(p=>p.x.toFixed(4))).size>=5,'ties are still smooth cylinders');
 for(const age of [0,.06,.1319,.1321,.3,.67]){
  poseSlingshot(sling,age,.67);assert.equal(sling.userData.pouch.children.length,2);assert.equal(pouch.parent,sling.userData.pouch);assert.deepEqual(pouch.scale.toArray(),[.046,.030,.016]);
 }
});

test('mirror petals are closed thin shells with a rolled edge inside their original envelope',()=>{
 const lamp=miasmaLantern(),petal=lamp.userData.petals[0],g=petal.geometry;assertClosed(g);g.computeBoundingBox();
 assert(g.boundingBox.min.z>=-.040001&&g.boundingBox.max.z<=.380001);
 assert.equal(petal.material.side,T.FrontSide);assert(petal.material.vertexColors);assert(g.attributes.color.array.some(v=>v<.7));
 for(const other of lamp.userData.petals){assert.equal(other.geometry,g);assert(other.userData.rest.isQuaternion);}
});

test('the three close weapons retain the same draw count and bounded geometry',()=>{
 for(const [make,count,limit]of [[makeSlingshot,11,4000],[sporeLantern,13,5000],[miasmaLantern,14,5000]]){
  const root=make();let meshes=0,triangles=0;root.traverse(o=>{assert(!o.isLight);if(!o.isMesh)return;meshes++;triangles+=(o.geometry.index?.count||o.geometry.attributes.position.count)/3;assert.equal(o.material.transparent,false);for(const field of ['position','normal'])assert(o.geometry.attributes[field].array.every(Number.isFinite));});
  assert.equal(meshes,count);assert(triangles<limit);
 }
});

test('lantern cores have distinct cached opaque PBR finishes rather than the same glowing bulb',()=>{
 const materials=[sporeLantern().userData.heart.material,miasmaLantern().userData.heart.material],textures=new Set();
 assert.deepEqual(materials.map(m=>m.userData.lanternCore),['spore','mirage']);
 assert.notDeepEqual(materials[0].map.image.data,materials[1].map.image.data);
 for(const m of materials){
  assert.equal(m.color.getHex(),0xffffff);assert.equal(m.roughness,1);assert.equal(m.transparent,false);assert(m.emissiveIntensity<=.20);
  for(const name of ['map','roughnessMap','emissiveMap']){
   const texture=m[name];textures.add(texture);assert.equal(texture.image.width,128);assert.equal(texture.image.height,128);assert.equal(texture.wrapS,T.RepeatWrapping);assert.equal(texture.generateMipmaps,true);
   assert(new Set(texture.image.data).size>24,'surface map is effectively a flat color');
  }
 }
 assert.equal(textures.size,6);assert.equal(sporeLantern().userData.heart.material,materials[0]);assert.equal(miasmaLantern().userData.heart.material,materials[1]);
});

test('viewmodel switching disposes owned copies but preserves shared weapon geometry and core maps',()=>{
 const view=new FirstPersonView(new T.PerspectiveCamera(60,16/9,.1,100));let disposed=0,copies=0;
 const roots=[makeSlingshot(),sporeLantern(),miasmaLantern()],ids=['boomerang','sporelantern','miasmalantern'],resources=new Set();
 for(const root of roots)root.traverse(o=>{if(!o.isMesh)return;resources.add(o.geometry);resources.add(o.material);for(const key of ['map','roughnessMap','emissiveMap'])if(o.material[key])resources.add(o.material[key]);});
 for(const resource of resources)resource.addEventListener('dispose',()=>disposed++);
 try{for(let cycle=0;cycle<4;cycle++)for(let i=0;i<roots.length;i++){
  const gun=roots[i],actor={visible:false,userData:{gun,attackAge:.1,reloadDuration:1,reloadPhase:.1,shotSerial:1}};
  view.setHero(actor,ids[i]);view.update(1,.016,{visible:true});
  for(const material of view.materials.values())material.addEventListener('dispose',()=>copies++);
  if(gun.userData.heart){
   const source=gun.userData.heart.material,copy=view.parts.find(([a])=>a===gun.userData.heart)[1].material;
   assert.notEqual(copy,source);for(const key of ['map','roughnessMap','emissiveMap'])assert.equal(copy[key],source[key]);
   const intensity=source.emissiveIntensity;view.update(2,.016,{visible:true});assert.equal(source.emissiveIntensity,intensity);
  }
  view.clear();assert.equal(disposed,0);
 }}finally{view.dispose();}
 assert(copies>0);assert.equal(disposed,0);
});
