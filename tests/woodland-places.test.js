import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../vendor/three.module.js';
import {buildWoodlandPlace} from '../woodland-places.js';
import {naturalRockGeometry} from '../biome-scenery.js?v=152';

function capture(biome){
 const pieces=[],solids=[];
 const result=buildWoodlandPlace(biome,{
  piece(category,geometry,color,transform={}){
   const {x=0,y=0,z=0,rx=0,ry=0,rz=0,sx=1,sy=1,sz=1}=transform,object=new T.Object3D();
   object.position.set(x,y,z);object.rotation.set(rx,ry,rz);object.scale.set(sx,sy,sz);object.updateMatrix();
   pieces.push({category,geometry,color,transform,matrix:object.matrix.clone()});
  },
  solid(x,z,r,height){solids.push({x,z,r,height});},
  solidBox(){assert.fail('these authored natural places only need cylindrical chains');}
 });
 return{pieces,solids,result,dispose(){for(const p of pieces)p.geometry.dispose();}};
}

test('woodland places have distinct horizontal silhouettes and bounded draw/triangle budgets',()=>{
 for(const biome of['forest','snow']){
  const built=capture(biome),bounds=new T.Box3(),point=new T.Vector3();let triangles=0;
  assert(built.result.kind&&built.result.name);assert(Object.values(built.result.focus).every(Number.isFinite));
  assert.equal(new Set(built.pieces.map(p=>p.category)).size,4);
  for(const part of built.pieces){
   const {geometry:g}=part;assert.notStrictEqual(g,naturalRockGeometry);assert(!part.transform.overhead);
   const p=g.attributes.position;triangles+=(g.index?.count??p.count)/3;
   for(const a of Object.values(g.attributes))assert([...a.array].every(Number.isFinite));
   for(let i=0;i<p.count;i++)bounds.expandByPoint(point.fromBufferAttribute(p,i).applyMatrix4(part.matrix));
  }
  assert(triangles<25000,biome+' exceeds geometry budget: '+triangles);
  const size=bounds.getSize(new T.Vector3());assert(size.x>12&&size.x<=18&&size.z>14&&size.z<=16,'place must read as one broad landscape');
  assert(size.y<4,'woodland place turns back into a tower');assert(built.solids.length<80);
  assert(biome==='forest'?built.pieces.some(p=>p.category==='leaf'):!built.pieces.some(p=>p.category==='leaf'));
  assert(built.pieces.some(p=>p.geometry.type==='TubeGeometry'),'curved roots or sled runners are missing');built.dispose();
 }
 assert.equal(buildWoodlandPlace('ash',{}),null);
});

test('the complete north/south passage stays clear of both scenery and registered solids',()=>{
 const p=new T.Vector3();
 for(const biome of['forest','snow']){
  const built=capture(biome);
  for(const part of built.pieces){const a=part.geometry.attributes.position;for(let i=0;i<a.count;i++){p.fromBufferAttribute(a,i).applyMatrix4(part.matrix);assert(Math.abs(p.x)>=3.1,biome+' scenery enters the wide path at '+p.toArray());}}
  for(const o of built.solids){assert(Math.abs(o.x)-o.r>=3.1,biome+' invisible wall enters the wide path');assert(o.r>0&&o.height>0);assert(Math.abs(o.x)+o.r<=9.05&&Math.abs(o.z)+o.r<=8.1,'registered footprint escapes the reserved rectangle');}
  built.dispose();
 }
});

test('solid wood, rock, snow and ice above ankle height are covered by their actual obstacle envelopes',()=>{
 const p=new T.Vector3();
 for(const biome of['forest','snow']){
  const built=capture(biome);
  for(const part of built.pieces){
   const a=part.geometry.attributes.position;
   for(let i=0;i<a.count;i++){
    p.fromBufferAttribute(a,i).applyMatrix4(part.matrix);if(part.category==='leaf'&&p.y<=.7||p.y<=.3)continue;
    assert(built.solids.some(o=>p.y<=o.height+.015&&Math.hypot(p.x-o.x,p.z-o.z)<=o.r+.015),biome+' '+part.category+' has an unregistered solid vertex at '+p.toArray());
   }
  }
  built.dispose();
 }
});

test('unrelated UUID randomness does not alter authored shapes, and all geometry remains independently disposable',()=>{
 const random=Math.random,source=naturalRockGeometry.attributes.position.array.slice();let calls=0;
 // Three generates geometry UUIDs; these are irrelevant to authored placement.
 Math.random=()=>{calls++;return .25;};
 try{
  for(const biome of['forest','snow']){
   Math.random=()=>{calls++;return .13;};const a=capture(biome);Math.random=()=>{calls++;return .91;};const b=capture(biome);
   assert.deepEqual(a.solids,b.solids);assert.deepEqual(a.result,b.result);assert.equal(a.pieces.length,b.pieces.length);
   for(let i=0;i<a.pieces.length;i++){assert.deepEqual(a.pieces[i].geometry.attributes.position.array,b.pieces[i].geometry.attributes.position.array);assert.deepEqual(a.pieces[i].transform,b.pieces[i].transform);assert.notStrictEqual(a.pieces[i].geometry,b.pieces[i].geometry);}
   a.dispose();b.dispose();
  }
 }finally{Math.random=random;}
 assert(calls>0);assert.deepEqual(naturalRockGeometry.attributes.position.array,source);
});

test('the connected snow lids face upward and woodland vegetation never forms a sight-blocking wall',()=>{
 for(const biome of['forest','snow']){
  const built=capture(biome);
  if(biome==='snow')for(const part of built.pieces.filter(p=>p.category==='snow'&&!Object.keys(p.transform).length)){
   const a=part.geometry.attributes.position,n=part.geometry.attributes.normal;
   assert(a.count>=90,'snow lid became a row of simple spheres');
   for(let i=0;i<a.count;i++)assert(n.getY(i)>.05,'snow lid is back-facing or inverted');
  }
  if(biome==='forest')for(const part of built.pieces.filter(p=>p.category==='leaf'&&p.geometry.type!=='BufferGeometry')){
   const bounds=new T.Box3().setFromBufferAttribute(part.geometry.attributes.position).applyMatrix4(part.matrix);
   if(bounds.min.y<.3)assert(bounds.max.y<.7,'ground vegetation masks actors and pickups');
  }
  built.dispose();
 }
});

test('the sled remains visible from the passage instead of being swallowed by its snow ridge',()=>{
 const built=capture('snow'),material=new T.MeshBasicMaterial({side:T.DoubleSide}),meshes=built.pieces.map(part=>{
  const mesh=new T.Mesh(part.geometry,material);mesh.matrix.copy(part.matrix);mesh.matrixAutoUpdate=false;mesh.updateMatrixWorld(true);mesh.userData.category=part.category;return mesh;
 }),eye=new T.Vector3(0,1.65,.8),ray=new T.Raycaster(),target=new T.Vector3();
 let visible=0;
 for(const part of built.pieces.filter(p=>p.category==='wood'&&p.geometry.type==='BoxGeometry')){
  target.setFromMatrixPosition(part.matrix);ray.set(eye,target.sub(eye).normalize());const first=ray.intersectObjects(meshes,false)[0];
  if(first?.object.userData.category==='wood')visible++;
 }
 assert(visible>=5,'the snow bank hides most of the broken sled');material.dispose();built.dispose();
});
