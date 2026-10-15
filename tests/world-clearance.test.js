import test from'node:test';
import assert from'node:assert/strict';
import{buildWorld,clearAt,moveActor}from'../world.js';
import{MAP_HALF}from'../map-layout.js?v=202';
import{bodyTravel}from'../actor-collision.js?v=202';
import{installForestVista}from'../forest-vista.js';
import{installForestHabitats}from'../forest-habitats.js';
import{installBiomePlaces}from'../biome-places.js?v=202';

globalThis.document={createElement:()=>({getContext:()=>({fillRect(){}})})};
// Frozen pre-optimization predicate, including its original coercion and bounds.
const legacy=(world,x,z,r=.45)=>Math.abs(x)<(world.half||MAP_HALF)-r&&Math.abs(z)<(world.half||MAP_HALF)-r&&!world.obstacles.some(o=>Math.hypot(x-o.x,z-o.z)<r+o.r);
const make=(id,seed)=>{const w=buildWorld(id,seed);installForestVista(w,id);installForestHabitats(w,id);installBiomePlaces(w,id);return w;};
const dispose=w=>w.group.traverse(o=>{if(o.isInstancedMesh)o.dispose();if(o.userData.ownedGeometry)o.geometry.dispose();});
const maps=['forest','snow','ash','sand','coast','confluence'],radii=[0,.12,.45,.65,1.6,3.25];

test('fast clearance matches the old query across real seeded maps, new places and actor sizes',()=>{
 let checked=0;
 for(const id of maps)for(const seed of[7,522,43837033]){
  const w=make(id,seed),points=[w.spawn,...w.sites,...w.biomePlaces.flatMap(p=>[p,p.entrance,p.exit])];
  for(let x=-w.half;x<=w.half;x+=w.half/6)for(let z=-w.half;z<=w.half;z+=w.half/6)points.push({x,z});
  for(const p of points)for(const r of radii){assert.equal(clearAt(w,p.x,p.z,r),legacy(w,p.x,p.z,r),id+' seed '+seed+' '+JSON.stringify([p.x,p.z,r]));checked++;}
  // Include normals, tangencies and either side of real walls, not only open ground.
  const obstacles=w.obstacles.filter((o,i)=>i%17===0||o.place&&i%7===0);
  for(const o of obstacles)for(const r of[.12,.45,1.6])for(const angle of[0,.37,Math.PI/4,2.73])for(const offset of[-1e-7,0,1e-7]){
   const reach=o.r+r+offset,x=o.x+Math.cos(angle)*reach,z=o.z+Math.sin(angle)*reach;
   assert.equal(clearAt(w,x,z,r),legacy(w,x,z,r),id+' real obstacle boundary');checked++;
  }
  dispose(w);
 }
 assert(checked>30000);
});

test('strict tangencies, map edges and exceptional numbers retain the original result',()=>{
 for(const half of[undefined,0,96,140,NaN,Infinity])for(const radius of[0,.12,.45,1.6,NaN,Infinity,-Infinity]){
  const w={half,obstacles:[]},limit=(half||MAP_HALF)-radius;
  for(const[x,z]of[[0,0],[limit,0],[-limit,0],[0,limit],[0,-limit],[limit-1e-8,0],[limit+1e-8,0],[NaN,0],[0,NaN],[Infinity,0]])assert.equal(clearAt(w,x,z,radius),legacy(w,x,z,radius));
 }
 for(const[x,z]of[[1,1],[3,4],[.1,.2],[.013,.071],[0,1],[1e-200,2e-200],[1e150,2e150],[1e300,2e300]]){
  const distance=Math.hypot(x,z);
  for(const ratio of[1-Number.EPSILON,1,1+Number.EPSILON]){
   const w={half:96,obstacles:[{x:-x,z:-z,r:distance*ratio}]};assert.equal(clearAt(w,0,0,0),legacy(w,0,0,0),'strict norm boundary '+[x,z,ratio]);
  }
 }
 for(const obstacle of[{x:NaN,z:0,r:1},{x:0,z:NaN,r:1},{x:0,z:0,r:NaN},{x:0,z:0,r:Infinity},{x:Infinity,z:NaN,r:Infinity},{x:0,z:0,r:-1},{x:1e300,z:0,r:1e308},{x:undefined,z:0,r:1}]){
  const w={half:96,obstacles:[,obstacle]};for(const r of[0,.45,1.6])assert.equal(clearAt(w,0,0,r),legacy(w,0,0,r));
 }
});

// Freeze the old movement algorithm too: the public moveActor must preserve its
// slide order, body sweep, boss radius and post-contact remainder after this edit.
function legacyMove(world,p,dx,dz,r=.45){
 if(p.boss)r=1.6;const travel=bodyTravel(world,p,dx,dz,r);const x=p.x+dx*travel,z=p.z+dz*travel;
 if(legacy(world,x,z,r)){p.x=x;p.z=z;if(travel===1)return;dx*=1-travel;dz*=1-travel;}
 const sx=p.x+dx*bodyTravel(world,p,dx,0,r);if(legacy(world,sx,p.z,r))p.x=sx;
 const sz=p.z+dz*bodyTravel(world,p,0,dz,r);if(legacy(world,p.x,sz,r))p.z=sz;
}
test('moveActor retains walking, corner sliding and body-contact results beside new solids',()=>{
 for(const id of maps){
  const w=make(id,522),spots=[w.spawn,{x:w.half-.5,z:w.half-.5},...w.biomePlaces.flatMap(p=>[p.entrance,p,...p.solids.slice(0,3).map(o=>({x:o.x+o.r+.46,z:o.z}))])];
  for(const start of spots)for(const boss of[false,true]){
   const a={...start,boss,size:.65},b={...start,boss,size:.65},neighbor={x:start.x+.65,z:start.z+.63,size:.6,alive:true};
   const modernWorld={...w,solidActors:function*(){yield a;yield neighbor;}},oldWorld={...w,solidActors:function*(){yield b;yield neighbor;}};
   for(let i=0;i<24;i++){
    const dx=Math.sin(i*.79)*.24,dz=Math.cos(i*.57)*.24;moveActor(modernWorld,a,dx,dz,.45);legacyMove(oldWorld,b,dx,dz,.45);
    assert.equal(a.x,b.x,id+' movement x changed');assert.equal(a.z,b.z,id+' movement z changed');
   }
  }
  dispose(w);
 }
});
