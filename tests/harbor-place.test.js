import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../vendor/three.module.js';
import {buildHarborPlace} from '../harbor-place.js?v=207';
import {createOverheadQuery} from '../adventure-overheads.js';

function build(variant=0){
 const pieces=[],solids=[],dummy=new T.Object3D();
 const kit={piece(category,geometry,color,transform={}){
  const {x=0,y=0,z=0,rx=0,ry=0,rz=0,sx=1,sy=1,sz=1,overhead=false}=transform;
  dummy.position.set(x,y,z);dummy.rotation.set(rx,ry,rz);dummy.scale.set(sx,sy,sz);dummy.updateMatrix();geometry.applyMatrix4(dummy.matrix);
  pieces.push({category,geometry,color,overhead});
 },solid(x,z,r,height){solids.push({x,z,r,height});},solidBox(x,z,w,d,height,angle=0){
  const alongX=w>=d,length=Math.max(w,d),thick=Math.min(w,d),steps=Math.max(1,Math.ceil(length/.65)),span=length/steps,r=Math.hypot(span/2,thick/2),c=Math.cos(angle),s=Math.sin(angle);
  for(let i=0;i<steps;i++){const q=-length/2+(i+.5)*span,dx=alongX?q:0,dz=alongX?0:q;solids.push({x:x+c*dx+s*dz,z:z-s*dx+c*dz,r,height});}
 }};
 const meta=buildHarborPlace(kit,variant);return{pieces,solids,meta,dispose(){for(const p of pieces)p.geometry.dispose();}};
}
function contains(s,x,y,z){
 if(y>s.height+.015)return false;
 if(s.r!==undefined)return Math.hypot(x-s.x,z-s.z)<=s.r+.015;
 const c=Math.cos(s.angle),n=Math.sin(s.angle),dx=x-s.x,dz=z-s.z;
 return Math.abs(c*dx-n*dz)<=s.w/2+.015&&Math.abs(n*dx+c*dz)<=s.d/2+.015;
}

