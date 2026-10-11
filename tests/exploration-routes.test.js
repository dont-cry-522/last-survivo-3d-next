import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../vendor/three.module.js';
import {buildWorld} from '../world.js';
import {installForestVista} from '../forest-vista.js';
import {installForestHabitats} from '../forest-habitats.js';
import {installExplorationRoutes} from '../exploration-routes.js';
import {segmentDistance} from '../rules.js';
import {waterDepth} from '../water.js';
import {bridgeContains} from '../coast.js';

globalThis.document={createElement:()=>({getContext:()=>({fillRect(){}})})};
const cleanup=w=>w.group.traverse(o=>{if(o.isInstancedMesh)o.dispose();if(o.userData.ownedGeometry)o.geometry.dispose();});
const state=w=>JSON.stringify({spawn:w.spawn,obstacles:w.obstacles.map(o=>[o.x,o.z,o.r,o.state]),patches:w.patches.map(p=>[p.x,p.z,p.rx,p.rz,p.kind]),sites:w.sites.map(s=>[s.x,s.z,s.availableAt,s.claimed,s.discovered,s.mesh.visible,s.trail.visible]),road:w.road});
function checkRoute(world,route){
 const {points,start,end}=route;assert(points.length<=40);if(!points.length)return;
 assert.deepEqual(points[0],start);assert.deepEqual(points.at(-1),end);
 const ponds=world.ponds.map(p=>{const k=p.baseRx===undefined?1:1.19,rx=(p.baseRx??p.rx)*k,rz=(p.baseRz??p.rz)*k;return{...p,rx,rz,r:Math.max(rx,rz)*1.12};});
 for(let i=1;i<points.length;i++){
  const a=points[i-1],b=points[i];
  for(const o of world.obstacles)assert(segmentDistance(o.x,o.z,a.x,a.z,b.x,b.z)>o.r+.55,'guide crosses an actual solid actor clearance');
  for(const v of world.patches.filter(p=>p.kind==='vent'))assert(segmentDistance(v.x,v.z,a.x,a.z,b.x,b.z)>v.r+.55,'guide crosses a vent');
  const steps=Math.ceil(Math.hypot(a.x-b.x,a.z-b.z)/.13);
  for(let n=0;n<=steps;n++){
   const x=a.x+(b.x-a.x)*n/steps,z=a.z+(b.z-a.z)*n/steps;
   assert(Math.abs(x)<world.half-.55&&Math.abs(z)<world.half-.55);
   assert(world.bridges?.some(bridge=>bridgeContains(bridge,x,z,-.54))||ponds.every(p=>waterDepth(p,x,z)===0),'dry guide leaves a bridge or enters high water');
  }
 }
}

