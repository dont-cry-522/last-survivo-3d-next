import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../vendor/three.module.js';
import {buildWorld} from '../world.js';
import {installForestVista} from '../forest-vista.js';
import {installForestHabitats,forestHabitatAt} from '../forest-habitats.js';
import {installHabitatDetail} from '../adventure-ground-detail.js';
globalThis.document={createElement:()=>({getContext:()=>({fillRect(){}})})};

test('forest districts preserve seeded gameplay, shared assets and destructible trees',()=>{
 for(const map of ['forest','confluence','snow','ash','sand','coast'])for(const seed of [7,522,43837033]){
  const w=buildWorld(map,seed);installForestVista(w,map);
  const before=JSON.stringify({o:w.obstacles.map(o=>[o.x,o.z,o.r]),sites:w.sites.map(s=>[s.x,s.z,s.type]),spawn:w.spawn});
  const protectedMeshes=w.obstacles.filter(o=>w.breakables.includes(o)||o.mesh.userData.treeBiome!=='forest').flatMap(o=>o.mesh.children.map(m=>[m,m.scale.toArray(),m.position.toArray()]));
  const meshes=[];w.group.traverse(m=>{if(m.isMesh)meshes.push(m);});const geometry=meshes.map(m=>m.geometry),materials=meshes.map(m=>m.material);
  const h=installForestHabitats(w,map);assert.equal(JSON.stringify({o:w.obstacles.map(o=>[o.x,o.z,o.r]),sites:w.sites.map(s=>[s.x,s.z,s.type]),spawn:w.spawn}),before);
  for(const[m,scale,position]of protectedMeshes){assert.deepEqual(m.scale.toArray(),scale);assert.deepEqual(m.position.toArray(),position);}
  assert(meshes.every((m,i)=>m.geometry===geometry[i]||m.name==='tree-trunk'&&m.parent.userData.forestHabitat&&m.userData.ownedGeometry));assert.deepEqual(meshes.map(m=>m.material),materials);
  if(!['forest','confluence'].includes(map)){assert.equal(h,null);continue;}
  assert(h.elder&&h.groves.length&&h.ponds.length);assert(h.trees>5);assert.equal(installForestHabitats(w,map),h);
  assert(w.obstacles.some(o=>o.mesh.userData.forestHabitat==='thicket'));
  for(const p of[h.relic,...h.groves,...h.ponds]){const a=forestHabitatAt(w,p.x,p.z),b=forestHabitatAt(w,p.x+.001,p.z);for(const k of['shade','bank','ruin']){assert(a[k]>=0&&a[k]<=1);assert(Math.abs(a[k]-b[k])<.002);}}
  if(map==='confluence')assert.deepEqual(forestHabitatAt(w,78,24),{shade:0,bank:0,ruin:0});
  const layer=installHabitatDetail(w,map),box=new T.Box3(),matrix=new T.Matrix4();assert(layer.children.length<=16);
  assert(layer.userData.records.some(p=>p.biome==='forest'&&p.kind==='reed'));
  for(const m of layer.children)for(let i=0;i<m.count;i++){
   m.getMatrixAt(i,matrix);box.copy(m.geometry.boundingBox).applyMatrix4(matrix);
   const p=layer.userData.records.find(p=>Math.abs(p.x-matrix.elements[12])+Math.abs(p.z-matrix.elements[14])<1e-4);assert(p);
   if(p.landscapeHeight){
    assert(['shrub','reed'].includes(p.kind)&&p.landscape,'only grouped soft cover may form the middle layer');
    assert(box.max.y<1.25&&Math.abs(box.max.y-p.landscapeHeight)<1e-5,'middle layer escaped its measured height');
    assert(Math.hypot(p.x-w.spawn.x,p.z-w.spawn.z)>=10,'middle layer crowds the opening clearing');
   }else assert(box.max.y<.7,'ordinary habitat blocks combat sightline');
  }
  w.group.traverse(m=>{if(m.isInstancedMesh)m.dispose();if(m.userData.ownedGeometry)m.geometry.dispose();});assert(layer.userData.disposed);
 }
});

