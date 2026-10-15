import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import * as T from '../vendor/three.module.js';
import {buildWorld} from '../world.js';
import {installForestVista} from '../forest-vista.js';
import {installForestHabitats} from '../forest-habitats.js';
import {installBiomePlaces} from '../biome-places.js?v=208';
import {installEnvironmentClusters} from '../environment-clusters.js?v=208';
import {installExplorationRoutes} from '../exploration-routes.js';
import {bridgeContains} from '../coast.js';
import {waterDepth} from '../water.js';
import {segmentDistance} from '../rules.js';
import {naturalRockGeometry} from '../biome-scenery.js?v=208';

globalThis.document={createElement:()=>({getContext:()=>({fillRect(){}})})};
const maps=['forest','snow','ash','sand','coast','confluence'];
const create=(id,seed)=>{const w=buildWorld(id,seed);installForestVista(w,id);installForestHabitats(w,id);installBiomePlaces(w,id);return w;};
const cleanup=w=>w.group.traverse(o=>{if(o.isInstancedMesh)o.dispose();if(o.userData.ownedGeometry)o.geometry.dispose();});
const gameplay=w=>JSON.stringify({spawn:w.spawn,sites:w.sites.map(s=>[s.x,s.z,s.type,s.event,s.availableAt,s.claimed,s.discovered,s.mesh.visible,s.trail.visible]),patches:w.patches.map(p=>[p.x,p.z,p.rx,p.rz,p.r,p.kind]),breakables:w.breakables.map(p=>[p.x,p.z,p.state]),roads:w.road,places:w.biomePlaces.map(p=>[p.x,p.z,p.angle,p.entrance,p.exit])});
const records=s=>s.records.map(({obstacle,...p})=>p);

test('all biomes compose deterministic open-sided place groups, actual trail shoulders and sparse groves',()=>{
 for(const id of maps)for(const seed of[7,522,43837033]){
  const w=create(id,seed),copy=create(id,seed),state=installEnvironmentClusters(w,id),other=installEnvironmentClusters(copy,id),lines=[];
  assert.deepEqual(records(state),records(other),id+' seed '+seed+' layout is not repeatable');
  if(w.road)for(let i=1;i<w.road.length;i++)lines.push({a:w.road[i-1],b:w.road[i],width:5.8});
  for(const site of w.sites){const p=site.trail.geometry.attributes.position;let previous;for(let i=0;i+3<p.count;i+=4){const next={x:(p.getX(i+1)+p.getX(i+2))/2,z:(p.getZ(i+1)+p.getZ(i+2))/2};if(previous)lines.push({a:previous,b:next,width:2});previous=next;}}
  for(const biome of w.regions?.map(r=>r.id)||[id]){
   const local=state.records.filter(r=>r.biome===biome),attached=local.filter(r=>r.composition==='place'),shoulders=local.filter(r=>r.composition==='shoulder');
   assert(attached.length>=(w.regions?3:4),biome+' scenery is still scattered away from its places');
   assert(shoulders.length>=1,biome+' has no actual trail-side scenery');
   assert.equal(local.filter(r=>r.composition==='grove').length,2,'retain a sparse grove allowance rather than making one solid corridor');
   for(const r of attached){
    const p=w.biomePlaces[r.anchorIndex],c=Math.cos(p.angle),s=Math.sin(p.angle),dx=r.x-p.x,dz=r.z-p.z,u=c*dx-s*dz,v=s*dx+c*dz;
    assert.equal(p.biome,biome);assert(Math.abs(u)>9.4+r.footprint+1.29&&Math.abs(u)<9.4+r.footprint+4.11,'cluster lost its place shoulder');assert(Math.abs(v)<7,'cluster closed a place entrance or exit');
    assert(Math.abs(r.angle-p.angle)<(biome==='coast'||biome==='sand'?.141:.451),'cargo or strata no longer follow the place orientation');
    assert(attached.filter(q=>q.anchorIndex===r.anchorIndex).length<=3,'one place consumed the whole map budget');
   }
   for(const r of shoulders)assert(lines.some(l=>{const d=segmentDistance(r.x,r.z,l.a.x,l.a.z,l.b.x,l.b.z);return d>=l.width+r.footprint+1.49&&d<=l.width+r.footprint+3.91;}),'shoulder is not beside an actual rendered trail');
  }
  cleanup(w);cleanup(copy);
 }
});

