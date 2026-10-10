import{MAP_HALF}from'./map-layout.js?v=114';
import{playerHidden}from'./target-awareness.js?v=114';
import * as T from './vendor/three.module.js';
import{terrainMesh}from'./map-tactics.js?v=114';
import{sceneryAllowed}from'./biome-scenery.js?v=131';
export const ROAMING_REWARDS={courier:{name:'携宝猎物',xp:30,heal:0},camp:{name:'守卫补给营地',xp:40,heal:.18}};
export function installRoaming(w,id,rnd){
 w.roaming=[];for(const kind of['courier','camp'])for(let attempt=0;attempt<700;attempt++){
  const a=rnd()*Math.PI*2,r=kind==='courier'?23+rnd()*12:w.regional?42+rnd()*12:55+rnd()*15,x=w.spawn.x+Math.sin(a)*r,z=w.spawn.z+Math.cos(a)*r;
  if(Math.abs(x)>(w.half||MAP_HALF)-6||Math.abs(z)>(w.half||MAP_HALF)-6||!sceneryAllowed(w,x,z)||w.obstacles.some(o=>Math.hypot(o.x-x,o.z-z)<o.r+5)||w.sites.some(s=>Math.hypot(s.x-x,s.z-z)<15)||[...w.discoveries,...w.roaming].some(s=>Math.hypot(s.x-x,s.z-z)<12))continue;
  const mesh=new T.Group();mesh.position.set(x,0,z);w.group.add(mesh);mesh.visible=false;
  if(kind==='camp'){
   terrainMesh(mesh,'BoxGeometry',[1.2,.65,.85],id==='coast'?0x66887f:0x806746,0,.34,0);
   for(const s of[-1,1]){terrainMesh(mesh,'BoxGeometry',[.12,.7,.9],0xd2b887,s*.4,.36,0);terrainMesh(mesh,'CylinderGeometry',[.04,.07,1.8,5],0x7d7054,s*1.6,.9,.8);terrainMesh(mesh,'BoxGeometry',[.45,.5,.025],0xa16f46,s*1.6,1.5,.8);}
  }else{terrainMesh(mesh,'DodecahedronGeometry',[.35,0],0xc5ac77,0,.25,0);terrainMesh(mesh,'BoxGeometry',[.12,.48,.35],0x70533f,0,.28,0);}
  w.roaming.push({kind,x,z,mesh,half:w.half||MAP_HALF,expiresAt:w.regional?Infinity:165,availableAt:(kind==='courier'?25:65)+rnd()*12,discovered:false,state:'hidden',variant:rnd()<.5?0:1,members:[],remaining:18,rewarded:false});break;
 }
}
export function roamingHint(s){
 if(s.kind==='courier')return s.state==='reward'?'宝袋落地 · 靠近领取 30 经验':s.state==='running'?'携宝猎物 · '+Math.ceil(s.remaining)+' 秒后逃走 · 可放弃追击':'携宝猎物 · 靠近追击，击败后掉落宝袋';
 return s.state==='reward'?'营地已清理 · 靠近领取经验和治疗':s.state==='active'?'守卫补给 · 剩余 '+s.members.filter(e=>e.alive).length+' 名守卫':'守卫补给 · 靠近 6 米挑战，或绕行离开';
}
export function advanceRoaming(s,dt,{time,player,boss=false,spawn,remove,reward,notify}){
 if(dt<=0||s.rewarded||s.state==='escaped'||time<s.availableAt)return;
 let d=Math.hypot(player.x-s.x,player.z-s.z);
 if(!s.discovered){if(boss||playerHidden(player)||time>=(s.expiresAt??165)||d>14)return;s.discovered=true;s.mesh.visible=true;s.state='waiting';notify(s,roamingHint(s));}
 if(s.kind==='courier'){
  if(!s.runner){if(boss||playerHidden(player))return;const e=spawn('wolf',s.x,s.z,s);if(!e)return;e.courier=s;e.speed=3.6;e.hp=e.maxHp=e.maxHp*1.6;e.cool=999;e.xp=0;s.runner=e;s.members=[e];s.mesh.visible=false;notify(s,'携宝猎物不会攻击 · 靠近 8 米开始追击；18 秒内击败可获 30 经验');}
  const e=s.runner;
  if(s.state!=='reward'&&!e.alive&&e.hp<=0){s.state='reward';s.x=e.x;s.z=e.z;s.mesh.position.set(s.x,0,s.z);s.mesh.visible=true;notify(s,'宝袋掉落 · 靠近领取 30 经验');}
  if(e.alive){s.x=e.x;s.z=e.z;d=Math.hypot(player.x-e.x,player.z-e.z);if(s.state==='waiting'&&(d<8&&!playerHidden(player)||e.hp<e.maxHp))s.state='running';
   if(s.state==='running'){s.remaining=Math.max(0,s.remaining-dt);if(s.remaining===0){s.state='escaped';e.alive=false;remove(e);notify(s,'携宝猎物逃走了 · 继续探索');}}
  }
 }else{
  if(s.state==='waiting'&&!boss&&!playerHidden(player)&&d<6){s.state='active';const roles=s.variant?['wolf','wolf','spitter']:['golem','mushroom','shaman'];
   for(const[i,role]of roles.entries()){const a=i*2.094+(s.variant?.5:0),e=spawn(role,s.x+Math.sin(a)*3,s.z+Math.cos(a)*3,s);if(e){e.hp=e.maxHp=e.maxHp*1.25;s.members.push(e);}}
   if(!s.members.length){s.state='waiting';return;}notify(s,'补给守卫被惊动 · 清理后获得 40 经验和 18% 治疗');
  }
  if(s.state==='active'&&s.members.every(e=>!e.alive)){s.state='reward';notify(s,'营地已清理 · 靠近补给箱领取');}
 }
 if(s.state==='reward'&&Math.hypot(player.x-s.x,player.z-s.z)<1.8){s.rewarded=true;s.state='claimed';s.mesh.scale.y=.35;reward(s,ROAMING_REWARDS[s.kind]);}
}
export function courierDirection(e,player,time){const s=e.courier;if(s.state!=='running')return null;const a=Math.atan2(e.x-player.x,e.z-player.z)+Math.sin(time*1.7+e.id)*.45;let x=Math.sin(a),z=Math.cos(a);if(Math.abs(e.x)>(s.half||MAP_HALF)-6)x=-Math.sign(e.x);if(Math.abs(e.z)>(s.half||MAP_HALF)-6)z=-Math.sign(e.z);return{x,z};}