test('ordinary habitat crowns keep their twigs connected without widening roots or leaking shared geometry',()=>{
 for(const map of['forest','confluence'])for(const seed of[7,522,43837033]){
  const w=buildWorld(map,seed);installForestVista(w,map);
  const originals=new Map(w.obstacles.filter(o=>o.mesh.getObjectByName('tree-canopy')).map(o=>{
   const trunk=o.mesh.getObjectByName('tree-trunk'),canopy=o.mesh.getObjectByName('tree-canopy');
   return[o,{geometry:trunk.geometry,p:trunk.geometry.attributes.position,y:trunk.scale.y,base:canopy.position.y,crownScale:canopy.scale.clone(),material:trunk.material}];
  }));
  const shared=new Map([...originals.values()].map(old=>[old.geometry,old.p.array.slice()])),h=installForestHabitats(w,map),owned=[];
  w.group.updateMatrixWorld(true);
  let tips=0,roots=0,thickets=0,bytes=0,vertices=0;
  for(const[o,old]of originals){
   if(!o.mesh.userData.forestHabitat||o===h.elder)continue;
   const trunk=o.mesh.getObjectByName('tree-trunk'),canopy=o.mesh.getObjectByName('tree-canopy'),p=trunk.geometry.attributes.position;
   const{shade,bank,ruin}=forestHabitatAt(w,o.x,o.z),height=1+shade*.17-bank*.04,width=1+shade*.34-ruin*.18-bank*.12,stretch=1+shade*.12;
   assert.equal(trunk.material,old.material);assert.equal(o.mesh.children.length,2);
   assert(Math.abs(trunk.scale.y-old.y*height)<1e-10);assert(Math.abs(canopy.position.y-old.base*height)<1e-10);
   assert(Math.abs(canopy.scale.x-old.crownScale.x*width)<1e-10);assert(Math.abs(canopy.scale.y-old.crownScale.y*stretch)<1e-10);
   assert.notEqual(trunk.geometry,old.geometry);assert(trunk.userData.ownedGeometry);owned.push(trunk.geometry);
   thickets+=o.mesh.userData.forestHabitat==='thicket'?1:0;
   for(let i=0;i<p.count;i++){
    const y=old.p.getY(i);
    if(y<=1.8){assert(Math.abs(p.getX(i)-old.p.getX(i))<1e-7);assert(Math.abs(p.getY(i)-y)<1e-7);assert(Math.abs(p.getZ(i)-old.p.getZ(i))<1e-7);roots++;}
   }
   const template=canopy.userData.treeTemplate,start=p.count-template.sprays.length*11;
   for(const[i,[x,y,z,,,height]]of template.sprays.entries()){
    const tip=trunk.localToWorld(new T.Vector3().fromBufferAttribute(p,start+i*11+10)),target=canopy.localToWorld(new T.Vector3(x,y+height*.24-template.bottom,z));
    assert(tip.distanceTo(target)<1e-5,'terminal twig detaches from its actual leaf spray, including low or ruin-thinned crowns');tips++;
   }
   assert(trunk.geometry.boundingBox&&Number.isFinite(trunk.geometry.boundingSphere.radius));
   vertices+=p.count;bytes+=Object.values(trunk.geometry.attributes).reduce((n,a)=>n+a.array.byteLength,0)+(trunk.geometry.index?.array.byteLength||0);
  }
  assert(thickets>0&&tips>100&&roots>100);assert(vertices<100000&&bytes<6*1024*1024,'per-world branch clones exceeded their bounded memory budget');
  for(const[geometry,positions]of shared)assert.deepEqual(geometry.attributes.position.array,positions,'shared tree template was edited');
  const before=[...originals.keys()].map(o=>[o.mesh.getObjectByName('tree-trunk'),o.mesh.getObjectByName('tree-trunk').geometry]);
  assert.equal(installForestHabitats(w,map),h);assert(before.every(([trunk,geometry])=>trunk.geometry===geometry),'reinstallation recloned tree geometry');
  let disposed=0,sharedDisposed=0;for(const geometry of owned)geometry.addEventListener('dispose',()=>disposed++);for(const geometry of shared.keys())geometry.addEventListener('dispose',()=>sharedDisposed++);
  w.group.traverse(m=>{if(m.isInstancedMesh)m.dispose();if(m.userData.ownedGeometry)m.geometry.dispose();});
  assert.equal(disposed,owned.length);assert.equal(sharedDisposed,0);
 }
});

test('every elder terminal twig follows its actual crown, retains its thick bole and never raises floor tint',()=>{
 for(const map of['forest','confluence'])for(const seed of[7,522,43837033]){
  const w=buildWorld(map,seed);installForestVista(w,map);
  const ground=w.ground.geometry,positions=ground.attributes.position.array.slice(),colors=ground.attributes.color.array.slice();
  const originals=new Map(w.obstacles.filter(o=>o.mesh.getObjectByName('tree-canopy')).map(o=>{const t=o.mesh.getObjectByName('tree-trunk'),c=o.mesh.getObjectByName('tree-canopy');return[o,{p:t.geometry.attributes.position,y:t.scale.y,base:c.position.y}];}));
  const h=installForestHabitats(w,map),trunk=h.elder.mesh.getObjectByName('tree-trunk'),canopy=h.elder.mesh.getObjectByName('tree-canopy'),old=originals.get(h.elder),p=trunk.geometry.attributes.position,template=canopy.userData.treeTemplate;
  w.group.updateMatrixWorld(true);
  const start=p.count-template.sprays.length*11;let lowTips=0,bole=0;
  for(const[i,[x,y,z,,,height]]of template.sprays.entries()){
   const index=start+i*11+10,tip=trunk.localToWorld(new T.Vector3().fromBufferAttribute(p,index)),target=canopy.localToWorld(new T.Vector3(x,y+height*.24-template.bottom,z));
   assert(tip.distanceTo(target)<1e-5,'elder terminal twig is detached from its actual leaf spray');lowTips+=old.p.getY(index)<4.1?1:0;
  }assert(lowTips>0,'fixture does not exercise low terminal tips');
  for(let i=0;i<p.count;i++)if(old.p.getY(i)>.7&&old.p.getY(i)<1.8){
   const before=Math.hypot(old.p.getX(i),old.p.getZ(i)),after=Math.hypot(p.getX(i),p.getZ(i));
   assert(Math.abs(after-Math.min(before*1.8,Math.max(before,h.elder.r*.89)))<1e-6,'elder lower bole lost its existing thickness');bole++;
  }assert(bole>0);
  assert.deepEqual(ground.attributes.position.array,positions);assert.notDeepEqual(ground.attributes.color.array,colors);
  for(let i=0;i<ground.attributes.position.count;i++)if(h.region&&!h.region.contains(positions[i*3],-positions[i*3+1]))assert.deepEqual(Array.from(ground.attributes.color.array.slice(i*3,i*3+3)),Array.from(colors.slice(i*3,i*3+3)));
  let disposed=0;trunk.geometry.addEventListener('dispose',()=>disposed++);
  w.group.traverse(m=>{if(m.isInstancedMesh)m.dispose();if(m.userData.ownedGeometry)m.geometry.dispose();});assert.equal(disposed,1);
 }
});
