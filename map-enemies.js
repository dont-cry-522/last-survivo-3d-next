import{ADDITIONAL_BOSSES}from'./boss-roster.js?v=211';
// Reuse locomotion roles while giving each biome its own species and attacks.
export const MAP_ROSTERS={coast:{mushroom:'foamling',wolf:'tidecrab',golem:'reefturtle',spitter:'jellyseer',shaman:'tidestar',boss:'wreckwarden'},sand:{mushroom:'sandworm',wolf:'clawbeetle',golem:'sandguard',spitter:'sandspitter',shaman:'duneoracle',boss:'dunescorpion'},forest:{mushroom:'mushroom',wolf:'wolf',golem:'golem',spitter:'spitter',shaman:'shaman',boss:'boss'},snow:{mushroom:'snowhare',wolf:'frostwolf',golem:'yeti',spitter:'icewitch',shaman:'snowtotem',boss:'frostking'},ash:{mushroom:'emberling',wolf:'ashstalker',golem:'lavabrute',spitter:'cinderwisp',shaman:'ashseer',boss:'cinderlord'}};
export const REGIONAL_ENEMIES={
 foamling:{map:'coast',role:'mushroom',hp:30,speed:2.9,damage:11,xp:7,size:.5,name:'海沫跳灵',traits:'青蓝卷浪软体、内凹浪窝和白色泡缘；压低后跳扑，落地回弹。',attack:'锁定方向后短距离跳扑',tip:'看到身体压低，侧移避开。'},
 tidecrab:{map:'coast',role:'wolf',hp:40,speed:3.7,damage:13,xp:10,size:.65,name:'钳潮蟹',traits:'低扁分片甲壳、外展关节足和长螯；交替撑地前进，张螯后夹击。',attack:'短蓄力后前冲夹击',tip:'不要直线后退，横向闪过钳口。'},
 reefturtle:{map:'coast',role:'golem',hp:150,speed:1.5,damage:21,xp:25,size:.9,name:'礁背海龟',traits:'低拱分缝龟甲、礁脊、厚趾足和钩喙；交替撑地，伸颈吐出浪涌。',attack:'前方两段延迟浪涌，命中减速',tip:'离开前方的青色水纹，绕龟壳两侧。'},
 jellyseer:{map:'coast',role:'spitter',hp:46,speed:2.3,damage:12,xp:13,size:.6,zone:'tide',name:'刺灯水母',traits:'透明伞盖、内侧径脉和长短不齐的口腕；伞盖收缩、触丝波动，漂浮时不受水阻。',attack:'锁定位置后放出延迟水爆，留下短暂减速水域',tip:'看见青色落点就继续移动，水爆后也别立刻返回。'},
 tidestar:{map:'coast',role:'shaman',hp:72,speed:1.8,damage:10,xp:19,size:.65,name:'潮汐海星',traits:'厚扁五臂与沿臂沟槽，中心有暗潮核；逐臂起伏爬动，抬臂呼唤回潮。',attack:'治疗附近受伤同伴；否则向目标释放减速水爆',tip:'先处理海星，避免厚壳怪反复恢复。'},
 wreckwarden:{map:'coast',role:'boss',name:'沉舟寄居王',traits:'巨钳、六足和背上的破船；负重迈步、船帆随身体摆动。',attack:'双钳封锁前方、三段追身浪涌、两侧落锚；半血后强化',tip:'双钳向后避，浪涌横移；落锚时两处之间有空隙，收招时反击。'},

 sandworm:{map:'sand',role:'mushroom',hp:32,speed:2.5,damage:12,xp:7,size:.55,name:'沙脊虫',traits:'环节躯体、起伏背脊和径向齿口；贴地蠕动，昂起前身后弹射。',attack:'短距离扑击',tip:'观察抬头蓄力，向侧面避开。'},
 clawbeetle:{map:'sand',role:'wolf',hp:38,speed:3.7,damage:13,xp:10,size:.65,name:'钩爪甲虫',traits:'纵长分缝硬鞘、深色腹甲和弯钩口钳；六足交替快爬。',attack:'压低身体后直线冲刺',tip:'侧闪，利用残垣阻挡冲刺。'},
 sandguard:{map:'sand',role:'golem',hp:145,speed:1.6,damage:23,xp:25,size:.85,name:'遗城盾卫',traits:'短裾裹头、窄视缝、旧铜盾和弯刃；负重迈步、举盾后向前刺击。',attack:'正面蓄力刺击；正面承受的伤害减少 35%',tip:'绕侧攻击，蓄力时退开。'},
 sandspitter:{map:'sand',role:'spitter',hp:52,speed:2.1,damage:13,xp:13,size:.6,zone:'sand',name:'砂咒术士',traits:'灰绿横缠头巾、长围巾和砂罐杖；侧移并举杖。',attack:'在锁定位置引爆砂刺',tip:'离开黄沙预告，砂刺只爆发一次。'},
 duneoracle:{map:'sand',role:'shaman',hp:75,speed:1.9,damage:11,xp:19,size:.65,name:'遗城祈者',traits:'紫灰深兜袍、浅色面罩和叉形沉芯杖；顿步抬杖。',attack:'治疗受伤同伴；否则施放减速咒',tip:'优先清除，防止盾卫反复恢复。'},
 dunescorpion:{map:'sand',role:'boss',name:'蚀金巨蝎',traits:'宽阔分节甲壳、八足、弯钳和高举蝎尾；交错支撑，夹击收钳、尾刺前卷尾。',attack:'近身夹击、锁定尾刺、钻地后破沙而出',tip:'夹击退后，尾刺横移；钻地时离开落点，出土后反击。'},

 snowhare:{map:'snow',role:'mushroom',hp:26,speed:3,damage:9,xp:6,size:.5,name:'雪原跳兔',traits:'白毛长耳、伏低前身和厚实后躯；耳中段与耳尖柔弯，折叠后踝和长掌蹬地跳扑，前爪接地后耳朵回弹。',attack:'低身蓄力后短距离跳扑',tip:'看到它蹲下就侧移，让它扑空后反击。'},
 frostwolf:{map:'snow',role:'wolf',hp:30,speed:4.2,damage:11,xp:9,size:.6,hitSlow:.65,name:'霜牙狼',traits:'白蓝厚胸、收紧腹线、长吻和弯折飞节；交错步绕侧追猎，伏低后扑咬。',attack:'锁定方向突扑，命中附带 0.65 秒寒霜减速',tip:'横向闪开扑击，不要被减速后继续沿直线逃跑。'},
 yeti:{map:'snow',role:'golem',hp:140,speed:1.6,damage:17,xp:24,size:1,name:'雪岭巨猿',traits:'厚背低颈、前伸面庞与撑地长臂；重心前倾迈步，抬臂砸出寒霜。',attack:'举臂后拍地，留下短暂伤害与减速的冰面',tip:'离开脚下预告区域，等冰面消退再靠近。'},
 icewitch:{map:'snow',role:'spitter',hp:48,speed:2.2,damage:10,xp:12,size:.6,zone:'frost',name:'冰冠巫灵',traits:'冰蓝连续长袍、狭窄面缝与冰杖；低空侧滑、抬杖送出冰晶，靠近时会退让。',attack:'锁定你的位置，延迟形成持续 1.5 秒的寒霜区',tip:'保持移动；冰面亮起后绕开，别被减速困在原地。'},
 snowtotem:{map:'snow',role:'shaman',hp:65,speed:1.8,damage:8,xp:18,size:.65,name:'浮霜晶核',traits:'偏斜主冰晶与环绕卫晶；悬浮转动，蓄力时卫晶展开。',attack:'在锁定位置两侧制造两块延迟寒霜区',tip:'从两块冰区中间穿出，别顺着横向封锁移动。'},
 frostking:{map:'snow',role:'boss',name:'霜冠巨猿',traits:'白毛宽肩、长臂撑地、冰晶王冠；蓄力蹲身后跃起。',attack:'锁定位置跳砸、三向冰棱扇；半血后范围扩大',tip:'看到蹲身就离开落点，从冰棱扇空隙穿出；落地后反击。'},
 emberling:{map:'ash',role:'mushroom',hp:30,speed:2.8,damage:10,xp:7,size:.55,name:'熔角幼魔',traits:'暗红收腹躯体、弯角与细眼；小步快跑并甩尾，跳扑落地留下余火。',attack:'蓄力跳扑，落地后脚下余火短暂灼伤',tip:'侧闪后继续走一步，别站回它的落点。'},
 ashstalker:{map:'ash',role:'wolf',hp:32,speed:4.1,damage:13,xp:10,size:.65,name:'烬脊猎蜥',traits:'低扁长头、外展爪足、橙色背鳍与长尾；贴地爬行、尾巴反向平衡，压低后猛冲。',attack:'压低身体后沿锁定方向长距离猛冲',tip:'横向闪避，利用树石拦住它，不要向后直退。'},
 lavabrute:{map:'ash',role:'golem',hp:145,speed:1.5,damage:19,xp:25,size:1,name:'裂炉重甲',traits:'楔形炉腹、层叠厚肩与熔裂纹；沉重拖步，转腰抬起单臂向前锤出地火。',attack:'重锤前方，沿锁定方向依次爆出三段地火',tip:'离开正前方攻击线，绕侧输出。'},
 cinderwisp:{map:'ash',role:'spitter',hp:44,speed:2.5,damage:12,xp:12,size:.55,zone:'ember',name:'飞烬火灵',traits:'单枚熔芯延伸出火舌，黑色碎甲环抱；起伏飘行，收紧碎甲后喷出火核。',attack:'锁定位置后延迟爆燃，地面余火持续 1.5 秒',tip:'预告亮起先离开，再绕过余火接近。'},
 ashseer:{map:'ash',role:'shaman',hp:70,speed:2,damage:10,xp:19,size:.65,name:'燃烬祭司',traits:'焦褐连续长袍、细面缝与橙红杖头；顿杖踏步，举杖再落杖鼓舞同伴加速。',attack:'附近有同伴时使其加速 3 秒；独处时制造地火',tip:'优先击倒祭司，留意同伴脚边的橙色火星。'},
 cinderlord:{map:'ash',role:'boss',name:'熔炉暴君',traits:'暗红岩甲、肋间熔核与角冠；负重迈步，举臂蓄火后向两侧推出炉焰。',attack:'双列炉火封路、交错落烬；半血后增加第三处落点',tip:'双列火路中间有空隙，交错落点需提前移步；收招时反击。'}
};
for(const [id,boss]of Object.entries(ADDITIONAL_BOSSES))REGIONAL_ENEMIES[id]={...boss,role:'boss'};
export function regionalEnemy(map,role){return MAP_ROSTERS[map]?.[role]||role;}
