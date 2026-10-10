import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../vendor/three.module.js';
import {WEAPON_PATHS} from '../rules.js';
import {SkillVFX} from '../skill-vfx.js';
import {weaponRouteEffect,WEAPON_ROUTE_LOOKS} from '../weapon-route-vfx.js';

const weapon=(pathId,pathRank=3)=>({id:WEAPON_PATHS[pathId].weapon,pathId,pathRank});
const event={combo:2,empowered:true,returning:true,targetSize:.6,x2:-2,z2:-1,stage:'snap'};
const cast=(v,id,phase,detail=event,rank=3)=>weaponRouteEffect(v,weapon(id,rank),phase,0,0,.4,detail);
const signature=v=>JSON.stringify(v.active.map(p=>[p.shape,p.mesh.material.color.getHex(),p.size,p.velocity]));

test('all routes produce distinct sibling silhouettes through the declared real events',()=>{
 assert.equal(Object.keys(WEAPON_ROUTE_LOOKS).length,Object.keys(WEAPON_PATHS).length);
 assert.deepEqual(Object.keys(WEAPON_ROUTE_LOOKS).sort(),Object.keys(WEAPON_PATHS).sort());
 const v=new SkillVFX(new T.Scene(),{mobile:true}),seen=new Map();
 for(const [id,look] of Object.entries(WEAPON_ROUTE_LOOKS)){
  assert.equal(look.weapon,WEAPON_PATHS[id].weapon);
  for(const phase of look.phases){
   v.clear();assert(cast(v,id,phase),id+' '+phase);
   assert(v.active.length>=1&&v.active.length<=6,id+' event must use 1–6 accents');
   assert(v.active.some(p=>p.priority===1),id+' needs a visible core');
   for(const p of v.active){
    assert(p.mesh.geometry,id+' missing geometry');
    assert(!['ring','disc','waterArc'].includes(p.shape),id+' must not suggest a range boundary');
    assert(p.life>0&&p.life<=.5);assert(p.opacity<=.85);
    assert.equal(p.mesh.material.blending,T.NormalBlending,id+' must not wash out enemies');
    assert(p.mesh.position.toArray().every(Number.isFinite));
    assert(p.mesh.scale.toArray().every(Number.isFinite));
    assert(p.velocity.every(Number.isFinite));
   }
  }
  v.clear();cast(v,id,look.phases[0]);
  const prior=seen.get(look.weapon);if(prior)assert.notEqual(signature(v),prior,'sibling routes must not share a look');
  seen.set(look.weapon,signature(v));
 }
});

test('conditional routes never claim a return, third strike or explosion that did not happen',()=>{
 const v=new SkillVFX(new T.Scene());
 for(const [id,phase,detail] of [
  ['shuriken_return','hit',{}],
  ['miasmalantern_lure','hit',{}],['miasmalantern_venom','hit',{}],['miasmalantern_venom','cast',{empowered:false}],
  ['harpoon_tow','hit',{combo:0}],['harpoon_tow','hit',{combo:1}]
 ]){assert.equal(cast(v,id,phase,detail),false);assert.equal(v.active.length,0);}
 for(const id of ['crossbow_hunt','shade_blight']){
  const phase=WEAPON_ROUTE_LOOKS[id].phases[0];
  cast(v,id,phase,{combo:1});const one=v.active.length;v.clear();
  cast(v,id,phase,{combo:2});const two=v.active.length;v.clear();
  cast(v,id,phase,{empowered:true});assert(v.active.length>two&&two>one,id+' third hit must look distinct');v.clear();
 }
 assert.equal(cast(v,'grimoire_echo','turn'),false);assert.equal(v.active.length,0);
});

test('route accents ignore unselected, foreign and unsupported routes and do not mutate combat state',()=>{
 const v=new SkillVFX(new T.Scene());
 for(const w of [{id:'rifle'},weapon('rifle_pierce',0),{...weapon('rifle_pierce'),id:'fire'},{id:'rifle',pathId:'unknown',pathRank:3},{id:'hammer',pathId:'hammer_guard',pathRank:3},{id:'hammer',pathId:'hammer_break',pathRank:3}]){
  assert.equal(weaponRouteEffect(v,w,'hit',0,0,0),false);assert.equal(v.active.length,0);
 }
 const w=Object.freeze({...weapon('rifle_pierce'),damage:73,rate:4,pierce:3}),detail=Object.freeze({...event});
 assert(weaponRouteEffect(v,w,'hit',0,0,0,detail));
 assert.equal(w.damage,73);assert.equal(w.rate,4);assert.equal(w.pierce,3);
 assert.equal(detail.x2,-2);assert.equal(v.limit,190);
});

