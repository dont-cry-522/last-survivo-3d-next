import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../vendor/three.module.js';
import {buildWorld} from '../world.js?v=203';
import {placeTemplate} from '../biome-places.js?v=203';
import {waterDepth,terrainAt} from '../water.js?v=203';
import {bridgeContains,updateTide} from '../coast.js?v=203';
import {coastPlaceCandidates,harborPierPlan} from '../harbor-bank-layout.js';

globalThis.document={createElement:()=>({getContext:()=>({fillRect(){}})})};
const at=(p,x,z)=>({x:p.x+Math.cos(p.angle)*x+Math.sin(p.angle)*z,z:p.z-Math.sin(p.angle)*x+Math.cos(p.angle)*z});
const highWater=w=>w.ponds.filter(p=>p.biome==='coast').map(p=>{const rx=(p.baseRx??p.rx)*1.19+1,rz=(p.baseRz??p.rz)*1.19+1;return{...p,rx,rz,r:Math.max(rx,rz)*1.12};});
const cleanup=w=>w.group.traverse(o=>{if(o.isInstancedMesh)o.dispose();if(o.userData.ownedGeometry)o.geometry.dispose();});
const signature=w=>JSON.stringify({spawn:w.spawn,ponds:w.ponds.map(p=>[p.x,p.z,p.rx,p.rz,p.r,p.baseRx,p.baseRz,p.angle]),bridges:w.bridges,fords:w.fords,sites:w.sites.map(s=>[s.x,s.z,s.event,s.availableAt]),obstacles:w.obstacles.map(o=>[o.x,o.z,o.r])});
function oldSafe(w,p,scope,placed){
 const footprint=(q,margin=0)=>{const dx=q.x-p.x,dz=q.z-p.z,c=Math.cos(p.angle),s=Math.sin(p.angle);return Math.abs(c*dx-s*dz)<9.4+margin&&Math.abs(s*dx+c*dz)<8.4+margin;};
 if(placed.some(q=>Math.hypot(p.x-q.x,p.z-q.z)<28))return false;
 const clearings=[{...w.spawn,r:7},...w.sites.map(s=>({...s,r:s.event?8:4.5})),...w.discoveries.flatMap(d=>[{...d,r:3.8},...(d.nodes||[]).map(n=>({...n,r:2}))]),...w.roaming.map(r=>({...r,r:4}))];
 if(clearings.some(q=>footprint(q,q.r)))return false;
 const protectedObjects=w.obstacles.filter(o=>o.tactic||w.breakables.includes(o)||o.mesh.userData.district||o.mesh.userData.fragile||(w.regions||[]).some(r=>r.beacon?.parent===o.mesh)||w.sites.some(s=>s.mesh===o.mesh||s.gates?.includes(o)));
 if(protectedObjects.some(o=>footprint(o,o.r+1))||w.road?.some(q=>footprint(q,5.8)))return false;
 const high=highWater(w);
 for(let x=-9.4;x<=9.4+.001;x+=9.4/3)for(let z=-8.4;z<=8.4+.001;z+=8.4/3){const q=at(p,x,z);
  if(Math.abs(q.x)>w.half-3||Math.abs(q.z)>w.half-3||scope.contains&&!scope.contains(q.x,q.z)||high.some(pond=>waterDepth(pond,q.x,q.z)>0)||w.bridges.some(b=>bridgeContains(b,q.x,q.z,2)))return false;
 }
 return true;
}
function chooseTwo(w,scope){
 const choices=[];
 for(let i=0;i<2;i++){
  const candidates=coastPlaceCandidates(w,scope).sort((a,b)=>Math.hypot(a.x-w.spawn.x,a.z-w.spawn.z)-Math.hypot(b.x-w.spawn.x,b.z-w.spawn.z));
  const p=candidates.find(p=>oldSafe(w,p,scope,choices));assert(p,'no safe harbor '+i);choices.push(p);
  const template=placeTemplate('coast');
  for(const s of template.solids){const q=at(p,s.x,s.z);w.obstacles.push({...q,r:s.r,place:true,mesh:new T.Object3D()});}
  w.bridges.push(p.pier);
 }
 return choices;
}

