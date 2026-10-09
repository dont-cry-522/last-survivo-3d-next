import{test}from'node:test';import assert from'node:assert/strict';
import{createHash}from'node:crypto';import * as T from'../vendor/three.module.js';
import{buildWorld,clearAt}from'../world.js';
import{terrainAt,waterDepth}from'../water.js';
import{installDiscoveries,advanceDiscovery,animateDiscoveries,discoveryHint,discoveryInfo,discoveryVariants,discoveryThreatened}from'../map-discoveries.js';
globalThis.document={createElement:()=>({getContext:()=>({fillRect(){}})})};
const ids=['forest','snow','ash','sand','coast'];
function dispose(w){w.group.traverse(o=>{if(o.isInstancedMesh)o.dispose();if(o.userData.ownedGeometry)o.geometry.dispose();});}
const node=id=>({id,x:0,z:0,phase:0,availableAt:10,discovered:false,claimed:false,progress:0,nodes:id==='snow'?[{x:-1.25,z:0},{x:1.25,z:0}]:[]});
const visit=(n,time=10,options={})=>advanceDiscovery(n,.5,{time,player:{x:0,z:0},...options});
test('all five maps place five staggered, clear discoveries with shared geometry and shore-bound shells',()=>{
 for(const id of ids){const geometries=new Map();for(let seed=1;seed<=20;seed++){
  const w=buildWorld(id,seed);assert.equal(w.discoveries.length,5,id+' seed '+seed);
  for(const [i,n]of w.discoveries.entries()){
   assert.equal(n.availableAt,10+i*35);if(i>=3)assert(Math.hypot(n.x-w.spawn.x,n.z-w.spawn.z)>=55,'late discovery must reward outer exploration');assert.equal(n.mesh.visible,n.variant!=='native');assert(n.markers.every(m=>!m.visible));assert(n.mesh.children.length<=4);
   assert(clearAt(w,n.x,n.z,1.8));for(const p of n.nodes)assert(clearAt(w,p.x,p.z,.55));
   assert(w.sites.every(s=>Math.hypot(n.x-s.x,n.z-s.z)>=11));
   const base=n.mesh.children[0],g=base.geometry||base.children[0].geometry;assert(g.attributes.position.count>0);assert([...g.attributes.position.array].every(Number.isFinite));if(geometries.has(n.variant))assert.strictEqual(g,geometries.get(n.variant));geometries.set(n.variant,g);
   if(id==='coast'){assert.equal(terrainAt(w,n.x,n.z).depth,0,'shells must sit on dry shore, away from crossing lanes');assert(w.ponds.some(p=>{const a=p.angle||0,dx=n.x-p.x,dz=n.z-p.z;return Math.abs(Math.hypot((Math.cos(a)*dx-Math.sin(a)*dz)/(p.baseRx*1.19+1.8),(Math.sin(a)*dx+Math.cos(a)*dz)/(p.baseRz*1.19+1.8))-1)<.001;}));}
  }dispose(w);
 }}
});
test('discoveries can be reached from spawn without crossing solid obstacles',()=>{
 for(const id of ids){const w=buildWorld(id,37),bound=w.half-1,size=bound*2+1,cell=(x,z)=>[Math.round(x+bound),Math.round(z+bound)],start=cell(w.spawn.x,w.spawn.z),seen=new Set([start.join(',')]),queue=[start];
  for(let i=0;i<queue.length;i++){const[x,z]=queue[i];for(const[dx,dz]of[[1,0],[-1,0],[0,1],[0,-1]]){const nx=x+dx,nz=z+dz,k=nx+','+nz;if(nx<0||nz<0||nx>=size||nz>=size||seen.has(k)||!clearAt(w,nx-bound,nz-bound,.45))continue;seen.add(k);queue.push([nx,nz]);}}
  for(const n of w.discoveries)for(const p of[n,...n.nodes])assert(seen.has(cell(p.x,p.z).join(',')),id+' inaccessible discovery');dispose(w);
 }
});
test('reveal is time and distance gated, enemy presence blocks collection, rewards occur once',()=>{
 const n=node('forest');assert(!visit(n,9).found);assert(!visit(n,10,{player:{x:10,z:0}}).found);assert(visit(n,10,{contested:true}).found);assert(!n.claimed);assert(visit(n).complete);assert(!visit(n).complete);
 const paused=node('forest');assert(!advanceDiscovery(paused,0,{time:20,player:{x:0,z:0}}).found);
});
test('snow requires both crystals; progress survives leaving or combat',()=>{
 const n=node('snow');assert(!visit(n).complete);visit(n,10,{player:{x:-1.25,z:0}});assert.equal(n.progress,1);visit(n,10,{player:{x:1.25,z:0},contested:true});assert.equal(n.progress,1);assert(visit(n,10,{player:{x:1.25,z:0}}).complete);
});
test('ash cool periods and coast low tide gate collection without charging hidden timers',()=>{
 const n=node('ash');assert(!visit(n,14).complete);assert(n.blocked);assert.match(discoveryHint(n),/灼热/);assert(visit(n,16).complete);
 const c=node('coast');assert(!visit(c,10,{tide:{warning:true}}).complete);assert(!visit(c,10,{tide:{high:true}}).complete);assert(visit(c,10,{tide:{high:false}}).complete);
});
test('sand clearing pauses in storms and combat, retains progress on leaving, completes once',()=>{
 const n=node('sand');visit(n);assert.equal(n.progress,.5);visit(n,10,{sandstorm:{active:true}});visit(n,10,{sandstorm:{warning:true}});visit(n,10,{contested:true});visit(n,10,{player:{x:10,z:0}});assert.equal(n.progress,.5);for(let i=0;i<3;i++)assert(!visit(n).complete);assert(visit(n).complete);assert(!visit(n).complete);
});
test('collected scenery remains, reward markers disappear and new runs reset discovery state',()=>{
 const w=buildWorld('forest',41),n=w.discoveries[0];n.discovered=n.claimed=true;animateDiscoveries(w,20);assert(n.mesh.visible);assert(n.markers.every(m=>!m.visible));const fresh=buildWorld('forest',41);assert(!fresh.discoveries[0].claimed);assert.equal(fresh.discoveries[0].x,n.x);dispose(w);dispose(fresh);
});
test('each biome has its own supply cache and three-step trail, with bounded rewards',()=>{
 const names=new Set();for(const id of ids){const variants=discoveryVariants(id);assert.equal(variants.length,3);for(const info of variants){assert(!names.has(info.name));names.add(info.name);}assert.equal(discoveryInfo({id,variant:'cache'}).xp,20);assert.equal(discoveryInfo({id,variant:'cache'}).heal,.08);assert.equal(discoveryInfo({id,variant:'trail'}).xp,24);assert.equal(discoveryInfo({id,variant:'trail'}).heal,0);const w=buildWorld(id,42);assert.equal(w.discoveries[2].variant,'cache');assert(['cache','trail'].includes(w.discoveries[1].variant));for(const n of w.discoveries.filter(n=>n.variant==='trail')){assert.equal(n.nodes.length,3);for(const p of n.nodes)assert.equal(terrainAt(w,p.x,p.z).depth,0,id+' trail on water');}dispose(w);}
});
test('trails require nodes in order and retain progress through pause, leaving and danger',()=>{
 const n={...node('forest'),variant:'trail',nodes:[{x:-2.4,z:0},{x:0,z:1.4},{x:2.4,z:0}]};
 visit(n,10,{player:n.nodes[2]});assert.equal(n.progress,0);visit(n,10,{player:n.nodes[0]});assert.equal(n.progress,1);assert.match(discoveryHint(n),/1\/3/);
 visit(n,10,{player:n.nodes[1],contested:true});advanceDiscovery(n,0,{time:20,player:n.nodes[1]});visit(n,10,{player:{x:30,z:0}});assert.equal(n.progress,1);
 visit(n,10,{player:n.nodes[1]});assert.equal(n.progress,2);assert(visit(n,10,{player:n.nodes[2]}).complete);assert(n.nodes.every(p=>p.lit));assert(!visit(n,10,{player:n.nodes[2]}).complete);
});
test('cache gathering takes 1.8 game seconds and pauses outside safety or during weather',()=>{
 for(const id of ids){const n={...node(id),variant:'cache'};const time=id==='ash'?16:10;visit(n,time);assert.equal(n.progress,.5);visit(n,time,{contested:true});visit(n,time,{player:{x:3,z:0}});advanceDiscovery(n,0,{time,player:{x:0,z:0}});assert.equal(n.progress,.5);
  if(id==='ash')visit(n,14);if(id==='coast')visit(n,time,{tide:{high:true}});if(id==='sand')visit(n,time,{sandstorm:{active:true}});assert.equal(n.progress,.5);assert(!visit(n,time).complete);assert(!visit(n,time).complete);assert(visit(n,time).complete);assert.equal(n.progress,1.8);assert(!visit(n,time).complete);
 }
});
test('new scenery is visible early but markers and rewards wait for discovery and restart cleanly',()=>{
 const w=buildWorld('forest',42);for(const n of w.discoveries.filter(n=>n.variant!=='native')){animateDiscoveries(w,0);assert(n.mesh.visible);assert(n.markers.every(m=>!m.visible));assert(!advanceDiscovery(n,.02,{time:n.availableAt-1,player:n}).found);assert(advanceDiscovery(n,.02,{time:n.availableAt,player:n,contested:true}).found);animateDiscoveries(w,100);assert(n.markers.every(m=>m.visible));n.claimed=true;animateDiscoveries(w,100);assert(n.mesh.visible);assert(n.markers.every(m=>!m.visible));}const fresh=buildWorld('forest',42);assert(fresh.discoveries.every(n=>!n.claimed&&!n.discovered&&n.progress===0));dispose(w);dispose(fresh);
});

