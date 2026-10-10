import{test}from'node:test';
import assert from'node:assert/strict';
import{HERO_LOADOUTS,WEAPONS,heroHealth,weaponFor,weaponStats,weaponReachText,chooseUpgrades,takeUpgrade,seeded}from'../rules.js';
import{EXTRA_SKILLS,EXTRA_BY_ID,skillPairState}from'../skill-catalog.js';
const player=(heroId='wuling')=>({heroId,weaponId:weaponFor(heroId,0).id,level:2,upgrades:{},hp:120,maxHp:120});
const near=(actual,expected)=>assert(Math.abs(actual-expected)<1e-9,actual+' != '+expected);

test('Wuling has one poison weapon and a bounded base area attack, leaving other loadouts intact',()=>{
 assert.deepEqual(HERO_LOADOUTS.wuling,['sporelantern']);assert.equal(heroHealth('wuling'),120);
 assert.deepEqual(HERO_LOADOUTS.scout,['rifle','shotgun','fire']);assert.deepEqual(HERO_LOADOUTS.silver,['crossbow','shuriken','dark']);assert.deepEqual(HERO_LOADOUTS.wraith,['shade','shadowblade','grimoire']);assert.deepEqual(HERO_LOADOUTS.tide,['harpoon']);assert.deepEqual(HERO_LOADOUTS.lingya,['boomerang']);
 const w=weaponStats(player());assert.equal(w.id,'sporelantern');assert.equal(w.damage,10);assert.equal(w.rate,.8);assert.equal(w.range,10);assert.equal(w.speed,16);assert.equal(w.cloudDamage,22);assert.equal(w.cloudRadius,2);assert.equal(w.cloudDuration,4.8);assert.equal(w.cloudMax,3);assert.equal(w.stillRank,0);assert.equal(w.roamRank,0);assert.equal(w.radius,0);assert(!w.returning);
 assert.match(weaponReachText(w),/毒雾半径 2 米/);assert.match(weaponReachText(w),/最多 3 片/);
});

test('poison skills belong only to Wuling while all six hero draft pools retain their legal spells',()=>{
 const elemental=['fire','ice','storm'],shadow=['veil','chain','rift'];
 for(const heroId of Object.keys(HERO_LOADOUTS)){
  const p=player(heroId),own=EXTRA_SKILLS.filter(s=>s.hero===heroId&&(!s.weapon||s.weapon===p.weaponId)).map(s=>s.id),seen=new Set(),rng=seeded(92);
  for(let i=0;i<120;i++)for(const card of chooseUpgrades(p,rng)){seen.add(card.id);if(EXTRA_BY_ID[card.id])assert.equal(EXTRA_BY_ID[card.id].hero,heroId);assert(!card.id.startsWith('path:'));}
  assert(own.every(id=>seen.has(id)));
  const legal=heroId==='wraith'?shadow:['tide','lingya'].includes(heroId)?[]:elemental;
  for(const id of[...elemental,...shadow]){assert.equal(seen.has(id),legal.includes(id),heroId+' '+id);assert.equal(takeUpgrade(p,id),legal.includes(id));}
  for(const id of['power','haste','vitality','stride','magnet'])assert(takeUpgrade(p,id));
  for(const id of['poison_linger','poison_spread','poison_guard']){if(heroId==='wuling'){for(let rank=0;rank<3;rank++)assert(takeUpgrade(p,id));assert(!takeUpgrade(p,id));}else assert(!takeUpgrade(p,id));}
 }
});

test('both poison routes keep 3/5/8 gates, lock the opposing route and retain their costs through all ranks',()=>{
 for(const suffix of['still','roam']){
  const p=player(),id='path:sporelantern_'+suffix,other='path:sporelantern_'+(suffix==='still'?'roam':'still');
  for(const [index,level]of[3,5,8].entries()){
   p.level=level-1;assert(!takeUpgrade(p,id));p.level=level;assert(takeUpgrade(p,id));assert(!takeUpgrade(p,other));
   const w=weaponStats(p);assert.equal(w.pathRank,index+1);assert.equal(w.stillRank,suffix==='still'?index+1:0);assert.equal(w.roamRank,suffix==='roam'?index+1:0);
   near(w.cloudRadius,suffix==='still'?1.6:2.5);near(w.cloudDuration,suffix==='still'?6.8:3.8);assert.equal(w.cloudDamage,22);assert.equal(w.damage,10);assert.equal(w.cloudMax,3);
  }
  assert(!takeUpgrade(p,id));for(let i=0;i<20;i++)assert(!chooseUpgrades(p).some(c=>c.category==='weapon'));
  const scout=player('scout');scout.level=8;assert(!takeUpgrade(scout,id));assert.equal(weaponStats({...p,weaponId:'rifle'}).pathId,null);
 }
});

test('poison DOT gets power once but never receives direct-hit rush damage or haste',()=>{
 const p=player(),before=JSON.stringify(WEAPONS.sporelantern);p.upgrades={power:3,haste:2};p.huntBoon='rush';p.huntRush=4;
 const w=weaponStats(p);near(w.damage,10*1.54*1.25);near(w.cloudDamage,22*1.54);near(w.rate,.8*1.3);assert.equal(w.cloudDuration,4.8);assert.equal(w.cloudMax,3);
 p.huntRush=0;near(weaponStats(p).damage,10*1.54);near(weaponStats(p).cloudDamage,w.cloudDamage);assert.equal(JSON.stringify(WEAPONS.sporelantern),before);
 const old=weaponStats({...p,weaponId:'rifle'});assert.equal(old.cloudDamage,undefined);near(old.damage,12*1.54);
});

test('poison descriptions identify actual sources and pairing never grants an undeclared bonus',()=>{
 for(const id of['poison_linger','poison_spread','poison_guard'])for(let r=1;r<=3;r++){const text=EXTRA_BY_ID[id].describe(r);assert(text.length>20);assert(!/undefined|NaN/.test(text));}
 assert.match(EXTRA_BY_ID.poison_spread.describe(1),/最近一名/);assert.match(EXTRA_BY_ID.poison_spread.describe(1),/毒带击杀均不再传播/);assert.match(EXTRA_BY_ID.poison_guard.describe(1),/成功完成闪避搬运/);assert.match(EXTRA_BY_ID.poison_guard.describe(1),/空闪避或站在毒区不会/);
 const p=player();p.upgrades={poison_linger:1,poison_spread:1};const pair=skillPairState(p);assert(pair.active);assert.equal(pair.bonus,false);
});