test('shore-facing dry templates and walkable piers remain available in local and confluence harbors across seeds',()=>{
 for(const map of ['coast','confluence'])for(const seed of [0,1,7,19,522,892,12345,43837033]){
  const w=buildWorld(map,seed),scope=w.regions?.find(r=>r.id==='coast')||{id:'coast'},before=signature(w),candidates=coastPlaceCandidates(w,scope);
  assert(candidates.length>=2,map+' '+seed);assert.equal(signature(w),before,'candidate search changed gameplay');
  const choices=chooseTwo(w,scope);assert(Math.hypot(choices[0].x-choices[1].x,choices[0].z-choices[1].z)>=28);
  const high=highWater(w);
  for(const p of choices){
   const pier=p.pier;assert(pier.width>0&&pier.width<=35);assert.equal(pier.length,2.8);assert.equal(pier.localStartZ,-7.6);assert.equal(pier.localEndZ,-7.6-pier.width);
   assert(w.ponds.some(q=>waterDepth(q,pier.end.x,pier.end.z)>=.35),'pier ends on a dry bank');
   for(let x=-9.4;x<=9.4+.001;x+=1.175)for(let z=-8.4;z<=8.4+.001;z+=1.05){const q=at(p,x,z);assert(high.every(pond=>waterDepth(pond,q.x,q.z)===0),'high water enters the main template');}
   for(const t of[0,.25,.5,.75,1]){const q=at(p,0,-7.6-pier.width*t);assert(bridgeContains(pier,q.x,q.z),'bridge coordinates differ from place direction');assert.equal(terrainAt(w,q.x,q.z).kind,'bridge');}
  }
  updateTide(w,21);
  for(const p of choices)for(const t of[0,.5,1]){const q=at(p,0,-7.6-p.pier.width*t);assert.equal(terrainAt(w,q.x,q.z).speed,1,'high tide makes the new deck swim');}
  cleanup(w);
 }
});

test('candidate generation consumes no random values, is tide-independent and does not modify water or scenery',()=>{
 const w=buildWorld('coast',522),before=signature(w),original=Math.random;let a,b;
 try{Math.random=()=>{throw Error('layout RNG consumed');};a=coastPlaceCandidates(w,{id:'coast'});b=coastPlaceCandidates(w,{id:'coast'});}finally{Math.random=original;}
 assert.deepEqual(a,b);assert.equal(signature(w),before);updateTide(w,21);assert.deepEqual(coastPlaceCandidates(w,{id:'coast'}),a);assert.deepEqual(coastPlaceCandidates(w,{id:'forest'}),[]);cleanup(w);
});

const simple=()=>{const p={kind:'water',biome:'coast',x:0,z:-23,rx:8,rz:8,r:8*1.12,baseRx:8,baseRz:8};return{half:100,spawn:{x:60,z:60},ponds:[p],patches:[p],sites:[],obstacles:[],breakables:[],discoveries:[],roaming:[],bridges:[],fords:[],weather:{kind:'coast'}};};
test('the full pier rectangle respects existing crossings, events, hidden objects, tactical props and the old road',()=>{
 const p={x:0,z:0,angle:0},w=simple(),pier=harborPierPlan(w,p);assert(pier);
 for(const block of[
  w=>w.sites.push({x:3,z:pier.z,event:'salvage'}),
  w=>w.discoveries.push({x:20,z:20,nodes:[{x:2,z:pier.z}]}),
  w=>w.obstacles.push({x:2,z:pier.z,r:.8,tactic:'crate',mesh:new T.Object3D()}),
  w=>w.obstacles.push({x:2,z:pier.z,r:.8,place:true,mesh:new T.Object3D()}),
  w=>w.bridges.push({x:0,z:pier.z,width:14,length:2.8,angle:.6}),
  w=>w.fords.push({x:0,z:pier.z,half:8,width:1.5,angle:.3}),
  w=>{w.road=[{x:5,z:pier.z}];},
  w=>w.patches.push({x:4,z:pier.z,kind:'vent',r:2})
 ]){const blocked=simple();block(blocked);assert.equal(harborPierPlan(blocked,p),null);}
 // Ordinary movable dressing is left for the installer to clear, preserving
 // its existing ownership/collision cleanup rather than mutating here.
 w.obstacles.push({x:0,z:pier.z,r:.4,mesh:new T.Object3D()});assert(harborPierPlan(w,p));
});

test('no connector is invented for distant water, flooded starts, clipped banks or foreign biomes',()=>{
 const p={x:0,z:0,angle:0},distant=simple();distant.ponds[0].z=-70;assert.equal(harborPierPlan(distant,p),null);
 const flooded=simple();flooded.ponds[0].z=-10;assert.equal(harborPierPlan(flooded,p),null);
 const clipped=simple();clipped.half=18;assert.equal(harborPierPlan(clipped,p),null);
 const foreign=simple();foreign.regions=[{id:'coast',contains:(x,z)=>z>-15}];assert.equal(harborPierPlan(foreign,p),null);
 assert.equal(harborPierPlan(simple(),{...p,angle:NaN}),null);
});