for(const variant of[0,1]){
test(`harbor ${variant} has a continuous long hull and an open net shed within its footprint and batch budget`,()=>{
 const b=build(variant),categories=new Set(),batches=new Set();let triangles=0,hullVertices=0;
 assert.equal(b.meta.kind,variant?'loading-wharf':'wreck-wharf');assert.equal(b.meta.name,variant?'整备装卸埠':'搁浅船坞');
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

test(`harbor ${variant}: all raised non-overhead vertices have registered solids, with no blocking floor or centre-line collider`,()=>{
 const b=build(variant),a=new T.Vector3(),c=new T.Vector3(),d=new T.Vector3(),point=new T.Vector3();
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

test(`harbor ${variant}: both sides of the closed hull have outward winding for consistent wood lighting`,()=>{
 const b=build(variant),a=new T.Vector3(),c=new T.Vector3(),d=new T.Vector3();
 for(const piece of b.pieces.slice(0,10)){
  const p=piece.geometry.attributes.position,index=piece.geometry.index;let volume=0;
  for(let i=0;i<index.count;i+=3){a.fromBufferAttribute(p,index.getX(i));c.fromBufferAttribute(p,index.getX(i+1));d.fromBufferAttribute(p,index.getX(i+2));volume+=a.dot(c.cross(d))/6;}
  assert(volume>0,'inverted curved side plank');
 }
 b.dispose();
});

test(`harbor ${variant}: only loose canvas and net move, with pinned attachments and the entire wind envelope inside existing solids`,()=>{
 const b=build(variant),moving=b.pieces.filter(p=>p.geometry.attributes.harborFlex);assert(moving.length>20);
 const allowed=new Set(['SM_Harbor_GatheredSail_A','SM_Harbor_RepairSail_A','SM_Harbor_DryingNet_A']);
 for(const piece of moving){
  const g=piece.geometry,p=g.attributes.position,n=g.attributes.normal,w=g.attributes.harborFlex;
  assert.equal(piece.category,'cloth');assert(!piece.overhead);assert(allowed.has(g.name),'load-bearing rope or packed cargo gained wind');
  assert.equal(w.count,p.count);assert(w.array.every(v=>Number.isFinite(v)&&v>=0&&v<=1));
  if(g.name!=='SM_Harbor_DryingNet_A'){
   assert(Math.max(...w.array)>.5);
   for(let row=0;row<=5;row++)for(let col=0;col<=12;col++)if(row===0||col===0||col===12||g.name==='SM_Harbor_RepairSail_A'&&row===5)assert(w.getX(row*13+col)<1e-8,'sewn/pinned cloth edge moves');
  }
  for(let i=0;i<p.count;i++){
   if(g.name==='SM_Harbor_DryingNet_A'&&(p.getY(i)>=2.19||p.getX(i)<=4.44||p.getX(i)>=7.36))assert.equal(w.getX(i),0,'net support moves');
   for(const sign of[-1,1]){
    const amount=.028*w.getX(i)*sign,net=g.name==='SM_Harbor_DryingNet_A',x=p.getX(i)+(net?0:n.getX(i)*amount),y=p.getY(i)+(net?0:n.getY(i)*amount),z=p.getZ(i)+(net?amount:n.getZ(i)*amount);
    assert(Math.abs(x)>=3.1&&Math.abs(x)<=9&&Math.abs(z)<=8,'wind enters the clear route or leaves the place');
    assert(b.solids.some(s=>contains(s,x,y,z)),'wind crosses the existing collision envelope');
   }
  }
 }
 for(const piece of b.pieces)if(!allowed.has(piece.geometry.name))assert(!piece.geometry.attributes.harborFlex,'static rigging unexpectedly moves');
 b.dispose();
});

test(`harbor ${variant}: repair hoist, suspended cargo and layered sailcloth provide a connected middle and upper silhouette`,()=>{
 const b=build(variant),named=new Map(b.pieces.filter(p=>p.geometry.name).map(p=>[p.geometry.name,p]));
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

test(`harbor ${variant}: each build transfers independent geometry without consuming layout randomness`,()=>{
 const a=build(variant),random=Math.random;let b;
 try{Math.random=()=>.7;b=build(variant);}finally{Math.random=random;}
 assert.deepEqual(a.meta,b.meta);assert.deepEqual(a.solids,b.solids);assert.equal(a.pieces.length,b.pieces.length);
 for(let i=0;i<a.pieces.length;i++){assert.notEqual(a.pieces[i].geometry,b.pieces[i].geometry);assert.deepEqual(a.pieces[i].geometry.attributes.position.array,b.pieces[i].geometry.attributes.position.array);}
 let released=0;for(const p of a.pieces)p.geometry.addEventListener('dispose',()=>released++);a.dispose();assert.equal(released,a.pieces.length);
 assert(b.pieces.every(p=>p.geometry.attributes.position.count>0));b.dispose();
});
}

test('loading berth relocates complete work and cargo areas without adding pieces, triangles or solid records',()=>{
 const wreck=build(),loading=build(1),triangles=b=>b.pieces.reduce((n,p)=>n+p.geometry.index.count/3,0);
 assert.equal(loading.pieces.length,wreck.pieces.length);assert.equal(triangles(loading),triangles(wreck));assert.equal(loading.solids.length,wreck.solids.length);
 const blocked=(b,x,y,z)=>b.solids.some(s=>contains(s,x,y,z));
 assert(blocked(wreck,7.72,1,1.82));assert(!blocked(loading,7.72,1,1.82),'old bench collider survived its move');
 assert(!blocked(wreck,7.72,1,-2.10));assert(blocked(loading,7.72,1,-2.10),'new working station has no matching collider');
 assert(blocked(wreck,4.92,1,-5.5));assert(!blocked(loading,4.92,1,-5.5),'pier-facing approach still carries the original stack');
 assert(blocked(loading,5.08,1,-2.0));assert(!blocked(wreck,5.08,1,-2.0));
 const looseNet=b=>b.solids.find(s=>s.r===.79&&s.height===.55);
 assert.equal(looseNet(wreck).z,-2.48);assert(Math.abs(looseNet(loading).z-2.80)<1e-8,'low net did not move into the cleared shed');
 // The low bundle stays jumpable; changing the activity must not erect a new wall.
 assert.equal(looseNet(loading).height,looseNet(wreck).height);
 const netFloor=b=>Math.min(...b.pieces.filter(p=>p.geometry.name==='SM_Harbor_DryingNet_A').flatMap(p=>Array.from(p.geometry.attributes.position.array).filter((_,i)=>i%3===1)));
 assert(netFloor(loading)-netFloor(wreck)>.3,'drying net was only recoloured');
 assert.notDeepEqual(loading.pieces[9].geometry.attributes.position.array,wreck.pieces[9].geometry.attributes.position.array,'repaired upper strake retained its broken notch');
 // The camera reads a new activity focus, while all building roofs stay identical.
 assert.notDeepEqual(loading.meta.focus,wreck.meta.focus);
 const roofs=b=>b.pieces.filter(p=>p.overhead).map(p=>p.geometry.attributes.position.array);
 assert.deepEqual(roofs(loading),roofs(wreck));wreck.dispose();loading.dispose();
});

test('weathered boards keep outward end-grain normals separate from their long side faces',()=>{
 const b=build(),a=new T.Vector3(),c=new T.Vector3(),d=new T.Vector3(),normal=new T.Vector3(),n=new T.Vector3();
 const boards=b.pieces.filter(p=>['SM_Harbor_WeatheredBoard_A','SM_Harbor_CurvedRoofBoard_A'].includes(p.geometry.name));assert.equal(boards.length,200);
 for(const {geometry:g}of boards){
  const p=g.attributes.position,index=g.index;assert.equal(index.count/3,g.name==='SM_Harbor_CurvedRoofBoard_A'?76:44);
  for(let i=index.count-36;i<index.count;i+=3){
   const ids=[index.getX(i),index.getX(i+1),index.getX(i+2)];a.fromBufferAttribute(p,ids[0]);c.fromBufferAttribute(p,ids[1]);d.fromBufferAttribute(p,ids[2]);normal.crossVectors(c.sub(a),d.sub(a)).normalize();
   for(const id of ids){n.fromBufferAttribute(g.attributes.normal,id);assert(n.dot(normal)>.55,'long side faces skewed the end-cap highlight');}
  }
 }
 b.dispose();
});

test('swept shed boards form real curved overheads while both entrances retain headroom',()=>{
 const b=build(),boards=b.pieces.filter(p=>p.geometry.name==='SM_Harbor_CurvedRoofBoard_A'),group=new T.Group(),material=new T.MeshBasicMaterial();assert.equal(boards.length,26);
 for(const{geometry:g,overhead}of boards){
  assert(overhead);const p=g.attributes.position;
  for(let corner=0;corner<8;corner++)assert(p.getY(16+corner)-(p.getY(corner)+p.getY(32+corner))*.5>.16,'roof board is only a tilted straight box');
  const mesh=new T.Mesh(g,material);mesh.userData.placeOverhead=true;group.add(mesh);
 }
 const query=createOverheadQuery({group});
 for(const x of[4.0,4.9,7.3,8.2])for(const z of[-.45,5.95]){const hit=query.firstHit({x,y:6,z},{x,y:3.2,z});assert(hit&&hit.point.y>3.2,'the curved canopy has a hole or lowers entrance clearance');}
 assert.equal(query.firstHit({x:0,y:6,z:3},{x:0,y:.2,z:3}),null);material.dispose();b.dispose();
});
