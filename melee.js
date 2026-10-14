import{GUARDIAN_DASH}from'./guardian-motion.js?v=196';
export function inMeleeArc(origin,target,angle,range,arc=Math.PI/3){
 const x=target.x-origin.x,z=target.z-origin.z,d=Math.hypot(x,z);
 return d<=range+(target.size||0)*.4&&Math.abs(Math.atan2(Math.sin(Math.atan2(x,z)-angle),Math.cos(Math.atan2(x,z)-angle)))<=arc;
}
export function canParry(player,x,z,window=.18){
 return player.heroId==='guardian'&&player.dashTime>0&&GUARDIAN_DASH.duration-player.dashTime<=window&&inMeleeArc(player,{x,z},player.dashAngle,1000,Math.PI*.36);
}

// Directional mitigation leaves flanks, rear attacks and hazards underfoot dangerous.
export function meleeDamageScale(player,x,z,angle,now){
 if(player.dashTime>0||Math.hypot(x-player.x,z-player.z)<.1)return 1;
 if(!inMeleeArc(player,{x,z},angle,1000,Math.PI*.36))return 1;
 if(player.heroId==='guardian')return .75;
 if(player.heroId==='tide'&&now<(player.braceUntil||0))return .8;
 return 1;
}