test('bounce only connects supplied completed contacts, otherwise remains a local deflection',()=>{
 const v=new SkillVFX(new T.Scene());
 cast(v,'shade_echo','bounce',{});assert.equal(v.active.length,2);v.clear();
 cast(v,'shade_echo','bounce',{x2:3,z2:4});
 const trace=v.active.find(p=>Math.abs(p.size[1]-5)<1e-8);
 assert(trace);assert.equal(trace.priority,0);assert(trace.opacity<.5);
 v.clear();cast(v,'shade_echo','bounce',{x2:100,z2:100});assert.equal(v.active.length,2);
});

test('gravity and third-strike water carry movement inward, within their actual effect',()=>{
 const v=new SkillVFX(new T.Scene());
 cast(v,'dark_gravity','field',{radius:2.6});
 for(const p of v.active.filter(p=>p.shape==='crystal')){
  assert(Math.hypot(p.mesh.position.x,p.mesh.position.z)<2.6);
  assert(p.mesh.position.x*p.velocity[0]+p.mesh.position.z*p.velocity[2]<0,'gravity debris must move inward');
 }
 v.clear();weaponRouteEffect(v,weapon('harpoon_tow'),'hit',0,0,0,{combo:2});
 assert(v.active.every(p=>p.velocity[2]<0),'tow accent must flow back toward the wielder');
});

test('higher ranks strengthen shape rather than linearly increasing particle counts',()=>{
 const v=new SkillVFX(new T.Scene());
 for(const [id,look] of Object.entries(WEAPON_ROUTE_LOOKS))for(const phase of look.phases){
  v.clear();cast(v,id,phase,event,1);const low=v.active.length;
  v.clear();cast(v,id,phase,event,3);assert.equal(v.active.length,low,id+' '+phase);
 }
 v.clear();cast(v,'grimoire_wide','hit',{},1);const low=v.active.find(p=>p.shape==='claw').size[0];
 v.clear();cast(v,'grimoire_wide','hit',{},3);assert(v.active.find(p=>p.shape==='claw').size[0]>low);
});

test('ground-plane arcs and fan blades keep their plane across firing angles without changing pooled Euler order',()=>{
 const v=new SkillVFX(new T.Scene());
 for(const [id,phase,shape]of[['shuriken_return','turn','sweep'],['shuriken_fan','cast','claw'],['dark_gravity','field','sweep']])for(const angle of[0,Math.PI/2,Math.PI,-Math.PI/2]){
  v.clear();weaponRouteEffect(v,weapon(id),phase,0,0,angle);
  for(const p of v.active.filter(p=>p.shape===shape)){
   const normal=new T.Vector3(0,0,1).applyQuaternion(p.mesh.quaternion);
   assert(Math.abs(normal.y)>.999,id+' should lie over the ground at every angle');
   assert.equal(p.mesh.rotation.order,'XYZ','rotation convention must not leak to reused particles');
  }
 }
});

test('all route accents survive pool rejection, reuse and cleanup within the unchanged mobile budget',()=>{
 const scene=new T.Scene(),v=new SkillVFX(scene,{mobile:true}),entries=Object.entries(WEAPON_ROUTE_LOOKS);
 assert.equal(v.limit,110);
 for(let frame=0;frame<3600;frame++){
  if(frame%12===0)for(const[id,look]of entries)for(const phase of look.phases)cast(v,id,phase);
  v.update(1/60);
  assert(v.active.length+v.pool.length<=110);assert.equal(scene.children.length,v.active.length);
  for(const p of v.active)assert(p.mesh.position.toArray().every(Number.isFinite));
 }
 v.clear();for(let i=0;i<110;i++)v.particle('ember',0xffffff,0,0,0,{priority:2});
 for(const[id,look]of entries)for(const phase of look.phases)assert.doesNotThrow(()=>cast(v,id,phase));
 assert.equal(v.active.length,110);v.update(1);assert.equal(v.active.length,0);assert.equal(scene.children.length,0);
});

test('burn and blast routes preserve distinct slow tongues versus outward fracture, with timed cooling',()=>{
 const v=new SkillVFX(new T.Scene());cast(v,'fire_burn','hit');
 const tongues=v.active.filter(p=>p.shape==='flame');assert.equal(tongues.length,2);assert(tongues.every(p=>p.motion==='combust'&&p.endColor));
 assert(tongues.some(p=>p.delay>0&&!p.mesh.visible));assert(tongues.every(p=>Math.abs(p.velocity[0])<.3&&p.max>.4));
 v.clear();cast(v,'fire_blast','hit');assert.equal(v.active.length,5);
 const sparks=v.active.filter(p=>p.shape==='crystal');assert.equal(sparks.length,2);assert(sparks.every(p=>p.gravity>0&&p.size[1]>p.size[0]*4&&p.endColor));
 v.update(0);assert(v.active.some(p=>p.delay>0));v.update(1);assert.equal(v.active.length,0);
});

