import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../vendor/three.module.js';
import {buildWorld,moveActor,clearAt} from '../world.js';
import {installForestVista} from '../forest-vista.js';
import {installForestHabitats} from '../forest-habitats.js';
import {installBiomePlaces} from '../biome-places.js';
import {installClimateLandforms} from '../climate-landforms.js';
import {segmentDistance} from '../rules.js';
import {installEnvironmentClusters} from '../environment-clusters.js';
import {installExplorationRoutes} from '../exploration-routes.js';
import {installExplorationLandmarks} from '../exploration-landmarks.js';
import {installExplorationComposition} from '../exploration-composition.js';
import {installAdventureGroundDetail,installHabitatDetail} from '../adventure-ground-detail.js';
import {installForestTerrain} from '../forest-terrain.js';
import {resetMobility} from '../adventure-mobility.js';

globalThis.document={createElement:()=>({getContext:()=>({fillRect(){}})})};
const cleanup=w=>w.group.traverse(o=>{if(o.isInstancedMesh)o.dispose();if(o.userData.ownedGeometry)o.geometry.dispose();});
function build(id,seed=522){const w=buildWorld(id,seed);for(const f of [installForestVista,installForestHabitats,installBiomePlaces])f(w,id);return w;}
function game(w){return JSON.stringify({spawn:w.spawn,sites:w.sites.map(s=>[s.x,s.z,s.type,s.event,s.availableAt,s.claimed,s.discovered,s.mesh.visible,s.trail.visible]),patches:w.patches.map(p=>[p.x,p.z,p.rx,p.rz,p.r,p.kind]),breakables:w.breakables.map(p=>[p.x,p.z,p.state]),roads:w.road,places:w.biomePlaces.map(p=>[p.x,p.z,p.angle,p.entrance,p.exit])});}

test('climate names have connected medium-scale solids and bounded real dune plans, including regional scopes',()=>{
 for(const id of ['snow','ash','sand','confluence'])for(const seed of [7,522,43837033]){
  const w=build(id,seed),before=game(w),existing=[...w.obstacles],s=installClimateLandforms(w,id);
  assert.equal(installClimateLandforms(w,id),s);assert.equal(game(w),before);
  assert(existing.every(o=>w.obstacles.includes(o)),'existing objects were removed or replaced');
  assert.equal(s.draws,id==='confluence'?3:1);assert(s.triangles<(id==='confluence'?12000:5000));
  for(const mesh of s.group.children.filter(m=>m.isMesh)){
   const p=mesh.geometry.attributes.position,n=mesh.geometry.attributes.normal,joined=new Map();let shared=0;
   for(let i=0;i<p.count;i++){const key=p.getX(i)+','+p.getY(i)+','+p.getZ(i),normal=[n.getX(i),n.getY(i),n.getZ(i)];if(joined.has(key)){assert.deepEqual(normal,joined.get(key),'separate collider pieces must not create regular black lighting seams');shared++;}else joined.set(key,normal);}
   assert(shared>50,'did not exercise any joined ridge boundary');
  }
  for(const biome of id==='confluence'?['snow','ash','sand']:[id]){
   const rs=s.records.filter(r=>r.biome===biome&&r.kind!=='dune');assert.equal(rs.length,2,`${id}/${seed}/${biome}: two meaningful structures`);
   for(const r of rs){assert(r.length>=24&&r.solids.length>=5);assert(Math.max(...r.solids.map(o=>o.height))>(biome==='sand'?1.5:3));
    const region=w.regions?.find(q=>q.id===biome);
    for(const o of r.solids){assert(w.obstacles.includes(o));assert.equal(o.height,o.sceneryHeight);if(region){assert(region.obstacles.includes(o));for(let i=0;i<8;i++)assert(region.contains(o.x+Math.cos(i*Math.PI/4)*(o.r+.1),o.z+Math.sin(i*Math.PI/4)*(o.r+.1)));}}
    // The deliberate central breach remains wide enough for large actors.
    const bend=biome==='sand'?0:r.width*.9,x=r.x-Math.sin(r.angle)*bend,z=r.z+Math.cos(r.angle)*bend;
    assert(r.solids.every(o=>Math.hypot(x-o.x,z-o.z)>o.r+1.1));
   }
  }
  if(id==='sand'||id==='confluence'){
   const dunes=s.records.filter(r=>r.kind==='dune');assert(dunes.length>=2&&dunes.length<=5);
   assert(dunes.some(p=>s.heightAt(p.x,p.z)>.8),'protected dunes must still have a real crest');
   for(const p of dunes)assert(p.length>=30&&p.width>=16);
   assert.equal(s.heightAt(w.half+20,w.half+20),0);
  }else assert.equal(s.heightAt(0,0),0);
  cleanup(w);
 }
});

