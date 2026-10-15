import test from 'node:test';
import assert from 'node:assert/strict';
import {buildWorld} from '../world.js';
import {takeUpgrade,UPGRADES} from '../rules.js';
import {advanceRoaming,campGuardRoles,campRewardChoices,roamingHint,roamingReward} from '../roaming-events.js';
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
