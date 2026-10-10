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
  assert(meshes.every((m,i)=>m.geometry===geometry[i]||m===h?.elder?.mesh.getObjectByName('tree-trunk')&&m.userData.ownedGeometry));assert.deepEqual(meshes.map(m=>m.material),materials);
  if(!['forest','confluence'].includes(map)){assert.equal(h,null);continue;}
  assert(h.elder&&h.groves.length&&h.ponds.length);assert(h.trees>5);assert.equal(installForestHabitats(w,map),h);
  assert(w.obstacles.some(o=>o.mesh.userData.forestHabitat==='thicket'));
  for(const p of[h.relic,...h.groves,...h.ponds]){const a=forestHabitatAt(w,p.x,p.z),b=forestHabitatAt(w,p.x+.001,p.z);for(const k of['shade','bank','ruin']){assert(a[k]>=0&&a[k]<=1);assert(Math.abs(a[k]-b[k])<.002);}}
  if(map==='confluence')assert.deepEqual(forestHabitatAt(w,78,24),{shade:0,bank:0,ruin:0});
  const layer=installHabitatDetail(w,map),box=new T.Box3(),matrix=new T.Matrix4();assert(layer.children.length<=16);
  assert(layer.userData.records.some(p=>p.biome==='forest'&&p.kind==='reed'));
  for(const m of layer.children)for(let i=0;i<m.count;i++){m.getMatrixAt(i,matrix);box.copy(m.geometry.boundingBox).applyMatrix4(matrix);assert(box.max.y<.7,'habitat blocks combat sightline');}
  w.group.traverse(m=>{if(m.isInstancedMesh)m.dispose();if(m.userData.ownedGeometry)m.geometry.dispose();});assert(layer.userData.disposed);
 }
});

test('elder upper twigs follow the enlarged crown and floor tint never raises terrain',()=>{
 for(const map of['forest','confluence']){
  const w=buildWorld(map,43837033);installForestVista(w,map);
  const ground=w.ground.geometry,positions=ground.attributes.position.array.slice(),colors=ground.attributes.color.array.slice();
  const originals=new Map(w.obstacles.filter(o=>o.mesh.getObjectByName('tree-canopy')).map(o=>{const t=o.mesh.getObjectByName('tree-trunk'),c=o.mesh.getObjectByName('tree-canopy');return[o,{p:t.geometry.attributes.position,y:t.scale.y,base:c.position.y}];}));
  const h=installForestHabitats(w,map),trunk=h.elder.mesh.getObjectByName('tree-trunk'),old=originals.get(h.elder),p=trunk.geometry.attributes.position;
  let tips=0;for(let i=0;i<p.count;i++)if(old.p.getY(i)>4.1){
   assert(Math.abs(p.getX(i)-old.p.getX(i)*1.70)<1e-5);assert(Math.abs(p.getZ(i)-old.p.getZ(i)*1.38)<1e-5);
   const y=old.base*1.65+(old.p.getY(i)*old.y-old.base)*1.32;
   assert(Math.abs(p.getY(i)*trunk.scale.y-y)<1e-5);tips++;
  }assert(tips>10);
  assert.deepEqual(ground.attributes.position.array,positions);assert.notDeepEqual(ground.attributes.color.array,colors);
  for(let i=0;i<ground.attributes.position.count;i++)if(h.region&&!h.region.contains(positions[i*3],-positions[i*3+1]))assert.deepEqual(Array.from(ground.attributes.color.array.slice(i*3,i*3+3)),Array.from(colors.slice(i*3,i*3+3)));
  let disposed=0;trunk.geometry.addEventListener('dispose',()=>disposed++);
  w.group.traverse(m=>{if(m.isInstancedMesh)m.dispose();if(m.userData.ownedGeometry)m.geometry.dispose();});assert.equal(disposed,1);
 }
});
