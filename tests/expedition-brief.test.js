import{test}from'node:test';
import assert from'node:assert/strict';
import{BOSS_ROUTES}from'../boss-roster.js';
import{mapBrief}from'../expedition-brief.js';
import{MAP_ROSTERS}from'../map-enemies.js';
import{ENEMY_GUIDE}from'../battle-guide.js';
import{EXPEDITION_BOSS_TIME}from'../encounters.js';

test('every local map previews its actual boss, attack and shared arrival time',()=>{
 for(const [map,roster]of Object.entries(MAP_ROSTERS)){
  const brief=mapBrief(map),boss=ENEMY_GUIDE[BOSS_ROUTES[map][0]];
  assert.equal(brief.name,boss.name,map);
  assert.equal(brief.threat,boss.attack,map);
  assert(brief.arrival.includes(String(EXPEDITION_BOSS_TIME/60)),map);
  assert(brief.goal.includes(boss.name)&&brief.goal.includes('通关'),map);
 }
});

test('the seamless expedition communicates landmark rewards and five guardians, never the timed-boss rule',()=>{
 const brief=mapBrief('confluence');
 for(const roster of Object.values(MAP_ROSTERS))assert(brief.threat.includes(ENEMY_GUIDE[roster.boss].name));
 assert.match(brief.arrival,/自由顺序/);
 assert.doesNotMatch(brief.arrival,/分钟|秒/);
 assert.match(brief.goal,/完成各区地标并领取奖励/);
 assert.match(brief.goal,/再靠近该区路标/);
 assert.match(brief.goal,/全部 5 位/);
});
