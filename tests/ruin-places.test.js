import test from'node:test';
import assert from'node:assert/strict';
import{createHash}from'node:crypto';
import * as T from'../vendor/three.module.js';
import{buildRuinPlace}from'../ruin-places.js?v=207';
import{naturalRockGeometry}from'../biome-scenery.js?v=207';
import{wornStoneBlock}from'../environment-props.js?v=207';

function build(id,variant=0){
 const parts=[],solids=[],dummy=new T.Object3D();
 const kit={piece(category,geometry,color,transform={}){
  const{x=0,y=0,z=0,rx=0,ry=0,rz=0,sx=1,sy=1,sz=1}=transform;dummy.position.set(x,y,z);dummy.rotation.set(rx,ry,rz);dummy.scale.set(sx,sy,sz);dummy.updateMatrix();geometry.applyMatrix4(dummy.matrix);geometry.computeBoundingBox();parts.push({category,geometry,color,overhead:!!transform.overhead});
 },solid(x,z,r,height){solids.push({x,z,r,height});},solidBox(x,z,w,d,height,angle=0){
  const alongX=w>=d,length=Math.max(w,d),thick=Math.min(w,d),steps=Math.max(1,Math.ceil(length/.65)),span=length/steps,r=Math.hypot(span/2,thick/2),c=Math.cos(angle),s=Math.sin(angle);
  for(let i=0;i<steps;i++){const q=-length/2+(i+.5)*span,dx=alongX?q:0,dz=alongX?0:q;solids.push({x:x+c*dx+s*dz,z:z-s*dx+c*dz,r,height});}
 }};
 return{...buildRuinPlace(id,kit,variant),parts,solids,dispose(){for(const p of parts)p.geometry.dispose();}};
}

test('ruins have wide continuous silhouettes, a clear central street and bounded mobile batches',()=>{
 for(const id of['ash','sand'])for(const variant of[0,1]){
  const place=build(id,variant),bounds=new T.Box3(),batches=new Set();let triangles=0;
  assert.equal(place.kind,id==='ash'?(variant?'cooled-furnace-terraces':'collapsed-kiln-yard'):(variant?'fallen-gate-waystation':'buried-courtyard'));assert(place.name&&Number.isFinite(place.focus.y));
  for(const part of place.parts){
   const g=part.geometry,p=g.attributes.position;bounds.union(g.boundingBox);batches.add(part.category+(part.overhead?':roof':''));triangles+=(g.index?g.index.count:p.count)/3;
   for(const attribute of Object.values(g.attributes))assert([...attribute.array].every(Number.isFinite));
   for(let i=0;i<p.count;i++){
    assert(Math.abs(p.getX(i))<=9&&Math.abs(p.getZ(i))<=8,'a part escapes the reserved footprint');
    assert(p.getY(i)<=3,'the scene regressed to a high pillar cluster');
    if(p.getY(i)>.12)assert(Math.abs(p.getX(i))>=3.1,'a wall or overhang narrows the main street');
   }
   if(part.category==='ground')assert(g.boundingBox.max.y<=.12,'non-solid ground detail is too tall');
  }
  assert(batches.size<=5);assert(triangles>3500&&triangles<25000);assert(place.solids.length<=60);assert(place.solids.length>15);
  assert(bounds.max.x-bounds.min.x>15&&bounds.max.z-bounds.min.z>13,'the place is still an isolated prop');
  for(const s of place.solids){assert([s.x,s.z,s.r,s.height].every(Number.isFinite));assert(s.r>0&&s.height>0);assert(Math.abs(s.x)-s.r>=3.1,'a collider blocks the six-metre street');assert(Math.abs(s.x)+s.r<9&&Math.abs(s.z)+s.r<8,'collider exceeds the placement footprint');}
  place.dispose();
 }
});