test('forest saplings and shrubs use small attached leaves instead of flattened adult crowns',()=>{
 const w=create('forest',7),state=installEnvironmentClusters(w,'forest'),point=new T.Vector3(),base=new T.Vector3(),closest=new T.Vector3(),tip=new T.Vector3(),box=new T.Box3(),size=new T.Vector3();
 assert.equal(state.draws,6);assert(state.triangles<=2244*14);
 for(const variant of[0,1]){
  const parts=state.group.children.filter(o=>o.isInstancedMesh&&o.name.startsWith('SM_Cluster_forest_'+variant+'_'));
  assert.equal(parts.length,3);assert(parts.reduce((n,o)=>n+o.geometry.index.count/3,0)<=2244);
  const leaves=parts.find(o=>o.material.map),wood=parts.find(o=>o.geometry.attributes.treeSurface?.getX(0)===0),g=leaves.geometry,p=g.attributes.position,uv=g.attributes.uv,image=leaves.material.map.image;
  assert.strictEqual(leaves.material,w.foliage[0].leaf.material,'undergrowth allocated a separate tree material/atlas');
  assert.equal(p.count%6,0);assert(p.count/6>=140&&p.count/6<=200);assert.equal(g.index.count/3,p.count,'large spray sheets remain underneath the individual leaves');
  const wp=wood.geometry.attributes.position,wi=wood.geometry.index,triangles=[];
  for(let i=0;i<wi.count;i+=3)triangles.push(new T.Triangle(new T.Vector3().fromBufferAttribute(wp,wi.getX(i)),new T.Vector3().fromBufferAttribute(wp,wi.getX(i+1)),new T.Vector3().fromBufferAttribute(wp,wi.getX(i+2))));
  let low=0,high=0;
  for(let i=0;i<p.count;i+=6){
   base.fromBufferAttribute(p,i);tip.fromBufferAttribute(p,i+3);assert(base.distanceTo(tip)>.08&&base.distanceTo(tip)<.16,'leaf lost its centimetre-scale blade');
   box.makeEmpty();for(let j=0;j<6;j++)box.expandByPoint(point.fromBufferAttribute(p,i+j));assert(box.getSize(size).length()<.18,'leaf returned to a broad canopy card');
   let distance=Infinity;for(const triangle of triangles){triangle.closestPointToPoint(base,closest);distance=Math.min(distance,base.distanceTo(closest));}
   assert(distance<.045,'leaf floats away from its supporting twig');
   low+=Number(base.y<.8);high+=Number(base.y>1);
   for(let j=0;j<6;j++){
    const x=Math.floor(uv.getX(i+j)*image.width),y=Math.floor(uv.getY(i+j)*image.height);assert.equal(image.data[(y*image.width+x)*4+3],255,'leaf samples a transparent atlas pixel');
   }
  }
  assert(low>=40&&high>=100,'two low shrubs or the taller sapling disappeared');
  assert(g.boundingBox.max.y-g.boundingBox.min.y>1.9,'foliage has been flattened into a ground sheet');
 }
 cleanup(w);
});

