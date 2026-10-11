import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../vendor/three.module.js';
import {buildHarborPlace} from '../harbor-place.js';
import {createOverheadQuery} from '../adventure-overheads.js';

function build(){
 const pieces=[],solids=[],dummy=new T.Object3D();
 const kit={piece(category,geometry,color,transform={}){
  const {x=0,y=0,z=0,rx=0,ry=0,rz=0,sx=1,sy=1,sz=1,overhead=false}=transform;
  dummy.position.set(x,y,z);dummy.rotation.set(rx,ry,rz);dummy.scale.set(sx,sy,sz);dummy.updateMatrix();geometry.applyMatrix4(dummy.matrix);
  pieces.push({category,geometry,color,overhead});
 },solid(x,z,r,height){solids.push({x,z,r,height});},solidBox(x,z,w,d,height,angle=0){
  const alongX=w>=d,length=Math.max(w,d),thick=Math.min(w,d),steps=Math.max(1,Math.ceil(length/.65)),span=length/steps,r=Math.hypot(span/2,thick/2),c=Math.cos(angle),s=Math.sin(angle);
  for(let i=0;i<steps;i++){const q=-length/2+(i+.5)*span,dx=alongX?q:0,dz=alongX?0:q;solids.push({x:x+c*dx+s*dz,z:z-s*dx+c*dz,r,height});}
 }};
 const meta=buildHarborPlace(kit);return{pieces,solids,meta,dispose(){for(const p of pieces)p.geometry.dispose();}};
}
function contains(s,x,y,z){
 if(y>s.height+.015)return false;
 if(s.r!==undefined)return Math.hypot(x-s.x,z-s.z)<=s.r+.015;
 const c=Math.cos(s.angle),n=Math.sin(s.angle),dx=x-s.x,dz=z-s.z;
 return Math.abs(c*dx-n*dz)<=s.w/2+.015&&Math.abs(n*dx+c*dz)<=s.d/2+.015;
}

test('wreck wharf has a continuous long hull and an open net shed within its footprint and batch budget',()=>{
 const b=build(),categories=new Set(),batches=new Set();let triangles=0,hullVertices=0;
 assert.equal(b.meta.kind,'wreck-wharf');assert.equal(b.meta.name,'搁浅船坞');
 for(const piece of b.pieces){
  categories.add(piece.category);batches.add(piece.category+':'+piece.overhead);
  const g=piece.geometry,p=g.attributes.position;triangles+=(g.index?.count??p.count)/3;
  assert(p&&g.attributes.normal);assert([...p.array,...g.attributes.normal.array].every(Number.isFinite));
  g.computeBoundingBox();const size=g.boundingBox.getSize(new T.Vector3());
  if(size.z>13&&g.index.count>500&&g.boundingBox.max.x<0)hullVertices+=p.count;
  for(let i=0;i<p.count;i++){
   assert(Math.abs(p.getX(i))<=9&&Math.abs(p.getZ(i))<=8,'asset leaves the 18 × 16m envelope');
   assert(Math.abs(p.getX(i))>=3.1,'asset intrudes into the central 6.2m route');
   if(piece.overhead)assert(p.getY(i)>=3.2,'roof blocks head clearance');
  }
 }
 assert(hullVertices>500,'wreck is a loose row of boxes rather than a continuous hull');
 assert(categories.size<=5&&batches.size<=5);assert(triangles<25000);
 assert(b.pieces.some(p=>p.overhead&&p.category.includes('wood')));assert(b.pieces.some(p=>p.category==='cloth'));assert(b.pieces.some(p=>p.category==='metal'));
 b.dispose();
});

test('all raised non-overhead vertices have registered solids, with no blocking floor or centre-line collider',()=>{
 const b=build(),a=new T.Vector3(),c=new T.Vector3(),d=new T.Vector3(),point=new T.Vector3();
 const check=(x,y,z)=>assert(y<=.3||b.solids.some(s=>contains(s,x,y,z)),`unregistered solid at ${x.toFixed(3)}, ${y.toFixed(3)}, ${z.toFixed(3)}`);
 for(const piece of b.pieces){
  if(piece.overhead)continue;
  const p=piece.geometry.attributes.position,index=piece.geometry.index;
  for(let i=0;i<p.count;i++){
   check(p.getX(i),p.getY(i),p.getZ(i));
  }
  for(let i=0;i<index.count;i+=3){
   a.fromBufferAttribute(p,index.getX(i));c.fromBufferAttribute(p,index.getX(i+1));d.fromBufferAttribute(p,index.getX(i+2));
   point.copy(a).add(c).add(d).multiplyScalar(1/3);check(point.x,point.y,point.z);
  }
 }
 assert(b.solids.length<=70);
 for(const s of b.solids)assert(Math.abs(s.x)-s.r-.55>=3.1,'solid removes player clearance from the central lane');
 assert(!b.solids.some(s=>contains(s,-6.3,1.5,-1.7)),'empty amidships was filled with one solid');
 const floor=b.pieces.filter(p=>{p.geometry.computeBoundingBox();return p.geometry.boundingBox.max.y<=.12;});
 assert(floor.length>=31);assert(floor.every(p=>!p.overhead));
 b.dispose();
});

