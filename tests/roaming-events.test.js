import test from 'node:test';
import assert from 'node:assert/strict';
import {buildWorld} from '../world.js';
import {takeUpgrade,UPGRADES,HERO_LOADOUTS} from '../rules.js';
import {advanceRoaming,campGuardRoles,campRewardPool,campRewardChoices,roamingHint,roamingReward} from '../roaming-events.js';
import{EXTRA_SKILLS}from'../skill-catalog.js';
globalThis.document={createElement:()=>({getContext:()=>({fillRect(){}})})};
const biomes=['forest','snow','ash','sand','coast'];
const clean=w=>w.group.traverse(o=>{if(o.isInstancedMesh)o.dispose();if(o.userData.ownedGeometry)o.geometry.dispose();});
const player=()=>({heroId:'silver',weaponId:'crossbow',hp:60,maxHp:100,upgrades:{},level:3,pending:2,upgradeDraft:{shown:['ice'],routeMisses:2},pendingDraft:[{id:'ice'}]});

test('camp recovery competes with legal weapon routes, respects 3/5/8 gates and leaves normal growth untouched',()=>{
 const p=player(),before=JSON.stringify(p),choices=campRewardChoices(p,()=>0);assert.equal(JSON.stringify(p),before);assert.equal(choices.length,3);assert.equal(choices[0].id,'recover');assert.equal(choices[0].heal,.18);
 assert.deepEqual(choices.slice(1).map(u=>u.pathId),['crossbow_pierce','crossbow_hunt']);assert(takeUpgrade(p,choices[1].id));assert(!takeUpgrade(p,choices[2].id));
 for(const [level,rank,offered]of[[4,1,false],[5,1,true],[7,2,false],[8,2,true],[20,3,false]]){p.level=level;p.weaponPath.rank=rank;const routes=campRewardChoices(p,()=>0).filter(u=>u.category==='weapon');assert.equal(routes.length,offered?1:0);if(offered)assert.equal(routes[0].pathId,'crossbow_pierce');}
 delete p.weaponPath;p.level=2;assert(campRewardChoices(p,()=>0).slice(1).every(u=>u.category==='skill'));
 p.upgrades=Object.fromEntries(UPGRADES.map(u=>[u.id,u.max]));assert.deepEqual(campRewardChoices(p).map(u=>u.id),['recover']);
 assert.equal(p.pending,2);assert.deepEqual(p.pendingDraft,[{id:'ice'}]);assert.deepEqual(p.upgradeDraft,{shown:['ice'],routeMisses:2});
});

test('six worlds keep one bounded optional camp per biome, with the reward advertised before engagement',()=>{
 const names=new Set(),formations=new Set();for(const map of[...biomes,'confluence']){
  const w=buildWorld(map,7),camps=w.roaming.filter(s=>s.kind==='camp');assert.equal(camps.length,map==='confluence'?5:1);
  for(const s of camps){assert(biomes.includes(s.biome));assert(!s.rewarded);const reward=roamingReward(s);assert.equal(reward.xp,40);assert.equal(reward.heal,.18);assert(reward.choice);names.add(reward.name);assert.match(roamingHint(s),/治疗.*专属成长/);assert.match(roamingHint(s),/可绕行/);
   for(const variant of[0,1]){const roles=campGuardRoles({...s,variant});assert.equal(roles.length,3);assert(roles.every(role=>['golem','mushroom','wolf','spitter','shaman'].includes(role)));formations.add(roles.join(','));}
  }clean(w);
 }assert.equal(names.size,5);assert(formations.size>=7);
});