test('six maps keep existing trail meshes, state and reachable whole routes across multiple seeds',()=>{
 for(const map of['forest','snow','ash','sand','coast','confluence'])for(const seed of[7,19,522,43837033]){
  const w=buildWorld(map,seed);installForestVista(w,map);installForestHabitats(w,map);
  const before=state(w),children=w.group.children.length,old=w.sites.map(s=>({mesh:s.trail,geometry:s.trail.geometry,material:s.trail.material}));let releases=0;
  for(const entry of old)entry.geometry.addEventListener('dispose',()=>releases++);
  const routes=installExplorationRoutes(w);assert.equal(routes.length,w.sites.length);assert.equal(state(w),before);assert.equal(w.group.children.length,children);assert.equal(releases,old.length);
  w.group.updateMatrixWorld(true);
  assert.strictEqual(installExplorationRoutes(w),routes);assert.equal(releases,old.length,'repeat install disposed active ribbons');
  assert(routes.every(r=>r.points.length>=2),map+' seed '+seed+' has no safe complete guide');
  for(const [i,route]of routes.entries()){
   assert.equal(route.site,w.sites[i]);assert.equal(route.site.trail,old[i].mesh);assert.equal(route.site.trail.material,old[i].material);assert.notEqual(route.site.trail.geometry,old[i].geometry);
   const region=w.regions?.find(r=>r.id===route.site.biome);assert.deepEqual(route.start,{x:region?.x??w.spawn.x,z:region?.z??w.spawn.z});
   checkRoute(w,route);
   const g=route.site.trail.geometry,p=g.attributes.position,c=g.attributes.color;assert.equal(p.count,route.points.length*4);assert.equal(c.itemSize,4);
   for(let j=0;j<p.count;j++){assert.equal(p.getY(j),Math.fround(.008));assert(Number.isFinite(p.getX(j))&&Number.isFinite(p.getZ(j)));assert.equal(c.getW(j),j%4===0||j%4===3?0:Math.fround(.13));}
   assert.equal(route.site.trail.parent,w.group);
   for(let j=0;j<route.points.length;j++){
    const center=new T.Vector3((p.getX(j*4+1)+p.getX(j*4+2))/2,.008,(p.getZ(j*4+1)+p.getZ(j*4+2))/2).applyMatrix4(route.site.trail.matrixWorld);
    assert(Math.hypot(center.x-route.points[j].x,center.z-route.points[j].z)<.00002,'parent transform displaced the world-space guide');assert.equal(center.y,.008);
   }
  }
  let newReleases=0;for(const route of routes)route.site.trail.geometry.addEventListener('dispose',()=>newReleases++);cleanup(w);assert.equal(newReleases,routes.length);
 }
});

function smallWorld(obstacles=[],patches=[],ponds=[],bridges=[]){
 const trail=new T.Mesh(new T.PlaneGeometry(1,1),new T.MeshBasicMaterial());trail.userData.ownedGeometry=true;
 const group=new T.Group();group.add(trail);return{half:20,spawn:{x:-8,z:0},group,obstacles,patches,ponds,bridges,sites:[{x:8,z:0,type:'relic',availableAt:0,discovered:false,claimed:false,trail}],weather:{kind:'forest'}};
}
test('the guide goes around walls and never keeps an old unsafe ribbon if the target is sealed',()=>{
 const w=smallWorld([{x:0,z:0,r:3}]),r=installExplorationRoutes(w)[0];assert(r.points.length>2);checkRoute(w,r);cleanup(w);
 const sealed=smallWorld([{x:8,z:0,r:2}]),mesh=sealed.sites[0].trail,visible=mesh.visible,none=installExplorationRoutes(sealed)[0];
 assert.equal(none.points.length,0);assert.equal(mesh.geometry.attributes.position.count,0);assert.equal(mesh.visible,visible);cleanup(sealed);
});

test('an angled narrow bridge connects between grid rows while high-water shortcuts are rejected',()=>{
 const angle=.37,c=Math.cos(angle),s=Math.sin(angle),w=smallWorld([],[],[{x:0,z:0,rx:3,rz:24,baseRx:3,baseRz:24,angle}], [{x:0,z:0,width:13,length:2.8,angle}]);
 w.spawn={x:-8*c,z:8*s};Object.assign(w.sites[0],{x:8*c,z:-8*s});const r=installExplorationRoutes(w)[0];assert(r.points.length>=2);checkRoute(w,r);cleanup(w);
 const trapped=smallWorld([],[],[{x:0,z:0,rx:3,rz:24,angle}],[]),none=installExplorationRoutes(trapped)[0];assert.equal(none.points.length,0,'route escaped through water or outside map bounds');cleanup(trapped);
});

test('route placement stays stable across unrelated Three geometry UUID randomness',()=>{
 const a=smallWorld([{x:0,z:0,r:2}]),b=smallWorld([{x:0,z:0,r:2}]),random=Math.random;
 try{
  Math.random=()=>.11;const first=installExplorationRoutes(a);
  Math.random=()=>.89;const second=installExplorationRoutes(b);
  assert.deepEqual(first.map(r=>r.points),second.map(r=>r.points));
  assert.deepEqual(first[0].site.trail.geometry.attributes.position.array,second[0].site.trail.geometry.attributes.position.array);
 }finally{Math.random=random;cleanup(a);cleanup(b);}
});
