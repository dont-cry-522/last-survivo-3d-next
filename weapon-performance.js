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

// Rear grip / shaft poses: diagonal carry, shoulder preparation, cutting pass,
// follow-through below the target, then an unloaded return. Both hands follow
// this single rigid pole; the blade never swings independently of the shaft.
const SCYTHE_REST=[-.20,-.28,.28,.12,.12,-1.16,0];
const SCYTHE_POSES=[
 [[-.28,-.21,.19,.60,.02,-.98,.22],[-.12,-.25,.39,-1.55,.12,-.18,-.12],[.02,-.34,.27,-2.18,.24,-1.45,-.36],[-.14,-.38,.21,-.70,.12,-1.72,-.18]],
 [[.02,-.20,.24,-2.08,.20,-1.10,-.24],[-.17,-.26,.39,-1.28,.12,-.20,.10],[-.29,-.31,.22,.56,.03,-1.28,.33],[-.24,-.37,.19,.42,.10,-1.65,.16]],
 [[-.15,-.05,.20,-.80,-.48,-.34,.16],[-.16,-.23,.41,-1.53,.25,-.08,-.10],[-.10,-.43,.32,-1.80,.76,-1.22,-.22],[-.19,-.40,.19,-.35,.24,-1.66,-.10]]
];
const SCYTHE_TIMES=[0,.24,SCYTHE.hitFraction,.62,.80,1];
export function scythePose(age,period=1,combo=0){
 const duration=Math.min(SCYTHE.recovery,Math.max(.12,period*.9)),t=clamp(age/duration),frames=[SCYTHE_REST,...SCYTHE_POSES[combo===1?1:combo===2?2:0],SCYTHE_REST];
 let i=0;while(i<4&&t>SCYTHE_TIMES[i+1])i++;
 const span=SCYTHE_TIMES[i+1]-SCYTHE_TIMES[i],u=(t-SCYTHE_TIMES[i])/span,u2=u*u,u3=u2*u,pose={};
 // Time-aware Hermite tangents keep velocity through contact; only idle endpoints
 // stop. Independent smoothsteps would visibly brake at every authored pose.
 for(const[k,name]of ['x','y','z','yaw','pitch','roll','torso'].entries()){
  const a=frames[i][k],b=frames[i+1][k],ma=i?(b-frames[i-1][k])/(SCYTHE_TIMES[i+1]-SCYTHE_TIMES[i-1]):0,mb=i<4?(frames[i+2][k]-a)/(SCYTHE_TIMES[i+2]-SCYTHE_TIMES[i]):0;
  pose[name]=(2*u3-3*u2+1)*a+(u3-2*u2+u)*span*ma+(-2*u3+3*u2)*b+(u3-u2)*span*mb;
 }
 return pose;
}
