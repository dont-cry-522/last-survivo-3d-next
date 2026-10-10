import{SCYTHE}from'./scythe-combat.js?v=125';
import{POISON}from'./poison-config.js?v=114';
import{MIRAGE}from'./mirage-config.js?v=114';
const clamp=x=>Math.max(0,Math.min(1,x));
const smooth=(a,b,t)=>{const x=clamp((t-a)/(b-a));return x*x*(3-2*x);};
const pulse=(t,a,b,c)=>smooth(a,b,t)*(1-smooth(b,c,t));
export const WEAPON_RECOVERY={miasmalantern:.72,sporelantern:POISON.castRecovery,boomerang:.55,harpoon:.48,hammer:.7,rifle:.22,shotgun:.48,crossbow:.26,shuriken:.46,fire:.62,dark:.68,shade:.36,shadowblade:SCYTHE.recovery,grimoire:.72};
// Cycle fractions also drive the audible mechanism cues, so haste preserves sync.
export const WEAPON_CUES={miasmalantern:[],sporelantern:[.73],boomerang:[],harpoon:[],hammer:[],rifle:[],shotgun:[.25,.6],crossbow:[.22,.68],shuriken:[.68],fire:[.68],dark:[.68],shade:[],shadowblade:[],grimoire:[.58]};
export function mirageShotDelay(rate){return Math.min(MIRAGE.releaseDelay,.3/Math.max(.01,rate));}
// One clock drives both held poses and their blade trails; damage timings stay unchanged.
export function meleeSwing(id,age,period=1){
 const hit=id==='shadowblade'?SCYTHE.hitFraction:.34,duration=Math.min(WEAPON_RECOVERY[id],Math.max(.12,period*.9)),t=age/duration;
 const gather=pulse(t,0,hit*.42,hit),follow=smooth(hit*.48,hit+.19,t)*(1-smooth(.72,1,t));
 return{kick:pulse(t,hit*.20,hit,.95),gather,sweep:follow,cut:-.70*gather+follow,draw:0,
  // Weight transfer begins before the hands and fades into the original gait.
  body:smooth(0,.10,t)*(1-smooth(.65,1,t)),
  clipPhase:t<hit?clamp(t/hit)*.42:.42+clamp((t-hit)/(1-hit))*.58,
  recover:pulse(t,.60,.82,1),weight:1-smooth(.78,1,t),trail:t>hit*.46&&t<hit+.22};
}
export function weaponGesture(id,age,cycle=1,period=1){
  const duration=WEAPON_RECOVERY[id]||.3;
  const t=age/Math.min(duration,Math.max(.12,period*.9));
  if(id==='miasmalantern'){
    const release=mirageShotDelay(1/period),settle=Math.min(duration,Math.max(.12,period*.9));
    return{kick:pulse(age,release*.40,release,settle),sweep:pulse(age,release*.55,release+(settle-release)*.23,settle),draw:0,gather:pulse(age,0,release*.42,release)};
  }
  if(id==='shadowblade'||id==='harpoon')return meleeSwing(id,age,period);
  if(id==='sporelantern')return{kick:pulse(t,0,POISON.releaseFraction,1),sweep:pulse(t,.18,.50,1),draw:0,gather:pulse(t,0,.13,POISON.releaseFraction)};
  const peak={boomerang:.24,harpoon:.34,rifle:.10,shotgun:.14,crossbow:.12,shuriken:.24,fire:.3,dark:.4,shade:.18,shadowblade:.32,grimoire:.46}[id]||.2;
  return {kick:pulse(t,0,peak,1),sweep:pulse(t,.04,peak+.12,1),
    draw:age<period&&cycle<1?pulse(cycle,.12,id==='crossbow'?.53:.42,id==='crossbow'?.82:.78):0,
    gather:pulse(t,.38,.68,1)};
}
export function shotStarted(d,attack,previous){
  const fired=d.shotSerial===undefined?attack>previous+.025:d.shotSerial!==(d.lastShotSerial||0);
  d.lastShotSerial=d.shotSerial;return fired;
}

export function weaponCuePhases(id,period){const scale=['crossbow','shotgun','rifle'].includes(id)?1:Math.min(WEAPON_RECOVERY[id],Math.max(.12,period*.9))/period;return (WEAPON_CUES[id]||[]).map(t=>t*scale);}
