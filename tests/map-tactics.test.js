import{test}from'node:test';import assert from'node:assert/strict';
import * as T from '../vendor/three.module.js';
import{buildWorld,clearAt}from'../world.js';import{iceMotion,onIce,onFord,damageTerrain,updateTactics}from'../map-tactics.js';import{terrainAt}from'../water.js';import{updateTide}from'../coast.js';import{advanceRoaming,courierDirection}from'../roaming-events.js';
globalThis.document={createElement:()=>({getContext:()=>({fillRect(){}})})};
const dispose=w=>w.group.traverse(o=>{if(o.isInstancedMesh)o.dispose();if(o.userData.ownedGeometry)o.geometry.dispose();});
test('five biomes keep two optional encounters clear of primary objectives across seeds',()=>{
 for(const id of['forest','snow','ash','sand','coast'])for(let seed=1;seed<=30;seed++){const w=buildWorld(id,seed);assert.equal(w.roaming.length,2,id+' '+seed);for(const s of w.roaming){assert(clearAt(w,s.x,s.z,4.5));assert.equal(s.half,w.half);if(s.kind==='camp')assert(Math.hypot(s.x-w.spawn.x,s.z-w.spawn.z)>=55);assert(w.sites.every(p=>Math.hypot(p.x-s.x,p.z-s.z)>=15));assert(!s.mesh.visible);assert.equal(s.state,'hidden');}if(id==='forest')assert.equal(w.breakables.length,6);if(id==='sand')assert(w.breakables.length>0);if(id==='snow')assert(w.ice.length>0);if(id==='coast'){assert(w.fords.length>=2&&w.fords.length<=3);assert(w.fords.length<w.ponds.length);}dispose(w);}
});
test('ice momentum has frame independent stopping distance and restores ordinary control off ice',()=>{
 const distances=[];for(const fps of[15,30,60,120]){const p={iceVX:6,iceVZ:0};let x=0;for(let i=0;i<fps;i++)x+=iceMotion(p,0,0,1/fps,true).x;distances.push(x);assert(p.iceVX<.06);assert.deepEqual(iceMotion(p,0,3,.1,false),{x:0,z:.30000000000000004});}assert(Math.max(...distances)-Math.min(...distances)<1e-8);
});
test('low tide ford is traversable, floods at high tide, and bridges retain normal movement',()=>{
 const w=buildWorld('coast',8),f=w.fords[0];updateTide(w,0);assert(onFord(w,f.x,f.z));const c=Math.cos(f.angle||0),s=Math.sin(f.angle||0);assert(onFord(w,f.x+c*f.half*.6,f.z-s*f.half*.6));assert(!onFord(w,f.x+s*3,f.z+c*3));assert.equal(terrainAt(w,f.x,f.z).kind,'ford');assert(terrainAt(w,f.x,f.z).speed>.9);updateTide(w,20);assert(!onFord(w,f.x,f.z));assert(terrainAt(w,f.x,f.z).depth>.6);const b=w.bridges[0];assert.equal(terrainAt(w,b.x,b.z).speed,1);dispose(w);
});
test('ice has a bounded footprint and reports the matching terrain type',()=>{const w=buildWorld('snow',7),p=w.ice[0];assert(onIce(w,p.x,p.z));assert.equal(terrainAt(w,p.x,p.z).kind,'ice');assert(!onIce(w,200,200));dispose(w);});
test('timber creates temporary solid cover without trapping occupants and clears on expiry',()=>{
 const w=buildWorld('forest',9),o=w.breakables[0],player={x:o.x,z:o.z+1,size:.45},foes=[],context={player,foes,clear:(x,z,r)=>clearAt(w,x,z,r),fx(){}};
 assert(damageTerrain(o,100,{x:o.x,z:o.z-2}));assert.equal(o.state,'falling');updateTactics(w,0,context);assert.equal(o.age,0);for(let i=0;i<46;i++)updateTactics(w,1/60,context);assert.equal(o.state,'fallen');assert(!w.obstacles.includes(o));assert(w.obstacles.filter(b=>b.owner===o).every(b=>Math.hypot(b.x-player.x,b.z-player.z)>.7));assert(!damageTerrain(o,100,player));for(let i=0;i<500;i++)updateTactics(w,1/60,context);assert.equal(o.state,'spent');assert(!w.obstacles.some(b=>b.owner===o));dispose(w);
});
test('fallen timber proxies retain their layout and use the real rotated mesh height',()=>{
 for(const angle of[0,.7,2.5]){
  const w=buildWorld('forest',9),o=w.breakables[0],player={x:1000,z:1000,size:.45},context={player,foes:[],clear:()=>true,fx(){}};
  damageTerrain(o,12,{x:o.x,z:o.z-2});
  damageTerrain(o,100,{x:o.x-Math.sin(angle)*2,z:o.z-Math.cos(angle)*2});
  updateTactics(w,.75,context);
  const proxies=w.obstacles.filter(b=>b.owner===o);assert.equal(proxies.length,5);
  const vertex=new T.Vector3();let top=-Infinity;
  o.mesh.traverse(mesh=>{if(mesh.isMesh){const positions=mesh.geometry.attributes.position;for(let i=0;i<positions.count;i++)top=Math.max(top,vertex.fromBufferAttribute(positions,i).applyMatrix4(mesh.matrixWorld).y);}});
  assert(top>.15&&top<1.08,`the real low trunk should be jumpable, got ${top}`);
  for(const [i,b]of proxies.entries()){
   assert(Number.isFinite(b.height));assert(Math.abs(b.height-top)<1e-6);assert.equal(b.sceneryHeight,b.height);assert.equal(b.r,.34);
   const distance=.35+i*.66;assert(Math.abs(b.x-o.x-Math.sin(angle)*distance)<1e-6);assert(Math.abs(b.z-o.z-Math.cos(angle)*distance)<1e-6);
  }
  const height=proxies[0].height;updateTactics(w,1,context);assert(proxies.every(b=>b.height===height));
  updateTactics(w,7,context);assert(!w.obstacles.some(b=>b.owner===o));dispose(w);
 }
});
test('broken timber has a broad fractured end, bounded roots and shared bark detail across world rebuilds',()=>{
 const first=buildWorld('forest',9),second=buildWorld('forest',31),model=first.breakables[0].mesh.getObjectByName('breakable-dead-timber'),geometry=model.geometry,material=model.material;
 assert(geometry.index.count/3<=800,'a six-log detail pass exceeded the small shared geometry budget');
 const box=geometry.boundingBox;assert(box.min.x>=-.782&&box.max.x<=.784&&box.min.y>=-.116&&box.max.y<=3.420&&box.min.z>=-.569&&box.max.z<=.569,'new timber escaped its original safe envelope');
 const p=geometry.attributes.position,cut=geometry.attributes.timberCut,grain=geometry.attributes.timberGrain;assert.equal(grain.count,p.count);assert.equal(cut.count,p.count);
 for(const attr of Object.values(geometry.attributes))assert(Array.from(attr.array).every(Number.isFinite),'bark or end-grain attributes contain invalid vertices');
 const top=[];for(let i=0;i<p.count;i++)if(cut.getX(i)===1&&p.getY(i)>3)top.push({y:p.getY(i),r:Math.hypot(p.getX(i),p.getZ(i))});
 assert(top.length>=20&&Math.max(...top.map(v=>v.r))>.20,'snapped trunk narrowed back into a pointed pole');
 assert(Math.max(...top.map(v=>v.y))-Math.min(...top.map(v=>v.y))>.15,'exposed end became a flat saw-cut disk');
 const shader={uniforms:{},vertexShader:T.ShaderLib.standard.vertexShader,fragmentShader:T.ShaderLib.standard.fragmentShader};material.onBeforeCompile(shader);
 assert(shader.vertexShader.includes('timberPoint=timberGrain'),'grooves will slide when the timber falls');
 assert(shader.fragmentShader.includes('smoothstep(.018,.085,timberPixel)'),'distant bark grain can shimmer');
 assert.equal(Object.keys(shader.uniforms).length,0,'static timber introduced timers or texture uniforms');assert.equal(material.map,null);assert.equal(material.bumpMap,null);
 for(const w of[first,second])for(const o of w.breakables){const m=o.mesh.getObjectByName('breakable-dead-timber');assert.equal(m.geometry,geometry);assert.equal(m.material,material);assert.equal(o.hp,42);assert.equal(o.state,'standing');assert.equal(o.r,.65);assert(m.castShadow&&m.receiveShadow);assert.equal(o.mesh.children.length,1,'timber detail added draw calls');assert(!m.userData.ownedGeometry);}
 let released=0;const onDispose=()=>released++;geometry.addEventListener('dispose',onDispose);dispose(first);assert.equal(released,0,'one world disposed another world\'s timber');
 const third=buildWorld('forest',9);assert.equal(third.breakables[0].mesh.children[0].geometry,geometry);dispose(second);dispose(third);assert.equal(released,0);geometry.removeEventListener('dispose',onDispose);
});
test('damaged walls remain solid until they collapse and repeated hits do not restart collapse',()=>{
 const w=buildWorld('sand',12),o=w.breakables[0],context={player:w.spawn,foes:[],clear:()=>true,fx(){}};assert(damageTerrain(o,40,w.spawn));assert.equal(o.state,'standing');assert(w.obstacles.includes(o));damageTerrain(o,60,w.spawn);updateTactics(w,.3,context);assert(!damageTerrain(o,10,w.spawn));updateTactics(w,.3,context);assert.equal(o.state,'spent');assert(!w.obstacles.includes(o));dispose(w);
});
function fixture(kind){const s={kind,x:0,z:0,availableAt:25,state:'hidden',discovered:false,members:[],remaining:18,mesh:{visible:false,position:{set(){}},scale:{y:1}},variant:0},out={rewards:0,removed:0,notices:0},c={time:30,player:{x:10,z:0},spawn:(role,x,z)=>({role,x,z,hp:20,maxHp:20,alive:true,id:1}),remove(){out.removed++},reward(){out.rewards++},notify(){out.notices++}};return{s,c,out};}
test('courier can be ignored, chased, escaped or defeated, with no rewards for escape',()=>{
 const {s,c,out}=fixture('courier');advanceRoaming(s,1,c);assert.equal(s.state,'waiting');assert.equal(s.remaining,18);assert.equal(courierDirection(s.runner,c.player,0),null);c.player.x=7;advanceRoaming(s,1,c);assert.equal(s.state,'running');assert.equal(s.remaining,17);assert(courierDirection(s.runner,c.player,0).x<0);advanceRoaming(s,0,c);assert.equal(s.remaining,17);advanceRoaming(s,18,c);assert.equal(s.state,'escaped');assert.equal(out.removed,1);assert.equal(out.rewards,0);advanceRoaming(s,1,c);assert.equal(out.removed,1);
});
test('courier reward waits for physical collection and is delivered once',()=>{const {s,c,out}=fixture('courier');advanceRoaming(s,.1,c);s.runner.alive=false;s.runner.hp=0;advanceRoaming(s,.1,c);assert.equal(s.state,'reward');assert.equal(out.rewards,0);c.player.x=0;advanceRoaming(s,.1,c);advanceRoaming(s,.1,c);assert.equal(out.rewards,1);});
test('camp requires approaching, spawns a bounded guard group and only rewards after clearing',()=>{const{s,c,out}=fixture('camp');advanceRoaming(s,.1,c);assert.equal(s.members.length,0);c.player.x=5;advanceRoaming(s,.1,c);assert.equal(s.members.length,3);assert.equal(out.rewards,0);s.members.forEach(e=>e.alive=false);advanceRoaming(s,.1,c);assert.equal(s.state,'reward');c.player.x=0;advanceRoaming(s,.1,c);advanceRoaming(s,.1,c);assert.equal(out.rewards,1);});
test('timers, distance, boss state and failed spawns cannot award free side rewards',()=>{for(const kind of['camp','courier']){const{s,c,out}=fixture(kind);advanceRoaming(s,1,{...c,time:0});assert(!s.discovered);advanceRoaming(s,1,{...c,boss:true});assert(!s.discovered);advanceRoaming(s,1,{...c,player:{x:50,z:50}});assert(!s.discovered);advanceRoaming(s,1,{...c,player:{x:0,z:0},spawn:()=>null});assert.equal(out.rewards,0);assert.equal(s.state,'waiting');}});
