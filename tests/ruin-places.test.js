import test from'node:test';
import assert from'node:assert/strict';
import * as T from'../vendor/three.module.js';
import{buildRuinPlace}from'../ruin-places.js';
import{naturalRockGeometry}from'../biome-scenery.js?v=154';
import{wornStoneBlock}from'../environment-props.js?v=154';

function build(id){
 const parts=[],solids=[],dummy=new T.Object3D();
 const kit={piece(category,geometry,color,transform={}){
  const{x=0,y=0,z=0,rx=0,ry=0,rz=0,sx=1,sy=1,sz=1}=transform;dummy.position.set(x,y,z);dummy.rotation.set(rx,ry,rz);dummy.scale.set(sx,sy,sz);dummy.updateMatrix();geometry.applyMatrix4(dummy.matrix);geometry.computeBoundingBox();parts.push({category,geometry,color,overhead:!!transform.overhead});
 },solid(x,z,r,height){solids.push({x,z,r,height});},solidBox(x,z,w,d,height,angle=0){
  const alongX=w>=d,length=Math.max(w,d),thick=Math.min(w,d),steps=Math.max(1,Math.ceil(length/.65)),span=length/steps,r=Math.hypot(span/2,thick/2),c=Math.cos(angle),s=Math.sin(angle);
  for(let i=0;i<steps;i++){const q=-length/2+(i+.5)*span,dx=alongX?q:0,dz=alongX?0:q;solids.push({x:x+c*dx+s*dz,z:z-s*dx+c*dz,r,height});}
 }};
 return{...buildRuinPlace(id,kit),parts,solids,dispose(){for(const p of parts)p.geometry.dispose();}};
}

test('ruins have wide continuous silhouettes, a clear central street and bounded mobile batches',()=>{
 for(const id of['ash','sand']){
  const place=build(id),bounds=new T.Box3(),batches=new Set();let triangles=0;
  assert.equal(place.kind,id==='ash'?'collapsed-kiln-yard':'buried-courtyard');assert(place.name&&Number.isFinite(place.focus.y));
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
 for(const id of['ash','sand']){
  const place=build(id);
  for(const part of place.parts.filter(p=>!p.overhead)){
   const p=part.geometry.attributes.position;
   for(let i=0;i<p.count;i++)if(p.getY(i)>.3){
    const x=p.getX(i),z=p.getZ(i),y=p.getY(i);
    assert(place.solids.some(s=>Math.hypot(x-s.x,z-s.z)<s.r+.045&&y<=s.height+.045),id+' has floating non-solid masonry at '+[x,y,z]);
   }
  }
  if(id==='ash'){
   assert(place.parts.some(p=>p.overhead),'the kiln needs a real raycast roof');
   for(let x=-7.35;x<=-3.15;x+=.1)assert(!place.solids.some(s=>Math.hypot(x-s.x,-2-s.z)<s.r+.28),'kiln mouth is sealed with an invisible collider');
  }else assert(place.parts.some(p=>p.category==='ceramic'),'the buried courtyard lost its distinct relic debris');
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

test('builds are deterministic, own their pieces, and never mutate or dispose shared sources',()=>{
 const sources=[naturalRockGeometry,wornStoneBlock],before=sources.map(g=>g.attributes.position.array.slice());let sharedDisposed=0;const onDispose=()=>sharedDisposed++;
 for(const g of sources)g.addEventListener('dispose',onDispose);
 for(const id of['ash','sand']){
  const a=build(id),b=build(id);assert.deepEqual(a.solids,b.solids);assert.equal(a.parts.length,b.parts.length);const disposed=new Set();
  a.parts.forEach((part,i)=>{const other=b.parts[i];assert.notEqual(part.geometry,other.geometry);assert(!sources.includes(part.geometry));assert.equal(part.category,other.category);assert.equal(part.color,other.color);assert.deepEqual(part.geometry.attributes.position.array,other.geometry.attributes.position.array);part.geometry.addEventListener('dispose',()=>disposed.add(part.geometry));});
  a.dispose();assert.equal(disposed.size,a.parts.length);assert(b.parts.every(p=>p.geometry.attributes.position.count>0));b.dispose();
 }
 assert.equal(sharedDisposed,0);sources.forEach((g,i)=>{assert.deepEqual(g.attributes.position.array,before[i]);g.removeEventListener('dispose',onDispose);});
});

test('unrelated biomes do not allocate pieces or register collision',()=>{
 const kit={piece(){assert.fail('unexpected geometry');},solid(){assert.fail('unexpected solid');},solidBox(){assert.fail('unexpected wall');}};
 for(const id of['forest','snow','coast','confluence',undefined])assert.equal(buildRuinPlace(id,kit),null);
});
