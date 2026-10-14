// Stable IDs: each local expedition has three different inhabitants. The
// connected expedition still uses the original five regional guardians.
export const BOSS_ROUTES={
 forest:['thornstag','webmatriarch','boss'],
 snow:['rimefang','frostking','icephoenix'],
 ash:['moltenrhino','cinderdrake','cinderlord'],
 sand:['dunedevourer','obeliskwarden','dunescorpion'],
 coast:['sailreaper','abyssmedusa','wreckwarden']
};
export const ADDITIONAL_BOSSES={
 thornstag:{map:'forest',name:'荆冠鹿王',height:3.8,speed:2.7,wind:1.15,recovery:1.7,color:0xa6bc71,moves:['antlerrush','thornhooves'],ranges:[11,6],stance:'stalk',
  traits:'四足长颈、后掠荆棘鹿角与苔色背脊；低头刨地，压低鹿角后冲锋。',attack:'荆角直线冲锋；四方踏出荆根',tip:'冲锋横移，根刺在四角留下空隙；鹿王停步抬头时反击。'},
 webmatriarch:{map:'forest',name:'噬梦蛛后',height:2.55,speed:1.9,wind:1.35,recovery:1.8,color:0xb5a4c5,moves:['silkweave','venomspit'],ranges:[12,11],stance:'orbit',
  traits:'低伏八足、带斑纹的巨大腹囊与前伸毒牙；横向试探，吐丝前抬起前足。',attack:'两列蛛丝咒印封锁；三处交错毒囊落点',tip:'穿过蛛丝中央通道，毒囊落地后不要原路折返。'},
 rimefang:{map:'snow',name:'霜牙狼王',height:2.5,speed:3.0,wind:1.1,recovery:1.7,color:0xa4cfdc,moves:['frosthunt','rimehowl'],ranges:[11,9],stance:'stalk',
  traits:'低颈厚肩、冰白鬃毛、长吻与弯折后肢；环侧奔行，伏低后跃扑。',attack:'锁定落点冰牙扑猎；扇形寒啸',tip:'扑猎向侧面躲，寒啸从扇形之间穿出；狼王落地后有破绽。'},
 icephoenix:{map:'snow',name:'裂冰晶凰',height:4.4,speed:2.0,wind:1.4,recovery:1.9,color:0x9ed8ee,moves:['featherring','glacialdive'],ranges:[12,11],stance:'orbit',
  traits:'冰晶羽冠、展开的分层长翼与三束尾羽；低空盘旋，收翼后俯冲。',attack:'环形落羽留出中心空地；直线破冰俯冲',tip:'落羽时进入环内或离开外缘；俯冲要横向避开，不能沿攻击线逃跑。'},
 moltenrhino:{map:'ash',name:'熔甲犀王',height:3.3,speed:2.0,wind:1.35,recovery:2.0,color:0xdc9259,moves:['horncharge','basaltslam'],ranges:[11,7],stance:'close',
  traits:'低头四足、前伸岩角、层叠熔甲和粗短颈；前足刨地，身体后坐蓄势。',attack:'岩角冲锋；前方三段玄岩震裂',tip:'冲锋闪到两侧，震裂离开正前方；沉重收招时靠近攻击。'},
 cinderdrake:{map:'ash',name:'烬翼龙蜥',height:3.9,speed:2.2,wind:1.3,recovery:1.8,color:0xe99660,moves:['cinderbreath','ashwings'],ranges:[10,11],stance:'orbit',
  traits:'长颈钩吻、两条屈曲后腿、焦黑翼膜与长尾；贴地迈步，吐息前颈胸鼓起。',attack:'由左到右扫过的扇形吐息；双翼拍出两列烬火',tip:'观察吐息扫向，绕至另一侧；双翼火路之间留有直通的安全带。'},
 dunedevourer:{map:'sand',name:'流沙吞噬者',height:3.7,speed:1.6,wind:1.4,recovery:1.9,color:0xc4a36a,moves:['sinkhole','sandspout'],ranges:[11,12],stance:'close',
  traits:'环节长躯、径向齿口和外翻口缘；贴地蠕进，前身竖起后潜沙。',attack:'钻地追踪已锁定落点后破沙；沿目标两侧先后喷砂',tip:'离开吞噬落点，喷砂留出的中间空隙可穿过；出土后反击。'},
 obeliskwarden:{map:'sand',name:'断碑守卫',height:4.7,speed:1.4,wind:1.45,recovery:1.9,color:0xd3bb83,moves:['stonepress','glyphcross'],ranges:[12,11],stance:'orbit',
  traits:'悬空断碑、侧向浮动石板与嵌入碑身的砂金符眼；没有人形四肢，石板聚拢后释放咒阵。',attack:'双列石板压落；四臂十字砂阵',tip:'石板之间有通路，十字阵避开四臂或站入中心空处。'},
 sailreaper:{map:'coast',name:'裂帆魟王',height:2.8,speed:2.6,wind:1.15,recovery:1.7,color:0x81b8bc,moves:['razortide','keelrush'],ranges:[10,11],stance:'stalk',
  traits:'宽扁菱形翼盘、裂帆般的翼缘、腹侧鳃纹与长鞭尾；双翼起伏贴地滑行。',attack:'交错翼刃浪；沿锁定航线突进',tip:'看清左右浪刃先后次序；突进横移，等它收拢翼盘再反击。'},
 abyssmedusa:{map:'coast',name:'深渊灯母',height:4.6,speed:1.3,wind:1.5,recovery:2.0,color:0x92cbd3,moves:['abysspulse','lurelights'],ranges:[8,12],stance:'orbit',
  traits:'暗蓝透明伞盖、内藏灯核、长短触腕与垂落口帘；伞盖缓慢收张，蓄力时触腕外展。',attack:'触腕环形潮压；三处先后引爆的诱灯',tip:'潮压靠近伞盖中心或退到外侧，诱灯亮起后保持移动。'}
};