test('walls, fallen masonry and pots have solid footprints while the kiln entrance remains open',()=>{
 for(const id of['ash','sand'])for(const variant of[0,1]){
  const place=build(id,variant);
  for(const part of place.parts.filter(p=>!p.overhead)){
   const p=part.geometry.attributes.position;
   for(let i=0;i<p.count;i++)if(p.getY(i)>.3){
    const x=p.getX(i),z=p.getZ(i),y=p.getY(i);
    assert(place.solids.some(s=>Math.hypot(x-s.x,z-s.z)<s.r+.045&&y<=s.height+.045),id+' has floating non-solid masonry at '+[x,y,z]);
   }
  }
  if(id==='ash'&&variant===0){
   assert(place.parts.some(p=>p.overhead),'the kiln needs a real raycast roof');
   for(let x=-7.35;x<=-3.15;x+=.1)assert(!place.solids.some(s=>Math.hypot(x-s.x,-2-s.z)<s.r+.28),'kiln mouth is sealed with an invisible collider');
  }else if(id==='sand')assert(place.parts.some(p=>p.category==='ceramic'),'the buried courtyard lost its distinct relic debris');
  place.dispose();
 }
});

test('the barrel roof has an actual opening and a broken crown rather than a painted closed block',()=>{
 const place=build('ash'),roof=new T.Group();for(const p of place.parts.filter(p=>p.overhead))roof.add(new T.Mesh(p.geometry,new T.MeshBasicMaterial({side:T.DoubleSide})));roof.updateMatrixWorld(true);
 const ray=new T.Raycaster(new T.Vector3(-3.2,1.15,-2),new T.Vector3(-1,0,0),0,4);assert.equal(ray.intersectObject(roof,true).length,0,'the furnace opening contains a front face');
 ray.set(new T.Vector3(-6.95,4,-2),new T.Vector3(0,-1,0));ray.far=4;assert(ray.intersectObject(roof,true).length>0,'the intact rear vault has no roof');
 // The front crown's authored angular gap is around 1.3 radians.
 ray.set(new T.Vector3(-4.86,4,-2-Math.cos(1.30)*1.45),new T.Vector3(0,-1,0));assert.equal(ray.intersectObject(roof,true).length,0,'the broken crown was filled by a merged solid cap');
 roof.traverse(o=>o.material?.dispose());place.dispose();
});

test('the second ash yard has an open round furnace and stepped rock beds instead of another roofed kiln',()=>{
 const place=build('ash',1),stone=new T.Group(),material=new T.MeshBasicMaterial({side:T.DoubleSide});
 for(const part of place.parts.filter(p=>p.category==='stone'))stone.add(new T.Mesh(part.geometry,material));stone.updateMatrixWorld(true);
 assert.equal(place.parts.filter(p=>p.geometry.type==='ExtrudeGeometry').length,7,'broken circular wall sectors are missing');assert(!place.parts.some(p=>p.overhead),'second yard repeats the first barrel roof');
 for(let x=3.12;x<=5.68;x+=.08)assert(!place.solids.some(s=>Math.hypot(x-s.x,-3.3-s.z)<s.r+.28),'cold furnace entrance has an invisible blocker');
 const ray=new T.Raycaster(new T.Vector3(3.12,.45,-3.3),new T.Vector3(1,0,0),0,2.56);assert.equal(ray.intersectObject(stone,true).length,0,'furnace entrance is painted over with masonry');
 ray.set(new T.Vector3(5.68,.45,-3.3),new T.Vector3(1,0,0));ray.far=2;const wall=ray.intersectObject(stone,true)[0];assert(wall&&wall.distance>1&&wall.distance<1.5,'furnace has no real circular outer wall');
 // Paired continuous strata form a low front ledge and a higher back face.
 const terrace=place.parts.filter(p=>p.category==='stone'&&p.geometry.type==='BufferGeometry'&&p.geometry.boundingBox.max.x<-6);
 assert(terrace.length>=2);assert(terrace.some(p=>p.geometry.boundingBox.max.y>1.5));assert(terrace.some(p=>p.geometry.boundingBox.max.y>.6&&p.geometry.boundingBox.max.y<.9));
 material.dispose();place.dispose();
});

test('the second sand place leads into one store court and retains a real fallen doorway',()=>{
 const place=build('sand',1);
 // Approach is open from the central street into the eastern store court.
 for(let x=3.12;x<=6.2;x+=.08)assert(!place.solids.some(s=>Math.hypot(x-s.x,1.72-s.z)<s.r+.28),'court entrance is sealed');
 for(const [x,z]of[[7.53,1.72],[6.15,4.88],[6.16,-1.53]])assert(place.solids.some(s=>Math.hypot(x-s.x,z-s.z)<s.r),'U-shaped court wall is visual only');
 assert(place.solids.some(s=>Math.hypot(-5.43-s.x,-4.88-s.z)<s.r&&s.height>1),'fallen lintel can be walked through');
 assert(place.parts.filter(p=>p.category==='ceramic').length>=12,'store court lost its pottery remnants');
 assert(place.focus.x<0&&place.focus.z<-4,'doorway focus still points at the first courtyard');place.dispose();
});

