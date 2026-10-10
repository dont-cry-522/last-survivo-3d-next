import {inMeleeArc} from './melee.js?v=114';
export const SCYTHE={damage:40,rate:1.45,range:3.2,arc:1.0,recovery:.56,hitFraction:.44,resetAfter:1.5};
export function beginScythe(p,w,time,angle,pitch){
 const combo=time-(p.scytheLast??-100)>SCYTHE.resetAfter?0:(p.scytheCount||0)%3;
 p.scytheLast=time;p.scytheCount=combo+1;
 const empowered=(p.upgrades.scythe_step||0)>0&&time<(p.scytheStepUntil||0);p.scytheStepUntil=0;
 return{scythe:true,combo,angle,pitch,hitAt:time+Math.min(SCYTHE.recovery,.9/w.rate)*SCYTHE.hitFraction,w:{...w},empowered};
}
export function scytheHits(origin,e,strike,blocked){
 const distance=Math.hypot(e.x-origin.x,e.z-origin.z),y=origin.y+Math.tan(strike.pitch)*distance;
 return e.alive&&inMeleeArc(origin,e,strike.angle,strike.w.range*Math.cos(strike.pitch),strike.w.arc)
  &&y+.45>=(e.y||0)&&y-.45<=(e.y||0)+(e.height||1.4)&&!blocked(origin,{x:e.x,y:Math.max(e.y||0,Math.min((e.y||0)+(e.height||1.4),y)),z:e.z});
}
export function scytheDamage(p,e,strike,time){
 let damage=strike.w.damage*[1,1.1,1.35][strike.combo],mark=false;
 if(strike.empowered)damage*=1+.20*(p.upgrades.scythe_step||0);
 const reap=p.upgrades.scythe_reap||0;if(reap&&e.hp<=e.maxHp*.30)damage*=1+.15*reap;
 const rank=p.upgrades.scythe_mark||0;
 if(rank){e.scytheMarks=time-(e.scytheMarkAt??-100)>3?1:(e.scytheMarks||0)+1;e.scytheMarkAt=time;if(e.scytheMarks>=3){e.scytheMarks=0;damage+=18+10*rank;mark=true;}}
 return{damage,mark};
}
