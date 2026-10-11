import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../vendor/three.module.js';
import {buildWorld} from '../world.js';
import {installForestVista} from '../forest-vista.js';
import {installForestHabitats} from '../forest-habitats.js';
import {installEnvironmentGrounding} from '../environment-grounding.js';
import {installForestFloorRelief} from '../forest-floor-relief.js';

globalThis.document={createElement:()=>({getContext:()=>({fillRect(){}})})};
const cleanup=w=>w.group.traverse(o=>{if(o.isInstancedMesh)o.dispose();if(o.userData.ownedGeometry)o.geometry.dispose();});

test('forest root shoulders are bounded by permanent colliders, submerged at their rim, one batch and deterministic',()=>{
 for(const map of ['forest','confluence'])for(const seed of [7,522,43837033]){
  const w=buildWorld(map,seed);installForestVista(w,map);installForestHabitats(w,map);installEnvironmentGrounding(w);
  const before=JSON.stringify({obstacles:w.obstacles.map(o=>[o.x,o.z,o.r,o.height,o.sceneryHeight]),sites:w.sites.map(s=>[s.x,s.z,s.type]),spawn:w.spawn,breakables:w.breakables.map(o=>[o.x,o.z])}),floor=w.ground.geometry.attributes.position.array.slice(),children=w.group.children.length;
  const mesh=installForestFloorRelief(w,map);assert(mesh);assert.equal(installForestFloorRelief(w,map),mesh);assert.equal(w.group.children.length,children+1);assert.strictEqual(mesh.material,w.ground.material);assert(mesh.castShadow&&mesh.receiveShadow&&mesh.userData.ownedGeometry);
  assert.equal(JSON.stringify({obstacles:w.obstacles.map(o=>[o.x,o.z,o.r,o.height,o.sceneryHeight]),sites:w.sites.map(s=>[s.x,s.z,s.type]),spawn:w.spawn,breakables:w.breakables.map(o=>[o.x,o.z])}),before);assert.deepEqual(w.ground.geometry.attributes.position.array,floor);
  const {records}=mesh.userData,p=mesh.geometry.attributes.position,n=mesh.geometry.attributes.normal;
  assert(records.length>=20&&records.length<=32);assert(mesh.geometry.index.count/3<=5632);assert(mesh.geometry.groups.length===0);
  for(const r of records){
   assert(w.obstacles.includes(r.source)&&!w.breakables.includes(r.source));assert(!r.source.tactic&&!r.source.mesh.userData.forestVistaTrunk);assert(r.height>=.12&&r.height<=.22);
   for(let i=r.start;i<r.start+r.count;i++){
    assert(Math.hypot(p.getX(i)-r.x,p.getZ(i)-r.z)<r.r*.954,'raised dirt extended outside a solid collider');assert(p.getY(i)<=.221&&p.getY(i)>=-.039);assert(n.getY(i)>.05,'root shoulder faces away from the sky');
    if(i>=r.start+r.count-16)assert(p.getY(i)<-.035,'outer rim does not disappear under the floor');
    if(map==='confluence')assert(w.regions.find(s=>s.id==='forest').contains(p.getX(i),p.getZ(i)));
   }
  }
  const saved=mesh.geometry.attributes.position.array.slice();mesh.geometry.dispose();assert(mesh.userData.disposed&&!mesh.visible);const again=installForestFloorRelief(w,map);assert.notEqual(again,mesh);assert.deepEqual(again.geometry.attributes.position.array,saved);cleanup(w);
 }
});

test('other biomes and forests without a permanent tree allocate no floor caps',()=>{
 for(const map of ['snow','ash','sand','coast']){const w=buildWorld(map,522),count=w.group.children.length;assert.equal(installForestFloorRelief(w,map),null);assert.equal(w.group.children.length,count);cleanup(w);}
 const w=buildWorld('forest',522);w.breakables=w.obstacles.slice();assert.equal(installForestFloorRelief(w,'forest'),null);cleanup(w);
});

test('cap UV and vertex color match the underlying floor triangles; shared floor material is never disposed',()=>{
 const floor=new T.Mesh(new T.PlaneGeometry(12,12,1,1),new T.MeshStandardMaterial({vertexColors:true}));floor.rotation.x=-Math.PI/2;floor.position.y=-.03;floor.geometry.setAttribute('color',new T.Float32BufferAttribute([.2,.3,.4,.7,.4,.6,.3,.6,.7,.9,.8,.5],3));
 const tree=new T.Group();tree.userData.treeBiome='forest';const trunk=new T.Object3D();trunk.name='tree-trunk';tree.add(trunk);
 const w={ground:floor,group:new T.Group(),spawn:{x:0,z:0},obstacles:[{x:2,z:1,r:.65,mesh:tree}],breakables:[]};w.group.add(floor);
 const mesh=installForestFloorRelief(w,'forest'),p=mesh.geometry.attributes.position,uv=mesh.geometry.attributes.uv,color=mesh.geometry.attributes.color;let materialDisposals=0,geometryDisposals=0;
 for(let i=0;i<p.count;i++){
  const x=p.getX(i)/12+.5,y=p.getZ(i)/12+.5,ids=x+y<=1?[0,2,1]:[2,3,1],weights=x+y<=1?[1-x-y,y,x]:[1-x,x+y-1,1-y];
  assert(Math.abs(uv.getX(i)-x)<1e-7);assert(Math.abs(uv.getY(i)-(1-y))<1e-7);
  for(let c=0;c<3;c++){const expected=ids.reduce((v,id,j)=>v+floor.geometry.attributes.color.array[id*3+c]*weights[j],0);assert(Math.abs(color.array[i*3+c]-expected)<1e-7);}
 }
 floor.material.addEventListener('dispose',()=>materialDisposals++);mesh.geometry.addEventListener('dispose',()=>geometryDisposals++);floor.geometry.dispose();assert(mesh.userData.disposed&&!mesh.visible);cleanup(w);assert.equal(geometryDisposals,1);assert.equal(materialDisposals,0);assert.equal((floor.geometry._listeners?.dispose||[]).length,0);
});
