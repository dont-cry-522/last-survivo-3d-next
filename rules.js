import{SCYTHE}from'./scythe-combat.js?v=125';
import{REGIONAL_ENEMIES}from'./map-enemies.js?v=114';
import{EXTRA_SKILLS,EXTRA_BY_ID}from'./skill-catalog.js?v=125';
import{POISON}from'./poison-config.js?v=114';
import{MIRAGE}from'./mirage-config.js?v=114';
export const MAPS={confluence:{name:'五境大远征',subtitle:'林地、雪山、裂谷、遗城与海港无缝相连，沿古道挑战五境守卫',ground:0x536a48,fog:0x526b61,leaf:0x427657,accent:0xdaca96,slow:'地形'},coast:{name:'幽潮遗港',subtitle:'穿过曲折水湾与岛地，走栈桥或退潮浅滩，打捞货箱、点亮古灯塔',ground:0x586e70,fog:0x344f5c,leaf:0x508582,accent:0x8cdde0,slow:'潮湿滩地'},sand:{name:'风蚀遗城',subtitle:'绕开沙暴流沙，风息挖掘古匣、开启遗城机关',ground:0xafa080,fog:0x928a77,leaf:0x938363,accent:0xe6ca87,slow:'流沙'},forest:{name:'翡翠幽林',subtitle:'穿过古木与遗迹，追寻林心的回声',ground:0x284b3b,fog:0x173d39,leaf:0x287456,accent:0xecc988,slow:'泥地'},snow:{name:'霜月峡谷',subtitle:'冰晶照亮雪路，寒风掩藏猎手',ground:0x96b7bd,fog:0x769daa,leaf:0x456e7d,accent:0x9ae9ff,slow:'深雪'},ash:{name:'赤烬荒原',subtitle:'越过熔岩裂隙，唤醒沉睡的守卫',ground:0x5c4544,fog:0x382e3c,leaf:0x69545d,accent:0xffa25d,slow:'灰烬'}};
export const WEAPONS={miasmalantern:{id:'miasmalantern',name:'蜃花灯',rate:MIRAGE.rate,damage:MIRAGE.impact,count:1,speed:MIRAGE.speed,range:MIRAGE.range,color:MIRAGE.color,needleDamage:MIRAGE.needleDps,needleDuration:MIRAGE.needleDuration,burstRadius:MIRAGE.burstRadius,splashDamage:MIRAGE.splashDamage,poisonScale:1,lureRank:0,venomRank:0},sporelantern:{id:'sporelantern',name:'孢灯',rate:POISON.rate,damage:POISON.impact,count:1,speed:POISON.speed,range:POISON.range,color:POISON.color,cloudDamage:POISON.dps,cloudRadius:POISON.radius,cloudDuration:POISON.duration,cloudMax:POISON.maxClouds,stillRank:0,roamRank:0},boomerang:{id:'boomerang',name:'獾牙回旋镖',rate:1.25,damage:23,count:1,speed:20,range:9,color:0xe2d2aa,petDamage:30,petCooldown:2.35},harpoon:{id:'harpoon',name:'潮汐长叉',rate:1.6,damage:36,count:1,speed:1,range:3.8,color:0x8ad9da,melee:true,width:.48,pull:.85,slow:.6},rifle:{id:'rifle',name:'游侠连发枪',rate:3,damage:12,count:1,speed:27,range:14,color:0xffdc91},shotgun:{id:'shotgun',name:'碎岩霰弹枪',rate:1,damage:10,count:5,speed:25,range:8,color:0xffbe69},fire:{id:'fire',name:'烬火法杖',rate:.9,damage:30,count:1,speed:14,range:11,color:0xff743b},crossbow:{id:'crossbow',name:'夜翎短弩',rate:2.05,damage:20,count:1,speed:35,range:16,color:0xd8edff},shuriken:{id:'shuriken',name:'月刃飞镖',rate:1.4,damage:13,count:3,speed:22,range:12,color:0x95fff0},dark:{id:'dark',name:'夜幕法杖',rate:1,damage:26,count:1,speed:12,range:10,color:0xc5a2ff},shade:{id:'shade',name:'噬影掌',rate:1.6,damage:18,count:1,speed:20,range:8,color:0xa7b7ce},shadowblade:{id:'shadowblade',name:'断魂战镰',rate:SCYTHE.rate,damage:SCYTHE.damage,count:1,speed:1,range:SCYTHE.range,arc:SCYTHE.arc,melee:true,color:0xb2bfd1},grimoire:{id:'grimoire',name:'悬影魔典',rate:.8,damage:34,count:1,speed:1,range:10,color:0x8b9daf}};
export const HERO_LOADOUTS={scout:['rifle','shotgun','fire'],silver:['crossbow','shuriken','dark'],wraith:['shade','shadowblade','grimoire'],tide:['harpoon'],lingya:['boomerang'],wuling:['sporelantern'],mirage:['miasmalantern']};
export function weaponFor(hero,index){const ids=Object.hasOwn(HERO_LOADOUTS,hero)?HERO_LOADOUTS[hero]:HERO_LOADOUTS.scout;return WEAPONS[ids[index]||ids[0]];}
export function registerCrossbowHit(player,targetId,now){const mark=player.crossbowMark;if(!mark||mark.target!==targetId||now-mark.time>2.5)player.crossbowMark={target:targetId,time:now,hits:1};else{mark.time=now;mark.hits++;if(mark.hits===3){mark.hits=0;return true;}}return false;}
export function registerShadowHit(target,now){const mark=target.shadowMark;if(!mark||now-mark.time>=2.5)target.shadowMark={hits:1,time:now};else{mark.time=now;mark.hits++;if(mark.hits>=3){mark.hits=0;return true;}}return false;}
export function seeded(seed){let n=seed>>>0;return()=>{n=(Math.imul(n,1664525)+1013904223)>>>0;return n/4294967296;};}
export function experienceNeeded(level){return Math.round(48+(level-1)*7);}
export function grantExperience(p,n){p.xp+=n;while(p.xp>=experienceNeeded(p.level)){p.xp-=experienceNeeded(p.level);p.level++;p.pending++;p.maxHp+=4;p.hp=Math.min(p.maxHp,p.hp+4);}}
export const UPGRADES=[{id:'power',name:'磨砺锋芒',text:'武器伤害 +18%',icon:'✦',max:5},{id:'haste',name:'疾风节拍',text:'射速 +15%',icon:'»',max:4},{id:'fire',name:'陨火降临',text:'周期召唤陨火，轰击附近怪群',icon:'☄',max:3},{id:'ice',name:'霜华绽放',text:'周期释放冰晶环，伤害并减速',icon:'❄',max:3},{id:'storm',name:'雷霆回响',text:'周期落雷，连锁附近敌人',icon:'ϟ',max:3},{id:'veil',name:'暗幕',text:'周期展开暗幕，遮蔽并削弱逼近的敌人',icon:'◐',max:3},{id:'chain',name:'缚影',text:'周期甩出影链，束缚前方怪物',icon:'⛓',max:3},{id:'rift',name:'裂隙',text:'周期唤出影之裂隙，重创附近怪物',icon:'✺',max:3},{id:'vitality',name:'坚韧之心',text:'生命上限 +24，并恢复 24',icon:'♡',max:4},{id:'stride',name:'轻盈步伐',text:'移动速度 +8%，闪避冷却缩短',icon:'➶',max:3},{id:'magnet',name:'灵光牵引',text:'经验吸取范围增加',icon:'◎',max:3}];
UPGRADES.push(...EXTRA_SKILLS.map(s=>({...s,text:s.describe(1),category:'skill'})));
const heroSpell=(hero,id,weapon)=>EXTRA_BY_ID[id]?EXTRA_BY_ID[id].hero===(hero||'scout')&&(!EXTRA_BY_ID[id].weapon||EXTRA_BY_ID[id].weapon===weapon):['tide','lingya'].includes(hero)?['power','haste','vitality','stride','magnet'].includes(id):hero==='wraith'?!['fire','ice','storm'].includes(id):!['veil','chain','rift'].includes(id);
const route=(weapon,name,icon,steps)=>({weapon,name,icon,steps});
export const WEAPON_PATHS={
 miasmalantern_lure:route('miasmalantern','幻瘴','❧',[`替身持续至 ${MIRAGE.lureDuration} 秒，承受伤害降低 ${Math.round((1-MIRAGE.lureDamageTaken)*100)}%；生命仍为释放时的当前生命`,`保留一阶；自然绽爆半径 ${MIRAGE.lureBloomRadius} 米，毒雾半径 ${MIRAGE.lureCloudRadius} 米，每秒 ${MIRAGE.lureCloudDps} 伤害、${MIRAGE.lureCloudDuration} 秒`,`保留二阶；自然绽爆伤害 +${Math.round((MIRAGE.lureFinalBloom-1)*100)}%，毒雾伤害 +${Math.round((MIRAGE.lureFinalDps-1)*100)}%；绽爆与毒雾短暂减速，替身被杀仍无绽爆`]),
 miasmalantern_venom:route('miasmalantern','蚀影','⋄',[`附毒提高至每秒 ${MIRAGE.venomDps[1]} 伤害，重复命中刷新而不叠层`,`附毒每秒 ${MIRAGE.venomDps[2]} 伤害；遁形结束后 ${MIRAGE.pursuitDuration} 秒内，命中的附毒再增加 ${MIRAGE.pursuitDps} 每秒伤害`,`附毒每秒 ${MIRAGE.venomDps[3]} 伤害；保留显形附毒强化，并在该 ${MIRAGE.pursuitDuration} 秒窗口内攻速再提高 ${Math.round((MIRAGE.pursuitRate-1)*100)}%`]),
 sporelantern_still:route('sporelantern','沉瘴','♧',[`毒雾半径缩至 ${POISON.radius*POISON.stillRadius} 米，持续延长至 ${POISON.duration+POISON.stillDuration} 秒；适合定点守区`,`保留小范围长持续；主毒区留置 ${POISON.matureTime} 秒逐渐成熟，毒雾伤害最高 +${POISON.matureBonus*100}%`,`成熟后凝出半径 ${POISON.coreRadius} 米的毒核，核心伤害再提高 ${Math.round((POISON.coreMultiplier-1)*100)}%；与同区毒雾取高，不叠加`]),
 sporelantern_roam:route('sporelantern','游瘴','↝',[`毒雾半径扩大至 ${POISON.radius*POISON.roamRadius} 米，持续缩短至 ${POISON.duration-POISON.roamDuration} 秒；适合搬运布阵`,`闪避搬运留下短毒带：每秒伤害为毒雾的 ${POISON.bandMultiplier*100}%，半宽 ${POISON.bandRadius} 米，最多 ${POISON.maxBands} 条、${POISON.bandDuration} 秒；不超过源毒区剩余寿命`,`搬运落点短暂展开横向毒幕：宽 ${POISON.curtainHalfWidth*2} 米、深 ${POISON.curtainHalfDepth*2} 米，最多 ${POISON.curtainDuration} 秒；不延长源毒区寿命`]),
 boomerang_pincer:route('boomerang','同心夹击','✦',['回旋镖伤害 +10%；伙伴扑击 +22%，优先绕侧；追击已被回旋镖标记的敌人额外 +22%','回旋镖 +20%，伙伴 +44%，标记额外 +44%，扑击休息缩短','回旋镖 +30%，伙伴 +66%，标记额外 +66%，扑击休息缩短至 1.75 秒']),
 boomerang_snare:route('boomerang','林间设伏','♧',['回旋镖伤害 +8%；每第三次投掷在脚下留下藤绊，触发造成 18 伤害并减速；最多 3 处','回旋镖 +16%；藤绊 26 伤害，范围和减速增强','回旋镖 +24%；藤绊 34 伤害，普通怪短暂停步 0.6 秒；首领只减速']),
 harpoon_reef:route('harpoon','破礁长锋','➤',['伤害 +18%，距离 +0.25 米，贯穿宽度 +0.08 米','伤害 +36%，距离 +0.5 米，宽度 +0.16 米','伤害 +54%，距离 +0.75 米，宽度 +0.24 米']),
 harpoon_tow:route('harpoon','回潮牵引','≈',['第三击牵引 1.3 米、减速 1.1 秒，伤害 +8%','第三击牵引 1.7 米、减速 1.5 秒，伤害 +16%','第三击牵引 2.1 米、减速 1.9 秒，伤害 +24%；首领只减速']),
 rifle_pierce:route('rifle','贯穿弹道','➤',['贯穿 2 个目标，伤害 +8%，射速 -10%','贯穿 3 个目标，伤害 +16%','贯穿 4 个目标，伤害 +24%']),
 rifle_rapid:route('rifle','疾速机括','»',['射速 +20%，单发伤害 -8%','射速 +40%，弹速 +10%','射速 +60%，弹速 +15%']),
 shotgun_fan:route('shotgun','散射风暴','⋔',['每次 7 弹丸，扇面变宽，单丸伤害 -20%，射程 -15%','每次 8 弹丸','每次 9 弹丸']),
 shotgun_slug:route('shotgun','独头重弹','◆',['合为 1 发重弹：55 伤害，贯穿 2 个目标，射程 +45%，射速 -15%','重弹 62 伤害，贯穿 3 个目标','重弹 69 伤害，贯穿 4 个目标']),
 fire_burn:route('fire','余烬灼烧','♨',['命中点燃 3 秒，每秒 7 伤害，直接伤害 -10%','灼烧每秒 10 伤害','灼烧每秒 13 伤害；重复命中刷新，不叠层']),
 fire_blast:route('fire','熔核爆破','✹',['爆炸半径 3，伤害 +12%，射速 -10%','爆炸半径 3.5，伤害 +24%','爆炸半径 4，伤害 +36%']),
 crossbow_pierce:route('crossbow','破甲重矢','➤',['伤害 +22%，贯穿 2 个目标，射速 -12%','伤害 +36%，贯穿 3 个目标','伤害 +50%，贯穿 4 个目标']),
 crossbow_hunt:route('crossbow','追猎机括','»',['射速 +18%，箭速 +10%，单箭伤害 -8%','射速 +32%，箭速 +18%','射速 +46%，箭速 +25%']),
 shuriken_fan:route('shuriken','月刃齐发','✧',['每次 5 枚飞镖，单枚伤害 -20%','每次 6 枚飞镖','每次 7 枚飞镖']),
 shuriken_return:route('shuriken','回旋月刃','↶',['飞镖折返，可再次命中；单次伤害 -20%，贯穿 3 个目标','贯穿 4 个目标，弹速 +10%','贯穿 5 个目标，弹速 +15%']),
 dark_gravity:route('dark','引力漩涡','✺',['命中留下 1.4 秒牵引区，半径 2.6；直接伤害 -10%','牵引半径 2.9，持续 1.6 秒','牵引半径 3.2，持续 1.8 秒；最多 3 处，首领牵引减弱']),
 dark_seek:route('dark','追魂魔矢','♦',['追踪弹速 +35%，射速 +15%，伤害 -10%','双追踪魔矢，每枚伤害 -30%，射速恢复基础值','双魔矢射速 +15%，每枚伤害 -30%']),
 shade_echo:route('shade','残响弹射','◇',['影脉弹射 1 次','影脉弹射 2 次，伤害 +10%','影脉弹射 3 次，伤害 +20%']),
 shade_blight:route('shade','蚀影刻印','◈',['三次命中引爆刻印，额外 24 伤害','刻印伤害 36，爆炸半径增加','刻印伤害 48，爆炸半径增加']),
 shadowblade_fan:route('shadowblade','横月收割','✧',['近战距离 +0.25 米、斩击半角 +7°、伤害 +8%','距离 +0.5 米、半角 +14°、伤害 +16%','距离 +0.75 米、半角 +21°、伤害 +24%']),
 shadowblade_return:route('shadowblade','断魂重镰','↶',['伤害 +25%，攻速 -10%；强化近身重击','伤害 +50%，攻速 -10%','伤害 +75%，攻速 -10%']),
 grimoire_wide:route('grimoire','裂界之页','▱',['裂口半径 2.1，伤害 +8%','裂口半径 2.5，伤害 +16%','裂口半径 2.9，伤害 +24%']),
 grimoire_echo:route('grimoire','复诵禁咒','◈',['裂口延迟再次爆发，造成 40% 伤害','再次爆发造成 55% 伤害','再次爆发造成 70% 伤害'])
};
const PATH_LEVELS=[3,5,8];
function routeChoices(p){const rank=p.weaponPath?.rank||0;if(rank>=3||(p.level||1)<PATH_LEVELS[rank])return[];return Object.entries(WEAPON_PATHS).filter(([id,v])=>v.weapon===p.weaponId&&(!p.weaponPath||p.weaponPath.id===id)).map(([id,v])=>({id:'path:'+id,pathId:id,name:v.name,icon:v.icon,text:v.steps[rank],max:3,rank,category:'weapon'}));}
export function chooseUpgrades(p,random=Math.random){const pool=UPGRADES.filter(u=>heroSpell(p.heroId,u.id,p.weaponId)&&(p.upgrades[u.id]||0)<u.max).map(u=>{
 const rank=(p.upgrades[u.id]||0)+1;let text=u.text;
 if(u.id==='haste'&&p.heroId==='lingya')text='攻击频率 +15%，骨镖往返速度 +12%，仍须回收后再次投掷';
 if(u.id==='haste'&&p.heroId==='tide')text='穿刺速度 +15%，牵引节奏加快';
 if(u.id==='haste'&&p.heroId==='mirage')text='毒针发射频率 +15%；附毒刷新不叠层，不加快替身绽爆';
 if(u.id==='haste'&&p.heroId==='wuling')text=`抛投频率 +15%；不增加毒雾每秒伤害，最多保留 ${POISON.maxClouds} 片主毒区`;
 if(u.id==='fire')text=`每 5.5 秒落下陨火，造成 ${35*rank} 伤害，爆炸半径 3.5`;
 if(u.id==='ice')text=`每 7 秒冰晶扩散，造成 ${20*rank} 伤害，减速 ${(2+rank*.35).toFixed(2)} 秒`;
 if(u.id==='storm')text=`每 5.5 秒落雷并连锁 ${2+rank} 个目标，每个造成 ${27*rank} 伤害`;
 if(u.id==='veil')text=`每 8 秒张开暗幕 2.5 秒，范围内敌人减速并受到 ${10*rank} 点影蚀伤害`;
 if(u.id==='chain')text=`每 7 秒缚住附近 ${2+rank} 只怪物，造成 ${15*rank} 伤害`;
 if(u.id==='rift')text=`每 9 秒打开裂隙，造成 ${30*rank} 范围伤害并短暂牵引`;
 if(EXTRA_BY_ID[u.id])text=EXTRA_BY_ID[u.id].describe(rank);
 return{...u,text};
 });
 const previous=new Set(p.upgradeDraft?.shown||[]),result=[],routes=routeChoices(p);
 // Recent cards stay possible for focused builds, but do not crowd out new options.
 const pick=options=>{
  if(!options.length)return;
  const fresh=options.filter(u=>!previous.has(u.id));
  if(fresh.length&&result.some(u=>previous.has(u.id)))options=fresh;
  const weights=options.map(u=>previous.has(u.id)?.2:1);
  let roll=random()*weights.reduce((sum,w)=>sum+w,0),index=options.length-1;
  for(let i=0;i<options.length;i++){roll-=weights[i];if(roll<0){index=i;break;}}
  const choice=options[index];result.push(choice);const at=pool.indexOf(choice);if(at>=0)pool.splice(at,1);
 };
 const misses=p.upgradeDraft?.routeMisses||0;
 if(routes.length&&(!pool.length||misses>=2||random()<.45))pick(routes);
 // Include a gameplay skill when available, drawn from spells AND hero abilities.
 pick(pool.filter(u=>u.category==='skill'||['fire','ice','storm','veil','chain','rift'].includes(u.id)));
 while(pool.length&&result.length<3)pick(pool);
 // Cards have no fixed "best" slot.
 for(let i=result.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[result[i],result[j]]=[result[j],result[i]];}
 p.upgradeDraft={shown:result.map(u=>u.id),routeMisses:routes.length&&!result.some(u=>u.category==='weapon')?misses+1:0};
 return result;
}
export function takeUpgrade(p,id){
 if(id.startsWith('path:')){const choice=routeChoices(p).find(c=>c.id===id);if(!choice)return false;p.weaponPath={id:choice.pathId,rank:choice.rank+1};return true;}
 const u=UPGRADES.find(u=>u.id===id);if(!u||!heroSpell(p.heroId,id,p.weaponId)||(p.upgrades[id]||0)>=u.max)return false;p.upgrades[id]=(p.upgrades[id]||0)+1;if(id==='vitality'){p.maxHp+=24;p.hp=Math.min(p.maxHp,p.hp+24);}return true;
}
export function weaponStats(p){
 const base=Object.hasOwn(WEAPONS,p.weaponId)?WEAPONS[p.weaponId]:WEAPONS.crossbow,w={...base,hitRadius:({miasmalantern:MIRAGE.hitRadius,sporelantern:POISON.impactRadius,boomerang:.20,harpoon:.1,rifle:.06,shotgun:.07,crossbow:.09,shuriken:.22,fire:.32,dark:.28,shade:.18,shadowblade:.32,grimoire:0})[base.id],pierce:base.id==='boomerang'?3:['shuriken','shadowblade'].includes(base.id)?2:1,spread:({shotgun:.20,shuriken:.19,shadowblade:.22})[base.id]||.12,radius:base.id==='fire'?2.5:base.id==='dark'?2:base.id==='grimoire'?1.7:0,bounces:0,burn:0,returning:base.id==='boomerang',gravity:0,echo:0,markDamage:base.id==='shade'?24:0,markRadius:1.8};
 const id=p.weaponPath?.id,path=WEAPON_PATHS[id],r=path?.weapon===base.id?Math.min(3,Math.max(0,p.weaponPath.rank)):0;
 w.pathId=r?id:null;w.pathRank=r;
 if(r)switch(id){
 case'miasmalantern_lure':w.lureRank=r;break;
 case'miasmalantern_venom':w.venomRank=r;w.needleDamage=MIRAGE.venomDps[r];break;
 case'sporelantern_still':w.stillRank=r;w.cloudRadius*=POISON.stillRadius;w.cloudDuration+=POISON.stillDuration;break;
 case'sporelantern_roam':w.roamRank=r;w.cloudRadius*=POISON.roamRadius;w.cloudDuration-=POISON.roamDuration;break;
 case'boomerang_pincer':w.damage*=1+.10*r;w.petDamage*=1+.22*r;w.petCooldown=base.petCooldown-.20*r;w.pincerRank=r;break;
 case'boomerang_snare':w.damage*=1+.08*r;w.trapRank=r;break;
 case'harpoon_reef':w.damage*=1+.18*r;w.range+=.25*r;w.width+=.08*r;break;
 case'harpoon_tow':w.damage*=1+.08*r;w.pull=.9+.4*r;w.slow=.7+.4*r;break;
 case'rifle_pierce':w.pierce=1+r;w.damage*=1+.08*r;w.rate*=.9;break;
 case'rifle_rapid':w.rate*=1+.2*r;w.damage*=.92;w.speed*=1+.05*r;break;
 case'shotgun_fan':w.count=6+r;w.damage*=.8;w.range*=.85;w.spread=.19;break;
 case'shotgun_slug':w.count=1;w.hitRadius=.13;w.damage=48+7*r;w.range*=1.45;w.rate*=.85;w.pierce=1+r;break;
 case'fire_burn':w.burn=4+3*r;w.damage*=.9;break;
 case'fire_blast':w.radius=2.5+.5*r;w.damage*=1+.12*r;w.rate*=.9;break;
 case'crossbow_pierce':w.damage*=1+.08+.14*r;w.rate*=.88;w.pierce=1+r;break;
 case'crossbow_hunt':w.rate*=[1,1.18,1.32,1.46][r];w.speed*=[1,1.10,1.18,1.25][r];w.damage*=.92;break;
 case'shuriken_fan':w.count=4+r;w.damage*=.8;w.spread=.18;break;
 case'shuriken_return':w.returning=true;w.pierce=2+r;w.damage*=.8;w.speed*=1+(r===1?0:.05*r);break;
 case'dark_gravity':w.gravity=r;w.damage*=.9;break;
 case'dark_seek':w.speed*=1.35;w.count=r>=2?2:1;w.damage*=r>=2?.7:.9;w.rate*=r===2?1:1.15;break;
 case'shade_echo':w.bounces=r;w.damage*=1+.1*(r-1);break;
 case'shade_blight':w.markDamage=12+12*r;w.markRadius=1.6+.3*r;break;
 case'shadowblade_fan':w.range+=.25*r;w.arc+=Math.PI/180*7*r;w.damage*=1+.08*r;break;
 case'shadowblade_return':w.damage*=1+.25*r;w.rate*=.9;break;
 case'grimoire_wide':w.radius=1.7+.4*r;w.damage*=1+.08*r;break;
 case'grimoire_echo':w.echo=.25+.15*r;break;
 }
 w.damage*=1+.18*(p.upgrades?.power||0);if(w.id==='miasmalantern'){w.poisonScale=1+.18*(p.upgrades?.power||0);w.needleDamage*=w.poisonScale;w.splashDamage*=w.poisonScale;}if(w.cloudDamage!==undefined)w.cloudDamage*=1+.18*(p.upgrades?.power||0);if(w.petDamage)w.petDamage*=1+.18*(p.upgrades?.power||0);w.rate*=1+.15*(p.upgrades?.haste||0);if(w.id==='boomerang')w.speed*=1+.12*(p.upgrades?.haste||0);if(p.huntBoon==='rush'&&p.huntRush>0){w.damage*=1.25;if(w.petDamage)w.petDamage*=1.25;}return w;
}
export function weaponReachText(w){
 const n=v=>Number(v.toFixed(1));if(w.id==='miasmalantern')return `毒团射程 ${n(w.range)} 米 · 扩散半径 ${n(w.burstRadius)} 米 · 附毒每秒 ${n(w.needleDamage)} 伤害、${MIRAGE.needleDuration} 秒 · 刷新不叠层 · 闪避起点留下诱敌替身`;if(w.id==='sporelantern')return `抛投距离 ${n(w.range)} 米 · 毒雾半径 ${n(w.cloudRadius)} 米 · 每秒 ${n(w.cloudDamage)} 伤害，持续 ${n(w.cloudDuration)} 秒 · 最多 ${w.cloudMax} 片`;if(w.id==='boomerang')return '去程 '+n(w.range)+' 米 · 去回程各可命中一次 · 伙伴自主扑击';if(w.id==='harpoon')return '穿刺距离 '+n(w.range)+' 米 · 窄线贯穿 · 第三击回潮牵引';
 if(w.id==='shadowblade')return '近战距离 '+n(w.range)+' 米 · 横斩→反斩→重镰 · 扇面 '+Math.round(w.arc*360/Math.PI)+'°';
 const reach=w.id==='grimoire'?'施法距离':w.returning?'去程距离':'射程';
 const area=w.radius>0?' · '+(w.id==='grimoire'?'裂口':'爆炸')+'半径 '+n(w.radius)+' 米':w.count>1?' · 扇面 '+Math.round((w.count-1)*w.spread*180/Math.PI)+'°':w.hitRadius>=.18?' · 宽刃／影脉':' · 窄线直射';
 return reach+' '+n(w.range)+' 米'+area+(w.returning?' · 飞回可再次命中':'');
}
export const ENEMIES={mushroom:{hp:28,speed:2.7,damage:10,xp:6,size:.55},wolf:{hp:24,speed:4.4,damage:12,xp:8,size:.6},golem:{hp:130,speed:1.7,damage:22,xp:23,size:1},spitter:{hp:52,speed:2.3,damage:13,xp:12,size:.6},shaman:{hp:75,speed:2,damage:8,xp:18,size:.65}};
for(const [id,cfg]of Object.entries(REGIONAL_ENEMIES))if(cfg.role!=='boss')ENEMIES[id]={...cfg};
export function segmentDistance(px,pz,ax,az,bx,bz){const x=bx-ax,z=bz-az,l=x*x+z*z,t=l?Math.max(0,Math.min(1,((px-ax)*x+(pz-az)*z)/l)):0;return Math.hypot(px-ax-x*t,pz-az-z*t);}

export const heroHealth=id=>id==='tide'?140:120;
