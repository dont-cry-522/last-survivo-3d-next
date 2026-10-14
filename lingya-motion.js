import{HERO_DODGES,heroDodgePose}from'./hero-dodge.js?v=188';
export const LINGYA_HOP_DURATION=HERO_DODGES.lingya.duration;
export const LINGYA_HOP_DISTANCE=6.2;
const clamp=x=>Math.max(0,Math.min(1,x));
const smooth=(a,b,t)=>{const x=clamp((t-a)/(b-a));return x*x*(3-2*x);};
const pulse=(t,a,b,c)=>smooth(a,b,t)*(1-smooth(b,c,t));
const angleDelta=(a,b)=>Math.atan2(Math.sin(a-b),Math.cos(a-b));
// Directional input is authoritative. A stationary dodge may enlist the companion.
export function planLingyaHop(owner,pet,inputAngle,facing,free){
 const directed=Number.isFinite(inputAngle),fallback=directed?inputAngle:facing+Math.PI/2;
 const clearDistance=(angle,limit)=>{let last=0;for(let d=.15;d<limit+.15;d+=.15){const step=Math.min(d,limit);if(!free(owner.x+Math.sin(angle)*step,owner.z+Math.cos(angle)*step))break;last=step;}return last;};
 let angle=fallback,distance=LINGYA_HOP_DISTANCE,cooperative=false;
 if(pet?.alive){const dx=pet.x-owner.x,dz=pet.z-owner.z,d=Math.hypot(dx,dz),toward=Math.atan2(dx,dz),diff=Math.abs(angleDelta(toward,fallback));
  // With a held direction, assist only when the pet already lies on that route.
  if(d>=4&&d<=9&&(!directed||diff<.22)&&clearDistance(toward,d)>=d-.001){angle=directed?inputAngle:toward;distance=Math.min(LINGYA_HOP_DISTANCE,directed?d*Math.cos(diff):d);cooperative=true;}
 }
 const available=clearDistance(angle,distance);if(available<distance-.2)cooperative=false;
 return {angle,distance:available,cooperative};
}
export function steerLingyaHop(angle,initial,inputAngle,remaining,dt){
 const u=clamp(1-remaining/LINGYA_HOP_DURATION);if(!Number.isFinite(inputAngle)||u>.84)return angle;
 const target=initial+Math.max(-Math.PI/4,Math.min(Math.PI/4,angleDelta(inputAngle,initial))),delta=angleDelta(target,angle),step=2.8*dt*(1-smooth(.58,.84,u));
 return angle+Math.max(-step,Math.min(step,delta));
}
// Integrate a short acceleration, cruise and longer braking phase. Exact distance at any frame rate.
export function sideHopTravel(remaining){const t=clamp(1-remaining/LINGYA_HOP_DURATION),a=.10,b=.62,c=1-b;let area;
 if(t<a){const q=t/a;area=a*(q**3-.5*q**4);}else if(t<b)area=a*.5+t-a;else{const q=(t-b)/c;area=a*.5+b-a+c*(q-q**3+.5*q**4);}
 return LINGYA_HOP_DISTANCE*area/(1-(a+c)/2);
}
export function lingyaHopScale(slow,depth=0){return depth>.42?slow:Math.max(.9,slow);}
export function lingyaHopPose(remaining){
 const t=clamp(1-remaining/LINGYA_HOP_DURATION),air=pulse(t,.08,.36,.78),push=pulse(t,0,.12,.32),land=pulse(t,.64,.82,1),reach=smooth(.32,.76,t),weight=smooth(0,.10,t)*(1-smooth(.85,1,t));
 return{t,air,push,land,reach,weight,height:heroDodgePose('lingya',remaining).height,pitch:push*.18+air*.12+land*.16,bank:air*.24+push*.08,twist:air*.24};
}
