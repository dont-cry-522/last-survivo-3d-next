import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../vendor/three.module.js';
import {buildWorld} from '../world.js';
import {installForestVista} from '../forest-vista.js';
import {installForestHabitats} from '../forest-habitats.js';
import {installExplorationRoutes} from '../exploration-routes.js';
import {installBiomePlaces} from '../biome-places.js?v=196';
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

const length=points=>points.reduce((sum,p,i)=>sum+(i?Math.hypot(p.x-points[i-1].x,p.z-points[i-1].z):0),0);
test('associated places join safe reward trails in all six maps without changing rewards or exceeding detour budgets',()=>{
 for(const map of['forest','snow','ash','sand','coast','confluence']){
  let linked=0;
  for(const seed of[7,19,522,43837033]){
   const w=buildWorld(map,seed);installForestVista(w,map);installForestHabitats(w,map);installBiomePlaces(w,map);
   const before=state(w),base=installExplorationRoutes({...w,biomePlaces:[]});
   const routes=installExplorationRoutes(w);assert.equal(state(w),before);
   for(const [i,r]of routes.entries()){
    assert(r.points.length>=2);checkRoute(w,r);
    if(!r.place){assert.deepEqual(r.points,base[i].points);continue;}
    linked++;assert(w.biomePlaces.includes(r.place));assert.equal(r.place.site,r.site);
    const center=r.points.findIndex(p=>Math.hypot(p.x-r.place.x,p.z-r.place.z)<.000001);assert(center>0&&center<r.points.length-1,'connected route misses the actual central passage');
    const a=r.points[center-1],p=r.points[center],b=r.points[center+1];
    assert((p.x-a.x)*(b.x-p.x)+(p.z-a.z)*(b.z-p.z)>0,'route turns back at the place centre');
    const distance=length(base[i].points);assert(length(r.points)<=distance+35+.000001);assert(length(r.points)<=distance*1.7+12+.000001);
   }
   cleanup(w);
  }
  assert(linked>0,map+' has no place connected to an actual exploration trail');
 }
});

test('the shortest permitted same-site place is used, while blocked, distant and unrelated places keep the original complete trail',()=>{
 const w=smallWorld(),near={x:0,z:4,site:w.sites[0]},far={x:0,z:8,site:w.sites[0]};
 w.biomePlaces=[far,{x:0,z:0,site:{}},near];const selected=installExplorationRoutes(w)[0];assert.equal(selected.place,near);checkRoute(w,selected);cleanup(w);
 for(const invalid of['blocked','far','underwater','unrelated']){
  const obstacles=invalid==='blocked'?[{x:0,z:5,r:2}]:[],ponds=invalid==='underwater'?[{x:0,z:5,rx:2,rz:2}]:[];
  const world=smallWorld(obstacles,[],ponds),base=installExplorationRoutes({...world,biomePlaces:[]})[0];
  world.biomePlaces=[{x:invalid==='far'?-17:0,z:invalid==='far'?18:5,site:invalid==='unrelated'?{}:world.sites[0]}];
  const actual=installExplorationRoutes(world)[0];assert.equal(actual.place,null,invalid);assert.deepEqual(actual.points,base.points,invalid);checkRoute(world,actual);cleanup(world);
 }
 const bare=smallWorld(),empty=smallWorld();empty.biomePlaces=[];
 assert.deepEqual(installExplorationRoutes(bare)[0].points,installExplorationRoutes(empty)[0].points);cleanup(bare);cleanup(empty);
});

test('a place reached over a narrow bridge retains high-water safety and the same reward endpoint',()=>{
 const angle=.37,c=Math.cos(angle),s=Math.sin(angle),w=smallWorld([],[],[{x:0,z:0,rx:3,rz:24,baseRx:3,baseRz:24,angle}],[{x:0,z:0,width:13,length:2.8,angle}]);
 w.spawn={x:-8*c,z:8*s};Object.assign(w.sites[0],{x:8*c,z:-8*s});w.biomePlaces=[{x:0,z:0,site:w.sites[0]}];
 const r=installExplorationRoutes(w)[0];assert.equal(r.place,w.biomePlaces[0]);checkRoute(w,r);cleanup(w);
});

test('forest approach chooses an existing reachable near shore without moving gameplay or revealing hidden rewards',()=>{
 for(const seed of[7,19,522,43837033]){
  const world=buildWorld('forest',seed);installForestVista(world,'forest');installForestHabitats(world,'forest');installBiomePlaces(world,'forest');
  const before=state(world);installExplorationRoutes(world);const approach=world.forestHabitats.approach;
  assert(approach,'no safe near-shore approach for seed '+seed);assert.equal(state(world),before);assert(world.ponds.includes(approach.pond));
  assert.deepEqual(approach.start,world.spawn);assert.deepEqual(approach.points[0],world.spawn);assert.deepEqual(approach.points.at(-1),approach.shore);
  assert(length(approach.points)<=48);checkRoute(world,{...approach,end:approach.shore});
  const pond=approach.pond,c=Math.cos(pond.angle),s=Math.sin(pond.angle),dx=approach.shore.x-pond.x,dz=approach.shore.z-pond.z;
  const normalized=Math.hypot((c*dx-s*dz)/pond.rx,(s*dx+c*dz)/pond.rz);assert(normalized>1.1&&normalized<1.8,'shore endpoint is not at the actual dry bank');
  const points=approach.points.map(p=>({...p}));assert.strictEqual(installExplorationRoutes(world),world.explorationRoutes);assert.deepEqual(approach.points,points);cleanup(world);
 }
});

test('a short shore detour can join the old guide, while an inaccessible shore preserves its original route',()=>{
 const world=smallWorld([],[],[{x:0,z:3.5,rx:1,rz:1,angle:0}]);world.forestHabitats={relic:world.sites[0],ponds:world.ponds};
 const route=installExplorationRoutes(world)[0],approach=world.forestHabitats.approach;assert(approach);checkRoute(world,route);
 assert(route.points.some(p=>Math.hypot(p.x-approach.shore.x,p.z-approach.shore.z)<1e-6),'the permitted shore visit was not joined to its existing guide');
 assert(length(route.points)<=16*1.35);assert.deepEqual(route.points.at(-1),{x:8,z:0});cleanup(world);
 const blocked=smallWorld([{x:0,z:18,r:7}],[],[{x:0,z:18,rx:2,rz:2,angle:0}]);blocked.forestHabitats={relic:blocked.sites[0],ponds:blocked.ponds};
 const actual=installExplorationRoutes(blocked)[0];assert.equal(blocked.forestHabitats.approach,undefined);checkRoute(blocked,actual);assert.equal(length(actual.points),16);cleanup(blocked);
});
