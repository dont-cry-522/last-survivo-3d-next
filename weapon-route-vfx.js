// Route accents use the existing bounded pool. Call once at the real event;
// these short silhouettes never schedule damage, alter hit tests, or draw range rings.
const look=(weapon,name,summary,phases)=>Object.freeze({weapon,name,summary,phases:Object.freeze(phases)});
// These effects describe an area on the floor, even when the triggering shot hit a head.
const groundRoutes=new Set(['miasmalantern_lure','miasmalantern_venom','sporelantern_still','sporelantern_roam','fire_blast','dark_gravity','grimoire_wide','grimoire_echo','boomerang_snare']);
const contactHeights={shotgun_fan:.65,shotgun_slug:.86,fire_burn:.48,shade_blight:.5,harpoon_reef:.84,harpoon_tow:.20,boomerang_pincer:.4};
export const WEAPON_ROUTE_LOOKS=Object.freeze({
 miasmalantern_lure:look('miasmalantern','幻瘴','替身自然绽放时，低位紫瓣向外舒展，余雾留在原地',['bloom']),
 miasmalantern_venom:look('miasmalantern','蚀影','蜕影后的追击毒雾球带紫色卷气，破裂时散开短暂蚀雾',['cast','hit']),
 sporelantern_still:look('sporelantern','沉瘴','落地毒囊裂出低矮孢芽，成熟后出现暖金色菌核',['hit']),
 sporelantern_roam:look('sporelantern','游瘴','搬运后顺移动方向散开的轻薄叶雾',['hit']),
 rifle_pierce:look('rifle','贯穿弹道','命中后向弹道前方穿出的细金针',['hit']),
 rifle_rapid:look('rifle','疾速机括','枪口短促余焰与后退机括火星',['cast']),
 shotgun_fan:look('shotgun','散射风暴','开火时张开的三束碎屑，命中飞散砂石',['cast','hit']),
 shotgun_slug:look('shotgun','独头重弹','聚束枪焰与命中后厚重的穿刺残痕',['cast','hit']),
 fire_burn:look('fire','余烬灼烧','沿目标边缘向上舔动的暗红余焰',['hit']),
 fire_blast:look('fire','熔核爆破','低位熔核裂开，橙红火舌向外翻卷',['hit']),
 crossbow_pierce:look('crossbow','破甲重矢','贯穿出口留下冰蓝针线与分叉羽痕',['hit']),
 crossbow_hunt:look('crossbow','追猎机括','前两击累积短羽痕，第三击三道羽锋迸发',['hit']),
 shuriken_fan:look('shuriken','月刃齐发','放射形分刃切纹与交错命中痕',['cast','hit']),
 shuriken_return:look('shuriken','回旋月刃','转向处的青绿回钩，返程命中的反向月痕',['turn','hit','catch']),
 dark_gravity:look('dark','引力漩涡','牵引区内的暗紫碎光向核心回旋收拢',['field']),
 dark_seek:look('dark','追魂魔矢','紫黑彗尾包住淡紫核心，命中留下短尾迹',['cast','hit']),
 shade_echo:look('shade','残响弹射','转折碎影与已完成弹射路径的短暂连线',['bounce']),
 shade_blight:look('shade','蚀影刻印','逐击加深的刻痕，第三击向外撕开',['mark']),
 shadowblade_fan:look('shadowblade','横月收割','近战横斩更宽，命中留下月白切痕',['cast','hit']),
 shadowblade_return:look('shadowblade','断魂重镰','重击命中留下厚重暗影裂痕',['hit']),
 grimoire_wide:look('grimoire','裂界之页','裂口两翼向外展开的裂页和碎纸',['cast','hit']),
 grimoire_echo:look('grimoire','复诵禁咒','窄裂页留下余痕，二次爆发重新撕开双层裂缝',['cast','hit','echo']),
 harpoon_reef:look('harpoon','破礁长锋','三叉形窄穿刺与低位礁石碎片',['hit']),
 harpoon_tow:look('harpoon','回潮牵引','第三击接触处的水痕与水珠向持叉者倒流',['hit']),
 boomerang_pincer:look('boomerang','同心夹击','伙伴扑击留下并列爪痕，标记目标呈浅绿夹击亮锋',['pet']),
 boomerang_snare:look('boomerang','林间设伏','落地生出低矮藤芽，触发时双藤抬升收拢',['trap'])
});