test('forest stones have low fractured mineral faces, buried bases and the unchanged triangle budget',()=>{
 const w=create('forest',7),state=installEnvironmentClusters(w,'forest'),a=new T.Vector3(),b=new T.Vector3(),c=new T.Vector3();
 const rocks=state.group.children.filter(o=>o.isInstancedMesh&&o.material.userData.propSurface==='stone-placed');
 assert.equal(rocks.length,2,'each forest variant should retain one shared rock batch');
 for(const mesh of rocks){
  const g=mesh.geometry,p=g.attributes.position,n=g.attributes.normal,color=g.attributes.color,index=g.index;
  assert.equal(index.count/3,240,'the two low stones exceeded their original 120 triangles each');
  assert(g.boundingBox.max.y<.43,'the soft olive-shaped domes returned');
  for(let fragment=0;fragment<2;fragment++){
   let bottom=Infinity,top=-Infinity,mossVertices=0,minTint=Infinity,maxTint=0;const faces=[];
   for(let i=fragment*360;i<(fragment+1)*360;i+=3){
    const ia=index.getX(i),ib=index.getX(i+1),ic=index.getX(i+2);
    a.fromBufferAttribute(p,ia);b.fromBufferAttribute(p,ib);c.fromBufferAttribute(p,ic);
    const normal=new T.Vector3().crossVectors(b.clone().sub(a),c.clone().sub(a)).normalize();
    if(Math.min(a.y,b.y,c.y)>.24&&normal.y>.7)faces.push(normal);
    for(const v of[ia,ib,ic]){
     bottom=Math.min(bottom,p.getY(v));top=Math.max(top,p.getY(v));
     const r=color.getX(v),green=color.getY(v),blue=color.getZ(v);
     minTint=Math.min(minTint,r);maxTint=Math.max(maxTint,r);
     assert(green>=blue&&green/r<1.12,'stone lost its muted mineral palette');
     if(green>r){mossVertices++;assert(p.getY(v)<.30,'moss has covered the exposed upper fracture');}
     assert(Math.abs(Math.hypot(n.getX(v),n.getY(v),n.getZ(v))-1)<.00001,'fracture normal is invalid');
    }
   }
   assert(bottom<-.035&&bottom>-.06,'stone base must still sit below the actual -.03 ground');
   assert(top>.28&&top<.43,'stone should have a low visible broken crown');
   assert(mossVertices<360*.05,'localized damp moss became an all-over green coating');
   assert(maxTint-minTint>.04,'mineral strata and damp lower-face variation disappeared');
   assert(faces.some(normal=>faces.filter(other=>normal.dot(other)>.9999).length>=6),'upper surface should contain a broad real fracture face, not just a recolored sphere');
  }
  let difference=0;
  for(let i=0;i<360;i++)difference+=((p.getX(i)+.42)/.78-(p.getX(i+360)-.65)/.59)**2+((p.getY(i)-.21)/.35-(p.getY(i+360)-.16)/.27)**2+((p.getZ(i)-.27)/.69-(p.getZ(i+360)+.24)/.50)**2;
  assert(Math.sqrt(difference/360)>.08,'the slab and wedge returned to two scaled copies of one pebble');
 }
 cleanup(w);
});

test('fracture shapes reuse the existing scanned stone finish and retain the original cargo geometry',()=>{
 const baseline={coast:'2f190ba9372a365c596649e469009934454811f1e7cb822752c6505eae9e84a4'};
 const forest=create('forest',7),state=installEnvironmentClusters(forest,'forest'),material=state.group.children.find(o=>o.material?.userData.propSurface==='stone-placed').material;
 for(const id of ['snow','ash','sand','coast']){
  const w=create(id,7),other=installEnvironmentClusters(w,id),hash=createHash('sha256');
  for(const mesh of other.group.children.filter(o=>o.isInstancedMesh)){
   if(mesh.material.userData.propSurface==='stone-placed')assert.strictEqual(mesh.material,material,'forest allocated its own scanned stone material');
   for(const name of Object.keys(mesh.geometry.attributes).sort()){
    const a=mesh.geometry.attributes[name];hash.update(name);hash.update(Buffer.from(a.array.buffer,a.array.byteOffset,a.array.byteLength));
   }
   hash.update(Buffer.from(mesh.geometry.index.array.buffer));
  }
  const result=hash.digest('hex');if(baseline[id])assert.equal(result,baseline[id],id+' geometry, normals or surface colors changed');cleanup(w);
 }
 cleanup(forest);
});