test('the second ash furnace hearth stays visible above its own shallow slag bed',()=>{
 const place=build('ash',1),group=new T.Group(),material=new T.MeshBasicMaterial({side:T.DoubleSide});let hearth;
 for(const part of place.parts){const mesh=new T.Mesh(part.geometry,material);group.add(mesh);if(part.category==='metal'&&part.geometry.type==='CircleGeometry')hearth=mesh;}
 group.updateMatrixWorld(true);assert(hearth);assert(hearth.geometry.boundingBox.max.y<=.035,'hearth became a raised platform');
 const ray=new T.Raycaster();
 for(const[dx,dz]of[[0,0],[-.3,0],[.3,0],[0,-.3],[0,.3],[-.6,.3],[.6,-.3]]){
  ray.set(new T.Vector3(5.68+dx,2,-3.3+dz),new T.Vector3(0,-1,0));const hits=ray.intersectObject(group,true);assert.equal(hits[0]?.object,hearth,'slag floor hides the cold furnace hearth');
  const floor=hits.find(h=>h.object!==hearth);assert(floor&&hits[0].point.y-floor.point.y>.015,'hearth and floor can flicker at their overlap');
 }
 material.dispose();place.dispose();
});

test('the two layouts differ physically, use existing material categories and preserve the default template',()=>{
 const budgets={ash:[[11226,4,57],[9754,3,48]],sand:[[18714,3,55],[13722,3,46]]};
 for(const id of['ash','sand']){
  const first=build(id),second=build(id,1),explicit=build(id,0);assert.deepEqual(first.solids,explicit.solids);assert.notDeepEqual(first.solids,second.solids,'variant changes only colors');
  assert.notEqual(first.kind,second.kind);assert.notEqual(Math.sign(first.focus.x),Math.sign(second.focus.x),'both layouts keep the same large landmark on the same side');
  for(const [variant,place]of[first,second].entries()){
   const batches=new Set(place.parts.map(p=>p.category+(p.overhead?':roof':''))),triangles=place.parts.reduce((n,p)=>n+(p.geometry.index?.count??p.geometry.attributes.position.count)/3,0);
   assert.deepEqual([triangles,batches.size,place.solids.length],budgets[id][variant]);assert([...batches].every(k=>['stone','stone:roof','ground','metal','ceramic'].includes(k)),'variant added a material family');
  }
  first.parts.forEach((p,i)=>assert.deepEqual(p.geometry.attributes.position.array,explicit.parts[i].geometry.attributes.position.array));first.dispose();second.dispose();explicit.dispose();
 }
});

test('fractured ground and sand deposits taper below the real ground with no raised walkable slab',()=>{
 const material=new T.MeshBasicMaterial({side:T.FrontSide}),ray=new T.Raycaster();
 for(const id of['ash','sand'])for(const variant of[0,1]){
  const place=build(id,variant),layers=place.parts.filter(p=>p.geometry.userData.ruinGroundLayer);
  assert.equal(layers.length,id==='ash'?4:5,'ground layer count changed');
  for(const{geometry:g}of layers){
   const p=g.attributes.position,n=g.attributes.normal,c=g.attributes.color,meta=g.userData.ruinGroundLayer;
   assert.equal(g.index.count/3,120,'thin layer has a larger geometry cost than the old rock');
   assert(g.boundingBox.max.y<=.0290001&&g.boundingBox.max.y<=meta.ceiling+.000001,'walkable detail hides the player feet');
   assert(g.boundingBox.min.y<-.034,'edges do not reach through the real ground at -0.03m');
   assert.equal(Array.from({length:p.count},(_,i)=>p.getY(i)).filter(y=>y<-.034).length,24,'the whole irregular perimeter must be buried');
   assert(g.boundingBox.max.y-g.boundingBox.min.y>.037,'layer has collapsed into a flat decal');
   for(let i=0;i<p.count;i++)assert(n.getY(i)>.8,'ground layer is folded or wound downward');
   for(const value of c.array)assert(Number.isFinite(value)&&value>=0&&value<=1,'ground color is invalid');
   assert(Math.max(...c.array)-Math.min(...c.array)>.05,'fractures or wind streaks have no low-contrast tonal variation');
   // A front-facing ray confirms the center is actual continuous ground, with
   // no alpha plane or back-facing hole where a player can walk into the yard.
   const mesh=new T.Mesh(g,material);mesh.updateMatrixWorld(true);ray.set(new T.Vector3(p.getX(0),1,p.getZ(0)),new T.Vector3(0,-1,0));assert(ray.intersectObject(mesh).length>0);
  }
  place.dispose();
 }
 material.dispose();
});

