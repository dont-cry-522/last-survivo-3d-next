import{AIR_ENEMIES}from'./airborne-enemies.js?v=123';
import{REGIONAL_ENEMIES}from'./map-enemies.js?v=114';
export const ENEMY_GUIDE={
 mushroom:{image:"assets/bestiary/mushroom.png",traits:"红褐色斑点菌盖、小短腿；小跳挪动，菌盖随步伐摇摆。",name:'蹦跳蘑菇',attack:'蓄力后向锁定位置弹跳扑击',tip:'看到脚下的橙色爪痕就侧移，别沿直线后退。'},
 wolf:{image:"assets/bestiary/wolf.png",traits:"蓝灰色四足、尖耳长尾；交错快步绕侧，压低身体后扑咬。",name:'林地狼',attack:'绕侧接近，再向锁定方向猛扑',tip:'等它压低身体后闪到侧面。'},
 golem:{image:"assets/bestiary/golem.png",traits:"灰绿色嵌合岩甲、苔肩、绿色胸核；踏步转移重心，双臂蓄力拍地后收招较慢。",name:'岩甲石怪',attack:'缓慢举臂后震地，近身范围较大',tip:'观察震地前的橙色标记，离开范围再回身攻击。'},
 spitter:{image:"assets/bestiary/spitter.png",traits:"紫袍弯帽、粉紫色毒囊杖头；迈步时衣摆跟随，抬杖抛毒，靠近时会退让。",name:'吐毒巫兽',attack:'抬杖吐出毒雾，在紫色毒雾内持续伤人',tip:'毒雾落地后会停留一阵，不要站回去。'},
 shaman:{image:"assets/bestiary/shaman.png",traits:"青绿长袍、叶形杖头；立杖缓步，抬杖治疗同伴或施放减速咒。",name:'林地祭司',attack:'治疗受伤怪物；无人受伤时施放减速咒',tip:'优先处理祭司，并离开青绿色咒印。'},
 boss:{image:"assets/bestiary/boss.png",traits:"粗壮古树、苔叶树冠、枝指根足；重心随踏步摆动，枝梢轻摇。",name:'林心古树',attack:'横向挥枝与逐段扎根交替，半血后根刺更远',tip:'挥枝时退后，根刺横向躲开，收招时反击。'}
};
for(const [id,cfg]of Object.entries(REGIONAL_ENEMIES))ENEMY_GUIDE[id]={...cfg,image:'assets/bestiary/'+id+'.png'};
export const CIRCLE_GUIDE=[
 {color:'烟紫',name:'我方蜃影毒花',meaning:'雾苓·蜃影留下的人形替身会吸引攻击；撑到时间才绽放，留下伤害怪物的低矮毒雾，玩家可以穿行。被打碎的替身没有爆炸或毒雾。'},
 {color:'冰蓝',name:'寒霜落点',meaning:'雪地怪物的攻击。浅蓝预告后冰晶升起，范围内伤害并减速；沿空隙绕开。'},
 {color:'橙红',name:'怪物地火',meaning:'赤烬怪物的攻击。预告后爆燃并留下短暂余火，别站回落点。'},
 {color:'橙',name:'敌人蓄力',meaning:'短暂预警；蘑菇和狼用爪痕标出落点，石怪用柔和色块提示震地范围。'},
 {color:'紫',name:'毒雾区域',meaning:'吐毒怪投出的持续伤害区域，亮起后离开。'},
 {color:'青绿',name:'祭司咒印',meaning:'短暂伤害并减速；祭司的治疗波也会发出绿色闪光。'},
 {color:'红',name:'首领裂地',meaning:'红色地面预警是即将落下的裂击；橙色箭头标出冲撞方向。'},
 {color:'橙红',name:'赤烬地脉',meaning:'荒原上固定地面的橙红色预警会先亮起，再喷发灼伤范围内的人与怪物。'},
 {color:'金',name:'我方陨火',meaning:'金色落点属于自己升级的陨火，会伤害怪物。'},
 {color:'金绿',name:'补给与祭坛',meaning:'石门祭坛和补给箱是探索目标，靠近时会有柔和微光；先清理守卫，再靠近领取。'}
];

for(const [id,cfg]of Object.entries(AIR_ENEMIES))ENEMY_GUIDE[id]={name:cfg.name,attack:cfg.pass>1?'蓄力后高位俯冲，可蹲避':'蓄力后贴地冲撞，可跳避',tip:cfg.tip,traits:'空中巡游；翼部收拢预告攻击，俯冲后低飞恢复。',image:'assets/bestiary/'+id+'.png'};

Object.assign(ENEMY_GUIDE.sandguard,{attack:'举盾后正面高位刺击',tip:'绕到背后攻击；蓄力时侧移，或下蹲避开高位刺击。'});