test('six maps add broad, distinct midground groups within one-pass rendering and collision budgets',()=>{
 for(const id of maps)for(const seed of[7,522,43837033]){
  const w=create(id,seed),before=gameplay(w),original=w.obstacles.slice(),matrices=original.map(o=>[o.mesh.position.toArray(),o.mesh.rotation.toArray(),o.mesh.scale.toArray()]),foliage=w.foliage.slice();
  const state=installEnvironmentClusters(w,id);assert.strictEqual(w.environmentClusters,state);assert.strictEqual(installEnvironmentClusters(w,id),state);
  assert.equal(gameplay(w),before);assert.deepEqual(w.foliage,foliage);assert.deepEqual(w.obstacles.slice(0,original.length),original);assert.deepEqual(original.map(o=>[o.mesh.position.toArray(),o.mesh.rotation.toArray(),o.mesh.scale.toArray()]),matrices);
  assert.equal(state.records.length,id==='confluence'?30:14);assert.equal(w.obstacles.length-original.length,state.records.length);assert(state.records.length<=50);
  assert(state.draws<=(id==='confluence'?35:10));assert(state.triangles<40000,id+' triangles '+state.triangles);
  assert.equal(state.group.children.filter(o=>o.isInstancedMesh).length,state.draws);
  for(const r of state.records){
   assert(r.height>=1&&r.height<=3);assert(r.footprint>1.1&&r.footprint<2.1);assert.equal(r.obstacle.sceneryHeight,r.height);assert(r.obstacle.mesh.parent===state.group);
   if(w.regions){const scope=w.regions.find(s=>s.id===r.biome);assert(scope.obstacles.includes(r.obstacle));assert(scope.contains(r.x,r.z));assert.equal(state.records.filter(p=>p.biome===r.biome).length,6);}
  }
  const distances=state.records.map(r=>Math.hypot(r.x-w.spawn.x,r.z-w.spawn.z));assert(Math.max(...distances)>30,'clusters only frame the spawn');
  cleanup(w);
 }
});

test('whole cluster footprints protect roads, high water, crossings, rewards, places and tactical objects',()=>{
 for(const id of maps)for(const seed of[19,43837033]){
  const w=create(id,seed),old=w.obstacles.slice(),state=installEnvironmentClusters(w,id);
  const water=w.ponds.map(p=>{const k=p.baseRx===undefined?1:1.19;return{...p,rx:(p.baseRx??p.rx)*k,rz:(p.baseRz??p.rz)*k};});
  const clearings=[{...w.spawn,r:7},...(w.regions||[]).map(s=>({...s,r:7})),...w.sites.map(s=>({...s,r:s.event?8:5})),...w.discoveries.flatMap(d=>[{...d,r:5},...(d.nodes||[]).map(p=>({...p,r:4.5}))])];
  const crossings=[...(w.bridges||[]),...(w.fords||[]).map(f=>({...f,width:f.half*2,length:f.width}))];
  for(const r of state.records){
   for(const p of clearings)assert(Math.hypot(r.x-p.x,r.z-p.z)>=r.footprint+p.r);
   for(const o of old)assert(Math.hypot(r.x-o.x,r.z-o.z)>=r.footprint+o.r+1.04,'cluster pinches an old obstacle');
   for(const other of state.records)if(other!==r)assert(Math.hypot(r.x-other.x,r.z-other.z)>=r.footprint+other.footprint+2,'clusters join into an impassable continuous wall');
   for(const b of crossings)assert(!bridgeContains(b,r.x,r.z,r.footprint+1.19));
   for(const p of w.biomePlaces){const c=Math.cos(p.angle),s=Math.sin(p.angle),dx=r.x-p.x,dz=r.z-p.z;assert(Math.abs(c*dx-s*dz)>=9.4+r.footprint+.34||Math.abs(s*dx+c*dz)>=8.4+r.footprint+.34);}
   for(const p of w.patches)if(p.kind==='vent')assert(Math.hypot(r.x-p.x,r.z-p.z)>r.footprint+p.r+1.49);
   for(let n=0;n<24;n++){const a=n/24*Math.PI*2,x=r.x+Math.cos(a)*r.footprint,z=r.z+Math.sin(a)*r.footprint;for(const p of water)assert.equal(waterDepth(p,x,z),0,'cluster enters the high-tide water');}
   if(w.road)for(let i=1;i<w.road.length;i++)assert(segmentDistance(r.x,r.z,w.road[i-1].x,w.road[i-1].z,w.road[i].x,w.road[i].z)>=5.8+r.footprint);
   for(const site of w.sites){const a=site.trail.geometry.attributes.position;let previous;for(let i=0;i+3<a.count;i+=4){const p={x:(a.getX(i+1)+a.getX(i+2))/2,z:(a.getZ(i+1)+a.getZ(i+2))/2};if(previous)assert(segmentDistance(r.x,r.z,previous.x,previous.z,p.x,p.z)>=2+r.footprint);previous=p;}}
  }
  cleanup(w);
 }
});