/**
 * x/z is the actual contact, turn, field or rift point; cast is the release point.
 * combo: 0..2 melee combo, or 1..2 accumulated crossbow/shadow hits.
 * empowered: confirmed third hit or marked companion strike.
 * returning: true only on the return leg. radius: actual field/rift radius.
 * bounce x2/z2 is a PREVIOUS contact, only after the next hit has happened.
 * trap stage: 'set', 'idle', 'snap'. No timers or live gameplay objects are retained.
 * contact: optional {x,y,z,normal,direction,compact} for point hit/mark/pet/bounce.
 * Ground-area routes ignore contact; y2 optionally supplies the previous bounce height.
 * Returns false for an inactive route/phase or a conditional event that did not occur.
 */
export function weaponRouteEffect(vfx,w,phase,x,z,angle=0,detail={}){
 const id=w?.pathId,style=WEAPON_ROUTE_LOOKS[id],rank=Math.min(3,Math.max(0,Math.floor(w?.pathRank||0)));
 if(!rank||!style||style.weapon!==w.id||!style.phases.includes(phase))return false;
 const a=Number.isFinite(angle)?angle:0,sx=Math.cos(a),sz=-Math.sin(a),level=1+(rank-1)*.12;
 const contact=!groundRoutes.has(id)&&['hit','mark','pet','bounce'].includes(phase)?detail.contact:null,compact=!!contact?.compact,scale=contact?(compact?.50:.78):1,baseY=contactHeights[id]??1;
 const valid=v=>v&&[v.x,v.y,v.z].every(Number.isFinite)&&Math.hypot(v.x,v.y,v.z)>1e-6;
 const direction=valid(contact?.direction)?contact.direction:{x:Math.sin(a),y:0,z:Math.cos(a)},length=Math.hypot(direction.x,direction.y,direction.z),dx=direction.x/length,dy=direction.y/length,dz=direction.z/length;
 const outward=valid(contact?.normal)?contact.normal:{x:-dx,y:-dy,z:-dz},normalLength=Math.hypot(outward.x,outward.y,outward.z),nx=outward.x/normalLength,ny=outward.y/normalLength,nz=outward.z/normalLength;
 const cx=Number.isFinite(contact?.x)?contact.x:x,cy=Number.isFinite(contact?.y)?contact.y:baseY,cz=Number.isFinite(contact?.z)?contact.z:z;
 const target=Math.max(.2,Math.min(contact?.4:2,detail.targetSize||.55));
 const at=(forward=0,side=0,y=.85)=>({x:cx+(dx*forward+sx*side)*scale+(contact?nx*.018:0),y:contact?cy+(y-baseY+dy*forward)*scale+ny*.018:y,z:cz+(dz*forward+sz*side)*scale+(contact?nz*.018:0)});
 const particle=(shape,color,forward,side,y,options={})=>{
  const p=at(forward,side,y),o={additive:false,opacity:.68,...options};
  if(contact){if(o.size)o.size=o.size.map(n=>n*scale);if(o.velocity)o.velocity=o.velocity.map(n=>n*scale);if(compact){if(o.life)o.life*=.8;if(o.delay)o.delay*=.8;o.opacity*=.9;}}
  return vfx.particle(shape,color,p.x,p.y,p.z,o);
 };
 const line=(from,to,color,width=.024,life=.19,priority=0,opacity=.65)=>vfx.segment(at(...from),at(...to),color,width*scale,life*(compact?.8:1),false,priority,opacity*(compact?.9:1));
 const velocity=(forward,side=0,up=0)=>[dx*forward+sx*side,dy*forward+up,dz*forward+sz*side];
 // Yaw in world space after tilting; preserve the pool's default Euler order.
 const orient=(m,tilt,yaw=a,roll=0)=>{if(m){if(contact){m.lookAt(m.position.x+nx,m.position.y+ny,m.position.z+nz);m.rotateZ(roll);}else{m.rotation.set(tilt,0,roll);m.rotateOnWorldAxis({x:0,y:1,z:0},yaw);}}return m;};
 const curl=(color,forward,side,y,width,height,{rotation=-Math.PI/2,roll=0,...options}={})=>{
  const m=particle('sweep',color,forward,side,y,{life:.24,size:[width,height,1],motion:'lash',roll,...options});
  return orient(m,rotation,a,side<0?-.4:.4);
 };
 const chip=(shape,color,forward,side,y,size,speed,up=.7,priority=0)=>particle(shape,color,forward,side,y,{life:.25,size,velocity:velocity(speed,side*2,up),gravity:4,spin:6,priority});

 switch(id){
 case'miasmalantern_lure':{
  const r=Math.max(.3,detail.radius||1.7);
  for(const side of[-1,1])curl(side<0?0x5c3475:0xa184bc,0,side*.08,.11,r*.33,r*.29,{life:.34,roll:side*.7,opacity:.46,priority:1});
  break;
 }
 case'miasmalantern_venom':
  if(!detail.empowered)return false;
  if(phase==='cast')for(const side of[-1,1])curl(side<0?0x76558e:0xb89dcd,-.03,side*.11,1.00,.30,.25,{rotation:-.6,life:.24,roll:side*.9,opacity:.46,priority:1});
  else{for(const side of[-1,1])particle('smoke',side<0?0x5e3874:0x9674b0,.05,side*.23,.22,{life:.36,size:[.22,.14,.24],velocity:velocity(.15,side*.5,.14),opacity:.30,priority:1});}
  break;
 case'sporelantern_still':
  for(const side of[-1,1])particle('crystal',side<0?0x899755:0xc2c384,.02,side*.17,.12,{life:.38,size:[.04,.16*level,.035],velocity:[0,.17,0],opacity:.7,priority:side<0?1:0});
  particle('veil',0x657548,0,0,.075,{life:.38,size:[.34,.26,1],opacity:.16});
  break;
 case'sporelantern_roam':
  for(const side of[-1,1])particle('smoke',side<0?0x7d985a:0xaebd7c,.08,side*.22,.20,{life:.34,size:[.10,.11,.22*level],velocity:velocity(-.55,side*.22,.18),opacity:.37,priority:side<0?1:0});
  chip('ember',0xb8bf81,0,0,.28,[.035,.06,.025],-.5,.45);
  break;
 case'rifle_pierce':
  line([target*.65,0,1],[target+.45*level,0,1],0xffd28d,.027,.115,1,.8);
  for(const side of[-1,1])chip('crystal',0xcba779,target*.72,side*.08,1,[.02,.065,.02],2.2,.18);
  break;
 case'rifle_rapid':
  particle('flame',0xe8a65a,.2,0,1.13,{life:.09,size:[.07,.13,1],velocity:velocity(-.45),priority:1,opacity:.68});
  chip('ember',0xd2ab70,.06,.11,1.08,[.025,.035,.045],-.9,.15);
  break;
 case'shotgun_fan':
  if(phase==='cast')for(const side of[-1,0,1])line([.15,side*.06,1.1],[.48,side*.25,1.05],side?0xc69862:0xe7bd81,side?.024:.035,.1,side?0:1,.65);
  else for(const side of[-1,1])chip('stone',0xb58c60,.12,side*.12,.65,[.055,.08,.045],1.1,.8,side<0?1:0);
  break;
 case'shotgun_slug':
  if(phase==='cast'){
   line([.03,0,1.1],[.48,0,1.1],0xf0c17e,.065,.105,1,.78);
   particle('smoke',0x746754,-.03,0,1.1,{life:.18,size:[.11,.09,.16],velocity:velocity(-.3,.15,.1),grow:true,opacity:.28});
  }else{
   line([target*.4,0,.9],[target+.45,0,.86],0xe3ba80,.065*level,.16,1,.82);
   for(const side of[-1,1])chip('stone',side<0?0x88745d:0xc5a476,.1,side*.14,.7,[.075,.09,.065],1.4,1.1);
  }
  break;
 case'fire_burn':
  for(const side of[-1,1])particle('flame',side<0?0xffb252:0xe16b2d,0,side*target*.55,.48,{life:.46,delay:side<0?0:.045,size:[.13,.33*level,1],velocity:velocity(-.08,side*.06,.65),motion:'combust',endColor:0x67251b,priority:side<0?0:1,opacity:.72});
  particle('ember',0x9b3927,.04,0,.28,{life:.44,size:[.08,.035,.08],opacity:.6});
  break;
 case'fire_blast':{
  const r=Math.max(.5,detail.radius||w.radius||2.5+.5*rank);
  particle('veil',0x9b422b,0,0,.055,{life:.35,size:[r*.48,r*.38,1],opacity:.16});
  for(const side of[-1,1]){
   curl(side<0?0xffcf85:0xe57735,.02,side*.13,.35,r*.32,r*.25,{rotation:-.65,life:.3,delay:side<0?0:.025,velocity:velocity(.15,side*.8,.4),roll:side*1.3,endColor:0x853221,priority:1,opacity:.71});
   particle('crystal',0xffd18b,0,side*.12,.45,{life:.36,size:[.018,.10,.018],velocity:velocity(.4,side*.9,1.4),gravity:4,spin:4,endColor:0x96341e,opacity:.75});
  }
  break;
 }
 case'crossbow_pierce':
  line([target*.55,0,1.03],[target+.57*level,0,1.03],0xbdd8e6,.021,.17,1,.85);
  for(const side of[-1,1]){
   line([target*.6,0,1.03],[target*.32,side*.17,1.08],0x8cacbf,.027,.24,0,.6);
   chip('crystal',0xa3bfcc,target*.55,side*.07,1.04,[.025,.11,.025],1.7,.18);
  }
  break;
 case'crossbow_hunt':{
  const strong=!!detail.empowered,count=strong?3:Math.max(1,Math.min(2,detail.combo||1));
  for(let i=0;i<count;i++){
   const side=(i-(count-1)/2)*.18;
   line([-.16,side-.09,.73],[.12,side+.08,strong?1.35:1.06],strong?0xc3e8db:0x87b0b7,strong?.033:.024,strong?.27:.18,i===0?1:0,strong?.8:.62);
  }
  if(strong)chip('crystal',0x94c7bb,.1,0,1.03,[.06,.17*level,.06],2,.6);
  break;
 }
 case'shuriken_fan':
  if(phase==='cast')for(const side of[-1,0,1]){
   const m=particle('claw',side?0x518e81:0xc5e4d4,.15,side*.18,1.1,{life:.15,size:[.65,.30,1],opacity:side?.68:.78,priority:side?0:1,velocity:velocity(.8,side*.45)});
   orient(m,-Math.PI/2,a+side*.4,Math.PI/2);
  }else for(const side of[-1,1])line([-.15,side*.17,.78],[.16,-side*.17,1.13],0xa1d2bd,.028,.17,side<0?1:0,.7);
  break;
 case'shuriken_return':
  if(phase==='hit'&&!detail.returning)return false;
  curl(0x72b49c,0,0,phase==='catch'?.85:1,.46*level,phase==='turn'?.6:.35,{rotation:phase==='hit'?-.6:-Math.PI/2,roll:-3,life:.24,priority:1,opacity:.8});
  if(phase==='turn')line([-.12,.26,1],[-.32,.10,1],0x628e85,.025,.28,0,.48);
  break;
 case'dark_gravity':{
  const r=Math.max(.5,detail.radius||2.3+.3*rank);
  particle('veil',0x3d3054,0,0,.055,{life:.43,size:[r*.34,r*.3,1],opacity:.22,priority:1});
  curl(0x6d4c85,0,0,.08,r*.42,r*.37,{life:.4,roll:-2.4,opacity:.54});
  for(let i=0;i<3;i++){
   const theta=a+i*2.39996,fx=Math.sin(theta)*r*.58,fz=Math.cos(theta)*r*.58;
   vfx.particle('crystal',i===0?0xaf8ac3:0x816195,x+fx,.19,z+fz,{life:.4,size:[.028,.1*level,.028],velocity:[-fx*1.8,.12,-fz*1.8],orbit:[x,z,1.4],additive:false,opacity:.68,priority:0});
  }
  break;
 }
 case'dark_seek':
  particle('ember',0xc6a5d7,phase==='cast'?.2:target*.75,0,1.08,{life:.17,size:[.08,.08,.14],priority:1,opacity:.8});
  for(const side of[-1,1]){
   const m=particle('claw',side<0?0x57376e:0x9b70b4,-.12,side*(phase==='cast'?.12:target*.75),1.06,{life:.22,size:[.7,.49*level,1],velocity:velocity(-.7,side*.15),opacity:.75});
   orient(m,Math.PI/2);
  }
  break;
 case'shade_echo':{
  // Endpoints describe a completed flight, never a predicted next target.
  if(Number.isFinite(detail.x2)&&Number.isFinite(detail.z2)){
   const distance=Math.hypot(detail.x2-cx,detail.z2-cz);
   if(distance>.05&&distance<=7.5)vfx.segment({x:detail.x2,y:Number.isFinite(detail.y2)?detail.y2:contact?cy:.95,z:detail.z2},{x:cx,y:contact?cy:.95,z:cz},0x7a8aa1,.022*scale,compact?.10:.14,false,0,compact?.28:.43);
  }
  line([-.19,-.13,.88],[0,0,1.03],0xc9d3df,.036,.22,1,.8);
  line([0,0,1.03],[.2,-.1,1.16],0x8c9eb5,.024,.26,0,.6);
  break;
 }
 case'shade_blight':{
  const strong=!!detail.empowered,count=strong?3:Math.max(1,Math.min(2,detail.combo||1));
  for(let i=0;i<count;i++){
   const side=(i-(count-1)/2)*.18,core=strong&&i===1,m=particle('claw',strong?(core?0x142030:0xd8e2eb):0x869ab0,0,side,.5,{life:strong?.34:.3,size:[strong?(core?.75:.20):.45,(strong?.65:.25)*level,1],velocity:strong?velocity(.15,side*2.4,.35):[0,0,0],motion:strong?'lash':'erupt',endColor:strong?(core?0x142030:0x566781):null,priority:i===0?1:0,opacity:strong?.76:.62});
   orient(m,-.2,a,side*2);
  }
  if(strong){if(!contact)particle('veil',0x16202c,0,0,.07,{life:.28,size:[.58,.46,1],opacity:.24});for(const side of[-1,1])chip('crystal',0x9aaabd,.03,side*.15,.7,[.04,.13,.04],.6,1);}
  break;
 }
 case'shadowblade_fan':
  if(phase==='cast')for(const side of[-1,1])curl(side<0?0x718397:0xc1cedc,.17,side*.25,1,.46,.38*level,{roll:side*2,velocity:velocity(.5,side*.55),priority:side<0?1:0,opacity:.76});
  else curl(0xa4b3c6,.02,0,.95,.38,.27,{rotation:-.5,roll:2,life:.19,priority:1,opacity:.62});
  break;
 case'shadowblade_return':
  curl(0xb4c2d1,0,0,.95,.52*level,.42,{rotation:phase==='hit'?-.65:-Math.PI/2,roll:-2.4,priority:1,opacity:.76});
  curl(0x253346,-.14,.13,.9,.38,.3,{roll:-1.9,life:.32,opacity:.43});
  break;
 case'grimoire_wide':{
  const r=Math.max(.5,detail.radius||w.radius||1.7+.4*rank),release=phase==='hit';
  for(const side of[-1,1]){
   const m=particle('claw',release?0x182331:0x7f94aa,0,side*r*.27,.07,{life:release?.4:.28,size:[r*.45,r*(release?.55:.2),1],motion:'erupt',priority:side<0?1:0,opacity:release?.76:.44});
   orient(m,-.3,a,side*.38);
   if(release){const edge=particle('claw',0xd8e4ec,.03,side*r*.27+.035,.08,{life:.28,delay:.03,size:[r*.10,r*.53,1],motion:'erupt',endColor:0x657a91,opacity:.78});orient(edge,-.3,a,side*.38);}
  }
  line([-.07,-r*.55,.065],[.08,r*.55,.065],0x53677e,.045,.25,0,.5);
  break;
 }
 case'grimoire_echo':{
  const echo=phase==='echo',release=phase==='hit',r=Math.max(.5,detail.radius||w.radius||1.7),width=r*(echo?.44:.31);
  line([0,-width,.07],[.11,0,echo?.22:.1],echo?0xc1cfdd:0x65788e,echo?.04:.027,echo?.3:.25,1,echo?.73:.46);
  line([.11,0,echo?.22:.1],[-.08,width,.07],echo?0xa8b9cb:0x65788e,echo?.034:.022,echo?.34:.25,0,.6);
  if(echo)for(const side of[-1,1]){
   const m=particle('claw',side<0?0x718296:0xb5c4d3,.05,side*.52,.1,{life:.38,size:[.75,.68*level,1],motion:'erupt',opacity:.76,priority:side<0?1:0});
   orient(m,-.3,a,side*.35);
  }
  else if(release)particle('veil',0x182230,0,0,.05,{life:.31,size:[.43,.33,1],opacity:.21});
  break;
 }
 case'harpoon_reef':
  line([-.15,0,.84],[target+.33,0,.86],0x9abfba,.032*level,.18,1,.75);
  for(const side of[-1,1]){
   line([.12,side*.16,.83],[.47,side*.1,.85],0x7da2a0,.018,.16,0,.6);
   chip('stone',0x77918a,.05,side*.13,.22,[.055,.075,.065],.75,.65);
  }
  break;
 case'harpoon_tow':
  if(detail.combo!==2&&!detail.empowered)return false;
  for(const side of[-1,1]){
   const m=particle('crest',side<0?0x4c9593:0xa6c9bc,.16,side*(.28+target*.35),.12,{life:.3,size:[.4,.28*level,1],motion:'erupt',velocity:velocity(-1.35,side*.12),priority:side<0?1:0,opacity:.73});
   if(m){if(contact)orient(m,0,a+Math.PI);else m.rotation.y=a+Math.PI;}
   chip('ember',0x9cbfb9,.1,side*(.28+target*.35),.45,[.026,.05,.026],-1.6,.25);
  }
  break;
 case'boomerang_pincer':
  for(let i=-1;i<=1;i++){
   const m=particle('claw',detail.empowered?(i===0?0xd0d9a3:0x8fac79):(i===0?0xd6bb89:0xa68f69),0,i*.16,.4,{life:.27,size:[.63,(detail.empowered?.57:.42)*level,1],motion:'lash',roll:-.6,priority:i===0?1:0,opacity:detail.empowered?.78:.67});
   orient(m,-.4,a,.45);
  }
  break;
 case'boomerang_snare':{
  const snap=detail.stage==='snap',idle=detail.stage==='idle',r=Math.max(.5,detail.radius||1.5+.15*rank),spread=r*(snap?.34:.23);
  for(const side of[-1,1]){
   const m=particle('claw',side<0?0x688a4b:0x9fbb71,0,side*spread,.065,{life:idle?.29:.4,size:[snap?.75:.45,(snap?.67:.14)*level,1],motion:'erupt',opacity:idle?.43:.72,priority:idle?0:side<0?1:0});
   orient(m,-.2,a,side*-.5);
   line([-.2,side*spread,.07],[.14,side*spread*.6,.075],0x547344,.023,snap?.28:.34,0,idle?.35:.53);
   if(snap)chip('crystal',0xa5be7f,.05,side*.2,.36,[.075,.025,.13],-.2,.7);
  }
  break;
 }
 }
 return true;
}
