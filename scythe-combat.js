import {inMeleeArc} from './melee.js?v=203';
export const SCYTHE={damage:40,rate:1.45,range:3.2,arc:1.0,recovery:.56,hitFraction:.44,resetAfter:1.5};
export const SCYTHE_ROUTES={rest:1.2,heavy:[0,.45,.60,.75],stagger:[0,.25,.30,.35],slow:[0,.65,.80,.95],refund:[0,.35,.50,.65]};
export function scytheRestRemaining(p,time){return Math.max(0,SCYTHE_ROUTES.rest-(time-(p.scytheLast??-100)));}
export function beginScythe(p,w,time,angle,pitch){
 const combo=time-(p.scytheLast??-100)>SCYTHE.resetAfter?0:(p.scytheCount||0)%3;
 const heavy=w.pathId==='shadowblade_return'&&w.pathRank>0&&scytheRestRemaining(p,time)<=1e-9;
 p.scytheLast=time;p.scytheCount=combo+1;
 const empowered=(p.upgrades.scythe_step||0)>0&&time<(p.scytheStepUntil||0);p.scytheStepUntil=0;
 return{scythe:true,combo,angle,pitch,hitAt:time+Math.min(SCYTHE.recovery,.9/w.rate)*SCYTHE.hitFraction,w:{...w},empowered,heavy};
}
export function scytheHits(origin,e,strike,blocked){
 const distance=Math.hypot(e.x-origin.x,e.z-origin.z),y=origin.y+Math.tan(strike.pitch)*distance;
 return e.alive&&inMeleeArc(origin,e,strike.angle,strike.w.range*Math.cos(strike.pitch),strike.w.arc)
  &&y+.45>=(e.y||0)&&y-.45<=(e.y||0)+(e.height||1.4)&&!blocked(origin,{x:e.x,y:Math.max(e.y||0,Math.min((e.y||0)+(e.height||1.4),y)),z:e.z});
}
// Pass only targets that survived the real arc, height and obstruction tests.
export function scythePrimary(origin,hits){
 let nearest=null,distance=Infinity;
 for(const e of hits){const d=Math.hypot(e.x-origin.x,e.z-origin.z);if(d<distance){nearest=e;distance=d;}}
 return nearest;
}
export function scytheDamage(p,e,strike,time,primary=false){
 let damage=strike.w.damage*[1,1.1,1.35][strike.combo],mark=false;
 const routeRank=Math.min(3,Math.max(0,strike.w.pathRank||0)),heavy=!!(strike.heavy&&primary),sweep=strike.w.pathId==='shadowblade_fan'&&strike.combo===2;
 if(heavy)damage*=1+SCYTHE_ROUTES.heavy[routeRank];
 if(strike.empowered)damage*=1+.20*(p.upgrades.scythe_step||0);
 const reap=p.upgrades.scythe_reap||0;if(reap&&e.hp<=e.maxHp*.30)damage*=1+.15*reap;
 const rank=p.upgrades.scythe_mark||0;
 if(rank){e.scytheMarks=time-(e.scytheMarkAt??-100)>3?1:(e.scytheMarks||0)+1;e.scytheMarkAt=time;if(e.scytheMarks>=3){e.scytheMarks=0;damage+=18+10*rank;mark=true;}}
 return{damage,mark,heavy,slow:sweep?SCYTHE_ROUTES.slow[routeRank]:strike.combo===2?.5:0,stagger:heavy?SCYTHE_ROUTES.stagger[routeRank]:.13};
}
// Once per resolved swing, not once per enemy. No banked charges or extra invulnerability.
export function finishScytheSweep(p,strike,hits){
 if(strike.w.pathId!=='shadowblade_fan'||strike.combo!==2||hits<2)return 0;
 const refund=SCYTHE_ROUTES.refund[Math.min(3,Math.max(0,strike.w.pathRank||0))],before=Math.max(0,p.dash||0);
 p.dash=Math.max(0,before-refund);return before-p.dash;
}
