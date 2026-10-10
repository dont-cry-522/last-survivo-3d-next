import{BOSS_ROUTES,BOSS_BREAK}from'./boss-expedition.js?v=136';
import{MAP_ROSTERS}from'./map-enemies.js?v=114';
import{ENEMY_GUIDE}from'./battle-guide.js?v=123';
import{EXPEDITION_BOSS_TIME}from'./encounters.js?v=114';

// Use the same roster, attack descriptions and timing as the playable encounter.
export function mapBrief(mapId){
 if(mapId==='confluence')return{
  name:'五境守卫',arrival:'地标解锁 · 自由顺序',
  threat:['forest','snow','ash','sand','coast'].map(id=>ENEMY_GUIDE[MAP_ROSTERS[id].boss].name).join(' / '),
  goal:'完成各区地标并领取奖励，再靠近该区路标唤醒守卫；击败全部 5 位。'
 };
 const boss=ENEMY_GUIDE[MAP_ROSTERS[mapId]?.boss||MAP_ROSTERS.forest.boss];
 return{name:boss.name,arrival:'约 '+(EXPEDITION_BOSS_TIME/60)+' 分钟后苏醒',threat:boss.attack,goal:'依次迎战 '+BOSS_ROUTES[mapId].map(id=>ENEMY_GUIDE[MAP_ROSTERS[id].boss].name).join(' → ')+'；击败全部三位通关。前两场胜利恢复25%生命，间隔'+BOSS_BREAK+'秒继续探索。'};
}
