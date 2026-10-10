import{test}from'node:test';import assert from'node:assert/strict';import * as T from'../vendor/three.module.js';
import{buildWorld,clearAt,animateWorld}from'../world.js';import{sceneryAllowed}from'../biome-scenery.js';
import{bridgeContains,updateTide}from'../coast.js';import{waterDepth}from'../water.js';
import{naturalRockGeometry,boulderRockGeometry,finishRock,installGroundSurface,environmentDetailTexture}from'../biome-scenery.js?v=120';
globalThis.document={createElement:()=>({width:256,height:256,getContext:()=>({fillRect(){}})})};
function dispose(w){w.group.traverse(o=>{if(o.isInstancedMesh)o.dispose();if(o.userData.ownedGeometry)o.geometry.dispose();});}
test('worn rocks reuse a bounded smooth mesh and preserve placed obstacle transforms',()=>{
 const source=new T.MeshStandardMaterial({color:0x867863}),a=new T.Mesh(new T.DodecahedronGeometry(.7,0),source),b=a.clone();a.position.set(3,.3,-2);a.scale.set(1,.8,1);
 finishRock(a);finishRock(b);assert.strictEqual(a.geometry,boulderRockGeometry);assert.strictEqual(a.material,b.material);assert.notStrictEqual(a.material,source);assert(!source.vertexColors);assert(a.material.vertexColors);
 assert.deepEqual(a.position.toArray(),[3,.3,-2]);assert(Math.abs(a.scale.y-.56)<1e-8);const scale=a.scale.clone();finishRock(a);assert(a.scale.equals(scale),'finishing a rock twice changes its footprint');
 assert(naturalRockGeometry.index.count/3<=120,'tiny instanced scree must retain its budget');assert(boulderRockGeometry.index.count/3<=480);const p=boulderRockGeometry.attributes.position,n=boulderRockGeometry.attributes.normal,radii=[];
 for(let i=0;i<p.count;i++){const v=new T.Vector3().fromBufferAttribute(n,i);assert(Math.abs(v.length()-1)<1e-5,'rock normal is invalid');radii.push(new T.Vector3().fromBufferAttribute(p,i).length());}
 assert(Math.max(...radii)-Math.min(...radii)>.15,'rock lost its worn silhouette');assert(Math.max(...radii)<1.2);
});
test('all ground finishes share one filtered detail texture without changing terrain height',()=>{
 let texture;for(const id of['forest','snow','ash','sand','coast','confluence']){
  const w=buildWorld(id,7);installGroundSurface(w.ground,id);const shader={uniforms:{},vertexShader:T.ShaderLib.standard.vertexShader,fragmentShader:T.ShaderLib.standard.fragmentShader};w.ground.material.onBeforeCompile(shader);
  const detail=shader.uniforms.groundDetail.value;if(texture)assert.strictEqual(detail,texture);texture=detail;
  assert(detail.generateMipmaps);assert.equal(detail.wrapS,T.RepeatWrapping);assert.equal(detail.image.width,128);assert.equal(detail.image.height,128);assert(!w.ground.material.transparent);
  assert.equal((shader.fragmentShader.match(/texture2D\(groundDetail,/g)||[]).length,3,'ground added another texture fetch');
  assert.equal(w.ground.material.roughness,1,'ground detail introduced glossy flecks');
  const positions=w.ground.geometry.attributes.position;for(let i=0;i<positions.count;i++)assert.equal(positions.getZ(i),0,'visual relief moved the playable terrain');
  dispose(w);
 }
});
test('the shared detail texture packs sparse filtered litter without replacing the water noise channels',()=>{
 const texture=environmentDetailTexture(),data=texture.image.data,channels=[[],[],[],[]];
 assert.strictEqual(environmentDetailTexture(),texture,'detail texture is rebuilt on reuse');
 assert.equal(texture.magFilter,T.LinearFilter);assert.equal(texture.minFilter,T.LinearMipmapLinearFilter);assert.equal(texture.anisotropy,4);
 for(let i=0;i<data.length;i++)channels[i%4].push(data[i]);
 for(const noise of channels.slice(0,3)){
  assert(Math.min(...noise)<35&&Math.max(...noise)>220,'shared noise lost its range');
  const mean=noise.reduce((sum,v)=>sum+v,0)/noise.length;assert(mean>95&&mean<165,'shared noise became biased');
 }
 const litter=channels[3],coverage=litter.filter(v=>v>0).length/litter.length;
 assert(coverage>.015&&coverage<.09,'fallen leaves became absent or a continuous carpet');
 assert(litter.some(v=>v>0&&v<100)&&litter.some(v=>v>160),'litter lost its filtered edge and folded center');
});
test('biome details are bounded, finite, grounded and clear of rewards, bridges and hazard warnings',()=>{
 for(const id of ['forest','snow','ash','sand','coast'])for(let seed=1;seed<=5;seed++){
  const w=buildWorld(id,seed);assert(w.scenery.records.length>35,id);assert(w.scenery.batches.length<=3);const matrix=new T.Matrix4();let instances=0;
  for(const m of w.scenery.batches){instances+=m.count;assert(m.isInstancedMesh&&!m.castShadow);for(let i=0;i<m.count;i++){m.getMatrixAt(i,matrix);assert(matrix.elements.every(Number.isFinite));assert(matrix.elements[13]>=0&&matrix.elements[13]<.4);}}assert(instances<3700);
  for(const p of w.scenery.records)assert(sceneryAllowed(w,p.x,p.z),id+' invalid decoration placement');
  assert(w.ground.userData.ownedGeometry&&w.ground.material.vertexColors);const colors=w.ground.geometry.attributes.color;assert.equal(colors.count,w.ground.geometry.attributes.position.count);assert([...colors.array].every(v=>Number.isFinite(v)&&v>.3&&v<1.4));dispose(w);
 }
});
test('plants stay below the fighting plane and snow accumulation follows a consistent wind',()=>{
 const matrix=new T.Matrix4(),size=new T.Vector3();
 for(const id of['forest','snow','sand','coast']){
  const w=buildWorld(id,7);let snowDirection;
  for(const batch of w.scenery.batches){
   const kind=batch.userData.biomeDetail;
   if(['frond','leaf'].includes(kind)){
    batch.geometry.computeBoundingBox();const bounds=batch.geometry.boundingBox;
    assert.equal(bounds.min.y,0,'plants lost their grounded stems');
    for(let i=0;i<batch.count;i++){batch.getMatrixAt(i,matrix);size.setFromMatrixScale(matrix);assert(bounds.max.y*size.y+matrix.elements[13]<1.05,'detail obscures actors');}
   }
   if(kind==='snow')for(let i=0;i<batch.count;i++){
    batch.getMatrixAt(i,matrix);const direction=new T.Vector3(matrix.elements[8],0,matrix.elements[10]).normalize();
    snowDirection??=direction;assert(direction.dot(snowDirection)>.9999,'snow drifts contradict the shared wind');
   }
  }
  if(id==='forest'){const fronds=w.scenery.batches.find(m=>m.userData.biomeDetail==='frond');assert(fronds.count<=w.scenery.records.length*4,'forest floor became dense grass');assert(fronds.geometry.index.count<=96,'fern detail exceeds its triangle budget');}
  dispose(w);
 }
});
test('biomes use distinct detail silhouettes and reuse GPU materials on restart',()=>{
 const expected={forest:'frond',snow:'ice',ash:'chip',sand:'leaf',coast:'wood'};
 for(const [id,kind]of Object.entries(expected)){const a=buildWorld(id,19),b=buildWorld(id,19);assert(a.scenery.batches.some(m=>m.userData.biomeDetail===kind));assert.deepEqual(a.scenery.records,b.scenery.records);assert.deepEqual(a.obstacles.map(o=>[o.x,o.z]),b.obstacles.map(o=>[o.x,o.z]));for(const m of a.scenery.batches){const other=b.scenery.batches.find(n=>n.userData.biomeDetail===m.userData.biomeDetail);assert.strictEqual(m.geometry,other.geometry);assert.strictEqual(m.material,other.material);}dispose(a);dispose(b);}
});
test('snow mounds bury their outer rim below the terrain and remain low opaque caps',()=>{
 const w=buildWorld('snow',7),snow=w.scenery.batches.find(m=>m.userData.biomeDetail==='snow'),geometry=snow.geometry,p=geometry.attributes.position,matrix=new T.Matrix4(),point=new T.Vector3();
 geometry.computeBoundingBox();assert(geometry.index.count/3<=80);assert(!snow.material.transparent);
 const bottom=geometry.boundingBox.min.y,rim=[];for(let i=0;i<p.count;i++)if(Math.abs(p.getY(i)-bottom)<1e-5)rim.push(i);assert(rim.length>=8,'snow lost its complete buried perimeter');
 for(let i=0;i<snow.count;i++){
  snow.getMatrixAt(i,matrix);
  for(const vertex of rim){point.fromBufferAttribute(p,vertex).applyMatrix4(matrix);assert(point.y<w.ground.position.y-.01,'snow exposes a raised edge or underside');}
  point.set(0,geometry.boundingBox.max.y,0).applyMatrix4(matrix);assert(point.y>0&&point.y<.2,'snow cap is too tall or fully buried');
 }
 dispose(w);
});
test('natural ground cover stays within the previous per-biome geometry budgets',()=>{
 const budgets={forest:68368,snow:150218,ash:116088,sand:162870,coast:123792};
 for(const[id,triangles]of Object.entries(budgets)){
  const w=buildWorld(id,7),drawn=w.scenery.batches.reduce((n,m)=>n+m.count*(m.geometry.index?.count??m.geometry.attributes.position.count)/3,0);
  assert(drawn<=triangles,id+' ground detail triangle budget grew');
  for(const m of w.scenery.batches){assert(!m.material.transparent);assert(!Array.isArray(m.material),'material groups multiply detail draws');}
  if(id==='forest'){
   const fronds=w.scenery.batches.find(m=>m.userData.biomeDetail==='frond'),matrix=new T.Matrix4(),cover=w.scenery.records.map(()=>0);
   for(let i=0;i<fronds.count;i++){fronds.getMatrixAt(i,matrix);const x=matrix.elements[12],z=matrix.elements[14];let nearest=0,distance=Infinity;w.scenery.records.forEach((p,j)=>{const d=(p.x-x)**2+(p.z-z)**2;if(d<distance){nearest=j;distance=d;}});cover[nearest]++;}
   assert(cover.some(n=>n===2)&&cover.some(n=>n===4),'forest clusters lost their sparse and sheltered variation');
  }
  dispose(w);
 }
});
test('confluence plants retain their own wind and tide response through the full animation update',()=>{
 const w=buildWorld('confluence',7),motion=id=>w.regions.find(r=>r.id===id).scenery.batches.filter(m=>m.material.userData.motion);
 assert.notStrictEqual(motion('sand')[0].material,motion('coast')[0].material,'separate climates share a mutable gust');
 w.sandstorm={strength:1};w.tide={high:true};
 for(const activeBiome of['forest','sand','coast']){
  w.activeBiome=activeBiome;animateWorld(w,12,8,-5);
  for(const id of['forest','snow','sand','coast'])for(const m of motion(id)){
   const p=m.material.userData.motion;assert.equal(p.gust.value,id==='sand'?2.8:id==='coast'?1.3:1);assert.equal(p.clock.value,12);assert.deepEqual(p.focus.value.toArray(),[8,-5]);
  }
 }
 w.sandstorm.strength=0;w.tide.high=false;animateWorld(w,13,8,-5);
 for(const id of['forest','snow','sand','coast'])for(const m of motion(id))assert.equal(m.material.userData.motion.gust.value,1,'weather motion did not settle');
 dispose(w);
});
test('groves leave spawn, all rewards and broad cross-map routes connected',()=>{
 for(const id of ['forest','snow'])for(let seed=1;seed<=6;seed++){
  const w=buildWorld(id,seed),bound=w.half-1,size=bound*2+1,seen=new Set(),cell=(x,z)=>[Math.round(x+bound),Math.round(z+bound)],start=cell(w.spawn.x,w.spawn.z),queue=[start];seen.add(start.join(','));
  for(let i=0;i<queue.length;i++){const [x,z]=queue[i];for(const[dx,dz]of[[1,0],[-1,0],[0,1],[0,-1]]){const nx=x+dx,nz=z+dz,key=nx+','+nz;if(nx<0||nz<0||nx>=size||nz>=size||seen.has(key)||!clearAt(w,nx-bound,nz-bound,.45))continue;seen.add(key);queue.push([nx,nz]);}}
  for(const s of w.sites)assert(seen.has(cell(s.x,s.z).join(',')),id+' blocked reward');assert(seen.size>size*size*.85);dispose(w);
 }
});

test('expanded scenery reaches new map edges without adding detail batches or flooding rotated banks',()=>{
 for(const id of['forest','snow','ash','sand','coast'])for(let seed=1;seed<=5;seed++){
  const w=buildWorld(id,seed);assert(w.scenery.records.some(p=>Math.max(Math.abs(p.x),Math.abs(p.z))>82),id+' empty outer area');
  if(id==='coast')updateTide(w,21);const matrix=new T.Matrix4();
  for(const batch of w.scenery.batches)for(let i=0;i<batch.count;i++){batch.getMatrixAt(i,matrix);const x=matrix.elements[12],z=matrix.elements[14];assert(sceneryAllowed(w,x,z),id+' detail clipped safe area');assert(!w.bridges?.some(b=>bridgeContains(b,x,z)),id+' decoration on bridge');}
  dispose(w);
 }
});

test('all four harbor landmarks are built on dry ground with rotated collision and clear approaches',()=>{
 for(let seed=1;seed<=12;seed++){
  const w=buildWorld('coast',seed);assert.deepEqual(w.districts.map(d=>d.kind).sort(),['beacon','dock','warehouse','wreck']);updateTide(w,21);
  for(const district of w.districts){const parts=w.obstacles.filter(o=>o.mesh.userData.district===district.kind);assert(parts.length>=3,'missing '+district.kind);for(const o of parts){assert(w.ponds.every(p=>waterDepth(p,o.x,o.z)===0));assert(!w.bridges.some(b=>bridgeContains(b,o.x,o.z,o.r+.9)));assert(Math.abs(o.mesh.rotation.y-district.angle)<.0001);}}
  const details=w.group.children.filter(m=>m.userData.districtDetail);assert(details.length<=2);assert(details.reduce((n,m)=>n+m.count,0)<350);dispose(w);
 }
});

test('the existing route centers remain free of low cover in local maps and the connected world',()=>{
 const matrix=new T.Matrix4(),point=new T.Vector3(),closest=new T.Vector3();
 for(const id of['forest','snow','ash','sand','coast','confluence']){
  const w=buildWorld(id,7),paths=w.road?[w.road]:w.sites.filter(s=>s.trail).map(s=>{
   const p=s.trail.geometry.attributes.position,path=[];
   for(let i=0;i<p.count;i+=4)path.push({x:(p.getX(i+1)+p.getX(i+2))*.5,z:(p.getZ(i+1)+p.getZ(i+2))*.5});
   return path;
  }),segments=paths.flatMap(path=>path.slice(1).map((b,i)=>new T.Line3(new T.Vector3(path[i].x,0,path[i].z),new T.Vector3(b.x,0,b.z))));
  let campDetails=0;
  for(const batch of w.scenery.batches)for(let i=0;i<batch.count;i++){
   batch.getMatrixAt(i,matrix);point.set(matrix.elements[12],0,matrix.elements[14]);
   assert(segments.every(line=>line.closestPointToPoint(point,true,closest).distanceToSquared(point)>=1.45**2-1e-4),id+' cover entered a route center');
   const distance=Math.hypot(point.x-w.spawn.x,point.z-w.spawn.z);if(distance>3.5&&distance<11)campDetails++;
  }
  if(id!=='confluence')assert(campDetails>=6,id+' camp shoulders are empty');
  dispose(w);
 }
});

test('bank leaves and forest fronds have rooted color gradients and folded, curved surfaces',()=>{
 for(const id of['forest','sand','coast']){
  const w=buildWorld(id,7),batch=w.scenery.batches.find(m=>m.userData.biomeDetail===(id==='forest'?'frond':'leaf')),g=batch.geometry,p=g.attributes.position,c=g.attributes.color;
  assert(batch.material.vertexColors);assert.equal(c.count,p.count);assert([...c.array].every(v=>Number.isFinite(v)&&v>.5&&v<1.1));
  assert(Math.max(...c.array)-Math.min(...c.array)>.2,'leaves lost their shaded root and lighter tip');
  assert(g.index.count/3<=(id==='forest'?30:16),'plant silhouette exceeded its small shared mesh');
  if(id!=='forest'){
   assert(p.getY(7)>p.getY(6),'leaf midrib is flat');
   assert(p.getY(p.count-2)<p.getY(10),'leaf tip no longer curves down');
  }
  dispose(w);
 }
});
