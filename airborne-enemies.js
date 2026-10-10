import * as T from './vendor/three.module.js';
import{restoreEnemyHit,animateEnemyHit}from'./enemy-feedback.js?v=114';
import {segmentHitsBody} from './adventure-combat.js?v=123';

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
 e.flight??={stage:'orbit',timer:1.6};const f=e.flight;f.timer-=dt;
 const ox=e.x,oy=e.y??cfg.altitude,oz=e.z;
 if(e.stagger>0){f.stage='recover';f.timer=Math.max(f.timer,.65);}
 if(f.stage==='orbit'){
  const dx=focus.x-e.x,dz=focus.z-e.z,d=Math.hypot(dx,dz)||1,orbit=d<8?1:0;
  const speed=e.speed*(e.slow>0?.45:1),side=e.id%2?1:-1;
  io.move(e,(dx/d*(d>6?1:0)+dz/d*orbit*side*.6)*speed*dt,(dz/d*(d>6?1:0)-dx/d*orbit*side*.6)*speed*dt);
  e.y=oy+(cfg.altitude+Math.sin(time*1.7+e.id)*.16-oy)*Math.min(1,dt*3);
  if(f.timer<=0&&d<11&&!e.targetLost&&io.visible(e)){f.stage='wind';f.timer=cfg.windTime;f.from={x:e.x,z:e.z,y:e.y};const len=Math.hypot(dx,dz)||1;f.to={x:focus.x+dx/len*2,z:focus.z+dz/len*2,y:cfg.pass>1?(io.player().standHeight||1.8)*.85-.3:cfg.pass};f.hit=false;io.sound(e,'wind');}
 }else if(f.stage==='wind'){
  e.y=oy+(f.to.y-oy)*Math.min(1,dt*6);
  if(f.timer<=0){f.stage='strike';f.timer=cfg.strikeTime;f.from={x:e.x,y:e.y,z:e.z};io.sound(e,'attack');}
 }else if(f.stage==='strike'){
  const t=Math.min(1,1-f.timer/cfg.strikeTime),ease=t*t*(3-2*t);
  const nx=f.from.x+(f.to.x-f.from.x)*ease,nz=f.from.z+(f.to.z-f.from.z)*ease;
  io.move(e,nx-e.x,nz-e.z);e.y=f.from.y+(f.to.y-f.from.y)*ease;
  const decoy=io.decoy?.();if(!f.hit&&decoy?.alive&&segmentHitsBody(ox,oy+.3,oz,e.x,e.y+.3,e.z,{...decoy,y:0,height:1.8,radius:.4},.22)){f.hit=true;io.hitDecoy(e);}
  if(!f.hit&&segmentHitsBody(ox,oy+.3,oz,e.x,e.y+.3,e.z,io.player(),.22)){f.hit=true;io.hit(e);}
  if(f.timer<=0){f.stage='recover';f.timer=1.15;}
 }else{
  // Brief low recovery lets short weapons and ground poison punish a missed pass.
  e.y=oy+(.25-oy)*Math.min(1,dt*6);
  if(f.timer<=0){f.stage='orbit';f.timer=2.6+(e.id%3)*.4;}
 }
 const a=f.stage==='wind'?Math.atan2(f.to.x-e.x,f.to.z-e.z):Math.hypot(e.x-ox,e.z-oz)>.001?Math.atan2(e.x-ox,e.z-oz):e.mesh.rotation.y;
 e.mesh.rotation.y+=Math.atan2(Math.sin(a-e.mesh.rotation.y),Math.cos(a-e.mesh.rotation.y))*Math.min(1,dt*8);
 e.mesh.position.set(e.x,e.y,e.z);restoreEnemyHit(e.mesh);animateAirborne(e,time);animateEnemyHit(e.mesh,dt);
}

const sphere=new T.SphereGeometry(1,12,8),materials=new Map(),wings=new Map();
function wingGeometry(shape){if(wings.has(shape))return wings.get(shape);const s=new T.Shape();s.moveTo(0,0);s.bezierCurveTo(.35,.65,.85,.72,1.25,.3);if(shape==='bat'){s.quadraticCurveTo(.72,.28,.95,-.35);s.quadraticCurveTo(.4,-.13,.3,-.5);}else s.bezierCurveTo(1.08,-.15,.6,-.7,.15,-.4);s.lineTo(0,0);const g=new T.ShapeGeometry(s,8);g.rotateX(Math.PI/2);wings.set(shape,g);return g;}
export function makeAirborne(kind){
 const cfg=AIR_ENEMIES[kind],root=new T.Group(),rig=new T.Group();root.add(rig);root.userData.rig=rig;
 if(!materials.has(kind))materials.set(kind,[new T.MeshStandardMaterial({color:cfg.color,roughness:.8,side:T.DoubleSide}),new T.MeshStandardMaterial({color:cfg.accent,roughness:.6})]);
 const [skin,trim]=materials.get(kind);
 const part=(parent,scale,pos,material=skin)=>{const m=new T.Mesh(sphere,material);m.scale.set(...scale);m.position.set(...pos);m.castShadow=true;parent.add(m);return m;};
 part(rig,[cfg.shape==='beetle'?.3:.2,.22,.43],[0,.3,0]);part(rig,[.18,.17,.19],[0,.36,.4],trim);
 const pivots=[];for(const side of[-1,1]){const pivot=new T.Group();pivot.position.set(side*.12,.34,0);pivot.scale.x=side*cfg.span;pivot.scale.z=cfg.span;const wing=new T.Mesh(wingGeometry(cfg.shape),skin);wing.castShadow=true;pivot.add(wing);rig.add(pivot);pivots.push(pivot);part(rig,[.038,.048,.03],[side*.085,.42,.565],trim);if(cfg.shape==='beetle')part(rig,[.15,.08,.35],[side*.18,.48,-.04],trim);}
 if(cfg.shape==='ray')part(rig,[.045,.035,.65],[0,.25,-.8],trim);
 root.userData.wings=pivots;return root;
}
export function animateAirborne(e,time){const f=e.flight,rig=e.mesh.userData.rig;rig.rotation.z=Math.sin(time*2+e.id)*.08;rig.rotation.x=f?.stage==='strike'?-.08:Math.sin(time*2.3)*.035;const flap=f?.stage==='wind'?.7:f?.stage==='strike'?.12:Math.sin(time*(e.kind==='sunscarab'?13:6)+e.id)*.42;for(const [i,w]of e.mesh.userData.wings.entries())w.rotation.z=(i?1:-1)*flap;}
