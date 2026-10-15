import test from 'node:test';
import assert from 'node:assert/strict';
import {nextHuntFormation,huntFormation,attackSlotAvailable,enemyRecovery,enemyApproach} from '../encounters.js';
import {MAP_ROSTERS,REGIONAL_ENEMIES,regionalEnemy} from '../map-enemies.js';
import {ENEMIES,seeded} from '../rules.js';
import {ENEMY_MOTION} from '../enemy-motion.js';

test('all five biomes have three deterministic native formations with a clear retreat side',()=>{
 const names=new Set();
 for(const biome of Object.keys(MAP_ROSTERS)){
  const random=seeded(204),again=seeded(204),seen=new Set();let previous=-1,other=-1;
  for(let cycle=0;cycle<30;cycle++){
   const variant=nextHuntFormation(previous,random);assert.equal(variant,nextHuntFormation(other,again));assert.notEqual(variant,previous);seen.add(variant);previous=other=variant;
   const f=huntFormation(biome,cycle,variant);names.add(f.name);
   assert.equal(f.squad.length,6);assert.equal(f.squad.filter(s=>s.elite).length,1);assert(f.tip.length>20);
   assert(f.squad.filter(s=>['spitter','shaman'].includes(s.role)).length<=2);
   assert(Math.max(...f.squad.map(s=>s.offset))-Math.min(...f.squad.map(s=>s.offset))<Math.PI-.5);
   assert.equal(f.squad.filter(s=>s.role!=='shaman').filter(s=>s.elite).length,1,'opening wave retains its elite when shamans are withheld');
   for(const slot of f.squad){const kind=regionalEnemy(biome,slot.role);assert(ENEMIES[kind]);assert(ENEMY_MOTION[kind]);if(biome!=='forest')assert.equal(REGIONAL_ENEMIES[kind].map,biome);assert((slot.delay||0)>=0&&(slot.delay||0)<=1.5);}
  }
  assert.equal(seen.size,3);
 }
 assert.equal(names.size,15);
 assert.equal(nextHuntFormation(0,()=>0),1);assert.equal(nextHuntFormation(0,()=>1),2);
});

test('same-frame crowds stagger telegraphs and preserve independent melee / ranged caps at all frame rates',()=>{
 for(const fps of[30,60,144])for(const role of['wolf','spitter']){
  const gap=role==='spitter'?.38:.28,cap=role==='spitter'?2:3,foes=Array.from({length:12},(_,id)=>({id,role,alive:true,wind:0,starts:[]}));let now=0;
  for(let frame=0;frame<fps*4;frame++){
   for(const e of foes)e.wind=Math.max(0,e.wind-1/fps);
   for(const e of foes)if(e.starts.length===0&&attackSlotAvailable(e,foes,now)){e.wind=.95;e.attackStartedAt=now;e.starts.push(now);}
   assert(foes.filter(e=>e.wind>0).length<=cap);now+=1/fps;
  }
  const starts=foes.flatMap(e=>e.starts).sort((a,b)=>a-b);assert(starts.length>=7,'coordination never starves the waiting squad');
  for(let i=1;i<starts.length;i++)assert(starts[i]-starts[i-1]>=gap-1e-9);
 }
 const melee={role:'wolf',alive:true,wind:.5,attackStartedAt:2},caster={role:'spitter',alive:true,wind:.5,attackStartedAt:2};
 assert(attackSlotAvailable({role:'shaman'},[melee],2));assert(attackSlotAvailable({role:'golem'},[caster],2));
 assert(!attackSlotAvailable({role:'golem'},[melee],2.1));melee.wind=0;assert(attackSlotAvailable({role:'golem'},[melee],2.1));
 melee.wind=.5;melee.alive=false;assert(attackSlotAvailable({role:'golem'},[melee],2.1));
});

test('recovery grants a counterattack opening without changing attack power or windups',()=>{
 for(const biome of Object.keys(MAP_ROSTERS))for(const role of['mushroom','wolf','golem','spitter','shaman']){
  const kind=regionalEnemy(biome,role),e={role,kind,pounceMissed:false},base=ENEMY_MOTION[kind].recover;
  assert.equal(enemyRecovery(e,base),role==='golem'?.82:base);
  e.pounceMissed=true;const recover=enemyRecovery(e,base);if(role==='wolf')assert.equal(recover,.62);if(role==='mushroom')assert.equal(recover,.36);
 }
});

