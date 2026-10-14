import * as T from './vendor/three.module.js';
import {mergeGeometries} from './vendor/BufferGeometryUtils.js';
import{restoreEnemyHit,animateEnemyHit}from'./enemy-feedback.js?v=190';
import {segmentHitsBody} from './adventure-combat.js?v=190';

export const AIR_ROSTERS={forest:'duskbat',snow:'frostwing',ash:'cinderwing',sand:'sunscarab',coast:'skyray'};
export const AIR_ENEMIES={
 duskbat:{name:'暮翼蝠',color:0x8278a3,accent:0xd0bde2,voice:'wolf',hp:46,speed:3.4,damage:12,xp:5,altitude:2.7,pass:1.4,windTime:.85,strikeTime:1.0,span:1,shape:'bat',tip:'收拢双翼后高位俯冲，蹲下或横移；回升前可以近战反击。'},
 frostwing:{name:'霜羽蛾',color:0xaacbd2,accent:0xe4f4f4,voice:'snowtotem',hp:54,speed:2.8,damage:14,xp:6,altitude:3.1,pass:1.4,windTime:1.1,strikeTime:1.15,span:1.15,shape:'moth',tip:'展开冰蓝双翼蓄力，然后直线高位滑翔；蹲下避开。'},
 cinderwing:{name:'烬翼蝠',color:0x765554,accent:0xf5a467,voice:'emberling',hp:42,speed:4.2,damage:13,xp:5,altitude:3.4,pass:1.4,windTime:.8,strikeTime:.8,span:.9,shape:'bat',tip:'橙色翼尖亮起后快速掠过；锁定落点后横移或蹲下。'},
 sunscarab:{name:'沙金翼甲',color:0x9c7946,accent:0xdbbe74,voice:'sandguard',hp:65,speed:2.9,damage:15,xp:7,altitude:2.5,pass:.15,windTime:1.05,strikeTime:1.1,span:.85,shape:'beetle',tip:'打开甲壳后低空冲撞；可以跳过，也可侧移后趁低飞追击。'},
 skyray:{name:'潮风鳐',color:0x5a929e,accent:0xbddada,voice:'jellyseer',hp:58,speed:3.2,damage:14,xp:6,altitude:2.8,pass:.15,windTime:1.0,strikeTime:1.2,span:1.35,shape:'ray',tip:'翻起宽翼蓄力，然后贴地滑翔；跳跃避开腹部冲撞。'}
};
for(const cfg of Object.values(AIR_ENEMIES))Object.assign(cfg,{role:'flyer',size:.6});
export function airWaveEligible(time,enemies,random=Math.random){return time>=24&&enemies.filter(e=>e.alive&&e.role==='flyer').length<3&&random()<.22;}