test('low wall seams remain inside the original solid footprint and use biome-specific ground contact',()=>{
 for(const id of['ash','sand'])for(const variant of[0,1]){
  const place=build(id,variant),walls=place.parts.filter(p=>p.category==='stone'&&p.geometry.type==='BufferGeometry'&&Math.abs(p.geometry.boundingBox.min.y+.1)<1e-6);
  assert.equal(walls.length,id==='ash'?(variant?4:6):(variant?5:6));
  for(const{geometry:g}of walls){
   const p=g.attributes.position,c=g.attributes.color,foot=[],shoulder=[],seams=new Set();
   for(let i=0;i<p.count;i++){
    const y=p.getY(i);if(y<0)foot.push(c.getY(i));
    if(y>.04&&y<.26){seams.add(y.toFixed(4));shoulder.push(c.getY(i));}
   }
   assert(seams.size>=2,'low rock seam has no uneven profile');
   const avg=a=>a.reduce((s,n)=>s+n,0)/a.length;assert(id==='sand'?avg(foot)>avg(shoulder):avg(foot)<avg(shoulder),'sand burial and soot contact use the same color treatment');
  }
  place.dispose();
 }
});

test('ground and low wall refinement preserves every collider from both established layouts',()=>{
 const original={ash:['b1fc4ed1ca2168ec0472caca3fdfb1f4bd8f5ceedf6f6ac43879733b769988fc','0a618a5ce70680b0acc74bcf67c877d5ac7b25aa2ca995d5737301413fb29972'],sand:['a461e5c7c578709ca708b7fc8361f40df82e100f258282754bf617706a6e7f61','486f88fe3dacf2c633813c39f8967f6f39827ab86d0b1145dcbf4cc4a8d50f66']};
 for(const id of['ash','sand'])for(const variant of[0,1]){const p=build(id,variant);assert.equal(createHash('sha256').update(JSON.stringify(p.solids)).digest('hex'),original[id][variant]);p.dispose();}
});

test('builds are deterministic, own their pieces, and never mutate or dispose shared sources',()=>{
 const sources=[naturalRockGeometry,wornStoneBlock],before=sources.map(g=>g.attributes.position.array.slice());let sharedDisposed=0;const onDispose=()=>sharedDisposed++;
 for(const g of sources)g.addEventListener('dispose',onDispose);
 for(const id of['ash','sand'])for(const variant of[0,1]){
  const a=build(id,variant),b=build(id,variant);assert.deepEqual(a.solids,b.solids);assert.equal(a.parts.length,b.parts.length);const disposed=new Set();
  a.parts.forEach((part,i)=>{const other=b.parts[i];assert.notEqual(part.geometry,other.geometry);assert(!sources.includes(part.geometry));assert.equal(part.category,other.category);assert.equal(part.color,other.color);assert.deepEqual(part.geometry.attributes.position.array,other.geometry.attributes.position.array);part.geometry.addEventListener('dispose',()=>disposed.add(part.geometry));});
  a.dispose();assert.equal(disposed.size,a.parts.length);assert(b.parts.every(p=>p.geometry.attributes.position.count>0));b.dispose();
 }
 assert.equal(sharedDisposed,0);sources.forEach((g,i)=>{assert.deepEqual(g.attributes.position.array,before[i]);g.removeEventListener('dispose',onDispose);});
});

test('unrelated biomes do not allocate pieces or register collision',()=>{
 const kit={piece(){assert.fail('unexpected geometry');},solid(){assert.fail('unexpected solid');},solidBox(){assert.fail('unexpected wall');}};
 for(const id of['forest','snow','coast','confluence',undefined])assert.equal(buildRuinPlace(id,kit),null);
});
