import{HERO_DODGES,heroDodgePose}from'./hero-dodge.js?v=114';
import{SCOUT_ROLL_DURATION,rollWeight}from'./dodge-motion.js?v=114';

const clamp=x=>Math.max(0,Math.min(1,x)),smooth=x=>{x=clamp(x);return x*x*(3-2*x);};
// Presentation reads the existing ability clock. It never moves the actor,
// changes invulnerability, or integrates a second timer while the game is paused.
export function adventureDodgePose(hero,player,yaw){
 const remaining=player.dashTime||0;if(remaining<=0)return null;
 const duration=(Object.hasOwn(HERO_DODGES,hero)?HERO_DODGES[hero].duration:hero==='scout'?SCOUT_ROLL_DURATION:.24),u=clamp(1-remaining/duration);
 const kind=player.waterDash||hero==='tide'?'dive':hero==='scout'?'roll':hero==='lingya'?'hop':['silver','wraith'].includes(hero)?'blink':'mist';
 let weight=smooth(u/.16)*(1-smooth((u-.70)/.30));
 if(kind==='roll')weight=rollWeight(remaining);
 if(hero==='tide')weight=heroDodgePose('tide',remaining).depth;
 if(kind==='blink')weight=1-smooth(u);
 const angle=Number.isFinite(player.dashAngle)?player.dashAngle:yaw,side=-Math.sin(angle-yaw),forward=Math.cos(angle-yaw);
 const firstHeight=player.waterDash?-.12:({roll:-.38,dive:-.95,hop:.09,blink:-.035,mist:-.13}[kind]);
 return{kind,weight,side,forward,concealed:kind==='blink'&&remaining>.14,
  firstHeight:firstHeight*weight,thirdHeight:({roll:-.12,dive:-.28,hop:.05,blink:0,mist:-.05}[kind])*weight,
  fov:({roll:2,dive:-2.5,hop:1.5,blink:2.8,mist:1.2}[kind])*weight,
  roll:(kind==='roll'?.028:kind==='hop'?.018:.008)*side*weight,
  edge:(kind==='dive'?.22:kind==='blink'?.18:kind==='mist'?.10:.045)*weight};
}