test('enemies near the end of a trail block gathering, not just enemies near its center',()=>{
 const n={...node('forest'),variant:'trail',nodes:[{x:-2.4,z:0},{x:0,z:1.4},{x:2.4,z:0}]};
 assert(discoveryThreatened(n,5,0,4.5));assert(!discoveryThreatened(n,8,0,4.5));assert(!discoveryThreatened(node('forest'),5,0,4.5));assert(discoveryThreatened(node('forest'),3,0,4.5));
});

const emptyRegion=()=>({group:new T.Group(),regional:true,half:100,spawn:{x:0,z:0},obstacles:[],sites:[],ponds:[],patches:[]});
const sceneryPoints=n=>{const points=[];n.mesh.updateMatrixWorld(true);n.mesh.children[0].traverse(m=>{if(!m.isMesh)return;const p=m.geometry.attributes.position;for(let i=0;i<p.count;i++)points.push(new T.Vector3().fromBufferAttribute(p,i).applyMatrix4(m.matrixWorld));});return points;};
test('narrow trail placement falls back without shrinking node clearances or advancing map RNG',()=>{
 for(const id of ids){
  const w=emptyRegion();w.contains=(x,z)=>[18,36,54].some(center=>Math.hypot(x,z-center)<2.1);let draws=0;
  installDiscoveries(w,id,()=>{draws++;return 0;});assert.equal(draws,9);assert.equal(w.discoveries[1].variant,'cache');
  const n=w.discoveries[1];assert.deepEqual(n.mesh.children[0].scale.toArray(),[1,1,1]);assert.equal(n.nodes.length,0);
  assert(sceneryPoints(n).every(p=>Math.hypot(p.x-n.x,p.z-n.z)>=.65));assert.equal(n.availableAt,45);assert.equal(n.markers.length,1);
 }
});