test('grimoire release pairs dark folded pages with thin delayed bright edges under the same accent cap',()=>{
 const v=new SkillVFX(new T.Scene());
 for(const angle of[0,.8,Math.PI]){
  v.clear();weaponRouteEffect(v,weapon('grimoire_wide'),'hit',0,0,angle,{radius:2});assert.equal(v.active.length,5);
  const pages=v.active.filter(p=>p.shape==='claw'&&p.delay===0),edges=v.active.filter(p=>p.shape==='claw'&&p.delay>0);
  assert.equal(pages.length,2);assert.equal(edges.length,2);
  for(let i=0;i<2;i++){assert(edges[i].size[0]<pages[i].size[0]/3);assert(edges[i].mesh.quaternion.angleTo(pages[i].mesh.quaternion)<1e-7);assert.equal(pages[i].mesh.material.blending,T.NormalBlending);}
 }
 v.update(1);assert.equal(v.active.length,0);
});

test('point route accents follow elevated contacts and compact views without changing floor effects',()=>{
 const v=new SkillVFX(new T.Scene()),contact=Object.freeze({x:8,y:3.7,z:-6,normal:Object.freeze({x:0,y:0,z:-1}),direction:Object.freeze({x:0,y:.3,z:1}),compact:true});
 const pointRoutes=[['rifle_pierce','hit'],['shotgun_fan','hit'],['shotgun_slug','hit'],['fire_burn','hit'],['crossbow_pierce','hit'],['crossbow_hunt','hit'],['shuriken_fan','hit'],['shuriken_return','hit'],['dark_seek','hit'],['shade_blight','mark'],['shadowblade_fan','hit'],['shadowblade_return','hit'],['harpoon_reef','hit'],['harpoon_tow','hit'],['boomerang_pincer','pet']];
 for(const[id,phase]of pointRoutes){
  v.clear();assert(cast(v,id,phase,{...event,contact}));
  assert(v.active.length>0&&v.active.length<=6);
  for(const p of v.active){assert(Math.abs(p.mesh.position.x-contact.x)<.7,id);assert(Math.abs(p.mesh.position.y-contact.y)<.45,id+' retained a fixed height');assert(Math.abs(p.mesh.position.z-contact.z)<.7,id);assert.equal(p.mesh.material.blending,T.NormalBlending);assert(p.max<=.4);assert(p.mesh.quaternion.toArray().every(Number.isFinite));}
 }
 const pose=()=>v.active.map(p=>[p.shape,...p.mesh.position.toArray(),...p.mesh.quaternion.toArray(),p.size,p.velocity,p.max,p.opacity]);
 for(const[id,phase]of[['miasmalantern_venom','hit'],['sporelantern_still','hit'],['sporelantern_roam','hit'],['fire_blast','hit'],['dark_gravity','field'],['grimoire_wide','hit'],['grimoire_echo','echo'],['boomerang_snare','trap'],['rifle_rapid','cast']]){
  v.clear();cast(v,id,phase,event);const original=pose();v.clear();cast(v,id,phase,{...event,contact});assert.deepEqual(pose(),original,id+' must keep its real ground/cast anchor');
 }
});

test('compact point routes reduce their actual bounds and bounce connects the two supplied 3D contacts',()=>{
 const v=new SkillVFX(new T.Scene()),contact={x:2,y:2.4,z:3,normal:{x:0,y:0,z:-1}};
 for(const id of['rifle_pierce','crossbow_hunt','dark_seek','shadowblade_return','harpoon_tow']){
  v.clear();cast(v,id,'hit',{...event,contact});const large=new T.Box3().setFromObject(v.scene).getSize(new T.Vector3()).length(),count=v.active.length;
  v.clear();cast(v,id,'hit',{...event,contact:{...contact,compact:true}});const small=new T.Box3().setFromObject(v.scene).getSize(new T.Vector3()).length();
  assert(small<large*.75,id);assert.equal(v.active.length,count);
 }
 v.clear();cast(v,'shade_echo','bounce',{contact,x2:0,y2:.6,z2:0});
 const trace=v.active.find(p=>p.max===.14&&p.priority===0),center=new T.Vector3(1,1.5,1.5);
 assert(trace);assert(trace.mesh.position.distanceTo(center)<1e-8);assert(Math.abs(trace.size[1]-Math.hypot(2,1.8,3))<1e-8);
 v.update(1);assert.equal(v.active.length,0);
});
