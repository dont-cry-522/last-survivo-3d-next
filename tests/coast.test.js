import{HERO_DODGES}from'../hero-dodge.js';
import{coastProp}from'../coast-models.js';
import test from 'node:test';import assert from 'node:assert/strict';
import{tideState,updateTide,harpoonHit,tideDashTravel,bridgeContains}from'../coast.js';import{coastLayout}from'../coast-layout.js';import{buildWorld,clearAt}from'../world.js';import{terrainAt,waterDepth,buildPonds}from'../water.js';import{createMapEvent,advanceMapEvent}from'../map-events.js';import{weaponStats,takeUpgrade,chooseUpgrades,seeded}from'../rules.js';import{recordVictory}from'../expedition.js';import * as T from'../vendor/three.module.js';
globalThis.document={createElement:()=>({width:256,height:256,getContext:()=>({fillRect(){}})})};
test('ordinary coastal cargo replaces repeated posts within the unchanged solid footprint and random stream',()=>{
 const kinds=new Set(),point=new T.Vector3();let randomCalls=0;
 for(const index of[4,1,2,7]){
  const root=new T.Group(),radius=coastProp(root,index,()=>{randomCalls++;return .5;});kinds.add(root.userData.coastPropKind);
  assert.equal(radius,.35);assert(root.children.length<=3);root.updateMatrixWorld(true);
  root.traverse(mesh=>{if(!mesh.isMesh)return;const p=mesh.geometry.attributes.position;for(let i=0;i<p.count;i++){point.fromBufferAttribute(p,i).applyMatrix4(mesh.matrixWorld);assert(Math.hypot(point.x,point.z)<=radius+1e-6,'visible cargo exceeds its existing solid');assert(point.y>=-1e-6&&Number.isFinite(point.y));}});
 }
 assert.equal(randomCalls,0);assert.equal(kinds.size,4);
});
test('coastal bridges cross expanded water with dry and obstacle-free entrances for 30 seeds',()=>{for(let seed=0;seed<30;seed++){const w=buildWorld('coast',seed);assert(w.ponds.length>=7&&w.ponds.length<=8);assert.equal(w.bridges.length,4);assert.equal(w.sites[0].event,'lighthouse');assert(clearAt(w,w.spawn.x,w.spawn.z,1));for(const s of w.sites)assert(clearAt(w,s.x,s.z,3));updateTide(w,21);for(const b of w.bridges){assert.equal(terrainAt(w,b.x,b.z).speed,1);assert(w.ponds.some(p=>waterDepth(p,b.x,b.z)>.8));for(const sign of[-1,1])for(const side of[-1,0,1]){const c=Math.cos(b.angle),s=Math.sin(b.angle),x=b.x+c*sign*(b.width/2+.5)+s*side*b.length/2,z=b.z-s*sign*(b.width/2+.5)+c*side*b.length/2;assert(clearAt(w,x,z,.5),'bridge blocked '+seed);assert(w.ponds.every(p=>waterDepth(p,x,z)===0),'landing floods '+seed);}}w.group.traverse(o=>{if(o.isInstancedMesh)o.dispose();});}});
test('tide warns before rising, expands visual and physical shores, and returns without drift',()=>{const w=buildWorld('coast',2),p=w.ponds[0],rx=p.rx;assert(!tideState(13).warning);assert(tideState(15).warning&&!tideState(15).high);for(let cycle=0;cycle<20;cycle++){updateTide(w,cycle*28+21);assert(p.rx>rx*1.18);assert.equal(p.mesh.scale.x,p.rx);updateTide(w,cycle*28+1);assert.equal(p.rx,rx);}w.group.traverse(o=>{if(o.isInstancedMesh)o.dispose()});});
test('harpoon hits a narrow forward line, and both exclusive routes change their advertised properties',()=>{const o={x:0,z:0};assert(harpoonHit(o,{x:0,z:3},0,3.8,.48));assert(!harpoonHit(o,{x:1,z:2},0,3.8,.48));assert(!harpoonHit(o,{x:0,z:-1},0,3.8,.48));assert(!harpoonHit(o,{x:0,z:5},0,3.8,.48));for(const path of['harpoon_reef','harpoon_tow']){const p={heroId:'tide',weaponId:'harpoon',level:8,upgrades:{}},base=weaponStats(p);assert(!chooseUpgrades(p).some(s=>s.id==='fire'));for(let i=0;i<3;i++)assert(takeUpgrade(p,'path:'+path));const w=weaponStats(p);assert(w.damage>base.damage);assert(path==='harpoon_reef'?w.range>base.range:w.pull>base.pull&&w.slow>base.slow);assert(!takeUpgrade(p,'path:'+(path==='harpoon_reef'?'harpoon_tow':'harpoon_reef')));}});
test('lighthouse needs defeated guards and eight dry seconds, pauses and completes only once',()=>{const e=createMapEvent('lighthouse'),c={near:true,atCenter:true,guards:1,tide:tideState(1)};assert.equal(advanceMapEvent(e,.1,c).wave,1);advanceMapEvent(e,9,c);assert.equal(e.progress,0);c.guards=0;c.tide=tideState(15);advanceMapEvent(e,9,c);assert.equal(e.progress,0);c.tide=tideState(1);advanceMapEvent(e,3,c);assert.equal(e.progress,3);advanceMapEvent(e,20,{...c,near:false});assert.equal(e.progress,3);assert(advanceMapEvent(e,5,c).complete);assert(!advanceMapEvent(e,1,c).complete);});
test('dive has no forced displacement at any frame rate and new wins preserve old entries',()=>{for(const fps of[30,60,120]){let t=HERO_DODGES.tide.duration,d=0;while(t>0){const next=Math.max(0,t-1/fps);d+=tideDashTravel(next)-tideDashTravel(t);t=next;}assert.equal(d,0);}const j={relics:[],wins:['forest:rifle']};assert(recordVictory(j,'coast','harpoon'));assert(recordVictory(j,'forest','harpoon'));assert.equal(j.wins[0],'forest:rifle');assert(!recordVictory(j,'coast','harpoon'));});