// Shares the normal enemy lifecycle and reward path. No independent timers or projectiles.
export function tickAirborne(e,focus,dt,time,io){
 const cfg=AIR_ENEMIES[e.kind];if(!cfg||!e.alive||dt<=0)return;
 const floor=(x,z)=>io.groundHeight?.(x,z)||0;
 e.flight??={stage:'orbit',timer:1.6};const f=e.flight;f.timer-=dt;
 const ox=e.x,oy=e.y??cfg.altitude,oz=e.z;
 if(e.stagger>0){f.stage='recover';f.timer=Math.max(f.timer,.65);}
 if(f.stage==='orbit'){
  const dx=focus.x-e.x,dz=focus.z-e.z,d=Math.hypot(dx,dz)||1,orbit=d<8?1:0;
  const speed=e.speed*(e.slow>0?.45:1),side=e.id%2?1:-1;
  io.move(e,(dx/d*(d>6?1:0)+dz/d*orbit*side*.6)*speed*dt,(dz/d*(d>6?1:0)-dx/d*orbit*side*.6)*speed*dt);
  e.y=oy+(floor(e.x,e.z)+cfg.altitude+Math.sin(time*1.7+e.id)*.16-oy)*Math.min(1,dt*3);
  if(f.timer<=0&&d<11&&!e.targetLost&&io.visible(e)){f.stage='wind';f.timer=cfg.windTime;f.from={x:e.x,z:e.z,y:e.y};const len=Math.hypot(dx,dz)||1;f.to={x:focus.x+dx/len*2,z:focus.z+dz/len*2,y:cfg.pass>1?(io.player().standHeight||1.8)*.85-.3:cfg.pass};f.to.y+=floor(f.to.x,f.to.z);f.hit=false;io.sound(e,'wind');}
 }else if(f.stage==='wind'){
  e.y=Math.max(floor(e.x,e.z),oy+(f.to.y-oy)*Math.min(1,dt*6));
  if(f.timer<=0){f.stage='strike';f.timer=cfg.strikeTime;f.from={x:e.x,y:e.y,z:e.z};io.sound(e,'attack');}
 }else if(f.stage==='strike'){
  const t=Math.min(1,1-f.timer/cfg.strikeTime),ease=t*t*(3-2*t);
  const nx=f.from.x+(f.to.x-f.from.x)*ease,nz=f.from.z+(f.to.z-f.from.z)*ease;
  io.move(e,nx-e.x,nz-e.z);e.y=Math.max(floor(e.x,e.z),f.from.y+(f.to.y-f.from.y)*ease);
  const decoy=io.decoy?.();if(!f.hit&&decoy?.alive&&segmentHitsBody(ox,oy+.3,oz,e.x,e.y+.3,e.z,{...decoy,y:floor(decoy.x,decoy.z),height:1.8,radius:.4},.22)){f.hit=true;io.hitDecoy(e);}
  if(!f.hit&&segmentHitsBody(ox,oy+.3,oz,e.x,e.y+.3,e.z,io.player(),.22)){f.hit=true;io.hit(e);}
  if(f.timer<=0){f.stage='recover';f.timer=1.15;}
 }else{
  // Brief low recovery lets short weapons and ground poison punish a missed pass.
  e.y=oy+(floor(e.x,e.z)+.25-oy)*Math.min(1,dt*6);
  if(f.timer<=0){f.stage='orbit';f.timer=2.6+(e.id%3)*.4;}
 }
 const a=f.stage==='wind'?Math.atan2(f.to.x-e.x,f.to.z-e.z):Math.hypot(e.x-ox,e.z-oz)>.001?Math.atan2(e.x-ox,e.z-oz):e.mesh.rotation.y;
 e.mesh.rotation.y+=Math.atan2(Math.sin(a-e.mesh.rotation.y),Math.cos(a-e.mesh.rotation.y))*Math.min(1,dt*8);
 e.mesh.position.set(e.x,e.y,e.z);restoreEnemyHit(e.mesh);animateAirborne(e,time);animateEnemyHit(e.mesh,dt);
}

