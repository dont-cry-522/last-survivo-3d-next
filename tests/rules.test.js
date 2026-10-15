import{test}from'node:test';import assert from'node:assert/strict';import*as Rules from'../rules.js';const{experienceNeeded,grantExperience,seeded,weaponFor,chooseUpgrades,takeUpgrade,registerShadowHit}=Rules;
test('experience preserves every pending level',()=>{const p={level:1,xp:0,pending:0,hp:30,maxHp:100};grantExperience(p,experienceNeeded(1)+experienceNeeded(2)+5);assert.equal(p.level,3);assert.equal(p.pending,2);assert.equal(p.xp,5);});
test('random layouts reproducible',()=>{const a=seeded(42),b=seeded(42);for(let i=0;i<20;i++)assert.equal(a(),b());});
test('hero weapons are distinct',()=>{assert.equal(weaponFor('silver',0).id,'crossbow');assert.equal(weaponFor('scout',0).id,'rifle');});
test('public roster has seven heroes, fifteen weapons and thirty matching routes',()=>{
 const heroes=Object.keys(Rules.HERO_LOADOUTS),weapons=Object.keys(Rules.WEAPONS),paths=Object.entries(Rules.WEAPON_PATHS);
 assert.deepEqual(heroes,['scout','silver','wraith','tide','lingya','wuling','mirage']);assert.equal(weapons.length,15);assert.equal(paths.length,30);
 assert.deepEqual(Object.values(Rules.HERO_LOADOUTS).flat().sort(),weapons.sort());
 for(const id of weapons)assert.equal(paths.filter(([,p])=>p.weapon===id).length,2);
 assert.equal(Rules.WEAPONS.hammer,undefined);assert(!Rules.UPGRADES.some(u=>['fault','reprisal','landing'].includes(u.id)));
});
test('retired and unknown hero or weapon records fall back without restoring retired upgrades',()=>{
 for(const hero of ['guardian','unknown','constructor','__proto__'])assert.equal(weaponFor(hero,0).id,'rifle');
 for(const weaponId of ['hammer','unknown','constructor','__proto__']){
  const p={heroId:'guardian',weaponId,level:8,upgrades:{},weaponPath:{id:'hammer_guard',rank:3}},w=Rules.weaponStats(p);
  assert.equal(w.id,'crossbow');assert.equal(w.pathId,null);assert.equal(w.pathRank,0);assert(Rules.weaponReachText(w).length>0);
  for(const id of ['path:hammer_guard','path:hammer_break','fault','reprisal','landing'])assert.equal(takeUpgrade(p,id),false);
  assert(!chooseUpgrades(p).some(c=>c.pathId?.startsWith('hammer_')));
 }
});
test('shadow hero has three exclusive shadow weapons',()=>{assert.deepEqual([0,1,2].map(i=>weaponFor('wraith',i).id),['shade','shadowblade','grimoire']);});
test('shadow spells replace elemental spells only for the shadow hero',()=>{const maxed={mine:3,volley:3,counter:3,rain:3,trail:3,pursuit:3,echo:3,soul:3,spikes:3,power:5,haste:4,vitality:4,stride:3,magnet:3},shadow={heroId:'wraith',weaponId:'shade',level:1,upgrades:{...maxed}},other={heroId:'silver',weaponId:'dark',level:1,upgrades:{...maxed}};assert.deepEqual(new Set(chooseUpgrades(shadow).map(c=>c.id)),new Set(['veil','chain','rift']));assert.deepEqual(new Set(chooseUpgrades(other).map(c=>c.id)),new Set(['fire','ice','storm']));assert.equal(takeUpgrade(shadow,'fire'),false);assert.equal(takeUpgrade(other,'veil'),false);});
test('shadow marks detonate on the third timely hit per target',()=>{const a={},b={};assert.equal(registerShadowHit(a,0),false);assert.equal(registerShadowHit(a,.4),false);assert.equal(registerShadowHit(b,.5),false);assert.equal(registerShadowHit(a,.8),true);assert.equal(registerShadowHit(a,1),false);assert.equal(registerShadowHit(b,3),false);assert.equal(registerShadowHit(b,3.2),false);assert.equal(registerShadowHit(b,3.4),true);});
test('choices are distinct and exclude maxed upgrades',()=>{const p={upgrades:{power:5}};for(let i=0;i<20;i++){const c=chooseUpgrades(p);assert.equal(c.length,3);assert.equal(new Set(c.map(x=>x.id)).size,3);assert(!c.some(x=>x.id==='power'));}});