test('cache scenery tries another full-size orientation before falling back to its native find',()=>{
 const w=emptyRegion();w.ponds=[{x:0,z:55.6,rx:2,rz:.4,r:2.24}];let draws=0;
 installDiscoveries(w,'forest',()=>{draws++;return 0;});const n=w.discoveries[2];
 assert.equal(draws,9);assert.equal(n.variant,'cache');assert.notEqual(n.mesh.children[0].rotation.y,0);assert.equal(n.availableAt,80);
 assert.deepEqual(n.mesh.children[0].scale.toArray(),[1,1,1]);assert(sceneryPoints(n).every(p=>waterDepth(w.ponds[0],p.x,p.z)===0));
 const tight=emptyRegion();tight.ponds=Array.from({length:12},(_,i)=>({x:Math.sin(i*Math.PI/6)*1.2,z:54+Math.cos(i*Math.PI/6)*1.2,rx:.22,rz:.22,r:.25}));let tightDraws=0;
 installDiscoveries(tight,'forest',()=>{tightDraws++;return 0;});const fallback=tight.discoveries[2];
 assert.equal(tightDraws,draws);assert.equal(fallback.variant,'native');assert.deepEqual([fallback.x,fallback.z,fallback.availableAt,fallback.phase],[n.x,n.z,n.availableAt,n.phase]);
 assert.equal(fallback.mesh.visible,false);assert.equal(fallback.markers.length,1);assert.equal(discoveryInfo(fallback).name,'蜜露花丛');
});

