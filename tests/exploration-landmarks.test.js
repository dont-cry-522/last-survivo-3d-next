import test from'node:test';
import assert from'node:assert/strict';
import * as T from'../vendor/three.module.js';
import{buildWorld,clearAt,moveActor,animateWorld}from'../world.js';
import{installForestVista}from'../forest-vista.js';
import{installForestHabitats}from'../forest-habitats.js';
import{installBiomePlaces,placeTemplate}from'../biome-places.js?v=180';
import{installExplorationRoutes}from'../exploration-routes.js';
import{installExplorationLandmarks}from'../exploration-landmarks.js';
import{createOverheadQuery}from'../adventure-overheads.js';

globalThis.document={createElement:()=>({getContext:()=>({fillRect(){}})})};
const maps=['forest','snow','ash','sand','coast','confluence'];
function create(id,seed){const w=buildWorld(id,seed);installForestVista(w,id);installForestHabitats(w,id);return w;}
const cleanup=w=>w.group.traverse(o=>{if(o.isInstancedMesh)o.dispose();if(o.userData.ownedGeometry)o.geometry.dispose();});
const gameplay=w=>JSON.stringify({spawn:w.spawn,sites:w.sites.map(s=>[s.x,s.z,s.type,s.event,s.claimed,s.discovered,s.availableAt]),finds:w.discoveries.map(d=>[d.x,d.z,d.claimed,d.discovered,d.nodes]),roaming:w.roaming.map(r=>[r.x,r.z,r.state]),tactics:w.breakables.map(o=>[o.x,o.z,o.r,o.hp,o.state])});

test('both authored variants in five biomes have bounded shared geometry and broad traversable centers',()=>{
 const v=new T.Vector3();for(const id of maps.slice(0,5))for(const variant of[0,1]){
  const p=placeTemplate(id,variant);assert.equal(p.variant,variant);assert.strictEqual(placeTemplate(id,variant),p);assert(p.batches.length<=7);assert(p.solids.length<=100,id+' collision budget '+p.solids.length);
  let triangles=0;for(const b of p.batches){const geo=b.geometry;triangles+=geo.index.count/3;assert(geo.attributes.color&&geo.attributes.normal);assert([...geo.attributes.position.array].every(Number.isFinite));for(let i=0;i<geo.attributes.position.count;i++){v.fromBufferAttribute(geo.attributes.position,i);assert(Math.abs(v.x)<=9.5&&Math.abs(v.z)<=8.5,id+' bounds '+v.toArray());}}
  assert(triangles<25000,id+' triangle budget '+triangles);
  for(const s of p.solids)assert(Math.abs(s.x)-s.r>=3-.01,id+' central path narrowed');
 }
 for(const id of maps.slice(0,5)){
  const a=placeTemplate(id),b=placeTemplate(id,1),shape=p=>p.batches.map(b=>Array.from(b.geometry.attributes.position.array));
  assert.notStrictEqual(a,b);assert.notDeepEqual(shape(a),shape(b),id+' repeats the same geometry with a new label');
  assert.strictEqual(placeTemplate(id,99),a,'unknown variants must not allocate unbounded templates');
 }
});

test('every biome gains two real places without changing rewards, tactical assets or closing safe routes',()=>{
 for(const id of maps)for(const seed of[7,522,43837033]){
  const w=create(id,seed),before=gameplay(w),tactical=w.breakables.map(o=>o.mesh),places=installBiomePlaces(w,id);
  assert.equal(places.length,id==='confluence'?10:2,id+' '+seed+' '+JSON.stringify(w.biomePlaceSkips));assert.strictEqual(installBiomePlaces(w,id),places);assert.equal(gameplay(w),before);assert(tactical.every(m=>m.parent));
  for(const biome of id==='confluence'?maps.slice(0,5):[id])assert.deepEqual(places.filter(p=>p.biome===biome).map(p=>p.variant),[0,1],biome+' did not install both variants');
  const markers=installExplorationLandmarks(w,id);assert.equal(markers.length,id==='confluence'?5:1);assert(markers.every(m=>m.place&&places.includes(m.place)&&m.mesh===m.place.mesh));
  assert(clearAt(w,w.spawn.x,w.spawn.z,.45));
  for(const p of places){
   assert(p.mesh.parent===w.group&&p.solids.every(o=>w.obstacles.includes(o)&&o.mesh.parent===p.mesh&&o.sceneryHeight===o.height));
   const player={x:p.entrance.x,z:p.entrance.z},dx=(p.exit.x-player.x)/80,dz=(p.exit.z-player.z)/80;
   for(let i=0;i<80;i++)moveActor(w,player,dx,dz,.45);
   assert(Math.hypot(player.x-p.exit.x,player.z-p.exit.z)<.01,id+' passage blocked '+seed);
  }
  const routes=installExplorationRoutes(w);assert(routes.every(r=>r.points.length>=2),id+' unreachable reward '+seed);
  animateWorld(w,2,w.spawn.x,w.spawn.z);assert.equal(gameplay(w),before);cleanup(w);
 }
});

test('places own only installed copies and do not leak disposed foliage or shared resources',()=>{
 const a=create('coast',7),b=create('coast',522);installBiomePlaces(a,'coast');installBiomePlaces(b,'coast');installExplorationLandmarks(a,'coast');
 const originals=[0,1].flatMap(v=>placeTemplate('coast',v).batches.map(b=>b.geometry)),owned=[];a.group.traverse(m=>{if(m.userData.ownedGeometry&&m.name.startsWith('SM_Place'))owned.push(m.geometry);});let disposed=0,shared=0;
 owned.forEach(g=>g.addEventListener('dispose',()=>disposed++));originals.forEach(g=>g.addEventListener('dispose',()=>shared++));
 const q=createOverheadQuery(a);assert(a.biomePlaces.every(p=>p.mesh.children.filter(m=>m.userData.placeOverhead).every(m=>q.meshes.includes(m))));
 cleanup(a);assert.equal(disposed,owned.length);assert.equal(shared,0);assert(b.biomePlaces.every(p=>p.mesh.parent));cleanup(b);
 for(const id of['forest','snow','confluence']){const w=create(id,522);installBiomePlaces(w,id);for(const scope of[w,...w.regions||[]])assert(scope.foliage.every(f=>{let p=f.leaf;while(p&&p!==w.group)p=p.parent;return p===w.group;}));cleanup(w);}
});