const sphere=new T.SphereGeometry(1,12,8),ear=new T.ConeGeometry(1,1,7),materials=new Map(),wings=new Map();
const hinge=.52;
function shadedBody(shape){
 const g=new T.SphereGeometry(1,12,8),p=g.getAttribute('position'),colors=[];
 for(let i=0;i<p.count;i++){
  const x=p.getX(i),y=p.getY(i),z=p.getZ(i),belly=(1-y)*.5,shade=.80+.20*belly;
  if(shape==='bat')p.setXYZ(i,x*(1-Math.max(0,z)*.48),y*.88-Math.max(0,z)*.12,z);
  if(shape==='ray')p.setXYZ(i,x*(.30-.075*Math.max(0,z)),.30+y*.115+.02*z,.04+z*.52);
  colors.push(shade,shade*(1-belly*.025),shade*(1-belly*.065));
 }
 g.setAttribute('color',new T.Float32BufferAttribute(colors,3));g.computeVertexNormals();return g;
}
const bodySphere=shadedBody('body'),batHead=shadedBody('bat'),rayBody=shadedBody('ray');
const antennaParts=[-1,1].map(side=>new T.TubeGeometry(new T.CatmullRomCurve3([new T.Vector3(side*.065,.445,.47),new T.Vector3(side*.11,.515,.51),new T.Vector3(side*.16,.545,.565)]),6,.010,4,false));
const antennae=mergeGeometries(antennaParts);for(const g of antennaParts)g.dispose();
// Cambered membranes, with veins in the existing surface rather than extra rods.
// Both pieces share the hinge row; only the outer piece bends, like a wrist.
function wingGeometry(shape,outer){
 const key=shape+':'+outer;if(wings.has(key))return wings.get(key);
 const positions=[],colors=[],indices=[],rows=outer?14:10,cols=8;
 for(let i=0;i<=rows;i++)for(let j=0;j<=cols;j++){
  const x=outer?hinge+(1.25-hinge)*i/rows:hinge*i/rows,u=x/1.25,v=j/cols,tip=Math.sqrt(1-u),s=Math.sin(Math.PI*u);
  let center=.1+.2*u,front=(.11+.43*s)*tip,back=(.30+.17*Math.sin(3*Math.PI*u)**2)*tip;
  if(shape==='moth'){center=.02+.09*u;front=(.18+.48*s)*tip;back=(.21+.36*s)*tip;}
  if(shape==='beetle'){center=.05+.04*u;front=(.1+.27*s)*tip;back=(.14+.25*s)*tip;}
  if(shape==='ray'){center=-.12*u;front=(.21+.42*s)*tip;back=(.19+.31*s)*tip;}
  const vein=Math.cos(v*Math.PI*4+u*.8)**16,camber=i===0||i===rows?0:Math.sin(v*Math.PI)*Math.sin(Math.PI*i/rows)*.025;
  positions.push(x-(outer?hinge:0),camber,center+front-(front+back)*v);
  const shade=.71+.20*(1-v)+vein*.09;colors.push(shade,shade,shade);
  if(i<rows&&j<cols){const a=i*(cols+1)+j,b=a+cols+1;indices.push(a,b,a+1,b,b+1,a+1);}
 }
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setAttribute('color',new T.Float32BufferAttribute(colors,3));g.setIndex(indices);g.computeVertexNormals();wings.set(key,g);return g;
}
const tailGeometry=new T.TubeGeometry(new T.CatmullRomCurve3([new T.Vector3(),new T.Vector3(.035,0,-.42),new T.Vector3(-.025,.01,-.88),new T.Vector3(0,0,-1.3)]),12,.024,5,false);
const AIR_POSES={
 duskbat:{rate:6.8,amp:.39,tip:.24,lag:.8,wind:.63,fold:.26,strike:.10},
 frostwing:{rate:4.8,amp:.30,tip:.17,lag:.6,wind:.46,fold:.10,strike:.06},
 cinderwing:{rate:8.7,amp:.43,tip:.29,lag:.9,wind:.66,fold:.32,strike:.04},
 sunscarab:{rate:13,amp:.25,tip:.08,lag:.35,wind:.35,fold:.12,strike:.10},
 skyray:{rate:2.7,amp:.14,tip:.23,lag:1.1,wind:.36,fold:.05,strike:-.035}
};
const AIR_BLEND_KEYS=['wind','strike','recover'];
export function makeAirborne(kind){
 const cfg=AIR_ENEMIES[kind],root=new T.Group(),rig=new T.Group();root.add(rig);root.userData.rig=rig;
 root.name='SM_Enemy_'+kind;rig.name='Rig_'+kind;
 if(!materials.has(kind))materials.set(kind,[new T.MeshStandardMaterial({color:cfg.color,roughness:.8,vertexColors:true}),new T.MeshStandardMaterial({color:cfg.accent,roughness:cfg.shape==='beetle'?.42:.64,vertexColors:true}),new T.MeshStandardMaterial({color:cfg.color,roughness:.74,side:T.DoubleSide,vertexColors:true})]);
 const [skin,trim,membrane]=materials.get(kind);
 const part=(parent,name,scale,pos,material=skin,geometry=sphere)=>{const m=new T.Mesh(geometry,material);m.name=name;m.scale.set(...scale);m.position.set(...pos);m.castShadow=m.receiveShadow=true;parent.add(m);return m;};
 const body=cfg.shape==='ray'?part(rig,'SM_Enemy_Body_Head',[1,1,1],[0,0,0],skin,rayBody):part(rig,'SM_Enemy_Body',[cfg.shape==='beetle'?.3:.2,.22,.43],[0,.3,0],skin,bodySphere);
 const head=cfg.shape==='ray'?body:part(rig,'SM_Enemy_Head',[.18,.15,.19],[0,.36,.4],trim,cfg.shape==='bat'?batHead:bodySphere);
 const pivots=[],tips=[],shells=[];
 for(const side of[-1,1]){
  const pivot=new T.Group();pivot.name='Joint_Wing_'+side;pivot.position.set(side*.12,.34,0);pivot.scale.set(side*cfg.span,1,cfg.span);rig.add(pivot);pivots.push(pivot);
  part(pivot,'SM_Enemy_Wing_Inner',[1,1,1],[0,0,0],membrane,wingGeometry(cfg.shape,false));
  const tip=new T.Group();tip.name='Joint_WingTip_'+side;tip.position.x=hinge;pivot.add(tip);tips.push(tip);
  part(tip,'SM_Enemy_Wing_Outer',[1,1,1],[0,0,0],membrane,wingGeometry(cfg.shape,true));
  const eyePosition=cfg.shape==='ray'?[side*.115,.402,.30]:cfg.shape==='bat'?[side*.075,.405,.534]:[side*.085,.42,.565];
  part(rig,'SM_Enemy_Eye_'+side,[.026,.032,.025],eyePosition,skin);
  if(cfg.shape==='bat'){const e=part(rig,'SM_Enemy_Ear_'+side,[.058,.12,.04],[side*.13,.49,.36],skin,ear);e.rotation.set(-.5,0,-side*.25);}
  if(cfg.shape==='beetle')shells.push(part(rig,'SM_Enemy_Shell_'+side,[.15,.08,.35],[side*.18,.48,-.04],trim));
 }
 if(cfg.shape==='moth')part(rig,'SM_Enemy_Antennae',[1,1,1],[0,0,0],trim,antennae);
 let tail=null;if(cfg.shape==='ray')tail=part(rig,'SM_Enemy_Tail',[1,1,1],[0,.25,-.15],trim,tailGeometry);
 Object.assign(root.userData,{wings:pivots,wingTips:tips,head,shells,tail});return root;
}
export function animateAirborne(e,time){
 const d=e.mesh.userData,cfg=AIR_POSES[e.kind],stage=e.flight?.stage||'orbit';
 const p=d.airPose??={time,wind:0,strike:0,recover:0},dt=Math.max(0,Math.min(.05,time-p.time)),blend=1-Math.exp(-dt*7);p.time=time;
 for(const key of AIR_BLEND_KEYS)p[key]+=((stage===key?1:0)-p[key])*blend;
 const phase=time*cfg.rate+e.id,hover=Math.max(0,1-p.wind-p.strike),amplitude=cfg.amp*(1-p.recover*.35);
 const flap=Math.sin(phase)*amplitude*hover+cfg.wind*p.wind+cfg.strike*p.strike;
 const tip=Math.sin(phase-cfg.lag)*cfg.tip*hover-cfg.fold*p.wind+.035*p.strike;
 d.rig.rotation.z=Math.sin(time*1.8+e.id)*.045*(1-p.strike*.7);
 d.rig.rotation.x=Math.sin(time*2.3)*.025*(1-p.strike)-p.strike*.08;
 d.head.rotation.x=-d.rig.rotation.x*.45;
 for(let i=0;i<d.wings.length;i++){
  const side=i?1:-1;d.wings[i].rotation.set(0,side*cfg.fold*(p.wind+p.strike*.5),side*flap);
  d.wingTips[i].rotation.set(0,0,tip);
  if(d.shells[i])d.shells[i].rotation.z=side*(.12+.25*p.wind+.16*p.strike);
 }
 if(d.tail)d.tail.rotation.y=Math.sin(phase-1.3)*.12*(1-p.strike*.6);
}
