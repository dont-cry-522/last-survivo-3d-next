import test from 'node:test';
import assert from 'node:assert/strict';
import {beginScythe,scytheHits,scytheDamage,scythePrimary,scytheRestRemaining,finishScytheSweep} from '../scythe-combat.js';
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

test('unrouted scythe retains its damage, cadence and control even after waiting',()=>{
 const p=player(),e={hp:10000,maxHp:10000},w=weaponStats(p);
 for(const [i,expected]of[40,44,54].entries()){
  const s=beginScythe(p,w,i*.7,0,0),hit=scytheDamage(p,e,s,i*.7,true);
  assert.equal(hit.damage,expected);assert(!s.heavy);assert.equal(hit.stagger,.13);assert.equal(hit.slow,i===2?.5:0);
 }
 const s=beginScythe(p,w,10,0,0);assert.equal(scytheDamage(p,e,s,10,true).damage,40);assert(!s.heavy);
});

test('heavy opportunity is snapshotted on release, spent on misses and depends on game time',()=>{
 for(const fps of[30,60,144]){
  const p=player();p.weaponPath={id:'shadowblade_return',rank:1};const w=weaponStats(p);
  const first=beginScythe(p,w,0,0,0);assert(first.heavy);
  // No hit is resolved; a whiff still restarts the interval.
  const fast=beginScythe(p,w,.8,0,0);assert(!fast.heavy);
  assert.equal(scytheRestRemaining(p,.8),1.2);
  for(let i=0;i<fps;i++)assert.equal(scytheRestRemaining(p,.8),1.2,'paused calls must not advance');
  assert(!beginScythe(p,w,1.999,0,0).heavy);
  let now=1.999;for(let i=0;i<Math.ceil(fps*1.2);i++)now+=1/fps;
  const ready=beginScythe(p,w,now,0,0);assert(ready.heavy);assert.equal(ready.combo,0);
  assert(!fast.heavy,'an already launched fast swing must not charge during wind-up');
 }
});

test('heavy affects only the closest legal hit, independent of spawn order',()=>{
 const p=player(),origin={x:0,y:1,z:0};p.weaponPath={id:'shadowblade_return',rank:2};
 const s=beginScythe(p,weaponStats(p),0,0,0),foes=[3,2,1].map((z,id)=>({id,z,x:0,y:0,height:1.6,size:.4,alive:true,hp:1000,maxHp:1000}));
 const hits=foes.filter(e=>scytheHits(origin,e,s,(a,b)=>b.z===1));
 const primary=scythePrimary(origin,hits);assert.equal(primary.z,2);
 for(const e of hits){const hit=scytheDamage(p,e,s,0,e===primary);assert.equal(hit.damage,e===primary?96:60);assert.equal(hit.heavy,e===primary);}
 assert.equal(scythePrimary(origin,[]),null);
});

test('heavy route ranks and existing marks, step and low-life skills combine without extra hits',()=>{
 for(let rank=1;rank<=3;rank++){
  const p=player();p.weaponPath={id:'shadowblade_return',rank};
  const e={hp:100,maxHp:1000,scytheMarks:2,scytheMarkAt:0};p.upgrades={scythe_step:1,scythe_reap:1,scythe_mark:1};p.scytheStepUntil=1;
  const s=beginScythe(p,weaponStats(p),0,0,0),hit=scytheDamage(p,e,s,.25,true);
  const expected=40*(1+.25*rank)*(1+[0,.45,.60,.75][rank])*1.2*1.15+28;
  assert(Math.abs(hit.damage-expected)<1e-9);assert(hit.mark&&hit.heavy);assert.equal(e.scytheMarks,0);
  assert.equal(hit.stagger,[0,.25,.3,.35][rank]);assert.equal(p.scytheStepUntil,0);
 }
});

test('sweep rewards actual multi-target finishers, caps the refund and never changes invulnerability',()=>{
 for(let rank=1;rank<=3;rank++){
  const p=player();p.weaponPath={id:'shadowblade_fan',rank};p.inv=.1;p.dash=2;
  const w=weaponStats(p),one=beginScythe(p,w,0,0,0),two=beginScythe(p,w,.7,0,0),three=beginScythe(p,w,1.4,0,0);
  assert.equal(finishScytheSweep(p,one,3),0);assert.equal(finishScytheSweep(p,two,3),0);assert.equal(finishScytheSweep(p,three,1),0);
  const before=p.dash;finishScytheSweep(p,three,20);assert(Math.abs(before-p.dash-[0,.35,.5,.65][rank])<1e-9);
  assert.equal(scytheDamage(p,{hp:100,maxHp:100},three,1.7).slow,[0,.65,.8,.95][rank]);
  p.dash=.1;assert.equal(finishScytheSweep(p,three,2),.1);assert.equal(p.dash,0);assert.equal(p.inv,.1);
 }
});

test('routes preserve level gates, exclusivity and clean restart with no banked heavy attack',()=>{
 const p=player();p.level=2;assert(!takeUpgrade(p,'path:shadowblade_fan'));
 // Use the same upgrade IDs produced by the real draft.
 p.level=3;const rng=seeded(522);let card;
 for(let i=0;i<20&&!card;i++)card=chooseUpgrades(p,rng).find(c=>c.id.includes('shadowblade_return'));
 assert(card);assert(takeUpgrade(p,card.id));assert.equal(p.weaponPath.rank,1);
 for(let i=0;i<10;i++)assert(!chooseUpgrades(p,rng).some(c=>c.id.includes('shadowblade_fan')));
 const w=weaponStats(p);beginScythe(p,w,10,0,0);assert(scytheRestRemaining(p,10)>0);
 const fresh=player();assert.equal(scytheRestRemaining(fresh,0),0);assert(!beginScythe(fresh,weaponStats(fresh),0,0,0).heavy);
});