test('inland scenery stays wholly dry, including the snow seed 3 sled regression, while coast wreckage may touch water',()=>{
 const point=new T.Vector3();let inland=0,coastContact=false;
 for(const map of['forest','snow','confluence','coast'])for(const seed of[1,3,7,8]){
  const w=buildWorld(map,seed);w.group.updateMatrixWorld(true);
  const ponds=w.ponds.map(p=>p.baseRx===undefined?p:{...p,rx:p.baseRx*1.19,rz:p.baseRz*1.19,r:Math.max(p.baseRx,p.baseRz)*1.19*1.12});
  for(const n of w.discoveries.filter(n=>n.variant!=='native')){
   n.mesh.children[0].traverse(m=>{if(!m.isMesh)return;const p=m.geometry.attributes.position;for(let i=0;i<p.count;i++){
    point.fromBufferAttribute(p,i).applyMatrix4(m.matrixWorld);const wet=ponds.some(pond=>waterDepth(pond,point.x,point.z)>0);
    if(n.id==='coast')coastContact||=wet;else assert(!wet,`${map} ${seed} ${n.id} ${n.variant} scenery over water`);
   }});
   if(n.id!=='coast')inland++;
  }
  if(map==='snow'&&seed===3)assert.equal(w.discoveries[2].variant,'native','the original sled location cannot fit its full dry envelope');
  dispose(w);
 }
 assert(inland>10);assert(coastContact,'intentional driftwood at the shoreline was unnecessarily moved');
});

test('dry fitting preserves all seeded placement, timing and downstream gameplay data',()=>{
 const hashes={forest:'051a9fa8446da70b916b8ab19075686cfefec4e0c82013ced126fa7e2ce3c3cc',snow:'42678fb6ad80dede767adf9f94918c74d91cee6076eca3ddca9b3a76db43e024',ash:'abb6ef5bef6c25512584c7bf60bd3e620c0800d2760d45e88fb469dd7ce57af3',sand:'315d8c732fc1d39a60f2cd16a6ff202eeaf272513f9054b4df44296a6ff39ff0',coast:'78c26ae59f7e231f37c07e5e5a0d00dd2e7261bd287cae60f3eb33ae05d3e0ff',confluence:'7a3deaec63ea8a4b498a9773ea1b3e2682106e32e6acdb8713cf6e72249f9ad7'};
 for(const [id,hash]of Object.entries(hashes)){
  const w=buildWorld(id,3),data={spawn:w.spawn,obstacles:w.obstacles.map(o=>[o.x,o.z,o.r]),patches:w.patches.map(p=>[p.x,p.z,p.r,p.kind]),sites:w.sites.map(s=>[s.x,s.z]),finds:w.discoveries.map(n=>[n.x,n.z,n.phase,n.availableAt]),roaming:w.roaming.map(n=>[n.x,n.z])};
  assert.equal(createHash('sha256').update(JSON.stringify(data)).digest('hex'),hash,id+' dry-fitting consumed randomness or moved game objects');dispose(w);
 }
});
