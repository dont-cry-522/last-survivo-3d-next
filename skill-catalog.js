import{POISON}from'./poison-config.js?v=114';
import{MIRAGE}from'./mirage-config.js?v=114';
export const EXTRA_SKILLS=[
 {id:'scythe_mark',hero:'wraith',weapon:'shadowblade',name:'冥镰刻痕',icon:'⋀',max:3,describe:r=>`断魂战镰在同一目标身上连续命中三次（相邻间隔不超过 3 秒），第三次额外造成 ${18+10*r} 伤害，随后清空刻痕；不由其他技能叠层。`},
 {id:'scythe_step',hero:'wraith',weapon:'shadowblade',name:'影步斩',icon:'↝',max:3,describe:r=>`影步结束后 2 秒内第一次战镰攻击，伤害提高 ${20*r}%；空挥也会消耗机会，不提供额外无敌。`},
 {id:'scythe_reap',hero:'wraith',weapon:'shadowblade',name:'残月收割',icon:'☽',max:3,describe:r=>`断魂战镰命中生命不高于 30% 的敌人时，本次斩击伤害提高 ${15*r}%；对首领也有效，不直接处决。`},
 {id:'mirage_residue',hero:'mirage',name:'残蛊',icon:'♧',max:3,describe:r=>`毒团命中、扩散波及或接触己方蜃雾后，留下每秒 ${MIRAGE.residueDps[r]} 伤害、${MIRAGE.residueDuration[r]} 秒的残蛊。刷新不叠层；区域内只受最强蜃雾，区域外附毒、残蛊、诱葬只取最强一份，不触发技能或遗物连锁。`},
 {id:'mirage_burial',hero:'mirage',name:'诱葬',icon:'❧',max:3,describe:r=>`仅替身自然结束的绽爆，为范围内存活敌人附上每秒 ${MIRAGE.burialDps[r]} 伤害、${MIRAGE.burialDuration} 秒的毒蚀并减速 ${MIRAGE.burialSlow[r]} 秒。替身被杀或被新替身替换时不触发；区域内不叠加，离区与其他附着毒取高。`},
 {id:'mirage_mantle',hero:'mirage',name:'蜃衣',icon:'◇',max:3,describe:r=>`蜕影遁形结束并显形时，获得 ${MIRAGE.shield[r]} 点护盾，${MIRAGE.shieldDuration} 秒失效；独立间隔 ${MIRAGE.shieldCooldown} 秒。取高不相加，无回血或追加无敌；是否绽爆不影响显形护盾。`},
 {id:'poison_linger',hero:'wuling',name:'余毒未尽',icon:'♧',max:3,describe:r=>`敌人离开己方区域毒后，余毒每秒造成 ${POISON.lingerDps[r]} 伤害，持续 ${POISON.lingerDuration[r]} 秒；重复施加不叠层。区域内优先取最强区域毒，离区后余毒与传染只结算较强的一份。`},
 {id:'poison_spread',hero:'wuling',name:'败叶传染',icon:'❧',max:3,describe:r=>`主毒区（含同区毒核、毒幕）的持续毒伤击杀时，将传染施给 ${POISON.spreadRange} 米内最近一名敌人，每秒 ${POISON.spreadDps[r]} 伤害、持续 ${POISON.spreadDuration} 秒。每次死亡最多传播一次；传染、余毒、毒囊与毒带击杀均不再传播。`},
 {id:'poison_guard',hero:'wuling',name:'苔衣护身',icon:'◇',max:3,describe:r=>`成功完成闪避搬运毒区后获得 ${POISON.shield[r]} 点护盾，持续 ${POISON.shieldDuration} 秒，触发间隔 ${POISON.shieldCooldown} 秒。护盾先承伤、取较高值而不相加；空闪避或站在毒区不会获得护盾。`},
 {id:'surge',hero:'tide',name:'破浪锋',icon:'≈',max:3,describe:r=>`回钩第三击向前推出三段浪锋，每段 ${10+7*r} 伤害并减速；最远 6 米，遇障碍停止。`},
 {id:'brine',hero:'tide',name:'盐蚀印记',icon:'✧',max:3,describe:r=>`同一目标 3 秒内连续被长叉命中三次，爆开盐晶，造成 ${16+10*r} 伤害；触发间隔 1 秒，首领也可生效。`},
 {id:'wake',hero:'tide',name:'潜潮余流',icon:'↝',max:3,describe:r=>`浮出后留下 3 秒水流，触碰的敌人受到 ${9+7*r} 伤害并减速；每只敌人只受伤一次，6 秒触发间隔。`},
 {id:'bond',hero:'lingya',name:'同猎追击',icon:'✦',max:3,describe:r=>`獾兽扑中刚被骨镖标记的敌人时，追加 ${12+8*r} 伤害；1.5 秒触发间隔。伙伴倒地时不会触发。`},
 {id:'briar',hero:'lingya',name:'燕返藤绊',icon:'♧',max:3,describe:r=>`燕步起点留下藤绊，0.45 秒后就绪，靠近触发 ${12+8*r} 伤害并减速 2 秒；最多 2 处，8 秒失效，首领不会被定身。`},
 {id:'care',hero:'lingya',name:'归镖抚慰',icon:'♡',max:3,describe:r=>`每接回四次骨镖，为 10 米内存活的伙伴恢复 ${6+4*r} 点生命；不会提前复活倒地伙伴。`},
 {id:'mine',hero:'scout',name:'爆破陷阱',icon:'✹',max:3,describe:r=>`附近有敌人时每 6 秒在脚下布置陷阱，0.45 秒后就绪；敌人靠近引爆，造成 ${18+14*r} 范围伤害。最多保留 2 个，10 秒后失效。`},
 {id:'volley',hero:'scout',name:'破阵齐射',icon:'⋔',max:3,describe:r=>`每攻击 5 次，沿瞄准方向追加 3 发贯穿弹，单发造成 ${8+4*r} 伤害，射程 10 米。按攻击次数计数，不按弹丸数量。`},
 {id:'counter',hero:'scout',name:'翻滚反击',icon:'↶',max:3,describe:r=>`翻滚结束后 2 秒内的第一次攻击追加近身扇面冲击，造成 ${14+12*r} 伤害并击退普通敌人。首领不会被推走。`},
 {id:'rain',hero:'silver',name:'追猎箭雨',icon:'⇣',max:3,describe:r=>`每 8 秒锁定附近敌人的当前位置，0.55 秒后连续落下 3 阵箭雨，每阵造成 ${12+6*r} 范围伤害；移动出落点可躲避。`},
 {id:'trail',hero:'silver',name:'霜行足迹',icon:'❄',max:3,describe:r=>`每移动 3 米留下一段持续 2.5 秒的冰痕；敌人踏入时受到 ${6+3*r} 伤害并持续减速。每段对同一敌人只伤害一次，最多 4 段。`},
 {id:'pursuit',hero:'silver',name:'破绽追击',icon:'✧',max:3,describe:r=>`连续命中同一敌人 4 次（相邻命中间隔不超过 2.5 秒），追加 ${9+9*r} 伤害并定身 ${(0.35+.15*r).toFixed(2)} 秒。触发间隔 1.2 秒；首领只减速。`},
 {id:'echo',hero:'wraith',name:'残影复诵',icon:'◑',max:3,describe:r=>`每攻击 4 次召出残影，连续追击附近敌人 2 次，每次造成 ${14+7*r} 伤害。触发间隔至少 3 秒；残影攻击不会再次触发连击技能。`},
 {id:'soul',hero:'wraith',name:'噬魂余烬',icon:'◆',max:3,describe:r=>`击败 8 米内的敌人时吸取余烬，恢复 ${1+r} 点生命，每秒最多触发一次，不能超过生命上限。`},
 {id:'spikes',hero:'wraith',name:'影缚地刺',icon:'⋀',max:3,describe:r=>`每 7 秒沿瞄准方向依次升起 3 段影刺，每段造成 ${18+9*r} 伤害并减速 1.2 秒。地刺会被树木阻挡。`}
];
export const EXTRA_BY_ID=Object.fromEntries(EXTRA_SKILLS.map(s=>[s.id,s]));

