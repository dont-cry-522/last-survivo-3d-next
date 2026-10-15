import{HERO_DODGES,dodgeTravel}from'./hero-dodge.js?v=209';
const smooth=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);};
export const GUARDIAN_ATTACKS=[
 {name:'盾牌顶击',impact:.43,damage:.8,reach:.86,arc:.65,sound:'shield'},
 {name:'转身横锤',impact:.48,damage:1,reach:1,arc:Math.PI/3,sound:'hammer'},
 {name:'举锤下砸',impact:.52,damage:1.2,reach:1,arc:.68,sound:'hammer'}
];
export const GUARDIAN_DASH={...HERO_DODGES.guardian,parry:.18};
// Integral of a smooth acceleration/deceleration curve; independent of frame rate.
export function guardianDashTravel(remaining){return dodgeTravel('guardian',remaining);}
export function nextGuardianAttack(p,now){return now-(p.lastMeleeAt??-100)>1.4?0:((p.meleeCombo??-1)+1)%3;}
// Hands, torso and weight shift share the same timeline as the damage event.
// Layout: left xyz/xyz rotation, right xyz/xyz rotation, torso yaw/pitch, body z/y.
const rest=[-.52,.22,.34,0,0,0, .57,.20,.12,-.12,0,-.15, 0,0,0,0];
const poses=[
 [rest,[-.55,.27,.16,0,.25,-.12,.60,.22,.02,-.2,0,-.2,-.16,-.06,-.07,-.035],[-.34,.30,.79,0,-.08,.03,.61,.23,.18,-.12,0,-.15,.12,.14,.24,-.06],[-.38,.28,.66,0,0,0,.61,.22,.15,-.12,0,-.15,.10,.10,.17,-.04],rest],
 [rest,[-.54,.34,.40,0,.15,-.1,.76,.52,-.26,.22,-.3,-.55,-.40,-.035,-.06,-.035],[-.55,.34,.33,0,.25,-.08,.07,.32,.69,.95,-.7,-.65,.28,.07,.16,-.045],[-.53,.31,.34,0,.1,-.08,-.05,.24,.44,1.1,-.9,-.75,.40,.08,.12,-.04],rest],
 [rest,[-.53,.32,.4,0,.1,-.12,.38,1.18,-.02,-.30,0,-.13,-.12,-.14,-.03,-.06],[-.50,.33,.36,0,.1,-.10,.37,.25,.73,2.05,0,-.05,.14,.16,.20,-.09],[-.52,.28,.36,0,0,-.10,.40,.18,.70,2.18,0,-.05,.15,.17,.18,-.075],rest]
];
export function guardianPose(index,phase){
 const u=Math.max(0,Math.min(1,phase)),move=GUARDIAN_ATTACKS[index%3],times=[0,move.impact-.22,move.impact,move.impact+.14,1],keys=poses[index%3];
 let i=0;while(i<3&&u>times[i+1])i++;const k=smooth((u-times[i])/(times[i+1]-times[i]));return keys[i].map((v,j)=>v+(keys[i+1][j]-v)*k);
}
