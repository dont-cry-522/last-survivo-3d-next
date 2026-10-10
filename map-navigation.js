import {MAP_EVENTS} from './map-events.js?v=114';
import {discoveryInfo} from './map-discoveries.js?v=131';
import {ROAMING_REWARDS} from './roaming-events.js?v=131';

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
