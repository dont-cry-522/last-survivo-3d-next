import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import * as T from '../vendor/three.module.js';
import {createDiscoveryScenery} from '../discovery-scenery.js';

const biomes=['forest','snow','ash','sand','coast'];
const nodes=[[0,0],[-2.4,0],[0,1.4],[2.4,0]];
const segmentDistance=(p,a,b)=>{const dx=b.x-a.x,dz=b.z-a.z,t=T.MathUtils.clamp(((p.x-a.x)*dx+(p.z-a.z)*dz)/(dx*dx+dz*dz||1),0,1);return Math.hypot(p.x-a.x-dx*t,p.z-a.z-dz*t);};
function triangleDistance(p,a,b,c){
 const cross=(a,b,p)=>(b.x-a.x)*(p.z-a.z)-(b.z-a.z)*(p.x-a.x),area=cross(a,b,c);
 if(Math.abs(area)>1e-10){const signs=[cross(a,b,p),cross(b,c,p),cross(c,a,p)];if(signs.every(n=>n>=-1e-10)||signs.every(n=>n<=1e-10))return 0;}
 return Math.min(segmentDistance(p,a,b),segmentDistance(p,b,c),segmentDistance(p,c,a));
}

test('ten distinct low setpieces use bounded merged geometry with no extra runtime systems',()=>{
 const signatures=new Set(),materials=new Set();
 for(const biome of biomes)for(const variant of ['cache','trail']){
  const group=createDiscoveryScenery(biome,variant),box=new T.Box3().setFromObject(group,true);assert.equal(group.userData.biome,biome);assert.equal(group.userData.variant,variant);
  assert(group.children.length>0&&group.children.length<=2,'scenery exceeds two main draws / four including sun shadows');
  assert(box.max.y<.65&&box.min.y>-.06,'setpiece intrudes into combat height or below the ground');
  assert(Math.max(Math.abs(box.min.x),Math.abs(box.max.x))<3.1&&Math.max(Math.abs(box.min.z),Math.abs(box.max.z))<2.9);
  let triangles=0;const hash=createHash('sha256');
  for(const mesh of group.children){
   assert(mesh.isMesh&&!mesh.isLight&&!mesh.isInstancedMesh);assert.equal(mesh.geometry.groups.length,0);assert(!mesh.userData.ownedGeometry);assert(!mesh.material.transparent&&!mesh.material.map);
   assert(mesh.castShadow&&mesh.receiveShadow);materials.add(mesh.material);
   const {position,normal,color}=mesh.geometry.attributes;assert(position&&normal&&color);assert([...position.array,...normal.array,...color.array].every(Number.isFinite));
   triangles+=(mesh.geometry.index?.count??position.count)/3;hash.update(Buffer.from(position.array.buffer));hash.update(Buffer.from(color.array.buffer));
  }
  assert(triangles<5000,'static discovery exceeds its triangle budget');signatures.add(hash.digest('hex'));
 }
 assert.equal(signatures.size,10,'biome/variant geometry collapsed to recolored duplicate props');assert.equal(materials.size,2);
});

test('every triangle stays outside the interaction center and all three trail node footprints',()=>{
 const a=new T.Vector3(),b=new T.Vector3(),c=new T.Vector3();
 for(const biome of biomes)for(const variant of ['cache','trail']){
  const group=createDiscoveryScenery(biome,variant);
  for(const [x,z]of variant==='trail'?nodes:[nodes[0]])for(const mesh of group.children){
   const p=mesh.geometry.attributes.position,index=mesh.geometry.index,count=index?.count??p.count;
   for(let i=0;i<count;i+=3){a.fromBufferAttribute(p,index?index.getX(i):i);b.fromBufferAttribute(p,index?index.getX(i+1):i+1);c.fromBufferAttribute(p,index?index.getX(i+2):i+2);
    assert(triangleDistance({x,z},a,b,c)>=.65-1e-6,`${biome} ${variant} blocks node (${x},${z})`);
   }
  }
 }
});

test('world cleanup leaves cached scenery resources alive and groups transform independently',()=>{
 for(const biome of biomes)for(const variant of ['cache','trail']){
  const a=createDiscoveryScenery(biome,variant),b=createDiscoveryScenery(biome,variant),world=new T.Group();world.add(a,b);
  a.position.set(7,0,-3);a.visible=false;a.userData.features.push('instance-only');
  let disposed=0;const onDispose=()=>disposed++;
  for(let i=0;i<a.children.length;i++){assert.equal(a.children[i].geometry,b.children[i].geometry);assert.equal(a.children[i].material,b.children[i].material);a.children[i].geometry.addEventListener('dispose',onDispose);}
  a.traverse(o=>{if(o.isInstancedMesh)o.dispose();if(o.userData.ownedGeometry)o.geometry.dispose();});a.removeFromParent();
  assert.equal(disposed,0);assert(b.visible&&b.parent===world);assert.deepEqual(b.position.toArray(),[0,0,0]);assert(!b.userData.features.includes('instance-only'));
  for(const mesh of a.children)mesh.geometry.removeEventListener('dispose',onDispose);
 }
});

test('unsupported requests use one existing fallback instead of growing the shared cache',()=>{
 const fallback=createDiscoveryScenery('forest','cache'),unknown=createDiscoveryScenery('missing','missing');
 assert.equal(unknown.userData.biome,'forest');assert.equal(unknown.userData.variant,'cache');assert.equal(unknown.children[0].geometry,fallback.children[0].geometry);
});
