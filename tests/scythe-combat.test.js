import test from 'node:test';
import assert from 'node:assert/strict';
import {beginScythe,scytheHits,scytheDamage} from '../scythe-combat.js';
import {weaponStats,chooseUpgrades,takeUpgrade,seeded} from '../rules.js';
const player=()=>({heroId:'wraith',weaponId:'shadowblade',level:8,upgrades:{}});
test('scythe combos reset after a pause and consume only one dodge opportunity',()=>{
 const p=player(),w=weaponStats(p);p.upgrades.scythe_step=2;p.scytheStepUntil=2;
 const a=beginScythe(p,w,0,0,0),b=beginScythe(p,w,.7,0,0),c=beginScythe(p,w,1.4,0,0);assert.deepEqual([a.combo,b.combo,c.combo],[0,1,2]);assert(a.empowered&&!b.empowered&&!c.empowered);assert.equal(beginScythe(p,w,4,0,0).combo,0);assert(a.hitAt>0&&a.hitAt<1/w.rate);
});
test('melee rejects rear targets, high flying enemies, distant enemies and intervening walls',()=>{
 const p=player(),s=beginScythe(p,weaponStats(p),0,0,0),origin={x:0,y:1,z:0},e={alive:true,x:0,y:0,z:2,size:.5,height:1.6};
 assert(scytheHits(origin,e,s,()=>false));for(const q of[{z:-2},{z:5},{y:3}])assert(!scytheHits(origin,{...e,...q},s,()=>false));assert(!scytheHits(origin,e,s,()=>true));assert(scytheHits(origin,{...e,y:2}, {...s,pitch:.7},()=>false));
});
test('three weapon skills stay isolated, capped, and secondary effects do not recursively mark',()=>{
 const p=player(),rng=seeded(125),seen=new Set();for(let i=0;i<180;i++)for(const c of chooseUpgrades(p,rng))seen.add(c.id);
 for(const id of['scythe_step','scythe_mark','scythe_reap']){assert(seen.has(id));assert(!takeUpgrade({...player(),weaponId:'shade'},id));for(let i=0;i<3;i++)assert(takeUpgrade(p,id));assert(!takeUpgrade(p,id));}
 const e={hp:100,maxHp:100},s=beginScythe(p,weaponStats(p),0,0,0);assert(!scytheDamage(p,e,s,0).mark);assert(!scytheDamage(p,e,s,.7).mark);const third=scytheDamage(p,e,s,1.4);assert(third.mark);assert.equal(e.scytheMarks,0);assert(!scytheDamage(p,e,s,6).mark);e.hp=20;assert(scytheDamage(p,e,s,7).damage>s.w.damage);
});
