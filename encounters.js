// Two-minute expedition: a short opening, mixed encounters, telegraphed hunts,
// recovery. The schedule and rewards are identical for manual and auto aim.
export const EXPEDITION_BOSS_TIME=120;
export function encounterPhase(time,boss=false){
 if(boss)return{key:'boss',mode:'boss',label:'首领决战',remaining:0,interval:3.4,cap:14,mood:1,cycle:-1};
 if(time<8)return{key:'opening',mode:'opening',label:'荒野探路',remaining:8-time,interval:1.55,cap:10,mood:.12,cycle:-1};
 const cycle=Math.floor((time-8)/48),t=(time-8)%48,growth=Math.min(6,Math.floor(time/30));
 if(t<18)return{key:cycle+':build',mode:'build',label:'遭遇战',remaining:18-t,interval:Math.max(1.25,1.5-time*.0018),cap:20+growth,mood:.4,cycle};
 if(t<23)return{key:cycle+':warning',mode:'warning',label:'精锐围猎将至',remaining:23-t,interval:Infinity,cap:24+growth,mood:.65,cycle};
 if(t<39)return{key:cycle+':assault',mode:'assault',label:'精锐围猎',remaining:39-t,interval:2.1,cap:24+growth,mood:.85,cycle};
 return{key:cycle+':rest',mode:'rest',label:'收集与喘息',remaining:48-t,interval:Infinity,cap:0,mood:.06,cycle};
}
export function enemyGrowth(time,baseXp){
 const t=Math.max(0,Math.min(time,240));
 return{health:1+t*.0018,xp:Math.round(baseXp*(1+t*.003))};
}
export function encounterRole(time,random=Math.random,boss=false){
 const r=random();
 if(time<8)return'mushroom';
 if(time<18||boss)return r<.6?'mushroom':'wolf';
 if(time<38)return r<.4?'mushroom':r<.75?'wolf':'spitter';
 if(time<50)return r<.32?'mushroom':r<.60?'wolf':r<.78?'golem':'spitter';
 return r<.32?'mushroom':r<.60?'wolf':r<.74?'golem':r<.92?'spitter':'shaman';
}
export const HUNT_SQUAD=[
 {role:'golem',offset:0,elite:true},
 {role:'wolf',offset:-1.05,flank:-1},
 {role:'wolf',offset:1.05,flank:1},
 {role:'spitter',offset:-.35},
 {role:'shaman',offset:.35},
 {role:'mushroom',offset:.7}
];
export function enemyApproach(e,player,enemies,visible){
 const dx=player.x-e.x,dz=player.z-e.z,d=Math.hypot(dx,dz),a=Math.atan2(dx,dz);
 // Between lunges, flankers reposition within reach instead of pushing through
 // the player. This uses their own cooldown, never a player's input or dodge.
 if(e.role==='wolf'&&e.cool>.5&&d>1.8&&d<=4.2){
  const angle=Math.atan2(e.x-player.x,e.z-player.z)+(e.flank||((e.id%2)?1:-1))*.32;
  return{x:player.x+Math.sin(angle)*3.6,z:player.z+Math.cos(angle)*3.6};
 }
 if(e.role==='wolf'&&d>4.2&&d<14){
  const angle=(e.packAngle??Math.atan2(e.x-player.x,e.z-player.z))+(e.flank||((e.id%2)?1:-1))*.95;
  return{x:player.x+Math.sin(angle)*3.3,z:player.z+Math.cos(angle)*3.3};
 }
 if(['spitter','shaman'].includes(e.role)&&visible){
  if(d<5)return{x:e.x-dx,z:e.z-dz};
  const tank=enemies.find(q=>q!==e&&q.alive&&q.role==='golem'&&Math.hypot(q.x-e.x,q.z-e.z)<8);
  if(tank){const ta=Math.atan2(tank.x-player.x,tank.z-player.z),side=(e.id%2?1:-1)*1.4;return{x:tank.x+Math.sin(ta)*2.7+Math.cos(ta)*side,z:tank.z+Math.cos(ta)*2.7-Math.sin(ta)*side};}
  if(d<11){const side=e.id%2?1:-1;return{x:e.x+Math.cos(a)*side,z:e.z-Math.sin(a)*side};}
 }
 return{x:player.x,z:player.z};
}
export function separation(e,enemies){
 let x=0,z=0;
 for(const q of enemies){if(q===e||!q.alive)continue;const dx=e.x-q.x,dz=e.z-q.z,d=Math.hypot(dx,dz),gap=(e.size+q.size)*.7;
  if(d>0.001&&d<gap){const push=(gap-d)/gap;x+=dx/d*push;z+=dz/d*push;}
 }
 const length=Math.max(1,Math.hypot(x,z));return{x:x/length*.65,z:z/length*.65};
}
export function attackSlotAvailable(e,enemies,now){
 const ranged=['spitter','shaman'].includes(e.role),limit=ranged?2:3,gap=ranged?.38:.28;let active=0;
 for(const q of enemies){
  if(q===e||!q.alive||['spitter','shaman'].includes(q.role)!==ranged)continue;
  if(q.wind>0||q.pounce>0){
   if(++active>=limit)return false;
   // Keep simultaneous telegraphs readable even when a crowd reaches range on
   // the same frame. Interrupted/dead attackers immediately release the slot.
   if(Number.isFinite(now)&&Number.isFinite(q.attackStartedAt)&&now-q.attackStartedAt<gap)return false;
  }
 }
 return true;
}