// Tide and Lingya add bounded interactions; the others explain tactical combinations.
export const SKILL_PAIRS={
 mirage:{name:'蜃影诱葬',ids:['mirage_residue','mirage_burial'],bonus:false,text:'让替身在追兵之间自然绽爆，借蜃雾控住原处，残蛊补足离区毒伤。区域毒与附着毒不叠加，替身被杀不会触发诱葬；战术搭配，无隐藏加成。',support:'幻瘴提高保住替身的收益；蚀影强化显形后的追击窗口；蜃衣仅在显形时短暂保护本体。'},
 wuling:{name:'余毒接种',ids:['poison_linger','poison_spread'],bonus:false,text:'主毒区击杀将传染交给最近的追兵，离开毒区的敌人承受余毒。两种离区毒只取较强的一份，不叠加，也不额外触发连锁。战术配合，无隐藏加成。',support:'沉瘴适合守住落点；游瘴便于搬运毒区改变路线；苔衣护身保护成功搬运后的短暂调整。'},
 tide:{name:'盐潮共鸣',ids:['wake','brine'],bonus:true,text:'每片潜潮余流首次伤害一名敌人时，额外叠一层盐蚀；同一敌人不会被该片余流反复叠层。',support:'回潮牵引便于把怪物拉进余流；疾风节拍加快长叉叠层。'},
 lingya:{name:'藤缚合猎',ids:['briar','bond'],bonus:true,text:'藤绊命中会标记敌人 2 秒；伙伴扑中该目标可触发同猎追击，追加伤害再提高 25%。伙伴须存活。',support:'林间设伏增加控场机会；归镖抚慰照顾伙伴生命。'},
 scout:{name:'诱敌反击',ids:['mine','counter'],bonus:false,text:'在陷阱附近引怪，翻滚离开，再用强化反击把追兵挡在爆炸区域。战术配合，无额外数值加成。',support:'轻盈步伐缩短闪避冷却，霰弹枪适合近身反击。'},
 silver:{name:'霜痕追猎',ids:['trail','rain'],bonus:false,text:'利用冰痕减速，让敌人更难离开箭雨落点。战术配合，无额外数值加成。',support:'破绽追击进一步限制目标；短弩适合集中攻击。'},
 wraith:{name:'影缚复诵',ids:['spikes','echo'],bonus:false,text:'地刺减速限制敌人，给残影的两次追击创造机会。战术配合，无额外数值加成。',support:'噬魂余烬补充续航；裂隙的牵引便于集中目标。'}
};
export function skillPairState(p){const pair=Object.hasOwn(SKILL_PAIRS,p.heroId)?SKILL_PAIRS[p.heroId]:null;if(!pair)return null;const missing=pair.ids.filter(id=>!(p.upgrades[id]>0));return{...pair,missing,active:missing.length===0};}
export function skillPairHint(p,id){const q=skillPairState(p);if(!q||!q.ids.includes(id))return'';const other=q.ids.find(v=>v!==id);return(q.active?'搭配已成型':p.upgrades[other]>0?'选取后组成搭配':'搭配 '+EXTRA_BY_ID[other].name)+' · '+q.name;}
