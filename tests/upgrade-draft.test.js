import{test}from'node:test';
import assert from'node:assert/strict';
import{chooseUpgrades,takeUpgrade,seeded,HERO_LOADOUTS,UPGRADES,WEAPON_PATHS}from'../rules.js';
import{EXTRA_BY_ID}from'../skill-catalog.js';
const make=(hero='tide',weapon=HERO_LOADOUTS[hero][0])=>({heroId:hero,weaponId:weapon,level:2,upgrades:{},hp:100,maxHp:100});
const spells=['fire','ice','storm','veil','chain','rift'];
test('level two produces varied real combinations for all twelve loadouts',()=>{
 for(const[hero,weapons]of Object.entries(HERO_LOADOUTS))for(const weapon of weapons){
  const hands=new Set(),seen=new Set(),slots=[new Set(),new Set(),new Set()];
  for(let seed=1;seed<=400;seed++){
   const p=make(hero,weapon),cards=chooseUpgrades(p,seeded(seed));
   assert.equal(cards.length,3);assert.equal(new Set(cards.map(c=>c.id)).size,3);
   assert(cards.some(c=>c.category==='skill'||spells.includes(c.id)));assert(!cards.some(c=>c.category==='weapon'));
   cards.forEach((c,i)=>{seen.add(c.id);slots[i].add(c.id);if(EXTRA_BY_ID[c.id])assert.equal(EXTRA_BY_ID[c.id].hero,hero);});
   hands.add(cards.map(c=>c.id).sort().join(','));
  }
  assert(hands.size>20,hero+' lacks combinations: '+hands.size);
  assert.deepEqual([...seen].filter(id=>EXTRA_BY_ID[id]).sort(),Object.values(EXTRA_BY_ID).filter(s=>s.hero===hero&&(!s.weapon||s.weapon===weapon)).map(s=>s.id).sort());
  assert(slots.every(s=>s.size>=8),'a slot is fixed');
 }
});
test('successive offers avoid repeating two cards when the pool is broad',()=>{
 for(const hero of Object.keys(HERO_LOADOUTS)){
  const p=make(hero),random=seeded(4567);let previous=[];
  for(let i=0;i<100;i++){
   const cards=chooseUpgrades(p,random),ids=cards.map(c=>c.id);
   assert(ids.filter(id=>previous.includes(id)).length<=1,hero+' repeats hand');previous=ids;
  }
 }
});
test('eligible weapon routes occupy at most one slot and cannot miss three offers',()=>{
 for(const[hero,weapons]of Object.entries(HERO_LOADOUTS))for(const weapon of weapons){
  const p=make(hero,weapon);p.level=3;let misses=0;const seen=new Set(),random=seeded(57);
  for(let i=0;i<60;i++){
   const paths=chooseUpgrades(p,random).filter(c=>c.category==='weapon');assert(paths.length<=1);
   if(paths.length){misses=0;seen.add(paths[0].pathId);assert.equal(WEAPON_PATHS[paths[0].pathId].weapon,weapon);}else misses++;
   assert(misses<3);
  }
  assert.equal(seen.size,2);
 }
 const p=make();p.level=3;
 assert(!chooseUpgrades(p,()=>.99).some(c=>c.category==='weapon'));
 assert(!chooseUpgrades(p,()=>.99).some(c=>c.category==='weapon'));
 assert(chooseUpgrades(p,()=>.99).some(c=>c.category==='weapon'));
});
test('a full run respects caps, route gates, and hero identity through exhaustion',()=>{
 for(const hero of Object.keys(HERO_LOADOUTS)){
  const p=make(hero),random=seeded(921);let exhausted=false;
  for(let level=2;level<110;level++){
   p.level=level;const cards=chooseUpgrades(p,random);
   if(!cards.length){exhausted=true;break;}
   assert(cards.length<=3);assert.equal(cards.length,new Set(cards.map(c=>c.id)).size);
   for(const c of cards){
    if(c.category==='weapon'){assert.equal(WEAPON_PATHS[c.pathId].weapon,p.weaponId);if(p.weaponPath)assert.equal(c.pathId,p.weaponPath.id);assert(level>=[3,5,8][c.rank]);}
    else{assert((p.upgrades[c.id]||0)<c.max);if(EXTRA_BY_ID[c.id])assert.equal(EXTRA_BY_ID[c.id].hero,hero);}
   }
   assert(takeUpgrade(p,cards[0].id));
  }
  assert(exhausted,hero+' never exhausted');assert.equal(p.weaponPath.rank,3);
 }
});
test('small pools still return usable cards and new runs have no draft history',()=>{
 const p=make();for(const u of UPGRADES)p.upgrades[u.id]=u.max;
 p.upgrades.wake=2;assert.deepEqual(chooseUpgrades(p,seeded(3)).map(c=>c.id),['wake']);
 assert(takeUpgrade(p,'wake'));assert.deepEqual(chooseUpgrades(p),[]);
 const a=make(),b=make();chooseUpgrades(a);assert.equal(b.upgradeDraft,undefined);
 assert.deepEqual(chooseUpgrades(b,seeded(20)),chooseUpgrades(make(),seeded(20)));
});
