import test from 'node:test';
import assert from 'node:assert/strict';
import {WEAPONS,WEAPON_PATHS,WEAPON_PATH_PLAYS,HERO_LOADOUTS,forestGrowthChoices,takeUpgrade,weaponStats,registerShadowHit,harpoonEdgeMultiplier} from '../rules.js';

const player=(weaponId,level=3)=>({weaponId,heroId:Object.entries(HERO_LOADOUTS).find(([,ids])=>ids.includes(weaponId))[0],level,upgrades:{},hp:80,maxHp:120});
const close=(actual,expected)=>assert(Math.abs(actual-expected)<1e-10,`${actual} != ${expected}`);
const routes=p=>forestGrowthChoices(p,()=>0).filter(c=>c.category==='weapon');

test('all 26 route cards expose their own actionable play text before and after selection',()=>{
 const ids=Object.keys(WEAPON_PATHS);assert.equal(ids.length,26);assert.deepEqual(Object.keys(WEAPON_PATH_PLAYS).sort(),ids.sort());
 assert.equal(new Set(Object.values(WEAPON_PATH_PLAYS)).size,26);
 for(const weapon of Object.keys(WEAPONS)){
  const p=player(weapon),choices=routes(p);assert.equal(choices.length,2);
  for(const choice of choices){assert.equal(choice.play,WEAPON_PATH_PLAYS[choice.pathId]);assert(choice.play.length>10);assert.notEqual(choice.play,choice.text);}
 }
});

test('every route retains 3/5/8 level gates, three ranks and exclusive ownership',()=>{
 for(const[id,path]of Object.entries(WEAPON_PATHS)){
  const p=player(path.weapon,2),other=Object.keys(WEAPON_PATHS).find(key=>key!==id&&WEAPON_PATHS[key].weapon===path.weapon),foreign=Object.keys(WEAPON_PATHS).find(key=>WEAPON_PATHS[key].weapon!==path.weapon);
  assert.equal(routes(p).length,0);assert.equal(takeUpgrade(p,'path:'+id),false);
  for(const[rank,level]of [3,5,8].entries()){
   p.level=level;const eligible=routes(p);assert.equal(eligible.length,rank===0?2:1);
   const card=eligible.find(c=>c.pathId===id);assert(card);assert.equal(card.rank,rank);assert.equal(card.play,WEAPON_PATH_PLAYS[id]);assert.equal(card.text,path.steps[rank]);
   assert(takeUpgrade(p,'path:'+id));assert.deepEqual(p.weaponPath,{id,rank:rank+1});
   const accepted=JSON.stringify(p.weaponPath);assert.equal(takeUpgrade(p,'path:'+other),false);assert.equal(takeUpgrade(p,'path:'+foreign),false);assert.equal(takeUpgrade(p,'path:'+id),false);assert.equal(JSON.stringify(p.weaponPath),accepted);
   p.level=[4,7,20][rank];assert.equal(routes(p).length,0);
  }
 }
});

test('blight detonates every second hit while default shadow marks still require three and expire per target',()=>{
 const base={},blight={};
 assert.deepEqual([0,.1,.2,.3,.4,.5].map(t=>registerShadowHit(base,t)),[false,false,true,false,false,true]);
 assert.deepEqual([0,.1,.2,.3,.4,.5].map(t=>registerShadowHit(blight,t,2)),[false,true,false,true,false,true]);
 const a={},b={};assert.equal(registerShadowHit(a,0,2),false);assert.equal(registerShadowHit(b,.1,2),false);assert.equal(registerShadowHit(a,.2,2),true);assert.equal(b.shadowMark.hits,1);
 assert.equal(registerShadowHit(b,2.6,2),false,'a mark lasting exactly 2.5 seconds did not expire');assert.equal(b.shadowMark.hits,1);assert.equal(registerShadowHit(b,2.7,2),true);
 for(const[rank,damage]of [24,36,48].entries()){
  const stats=weaponStats({...player('shade'),weaponPath:{id:'shade_blight',rank:rank+1}});assert.equal(stats.markDamage,damage);close(stats.markRadius,[1.9,2.2,2.5][rank]);assert.equal(stats.bounces,0);
 }
});

test('reef tip damage is confined to 65–100 percent reach on first and third thrusts',()=>{
 for(const[rank,bonus]of [[1,1.20],[2,1.25],[3,1.30]]){
  const w=weaponStats({...player('harpoon'),weaponPath:{id:'harpoon_reef',rank}});
  for(const combo of [0,2]){
   for(const distance of [0,w.range*.65-1e-6,w.range+1e-6])assert.equal(harpoonEdgeMultiplier(w,distance,combo),1);
   for(const distance of [w.range*.65,w.range*.8,w.range])close(harpoonEdgeMultiplier(w,distance,combo),bonus);
  }
  for(const combo of [-1,1,3])for(const ratio of [.65,.8,1])assert.equal(harpoonEdgeMultiplier(w,w.range*ratio,combo),1,'a non-thrust receives tip damage');
  close(w.damage,WEAPONS.harpoon.damage*(1+.18*rank));close(w.range,WEAPONS.harpoon.range+.25*rank);
 }
 for(const weaponPath of [null,{id:'harpoon_tow',rank:3},{id:'harpoon_reef',rank:0}]){
  const w=weaponStats({...player('harpoon'),weaponPath});assert.equal(harpoonEdgeMultiplier(w,w.range*.8,0),1);
 }
});

test('wide rifts gain area and brief slowing at each rank without granting echo or changing base weapons',()=>{
 const before=JSON.stringify(WEAPONS),base=weaponStats(player('grimoire'));assert.equal(base.riftSlow,undefined);
 for(const[rank,slow,radius]of [[1,.6,2.1],[2,.8,2.5],[3,1,2.9]]){
  const w=weaponStats({...player('grimoire'),weaponPath:{id:'grimoire_wide',rank}});
  close(w.riftSlow,slow);close(w.radius,radius);close(w.damage,base.damage*(1+.08*rank));assert.equal(w.echo,0);assert.equal(w.range,base.range);
  const echo=weaponStats({...player('grimoire'),weaponPath:{id:'grimoire_echo',rank}});assert.equal(echo.riftSlow,undefined);assert.equal(echo.radius,base.radius);assert(echo.echo>0);
 }
 assert.equal(JSON.stringify(WEAPONS),before);
});

test('reef tip distance follows the committed pitched ray and remains finite for vertical aim',()=>{
 const w=weaponStats({...player('harpoon'),weaponPath:{id:'harpoon_reef',rank:3}});
 for(const pitch of [0,.65,-.65,1.25,-1.25,Math.PI/2-.025,-Math.PI/2+.025])for(const combo of [0,2]){
  const horizontal=along=>along*Math.abs(Math.cos(pitch));
  for(const along of [w.range*.65,w.range*.8,w.range])close(harpoonEdgeMultiplier(w,horizontal(along),combo,pitch),1.3);
  for(const along of [0,w.range*.65-1e-6,w.range+1e-6])assert.equal(harpoonEdgeMultiplier(w,horizontal(along),combo,pitch),1);
  assert.equal(harpoonEdgeMultiplier(w,horizontal(w.range*.8),1,pitch),1,'pitched sweep gained tip damage');
 }
 for(const pitch of [Math.PI/2,-Math.PI/2,NaN,Infinity])for(const distance of [0,.001,1,w.range])assert.equal(harpoonEdgeMultiplier(w,distance,0,pitch),1,'degenerate centre projection awarded damage or produced NaN');
});