test('a cleared camp queues its choice once at the chest; pausing, leaving and region revisits cannot duplicate it',()=>{
 for(const biome of biomes){const s={kind:'camp',biome,x:0,z:0,availableAt:0,discovered:false,state:'hidden',variant:0,members:[],mesh:{visible:false,scale:{y:1}}},p={x:9,z:0},queue=[],c={time:1000,player:p,spawn:(role,x,z)=>({role,x,z,hp:30,maxHp:30,alive:true}),notify(){},reward:(site,reward)=>queue.push({site,reward})};
  s.expiresAt=Infinity;advanceRoaming(s,.1,c);assert.equal(s.state,'waiting');assert.equal(s.members.length,0);p.x=5;advanceRoaming(s,0,c);assert.equal(s.members.length,0);advanceRoaming(s,.1,c);assert.equal(s.members.length,3);
  s.members.forEach(e=>e.alive=false);advanceRoaming(s,.1,c);assert.equal(s.state,'reward');assert.equal(queue.length,0);p.x=0;advanceRoaming(s,0,c);assert.equal(queue.length,0);advanceRoaming(s,.1,c);assert.equal(queue.length,1);assert.equal(s.state,'claimed');assert(queue[0].reward.choice);
  p.x=50;advanceRoaming(s,20,c);p.x=0;advanceRoaming(s,20,c);assert.equal(queue.length,1);assert(s.rewarded);
 }
});

test('camp health alternatives preserve the same three growth cards and never spend a useless full-health recovery',()=>{
 const p=player();p.hp=p.maxHp;let rolls=0;
 const pool=campRewardPool(p,()=>{rolls++;return .7;}),before=JSON.stringify(pool),draws=rolls;
 const stable=()=>{throw Error('health changes must not draw new cards');};
 assert.deepEqual(campRewardChoices(p,stable,pool).map(u=>u.id),pool.map(u=>u.id));assert.equal(pool.length,3);
 p.hp=95;const hurt=campRewardChoices(p,stable,pool);assert.equal(hurt[0].id,'recover');assert(!hurt[0].disabled);assert.match(hurt[0].text,/本次可恢复 5 点/);
 assert.deepEqual(hurt.slice(1).map(u=>u.id),pool.slice(0,2).map(u=>u.id));
 p.hp=100;assert.deepEqual(campRewardChoices(p,stable,pool).map(u=>u.id),pool.map(u=>u.id));assert.equal(JSON.stringify(pool),before);assert.equal(rolls,draws);
 const full={...p,level:20,weaponPath:{id:'crossbow_pierce',rank:3},upgrades:Object.fromEntries(UPGRADES.map(u=>[u.id,u.max]))},empty=campRewardPool(full);
 assert.equal(empty.length,0);const maxed=campRewardChoices(full,stable,empty);assert.equal(maxed.length,1);assert.equal(maxed[0].id,'recover');assert(maxed[0].disabled);assert.match(maxed[0].text,/稍后/);
 full.hp=70;const recovery=campRewardChoices(full,stable,empty);assert(!recovery[0].disabled);assert.equal(recovery[0].heal,.18);
});
test('camps offer one learned eligible signature skill before random growth, without mixing hero or weapon pools',()=>{
 for(const[heroId,weapons]of Object.entries(HERO_LOADOUTS))for(const weaponId of weapons){
  const own=EXTRA_SKILLS.filter(u=>u.hero===heroId&&(!u.weapon||u.weapon===weaponId));
  const p={...player(),heroId,weaponId,level:2,upgrades:{[own[0].id]:1}},snapshot=JSON.stringify(p),pool=campRewardPool(p,()=>.999);
  assert.equal(pool[0].id,own[0].id,weaponId+' lost learned growth');assert.equal(pool[0].rank,1);assert.match(pool[0].play,/1 → 2/);
  assert.equal(new Set(pool.map(u=>u.id)).size,pool.length);assert(pool.every(u=>own.some(o=>o.id===u.id)),weaponId+' wrong signature pool');assert.equal(JSON.stringify(p),snapshot);
  p.upgrades[own[0].id]=own[0].max;assert(!campRewardPool(p,()=>0).some(u=>u.id===own[0].id));
 }
 const p={...player(),level:2,upgrades:{trail:1}},pool=campRewardPool(p,()=>0),rain=pool.find(u=>u.id==='rain');assert(rain);assert.match(rain.play,/选取后组成搭配.*霜痕追猎/);
});
