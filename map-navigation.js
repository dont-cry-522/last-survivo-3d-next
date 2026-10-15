import {MAP_EVENTS} from './map-events.js?v=207';
import {discoveryInfo} from './map-discoveries.js?v=207';
import {ROAMING_REWARDS} from './roaming-events.js?v=207';

// Obstacle coordinates stay fixed during play. Destruction replaces the list;
// fallen trunks append entries. Keep only the small-map layer, leaving the
// enlarged map vector-drawn and tide/markers/fog live on both maps.
export function drawMapObstacles(context,world,scale,detailed=false){
 const paint=c=>{c.fillStyle='#72947a';for(const o of world.obstacles)c.fillRect(72+o.x*scale,72+o.z*scale,1.5,1.5);};
 if(detailed){paint(context);return;}
 let layer=world.obstacleMap;
 if(!layer){const canvas=document.createElement('canvas');canvas.width=canvas.height=144;layer=world.obstacleMap={canvas};}
 if(layer.list!==world.obstacles||layer.count!==world.obstacles.length||layer.scale!==scale){
  const c=layer.canvas.getContext('2d');c.clearRect(0,0,144,144);paint(c);
  layer.list=world.obstacles;layer.count=world.obstacles.length;layer.scale=scale;
 }
 context.drawImage(layer.canvas,0,0);
}

export function knownMapPoints(world){
 const points=[],known=p=>world.exploration.known(p.x,p.z);
 for(const p of world.sites||[])if(p.discovered&&known(p))points.push({x:p.x,z:p.z,name:p.event?MAP_EVENTS[p.event].name:p.type==='relic'?'遗物遗迹':p.type==='altar'?'技能祭坛':'治疗补给',kind:p.type==='relic'?'relic':p.type==='altar'?'skill':'heal',done:!!p.claimed});
 for(const p of world.discoveries||[])if(p.discovered&&known(p))points.push({x:p.x,z:p.z,name:discoveryInfo(p).name,kind:'find',done:!!p.claimed});
 for(const p of world.roaming||[])if(p.discovered&&p.state!=='escaped'&&known(p))points.push({x:p.x,z:p.z,name:ROAMING_REWARDS[p.kind].name,kind:'encounter',done:!!p.rewarded});
 return points;
}
export function mapWaypoint(world,x,z){
 if(!world.exploration.known(x,z))return null;
 const nearby=knownMapPoints(world).filter(p=>Math.hypot(p.x-x,p.z-z)<world.exploration.half*.065).sort((a,b)=>Math.hypot(a.x-x,a.z-z)-Math.hypot(b.x-x,b.z-z))[0];
 return nearby?{x:nearby.x,z:nearby.z,name:nearby.name}:{x,z,name:'探索路标'};
}
export function waypointHint(player,point,yaw=-Math.PI*.75){
 if(!point)return '';
 const dx=point.x-player.x,dz=point.z-player.z,distance=Math.hypot(dx,dz),index=(Math.round(Math.atan2(-Math.cos(yaw)*dx+Math.sin(yaw)*dz,Math.sin(yaw)*dx+Math.cos(yaw)*dz)/(Math.PI/4))+8)%8;
 return `${['↑','↗','→','↘','↓','↙','←','↖'][index]} ${point.name} · ${Math.ceil(distance)} 米`;
}