test('both sides of the closed hull have outward winding for consistent wood lighting',()=>{
 const b=build(),a=new T.Vector3(),c=new T.Vector3(),d=new T.Vector3();
 for(const piece of b.pieces.slice(0,10)){
  const p=piece.geometry.attributes.position,index=piece.geometry.index;let volume=0;
  for(let i=0;i<index.count;i+=3){a.fromBufferAttribute(p,index.getX(i));c.fromBufferAttribute(p,index.getX(i+1));d.fromBufferAttribute(p,index.getX(i+2));volume+=a.dot(c.cross(d))/6;}
  assert(volume>0,'inverted curved side plank');
 }
 b.dispose();
});

test('repair hoist, suspended cargo and layered sailcloth provide a connected middle and upper silhouette',()=>{
 const b=build(),named=new Map(b.pieces.filter(p=>p.geometry.name).map(p=>[p.geometry.name,p]));
 for(const name of['SM_Harbor_WinchDrum_A','SM_Harbor_HoistSheave_A','SM_Harbor_SuspendedSling_A','SM_Harbor_RepairSail_A','SM_Harbor_GatheredSail_A','SM_Harbor_FurledSail_A','SM_Harbor_TiedCargo_1'])assert(named.has(name),name+' is absent');
 const sheave=named.get('SM_Harbor_HoistSheave_A'),sling=named.get('SM_Harbor_SuspendedSling_A'),sail=named.get('SM_Harbor_GatheredSail_A');
 sheave.geometry.computeBoundingBox();sling.geometry.computeBoundingBox();sail.geometry.computeBoundingBox();
 assert(sheave.overhead);assert(sheave.geometry.boundingBox.min.y>4.3);assert(sling.geometry.boundingBox.max.y>2.2);
 assert(sail.geometry.boundingBox.getSize(new T.Vector3()).x>2.5);assert(sail.geometry.boundingBox.getSize(new T.Vector3()).z>.10,'sail is a flat sign');
 assert(b.pieces.some(p=>p.overhead&&p.category==='cloth'),'furled overhead sail is missing from the roof query batch');
 assert(b.solids.some(s=>Math.hypot(s.x+6.3,s.z+4.35)<.001&&s.height>=5),'hoist mast still has the old low deck collider');
 const group=new T.Group(),material=new T.MeshBasicMaterial({side:T.DoubleSide});
 for(const p of b.pieces.filter(p=>p.overhead)){const mesh=new T.Mesh(p.geometry,material);mesh.userData.placeOverhead=true;group.add(mesh);}
 const query=createOverheadQuery({group});
 for(const name of['SM_Harbor_HoistSheave_A','SM_Harbor_FurledSail_A']){
  const g=named.get(name).geometry;g.computeBoundingBox();const center=g.boundingBox.getCenter(new T.Vector3());
  assert(query.firstHit({x:center.x,y:6,z:center.z},{x:center.x,y:3.2,z:center.z}),name+' is missing from actual overhead rays');
 }
 assert.equal(query.firstHit({x:0,y:6,z:0},{x:0,y:.2,z:0}),null,'hoist and sail create a phantom roof across the centre lane');
 material.dispose();
 b.dispose();
});

test('each build transfers independent geometry without consuming layout randomness',()=>{
 const a=build(),random=Math.random;let b;
 try{Math.random=()=>.7;b=build();}finally{Math.random=random;}
 assert.deepEqual(a.meta,b.meta);assert.deepEqual(a.solids,b.solids);assert.equal(a.pieces.length,b.pieces.length);
 for(let i=0;i<a.pieces.length;i++){assert.notEqual(a.pieces[i].geometry,b.pieces[i].geometry);assert.deepEqual(a.pieces[i].geometry.attributes.position.array,b.pieces[i].geometry.attributes.position.array);}
 let released=0;for(const p of a.pieces)p.geometry.addEventListener('dispose',()=>released++);a.dispose();assert.equal(released,a.pieces.length);
 assert(b.pieces.every(p=>p.geometry.attributes.position.count>0));b.dispose();
});
