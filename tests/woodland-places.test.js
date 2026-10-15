import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import * as T from '../vendor/three.module.js';
import {buildWoodlandPlace} from '../woodland-places.js?v=202';
import {naturalRockGeometry} from '../biome-scenery.js?v=202';

function capture(biome,variant=0){
 const pieces=[],solids=[];
 const result=buildWoodlandPlace(biome,{
  piece(category,geometry,color,transform={}){
   const {x=0,y=0,z=0,rx=0,ry=0,rz=0,sx=1,sy=1,sz=1}=transform,object=new T.Object3D();
   object.position.set(x,y,z);object.rotation.set(rx,ry,rz);object.scale.set(sx,sy,sz);object.updateMatrix();
   pieces.push({category,geometry,color,transform,matrix:object.matrix.clone()});
  },
  solid(x,z,r,height){solids.push({x,z,r,height});},
  solidBox(){assert.fail('these authored natural places only need cylindrical chains');}
 },variant);
 return{pieces,solids,result,dispose(){for(const p of pieces)p.geometry.dispose();}};
}

test('woodland places have distinct horizontal silhouettes and bounded draw/triangle budgets',()=>{
 for(const biome of['forest','snow'])for(const variant of[0,1]){
  const built=capture(biome,variant),bounds=new T.Box3(),point=new T.Vector3();let triangles=0;
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
 for(const biome of['forest','snow'])for(const variant of[0,1]){
  const built=capture(biome,variant);
  for(const part of built.pieces){const a=part.geometry.attributes.position;for(let i=0;i<a.count;i++){p.fromBufferAttribute(a,i).applyMatrix4(part.matrix);assert(Math.abs(p.x)>=3.1,biome+' scenery enters the wide path at '+p.toArray());}}
  for(const o of built.solids){assert(Math.abs(o.x)-o.r>=3.1,biome+' invisible wall enters the wide path');assert(o.r>0&&o.height>0);assert(Math.abs(o.x)+o.r<=9.05&&Math.abs(o.z)+o.r<=8.1,'registered footprint escapes the reserved rectangle');}
  built.dispose();
 }
});

test('solid wood, rock, snow and ice above ankle height are covered by their actual obstacle envelopes',()=>{
 const p=new T.Vector3();
 for(const biome of['forest','snow'])for(const variant of[0,1]){
  const built=capture(biome,variant);
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
  for(const biome of['forest','snow'])for(const variant of[0,1]){
   Math.random=()=>{calls++;return .13;};const a=capture(biome,variant);Math.random=()=>{calls++;return .91;};const b=capture(biome,variant);
   assert.deepEqual(a.solids,b.solids);assert.deepEqual(a.result,b.result);assert.equal(a.pieces.length,b.pieces.length);
   for(let i=0;i<a.pieces.length;i++){assert.deepEqual(a.pieces[i].geometry.attributes.position.array,b.pieces[i].geometry.attributes.position.array);assert.deepEqual(a.pieces[i].transform,b.pieces[i].transform);assert.notStrictEqual(a.pieces[i].geometry,b.pieces[i].geometry);}
   a.dispose();b.dispose();
  }
 }finally{Math.random=random;}
 assert(calls>0);assert.deepEqual(naturalRockGeometry.attributes.position.array,source);
});

test('the connected snow lids face upward and woodland vegetation never forms a sight-blocking wall',()=>{
 for(const biome of['forest','snow'])for(const variant of[0,1]){
  const built=capture(biome,variant);
  if(biome==='snow')for(const part of built.pieces.filter(p=>p.geometry.name==='SM_Snow_RidgeCap_A')){
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
 for(const variant of[0,1]){
 const built=capture('snow',variant),material=new T.MeshBasicMaterial({side:T.DoubleSide}),meshes=built.pieces.map(part=>{
  const mesh=new T.Mesh(part.geometry,material);mesh.matrix.copy(part.matrix);mesh.matrixAutoUpdate=false;mesh.updateMatrixWorld(true);mesh.userData.category=part.category;return mesh;
 }),eye=new T.Vector3(0,1.65,built.result.focus.z),ray=new T.Raycaster(),target=new T.Vector3();
 let visible=0;
 for(const part of built.pieces.filter(p=>p.category==='wood'&&p.geometry.type==='BoxGeometry'&&p.geometry.parameters.height===.11)){
  target.setFromMatrixPosition(part.matrix);ray.set(eye,target.sub(eye).normalize());const first=ray.intersectObjects(meshes,false)[0];
  if(first?.object.userData.category==='wood')visible++;
 }
 assert(visible>=5,'the snow bank hides most of the broken sled');material.dispose();built.dispose();
 }
});

test('woodland variants change real roots, broken camp layouts and sheltered ridge bays, not only color',()=>{
 const average=(parts,axis)=>parts.reduce((n,p)=>n+(p.transform[axis]||0),0)/parts.length;
 for(const biome of['forest','snow']){
  const a=capture(biome,0),b=capture(biome,1),boards=built=>built.pieces.filter(p=>p.category==='wood'&&p.geometry.type==='BoxGeometry'&&p.geometry.parameters.height<.2);
  assert.notEqual(a.result.kind,b.result.kind);assert.notDeepEqual(a.result.focus,b.result.focus);assert.notDeepEqual(a.solids,b.solids);
  assert(Math.abs(average(boards(a),'z')-average(boards(b),'z'))>2,'camp remains in the same place');
  const shapes=built=>built.pieces.filter(p=>p.category===(biome==='forest'?'wood':'stone')).map(p=>Array.from(p.geometry.attributes.position.array));
  assert.notDeepEqual(shapes(a),shapes(b),'variant changed only its material tint');
  if(biome==='snow')assert(average(boards(a),'x')*average(boards(b),'x')<0,'both sleds still occupy the same side of the pass');
  else{
   const groundFern=built=>built.pieces.filter(p=>p.geometry.name==='SM_Woodland_Fern_A');
   assert(groundFern(a).length===72&&groundFern(b).length===72,'forest fern connection grew a second vegetation system');
   assert.notDeepEqual(groundFern(a).map(p=>p.transform),groundFern(b).map(p=>p.transform));
  }
  a.dispose();b.dispose();
 }
});

test('forest ground moss is broken and buried rather than a bright row of solid green pebbles',()=>{
 const point=new T.Vector3();
 for(const variant of[0,1]){
  const built=capture('forest',variant),moss=built.pieces.filter(p=>p.geometry.name==='SM_Woodland_BrokenMoss_A');assert.equal(moss.length,24);
  for(const part of moss){
   const g=part.geometry,p=g.attributes.position,color=new T.Color(part.color);assert(g.index.count/3<=50,'broken moss exceeds its replacement geometry budget');
   assert(Math.max(color.r,color.g,color.b)<.11,'ground moss returned to bright lime green');
   for(let i=0;i<p.count;i++){
    point.fromBufferAttribute(p,i).applyMatrix4(part.matrix);assert(point.y<.012,'low moss rose into a floating green cushion');
    if(i%8)assert(point.y<-.035,'moss perimeter does not enter the soil');
   }
   // Every little island has its own buried perimeter; no triangles bridge the gaps.
   for(let i=0;i<g.index.count;i+=3){const a=Math.floor(g.index.getX(i)/8);assert.equal(Math.floor(g.index.getX(i+1)/8),a);assert.equal(Math.floor(g.index.getX(i+2)/8),a);}
  }
  const widths=moss.map(p=>Math.abs(p.transform.x));assert(Math.max(...widths)-Math.min(...widths)>.7,'moss is still planted in two straight parallel rows');
  built.dispose();
 }
});

test('snow skirts make continuous grounded rock-foot drifts while leaving the sheltered sled bay shallow',()=>{
 for(const variant of[0,1]){
  const built=capture('snow',variant),skirts=built.pieces.filter(p=>p.geometry.name==='SM_Snow_RockFoot_A');assert.equal(skirts.length,2);
  for(const part of skirts){
   const g=part.geometry,p=g.attributes.position,n=g.attributes.normal;assert.equal(g.index.count/3,72);assert.equal(p.count,57);
   for(let i=0;i<p.count;i++){assert(n.getY(i)>.05,'ground drift faces down');assert(Math.abs(p.getX(i))>=3.1);}
   for(let row=0;row<19;row++){assert(p.getY(row*3+2)<-.03,'the drift edge floats above the ground');if(Math.abs(p.getZ(row*3)-built.result.focus.z)<1.1&&Math.sign(p.getX(row*3))===Math.sign(built.result.focus.x))assert(p.getY(row*3)<.1,'the sheltered bay is filled in front of the sled');}
  }
  const low=built.solids.filter(o=>o.height<1.1);assert(low.length>=5,'the low sled and windbreak no longer retain jumpable collision heights');built.dispose();
 }
});

test('contour polish keeps the established four collision layouts within geometry budgets',()=>{
 const reference={forest:[['f3c9869316bc633dac9f64a8efbcda6edd984687fc03fc4da292bc4a5fb96a54',16000,24],['e2d4ad54eab673db495ec0fe6a361856d5f40a29dd2596b42d892da04388b16b',16000,24]],snow:[['c543676e585018a0bdbd26d50f8db50f0418632a37a27880fa6e133db4e52e05',6500,47],['7318c8fb282fb8761d5aed8d44fc4c232110efa2299b210275bed4948c0e9e01',6500,48]]};
 for(const biome of['forest','snow'])for(const variant of[0,1]){
  const built=capture(biome,variant),[hash,triangleBudget,count]=reference[biome][variant];
  assert.equal(createHash('sha256').update(JSON.stringify(built.solids)).digest('hex'),hash,'terrain polish changed solid position, radius or height');
  assert.equal(built.solids.length,count);assert(built.pieces.reduce((n,p)=>n+(p.geometry.index?.count??p.geometry.attributes.position.count)/3,0)<triangleBudget);assert.equal(new Set(built.pieces.map(p=>p.category)).size,4);built.dispose();
 }
});

test('fallen roots have low bent feet and buried tips without adding a mound or separate contact mesh',()=>{
 for(const variant of[0,1]){
  const built=capture('forest',variant),roots=built.pieces.filter(p=>p.geometry.name==='SM_Forest_BuriedRoot_A');assert.equal(roots.length,9);
  for(const {geometry:g}of roots){
   const p=g.attributes.position;assert.equal(g.index.count/3,192);assert(g.userData.bark);
   for(let i=p.count-9;i<p.count;i++)assert(p.getY(i)<-.04,'root tip still floats over the soil');
   let feet=0;for(let i=0;i<p.count-9;i++)if(p.getY(i)>-.03&&p.getY(i)<.22)feet++;
   assert(feet>=9,'root ends as a straight leg rather than bending across the ground');
  }
  built.dispose();
 }
});

test('cut-back snow caps hug real layered rock faces while leaving irregular exposed shoulders',()=>{
 const material=new T.MeshBasicMaterial({side:T.DoubleSide}),ray=new T.Raycaster(),down=new T.Vector3(0,-1,0),point=new T.Vector3(),vertex=new T.Vector3();
 for(const variant of[0,1]){
  const built=capture('snow',variant),rocks=built.pieces.filter(p=>p.geometry.name==='SM_Snow_RockRidge_A'),caps=built.pieces.filter(p=>p.geometry.name==='SM_Snow_RidgeCap_A'),meshes=rocks.map(p=>new T.Mesh(p.geometry,material));meshes.forEach(m=>m.updateMatrixWorld(true));
  for(const [side,cap]of caps.entries()){
   const p=cap.geometry.attributes.position,index=cap.geometry.index,rock=rocks[side].geometry.attributes.position,exposure=[];
   for(let row=0;row<19;row++){
    const width=rock.getX(row*7+6)-rock.getX(row*7);exposure.push((p.getX(row*5)-rock.getX(row*7))/width);
    assert(p.getX(row*5)>rock.getX(row*7+1),'wind-scoured rock shoulder is fully covered again');
   }
   assert(Math.max(...exposure)-Math.min(...exposure)>.06,'snow edge has become one regular blanket');
   for(let i=0;i<index.count;i+=3){
    point.set(0,0,0);for(let j=0;j<3;j++)point.add(vertex.fromBufferAttribute(p,index.getX(i+j)).multiplyScalar(1/3));
    const snowY=point.y;point.y=10;ray.set(point,down);const hit=ray.intersectObjects(meshes,false)[0];assert(hit,'snow floats beyond the rock');
    const thickness=snowY-hit.point.y;assert(thickness>=0&&thickness<.085,`snow separates from or sinks through the real rock surface: ${thickness}`);
   }
  }
  built.dispose();
 }
 material.dispose();
});