test('new solids preserve trail lanes, objective clearings, existing collision and render exactly their own height envelopes',()=>{
 for(const id of ['snow','ash','sand','confluence']){
  const w=build(id),old=[...w.obstacles],s=installClimateLandforms(w,id),point=new T.Vector3(),ray=new T.Raycaster();w.group.updateMatrixWorld(true);
  const protectedCircles=[{...w.spawn,r:7},...w.sites.flatMap(p=>[{...p,r:p.event?9:5},...(p.nodes||[]).map(n=>({...n,r:3}))]),...old.map(p=>({...p,r:p.r+.6}))];
  for(const r of s.records.filter(r=>r.kind!=='dune'))for(const o of r.solids){
   assert(protectedCircles.every(p=>Math.hypot(o.x-p.x,o.z-p.z)>o.r+p.r),'collider invaded existing gameplay');
   for(const site of w.sites){const p=site.trail.geometry.attributes.position;for(let i=4;i<p.count;i+=4){const ax=(p.getX(i-3)+p.getX(i-2))/2,az=(p.getZ(i-3)+p.getZ(i-2))/2,bx=(p.getX(i+1)+p.getX(i+2))/2,bz=(p.getZ(i+1)+p.getZ(i+2))/2;assert(segmentDistance(o.x,o.z,ax,az,bx,bz)>o.r+3.6);}}
   const p=r.mesh.geometry.attributes.position,{first,count}=o.climateSpan;let maxY=-Infinity,maxR=0;
   for(let i=first;i<first+count;i++){point.fromBufferAttribute(p,i);assert(Number.isFinite(point.x+point.y+point.z));maxY=Math.max(maxY,point.y);maxR=Math.max(maxR,Math.hypot(point.x-o.x,point.z-o.z));}
   assert(Math.abs(maxY-o.height)<1e-6);assert(Math.abs(maxR-o.r)<1e-6);
   ray.set(new T.Vector3(o.x,10,o.z),new T.Vector3(0,-1,0));const hits=ray.intersectObject(r.mesh);assert(hits.length,'top surface must face outward and be visible from above');assert(hits[0].point.y<=o.height+1e-5);
  }
  for(const p of protectedCircles)assert.equal(s.heightAt(p.x,p.z),0,'dune raised an existing solid/objective');
  for(const p of w.ponds)assert.equal(s.heightAt(p.x,p.z),0);
  for(const p of w.bridges||[])assert.equal(s.heightAt(p.x,p.z),0);
  cleanup(w);
 }
});

test('geometry is world-owned, materials shared, deterministic plans do not retain old worlds',()=>{
 const a=build('snow',7),b=build('snow',7),x=installClimateLandforms(a,'snow'),y=installClimateLandforms(b,'snow');
 const plan=s=>s.records.map(r=>[r.kind,r.x,r.z,r.angle,r.solids.map(o=>[o.x,o.z,o.r,o.height])]);assert.deepEqual(plan(x),plan(y));
 const ma=x.records[0].mesh,mb=y.records[0].mesh;assert.notEqual(ma.geometry,mb.geometry);assert.equal(ma.material,mb.material);
 let disposed=0,other=0,materialDisposed=0;ma.geometry.addEventListener('dispose',()=>disposed++);mb.geometry.addEventListener('dispose',()=>other++);ma.material.addEventListener('dispose',()=>materialDisposed++);
 cleanup(a);assert.equal(disposed,1);assert.equal(other,0);assert.equal(materialDisposed,0);assert(mb.geometry.attributes.position.count>0);cleanup(b);assert.equal(other,1);
 const forest=build('forest');assert.equal(installClimateLandforms(forest,'forest'),null);assert.equal(forest.climateLandforms,undefined);cleanup(forest);
});

test('sand crests survive the complete environment protection and are the actual walkable rendered ground',()=>{
 for(const id of ['sand','confluence'])for(const seed of [7,522,43837033]){
  const w=build(id,seed),s=installClimateLandforms(w,id);
  for(const f of [installEnvironmentClusters,installExplorationRoutes,installExplorationLandmarks,installExplorationComposition,installAdventureGroundDetail,installHabitatDetail])f(w,id);
  const floor=installForestTerrain(w,id),dunes=s.records.filter(r=>r.kind==='dune'),heights=dunes.map(d=>floor.sample(d.x,d.z));assert(Math.max(...heights)>.4,`${id}/${seed}: dunes flattened during integration`);
  const crest=dunes[heights.indexOf(Math.max(...heights))];assert(clearAt(w,crest.x,crest.z));w.group.updateMatrixWorld(true);
  const ray=new T.Raycaster(new T.Vector3(crest.x,3,crest.z),new T.Vector3(0,-1,0)),hit=ray.intersectObject(w.ground)[0];assert(hit);assert(Math.abs(hit.point.y-w.ground.position.y-floor.sample(crest.x,crest.z))<1e-6);
  const player={x:crest.x,z:crest.z,standHeight:1.8,dashTime:0};resetMobility(player,floor.sample(player.x,player.z));moveActor(w,player,.25,0);assert.equal(player.x,crest.x+.25);assert(Math.abs(player.y-floor.sample(player.x,player.z))<1e-7);
  for(let i=0;i<floor.heights.length;i++){const h=floor.heights[i];assert(Number.isFinite(h)&&h>=0&&h<=1.2);if(i%(floor.cols+1))assert(Math.abs(h-floor.heights[i-1])<=floor.width/floor.cols*.12+1e-7);}
  cleanup(w);
 }
});