test('every rendered vertex is inside its registered cylinder and finite owned batches clean up independently',()=>{
 const point=new T.Vector3(),instance=new T.Matrix4(),source=naturalRockGeometry.attributes.position.array.slice();let sharedDisposals=0;const shared=()=>sharedDisposals++;naturalRockGeometry.addEventListener('dispose',shared);
 for(const id of maps){
  const a=create(id,43837033),b=create(id,522),state=installEnvironmentClusters(a,id),other=installEnvironmentClusters(b,id),counts=new Map();
  for(const batch of state.group.children.filter(o=>o.isInstancedMesh)){
   assert(batch.userData.ownedGeometry&&batch.castShadow&&batch.receiveShadow);assert(!batch.material.transparent);assert(!batch.isLight);
   for(const attr of Object.values(batch.geometry.attributes))assert(attr.array.every(Number.isFinite));
   counts.set(batch.geometry,0);batch.geometry.addEventListener('dispose',()=>counts.set(batch.geometry,counts.get(batch.geometry)+1));
   const p=batch.geometry.attributes.position;
   for(let i=0;i<batch.count;i++){
    batch.getMatrixAt(i,instance);const center=new T.Vector3().setFromMatrixPosition(instance),record=state.records.find(r=>Math.hypot(r.x-center.x,r.z-center.z)<.0001);assert(record);
    for(let n=0;n<p.count;n++){point.fromBufferAttribute(p,n).applyMatrix4(instance);assert(point.y<=record.height+.00001);assert(Math.hypot(point.x-record.x,point.z-record.z)<record.footprint+.00001,'visual exceeds collision envelope');}
   }
  }
  cleanup(a);assert([...counts.values()].every(n=>n===1));assert(state.group.children.filter(o=>o.isInstancedMesh).every(o=>!o.visible));assert(other.group.children.filter(o=>o.isInstancedMesh).every(o=>o.visible));assert.equal(sharedDisposals,0);cleanup(b);
 }
 naturalRockGeometry.removeEventListener('dispose',shared);assert.deepEqual(naturalRockGeometry.attributes.position.array,source);
});

test('routes remain navigable after clusters register their real collision footprints',()=>{
 for(const id of maps)for(const seed of[7,43837033]){
  const w=create(id,seed),state=installEnvironmentClusters(w,id),routes=installExplorationRoutes(w);
  for(const route of routes){
   assert(route.points.length>=2,id+' seed '+seed+' no longer has a full route');
   for(let i=1;i<route.points.length;i++)for(const r of state.records)assert(segmentDistance(r.x,r.z,route.points[i-1].x,route.points[i-1].z,route.points[i].x,route.points[i].z)>r.footprint+.55);
  }
  cleanup(w);
 }
});

test('placement is independent of global randomness, and sealed worlds skip without adding scene resources',()=>{
 const a=create('coast',7),b=create('coast',7),old=Math.random;
 try{Math.random=()=>.11;const first=installEnvironmentClusters(a,'coast');Math.random=()=>.89;const second=installEnvironmentClusters(b,'coast');assert.deepEqual(records(first),records(second));}finally{Math.random=old;cleanup(a);cleanup(b);}
 const w=create('forest',7),children=w.group.children.length,obstacles=w.obstacles.length;w.patches.push({x:0,z:0,r:1000,kind:'vent'});const none=installEnvironmentClusters(w,'forest');assert.equal(none.records.length,0);assert.equal(none.group,null);assert.equal(w.group.children.length,children);assert.equal(w.obstacles.length,obstacles);cleanup(w);
 assert.equal(installEnvironmentClusters({},'unsupported'),null);
});


test('young-tree leaf UVs use the stable atlas sample across asynchronous texture replacement',()=>{
 const world=create('forest',7),state=installEnvironmentClusters(world,'forest');let checked=0;
 for(const batch of state.group.children){if(batch.material?.name!=='shared-cutout-leaves')continue;const uv=batch.geometry.attributes.uv;assert(uv&&uv.count>0);assert([...uv.array].every(value=>value===.5));checked++;}
 assert(checked>0);cleanup(world);
});
