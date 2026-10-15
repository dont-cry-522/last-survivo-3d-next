// Visual anatomy only. These values never change AI speed, collisions or hit time.
// travel = half of a support stroke, in actor-local metres; support = stance
// fraction. The phase and foot solver must use the same pair to avoid sliding.
const profiles={
 wolf:[.38,.43,.115,.15,2.2,4.5,.58],frostwolf:[.37,.43,.09,.14,2.2,4.5,.58],
 ashstalker:[.28,.35,.055,.09,2,4.5,.60],emberling:[.27,.31,.09,.12,2,4.5,.61],
 yeti:[.25,.30,.07,.09,1.4,3.8,.64],lavabrute:[.30,.34,.045,.06,1.2,3.8,.68],
 boss:[.45,.45,.16,.16,1.5,4,.70],frostking:[.48,.54,.20,.24,2,4.5,.65],
 cinderlord:[.44,.48,.12,.15,2,4,.70],dunescorpion:[.48,.54,.12,.15,2,5,.68],wreckwarden:[.48,.52,.12,.14,1.8,4,.69],
 thornstag:[.38,.92,.16,.31,2.7,9,.50],rimefang:[.40,.62,.15,.25,3,7,.55],
 moltenrhino:[.34,.70,.12,.24,2,9,.58],webmatriarch:[.31,.39,.12,.17,1.9,4,.68],cinderdrake:[.32,.42,.14,.20,2.2,5,.62]
};
export function creatureGait(kind,speed){
 const p=profiles[kind];if(!p)return null;
 const x=Math.max(0,Math.min(1,(speed-p[4])/(p[5]-p[4]))),run=x*x*(3-2*x);
 return{travel:p[0]+(p[1]-p[0])*run,lift:p[2]+(p[3]-p[2])*run,support:.64+(p[6]-.64)*run,run};
}
// Slow travel shortens both the stroke and its cadence. A linear stride would
// cancel speed in gaitDistance, making a creeping creature pedal at full pace.
export function gaitStride(speed,referenceSpeed=2.5){return Math.sqrt(Math.max(0,Math.min(1,speed/referenceSpeed)));}
export function gaitDistance(distance,gait,stride=1){return Math.max(0,distance)*Math.PI*gait.support/(gait.travel*Math.max(.01,stride));}

export function footCycle(phase,stride,lift=.10,stance=.64){
 const u=((phase/(Math.PI*2)%1)+1)%1,support=u<stance,q=support?0:(u-stance)/(1-stance);
 // Match the backward velocity at take-off and touchdown, instead of snapping
 // from a planted stroke to a stationary swing. Squared sine eases vertical lift.
 const swing=-1+2*q*q*(3-2*q)-2*(1-stance)/stance*q*(1-q)*(1-2*q)*(1-4*q*(1-q))**3;
 return{support,travel:(support?1-2*u/stance:swing)*stride,lift:Math.sin(q*Math.PI)**2*lift*stride,q};
}

// Coast/sand attacks use their actual wind-up and recovery, not a generic
// 1.2-second timer. This is the same gather/release envelope as forest creatures.
export function creatureAttackPose(d,attack,dt,recovery){
 if(attack>0&&!(d.previousAttack>0))d.attackLength=attack;
 if(attack<=0&&d.previousAttack>0)d.release=d.cancelled?0:recovery;
 d.cancelled=false;d.previousAttack=attack;d.release=Math.max(0,(d.release||0)-dt);
 const smooth=x=>{x=Math.max(0,Math.min(1,x));return x*x*(3-2*x);};
 const progress=attack>0?1-attack/(d.attackLength||1):0;
 const strike=attack>0?smooth((progress-.66)/.34):d.release/recovery;
 return{wind:attack>0?smooth(progress/.6)*(1-.85*strike):strike*.15,strike};
}