test('seeded lagoon has connected branches, a dry island, safe rewards and unclipped high shores',()=>{
 const signatures=new Set(),counts=new Set();
 for(let seed=0;seed<200;seed++){
  const l=coastLayout(seeded(seed)),high=l.ponds.map(p=>({...p,rx:p.rx*1.19,rz:p.rz*1.19}));signatures.add(JSON.stringify(l.ponds));counts.add(l.ponds.length);assert.deepEqual(l,coastLayout(seeded(seed)));
  for(const [a,b]of[[0,1],[1,2],[2,3],[3,0],[4,0],[5,2]]){const p=l.ponds[a],q=l.ponds[b];let overlap=false;for(let u=-1.1;u<=1.1&&!overlap;u+=.05)for(let v=-1.1;v<=1.1&&!overlap;v+=.05){const x=p.x+Math.cos(p.angle)*u*p.rx+Math.sin(p.angle)*v*p.rz,z=p.z-Math.sin(p.angle)*u*p.rx+Math.cos(p.angle)*v*p.rz;overlap=waterDepth(p,x,z)>0&&waterDepth(q,x,z)>0;}assert(overlap,'disconnected reach '+seed+' '+a+'/'+b);}
  for(const [i,p]of[l.spawn,...l.sites,l.island,...l.districts].entries()){
   const radius=i===0?5:i===6?l.island.radius:i>6?6:3;
   for(let j=0;j<32;j++){const a=j/32*Math.PI*2,x=p.x+Math.cos(a)*radius,z=p.z+Math.sin(a)*radius;assert(high.every(q=>waterDepth(q,x,z)===0),'flooded safe space '+seed+' '+i);}
  }
  for(const p of high)for(let j=0;j<64;j++){const a=j/64*Math.PI*2,k=1+.07*Math.sin(a*3)+.045*Math.cos(a*5),u=Math.cos(a)*p.rx*k,v=Math.sin(a)*p.rz*k,x=p.x+Math.cos(p.angle)*u+Math.sin(p.angle)*v,z=p.z-Math.sin(p.angle)*u+Math.cos(p.angle)*v;assert(Math.abs(x)<92&&Math.abs(z)<92,'clipped high shore');}
 }
 assert.equal(signatures.size,200);assert.deepEqual([...counts].sort(),[7,8]);
});
test('angled bridge bounds match deck coordinates instead of the world-axis rectangle',()=>{
 const b={x:7,z:-3,width:30,length:3,angle:Math.PI/3},at=(x,z)=>({x:b.x+Math.cos(b.angle)*x+Math.sin(b.angle)*z,z:b.z-Math.sin(b.angle)*x+Math.cos(b.angle)*z});
 for(const x of[-14,0,14]){const p=at(x,1.4);assert(bridgeContains(b,p.x,p.z));const outside=at(x,2);assert(!bridgeContains(b,outside.x,outside.z));assert(bridgeContains(b,outside.x,outside.z,.6));}
 const end=at(16,0);assert(!bridgeContains(b,end.x,end.z));assert(bridgeContains(b,end.x,end.z,1.1));
 for(let seed=0;seed<200;seed++)for(const b of coastLayout(seeded(seed)).bridges)for(const end of[-1,1])for(const side of[-1,0,1]){const x=b.x+Math.cos(b.angle)*end*b.width/2+Math.sin(b.angle)*side*b.length/2,z=b.z-Math.sin(b.angle)*end*b.width/2+Math.cos(b.angle)*side*b.length/2;assert(bridgeContains(b,x,z),'exact rotated corner '+seed);}
});
test('shared coastal shading binds each rendered map and follows live tidal radii',()=>{
 const a=new T.Group(),b=new T.Group(),harbor=buildPonds(a,'coast',seeded(8),{},[]),regional=buildPonds(b,'coast',seeded(4),{},[],[{x:0,z:88,rx:12,rz:17},{x:34,z:112,rx:7,rz:11}]);
 assert.strictEqual(harbor[0].mesh.material,regional[0].mesh.material);
 assert(harbor[0].bank.renderOrder<harbor[0].mesh.renderOrder);
 const shader={uniforms:{},vertexShader:'#include <begin_vertex>',fragmentShader:'#include <color_fragment>'};harbor[0].mesh.material.onBeforeCompile(shader);
 harbor[0].mesh.onBeforeRender();assert.equal(shader.uniforms.coastCount.value,harbor.length);assert.equal(shader.uniforms.coastPonds.value[0].x,harbor[0].x);
 regional[0].mesh.onBeforeRender();assert.equal(shader.uniforms.coastCount.value,2);assert.equal(shader.uniforms.coastPonds.value[0].y,88);
 harbor[0].rx*=1.19;harbor[0].bank.onBeforeRender();assert.equal(shader.uniforms.coastCount.value,harbor.length);assert.equal(shader.uniforms.coastPonds.value[0].z,harbor[0].rx);
 for(const group of[a,b])group.traverse(o=>{if(o.isInstancedMesh)o.dispose();});
});
test('coastline reeds and stones stay out of intersecting deep water',()=>{
 const matrix=new T.Matrix4(),position=new T.Vector3();
 for(let seed=0;seed<30;seed++){const group=new T.Group(),ponds=buildPonds(group,'coast',seeded(seed),{},[]),batches=group.children.filter(o=>o.isInstancedMesh);assert.equal(batches.length,2);assert(batches[0].count<ponds.length*24);for(const batch of batches){for(let i=0;i<batch.count;i++){batch.getMatrixAt(i,matrix);position.setFromMatrixPosition(matrix);assert(ponds.every(p=>waterDepth(p,position.x,position.z)<.12),'interior shore prop');}batch.dispose();}}
});
test('authored confluence ponds are preserved and its regional bridges still cross water',()=>{
 const group=new T.Group(),locations=[{x:0,z:88,rx:12,rz:17},{x:34,z:112,rx:7,rz:11}],ponds=buildPonds(group,'coast',seeded(9),{x:0,z:0},[],locations);assert.equal(ponds.length,2);for(let i=0;i<2;i++)for(const key of['x','z','rx','rz'])assert.equal(ponds[i][key],locations[i][key]);
 group.traverse(o=>{if(o.isInstancedMesh)o.dispose();});
 const world=buildWorld('confluence',4),coast=world.regions.find(r=>r.id==='coast');assert.equal(coast.ponds.length,2);assert.equal(coast.bridges.length,2);updateTide(world,21);for(const b of coast.bridges){assert.equal(terrainAt(world,b.x,b.z).kind,'bridge');for(const side of[-1,1]){const x=b.x+Math.cos(b.angle)*side*(b.width/2+.5),z=b.z-Math.sin(b.angle)*side*(b.width/2+.5);assert(coast.ponds.every(p=>waterDepth(p,x,z)===0));}}world.group.traverse(o=>{if(o.isInstancedMesh)o.dispose();});
});