// A missed leap leaves a readable planted pause; heavy attacks always commit
// to a longer recovery. Existing hit, windup, cooldown and damage stay intact.
export function enemyRecovery(e,base){return Math.max(base,e.role==='golem'?.82:e.pounceMissed?(e.role==='wolf'?.62:.36):0);}

export function nextHuntFormation(previous=-1,random=Math.random){const pool=[0,1,2].filter(id=>id!==previous);return pool[Math.max(0,Math.min(pool.length-1,Math.floor(random()*pool.length)))];}
export const nextForestFormation=nextHuntFormation;
// Every line occupies less than half a circle and keeps six members and one
// elite. Delays only stagger the first attack; normal cooldowns take over.
const REGIONAL_HUNTS={
 snow:[
  {name:'霜线夹击',tip:'巨猿压住正面，巫灵和晶核错开冰区；先走出落点，再从巨猿侧面切入。',squad:[
   {role:'golem',offset:0,elite:true,delay:0},{role:'spitter',offset:-.7,delay:.7},{role:'shaman',offset:.55,delay:1.3},
   {role:'wolf',offset:-1.1,flank:-1,delay:.25},{role:'wolf',offset:1.1,flank:1,delay:1},{role:'mushroom',offset:.3,delay:.5}]},
  {name:'冰脊护送',tip:'晶冠巨猿带队，冰区集中在一侧；绕过另一侧，趁重击收招处理后排。',squad:[
   {role:'golem',offset:-.2,elite:true,delay:0},{role:'wolf',offset:1,flank:1,delay:.65},{role:'spitter',offset:-.8,delay:1.2},
   {role:'shaman',offset:-.4,delay:.5},{role:'mushroom',offset:.3,delay:.9},{role:'mushroom',offset:.6,delay:1.4}]},
  {name:'雪牙轮扑',tip:'霜牙狼从两翼轮流扑近；横移让头狼扑空，利用落地停顿反击。',squad:[
   {role:'wolf',offset:-1,flank:-1,elite:true,delay:0},{role:'wolf',offset:.95,flank:1,delay:.75},{role:'golem',offset:.1,delay:1.2},
   {role:'spitter',offset:-.4,delay:.4},{role:'shaman',offset:.5,delay:1},{role:'mushroom',offset:.7,delay:1.4}]}
 ],
 ash:[
  {name:'裂炉推进',tip:'重甲沿正前方锤出地火，猎蜥从侧面逼近；横移避开火线，再趁重甲收招绕后。',squad:[
   {role:'golem',offset:0,elite:true,delay:0},{role:'wolf',offset:-1.1,flank:-1,delay:.4},{role:'wolf',offset:1.1,flank:1,delay:1.1},
   {role:'spitter',offset:-.45,delay:.75},{role:'shaman',offset:.4,delay:1.3},{role:'mushroom',offset:.7,delay:.2}]},
  {name:'烬鼓催阵',tip:'祭司在重甲后催动同伴；从猎蜥较少的一侧接近，先打断后排的鼓舞。',squad:[
   {role:'shaman',offset:-.45,delay:.9},{role:'golem',offset:0,elite:true,delay:.1},{role:'spitter',offset:.55,delay:1.4},
   {role:'wolf',offset:1.05,flank:1,delay:.5},{role:'mushroom',offset:-.8,delay:1.1},{role:'mushroom',offset:.3,delay:.3}]},
  {name:'飞烬交替',tip:'两名火灵交替封住落点，猎蜥穿插；沿空侧持续走位，别折回尚未熄灭的余火。',squad:[
   {role:'spitter',offset:-.9,elite:true,delay:0},{role:'spitter',offset:.85,delay:1.1},{role:'wolf',offset:-.3,flank:-1,delay:.45},
   {role:'wolf',offset:.35,flank:1,delay:1.3},{role:'mushroom',offset:0,delay:.7},{role:'mushroom',offset:.6,delay:.2}]}
 ],
 sand:[
  {name:'盾阵护咒',tip:'盾卫护住祈者，甲虫从两侧前冲；引出盾卫刺击，侧闪后抓住收盾破绽。',squad:[
   {role:'golem',offset:0,elite:true,delay:0},{role:'shaman',offset:.3,delay:1.25},{role:'spitter',offset:-.4,delay:.65},
   {role:'wolf',offset:-1.05,flank:-1,delay:.3},{role:'wolf',offset:1.05,flank:1,delay:1},{role:'mushroom',offset:.65,delay:.5}]},
  {name:'砂刺双哨',tip:'两名术士分守两边，盾卫挡住中间；先退出砂刺落点，再贴近一翼减少封锁。',squad:[
   {role:'spitter',offset:-.95,elite:true,delay:0},{role:'spitter',offset:.95,delay:.9},{role:'golem',offset:.1,delay:.5},
   {role:'wolf',offset:.6,flank:1,delay:1.2},{role:'mushroom',offset:-.4,delay:.3},{role:'mushroom',offset:.3,delay:.7}]},
  {name:'钩爪穿阵',tip:'晶冠甲虫先冲，另一只随后绕侧；横移避开钳口，扑空后的停顿是反击机会。',squad:[
   {role:'wolf',offset:-1.1,flank:-1,elite:true,delay:0},{role:'wolf',offset:.9,flank:1,delay:.8},{role:'golem',offset:.1,delay:1.3},
   {role:'spitter',offset:-.5,delay:.4},{role:'shaman',offset:.45,delay:1.1},{role:'mushroom',offset:.7,delay:.6}]}
 ],
 coast:[
  {name:'礁背护潮',tip:'海龟向前吐出两段浪涌，海星在后治疗；绕过龟壳侧面，优先处理海星。',squad:[
   {role:'golem',offset:0,elite:true,delay:0},{role:'shaman',offset:.4,delay:1.2},{role:'spitter',offset:-.45,delay:.65},
   {role:'wolf',offset:-1,flank:-1,delay:.3},{role:'wolf',offset:1,flank:1,delay:1},{role:'mushroom',offset:.7,delay:.5}]},
  {name:'刺灯双汐',tip:'两只水母错开放出水爆，蟹群从中间夹近；向空侧移动，等水域退去再回身。',squad:[
   {role:'spitter',offset:-.85,elite:true,delay:0},{role:'spitter',offset:.9,delay:1.15},{role:'wolf',offset:-.3,flank:-1,delay:.4},
   {role:'wolf',offset:.3,flank:1,delay:1},{role:'mushroom',offset:0,delay:.7},{role:'mushroom',offset:.6,delay:1.4}]},
  {name:'钳潮侧袭',tip:'晶冠潮蟹从一翼夹击，海龟堵住正面；横闪让钳口落空，再沿侧翼拆掉水母。',squad:[
   {role:'wolf',offset:-.95,flank:-1,elite:true,delay:0},{role:'golem',offset:.1,delay:.75},{role:'wolf',offset:.95,flank:1,delay:1.2},
   {role:'spitter',offset:-.4,delay:.4},{role:'shaman',offset:.45,delay:1.35},{role:'mushroom',offset:.7,delay:.6}]}
 ]
};
export function huntFormation(map,cycle,variant=cycle%3){
 const regional=REGIONAL_HUNTS[map];if(regional)return regional[((Math.trunc(variant)%3)+3)%3]||regional[0];
 if(map==='forest'&&variant===2)return{name:'孢火交叉',tip:'两名吐息者分守两翼，狼群逼近；沿空出的侧面切入，先打掉一翼。',squad:[
  {role:'spitter',offset:-.9,elite:true},{role:'spitter',offset:1.05},
  {role:'wolf',offset:-.35,flank:-1},{role:'wolf',offset:.4,flank:1},{role:'mushroom',offset:0},{role:'mushroom',offset:.7}
 ]};
 if(map==='forest'&&variant===1)return{name:'獠牙穿插',tip:'晶冠头狼带队绕侧，远程怪压住后方；优先拦截侧面的狼群。',squad:[
  {role:'wolf',offset:-.8,flank:-1,elite:true},{role:'wolf',offset:1.1,flank:1},
  {role:'golem',offset:0},{role:'spitter',offset:-.3},{role:'shaman',offset:.4},{role:'mushroom',offset:.7}
 ]};
 return{name:map==='forest'?'岩甲护送':'精锐围猎',tip:'晶冠重甲正面推进，狼群绕侧，远程怪跟随重甲；绕开领队可先清后排。',squad:HUNT_SQUAD};
}
export const HUNT_BOONS={
 rush:{name:'追猎纹章',text:'使用角色闪避能力后，4 秒内武器和伙伴的直接伤害 +25%。再次使用刷新时间，不叠加。'},
 shelter:{name:'林卫护符',text:'本局生命上限 +20，并恢复 20 生命；铃芽伙伴的生命上限额外 +30。适合稳住近身战。'}
};
export function takeHuntBoon(p,id){
 if(!p.huntRewardPending||p.huntBoon||!Object.hasOwn(HUNT_BOONS,id))return false;
 p.huntBoon=id;p.huntRewardPending=false;
 if(id==='shelter'){p.maxHp+=20;p.hp=Math.min(p.maxHp,p.hp+20);}
 return true;
}