test('cooling flankers reposition using only cooldown and position; helper checks are pause-safe',()=>{
 const player={x:0,z:0},e={id:2,role:'wolf',alive:true,x:0,z:3,cool:1,flank:1,packAngle:0},other={...e,id:3,flank:-1},before=JSON.stringify([e,other]);
 const a=enemyApproach(e,player,[other],true),b=enemyApproach(other,player,[e],true);
 assert(a.x>0&&b.x<0);assert(Math.abs(Math.hypot(a.x,a.z)-3.6)<1e-9);
 assert.deepEqual(enemyApproach({...e,cool:0},player,[other],true),player);
 for(let i=0;i<30;i++){assert.deepEqual(enemyApproach(e,{...player,dashTime:10,vx:90},[other],true),a);attackSlotAvailable(e,[other],3);enemyRecovery(e,.18);}
 assert.equal(JSON.stringify([e,other]),before);
});


test('all native flankers and casters finish a finite side-step instead of orbiting a stationary target',()=>{
 const p={x:0,z:0};
 for(const biome of Object.keys(MAP_ROSTERS))for(const role of['wolf','spitter','shaman'])for(const fps of[30,60,144]){
  const kind=regionalEnemy(biome,role),e={...ENEMIES[kind],kind,role,id:2,alive:true,x:0,z:role==='wolf'?3:8,cool:10,packAngle:0};
  const target=enemyApproach(e,p,[],true);let distance=0;
  for(let i=0;i<fps*4;i++){
   const next=enemyApproach(e,p,[],true);assert.deepEqual(next,target,'goal must remain reachable while the target is still');
   const dx=next.x-e.x,dz=next.z-e.z,d=Math.hypot(dx,dz);
   if(d>.4){const step=Math.min(d,e.speed/fps);e.x+=dx/d*step;e.z+=dz/d*step;distance+=step;}
  }
  assert(Math.hypot(e.x-target.x,e.z-target.z)<=.4,'native speed reaches and holds the side-step');
  assert(distance<3,'cooldown does not turn into an endless orbit');
 }
});

test('committed attacks produce the next finite lane; flankers do not cross through the target after overshooting',()=>{
 const p={x:0,z:0},e={id:2,role:'spitter',alive:true,x:0,z:8,packAngle:0};
 const before=enemyApproach(e,p,[],true);e.attackAngle=-Math.PI+.5;const after=enemyApproach(e,p,[],true);
 assert(Math.hypot(before.x-after.x,before.z-after.z)>1,'a new attack changes the approach lane');
 e.x=after.x;e.z=after.z;assert.deepEqual(enemyApproach(e,p,[],true),after,'arriving does not advance another tangent');
 const wolf={id:3,role:'wolf',alive:true,x:0,z:-1.2,cool:1,attackAngle:Math.PI};
 assert(enemyApproach(wolf,p,[],true).z<0,'landed behind the target: withdraw to that same side');
 assert.deepEqual(enemyApproach({...wolf,cool:.4},p,[],true),p,'after the short withdrawal the normal attack approach resumes');
});

test('casters shelter only behind an effective front line and resume pursuit offscreen',()=>{
 const p={x:0,z:0},mage={id:2,role:'spitter',alive:true,x:0,z:8,packAngle:0},tank={id:4,role:'golem',alive:true,x:0,z:4};
 const open=enemyApproach(mage,p,[],true),sheltered=enemyApproach(mage,p,[tank],true);assert.notDeepEqual(sheltered,open);
 for(const condition of[{alive:false},{recovery:.7},{stagger:.2},{targetLost:true},{z:10},{x:5,z:2}]){
  assert.deepEqual(enemyApproach(mage,p,[{...tank,...condition}],true),open,'invalid cover '+JSON.stringify(condition));
 }
 assert.deepEqual(enemyApproach(mage,p,[tank],false),p);
 const nearer={...tank,id:5,z:5};assert.deepEqual(enemyApproach(mage,p,[tank,nearer],true),enemyApproach(mage,p,[nearer,tank],true),'nearest useful cover is independent of spawn-array order');
});
