import test from 'node:test';import assert from 'node:assert/strict';
import{weaponStats,heroHealth}from'../rules.js';import{meleeDamageScale}from'../melee.js';import{huntFormation,takeHuntBoon}from'../encounters.js';
test('new hero damage and ranged cadence improve without increasing offscreen range',()=>{
 const bone=weaponStats({weaponId:'boomerang'}),quick=weaponStats({weaponId:'boomerang',upgrades:{haste:3}});
 assert.equal(bone.damage,30);assert.equal(bone.petDamage,30);assert.equal(bone.range,11);assert.equal(bone.pierce,1);assert.equal(bone.returning,false);assert.equal(quick.speed,bone.speed);assert(quick.rate>bone.rate);assert.equal(quick.range,bone.range);
 assert.equal(weaponStats({weaponId:'harpoon'}).damage,36);
 assert.deepEqual(['tide','lingya','scout','silver','wraith'].map(heroHealth),[140,120,120,120,120]);
});
test('melee protection respects facing, attack windows, ground hazards and guard non-stacking',()=>{
 const p={heroId:'guardian',x:0,z:0,dashTime:0};assert.equal(meleeDamageScale(p,0,2,0,1),.75);assert.equal(meleeDamageScale(p,0,-2,0,1),1);assert.equal(meleeDamageScale(p,0,0,0,1),1);
 p.dashTime=1;assert.equal(meleeDamageScale(p,0,2,0,1),1);p.dashTime=0;p.heroId='tide';p.braceUntil=2;assert.equal(meleeDamageScale(p,0,2,0,1),.8);assert.equal(meleeDamageScale(p,0,2,0,2),1);assert.equal(meleeDamageScale(p,0,-2,0,1),1);
 p.heroId='silver';assert.equal(meleeDamageScale(p,0,2,0,1),1);
});
test('forest squads vary without larger crowds and rewards remain once per expedition',()=>{
 const a=huntFormation('forest',0),b=huntFormation('forest',1);assert.notEqual(a.name,b.name);assert.equal(a.squad.length,b.squad.length);assert.equal(b.squad.filter(s=>s.elite).length,1);assert.equal(b.squad[0].role,'wolf');assert.equal(huntFormation('snow',1).squad[0].role,'golem');
 const p={weaponId:'boomerang',hp:70,maxHp:120};assert(!takeHuntBoon(p,'shelter'));p.huntRewardPending=true;assert(!takeHuntBoon(p,'invalid'));assert(takeHuntBoon(p,'shelter'));assert.equal(p.maxHp,140);assert.equal(p.hp,90);p.huntRewardPending=true;assert(!takeHuntBoon(p,'rush'));assert.equal(p.maxHp,140);
 const q={weaponId:'boomerang',huntRewardPending:true};assert(takeHuntBoon(q,'rush'));assert.equal(weaponStats(q).damage,30);q.huntRush=4;assert.equal(weaponStats(q).damage,37.5);assert.equal(weaponStats(q).petDamage,37.5);q.huntRush=0;assert.equal(weaponStats(q).damage,30);
});
