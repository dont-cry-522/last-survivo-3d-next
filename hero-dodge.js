import{MIRAGE}from'./mirage-config.js?v=193';
// One clock drives travel, the skeletal action, landing and gameplay hooks.
export const HERO_DODGES={mirage:{duration:MIRAGE.dodgeDuration,distance:MIRAGE.dodgeDistance,cooldown:MIRAGE.dodgeCooldown,name:'蜕影'},wuling:{duration:.52,distance:4.8,cooldown:2.3,name:'牵瘴步'},tide:{duration:2,distance:0,cooldown:6.5,name:'潜潮'},lingya:{duration:.58,distance:6.2,cooldown:3.6,name:'换位'}};
const clamp=t=>Math.max(0,Math.min(1,t));
const smooth=(a,b,t)=>{const u=clamp((t-a)/(b-a));return u*u*(3-2*u);};
export function heroDodgePose(kind,remaining){
 const cfg=Object.hasOwn(HERO_DODGES,kind)?HERO_DODGES[kind]:null;if(!cfg)return null;const u=clamp(1-remaining/cfg.duration),weight=smooth(0,.12,u)*(1-smooth(.80,1,u));
 if(kind==='tide'){const depth=smooth(0,.18,cfg.duration-remaining)*smooth(0,.22,remaining);return{u,weight:depth,depth,height:depth?-2.15*depth:0,brace:.15*depth};}
 const launch=1-smooth(.20,.34,u),land=smooth(.61,.76,u),air=1-launch-land;
 return{u,weight,launch,air,land,startTime:Math.min(.20,u/.25*.20),airTime:Math.max(0,u-.25)*.4,landTime:clamp((u-.61)/.39)*.94,
  height:u<=.18||u>=.76?0:Math.sin(Math.PI*clamp((u-.18)/.58))*.16,brace:weight*.13};
}
export function dodgeTravel(kind,remaining){const c=Object.hasOwn(HERO_DODGES,kind)?HERO_DODGES[kind]:null;if(!c)return 0;const u=clamp(1-remaining/c.duration);return c.distance*(u-Math.sin(2*Math.PI*u)/(2*Math.PI));}

export const HERO_ABILITY_TEXT={
 mirage:`沿原有碰撞规则闪避，最远 ${MIRAGE.dodgeDistance} 米、持续 ${MIRAGE.dodgeDuration} 秒，基础冷却 ${MIRAGE.dodgeCooldown} 秒。在起点留下当前生命值的静止替身，自身遁形免伤 ${MIRAGE.hiddenDuration} 秒，期间可移动但不能攻击。敌人优先锁定替身；已出手的攻击仍落在原处。替身不攻击、不回复生命，撑满 ${MIRAGE.decoyDuration} 秒才绽放毒花并留下 ${MIRAGE.cloudDuration} 秒毒雾；被击碎、替换或离场均不会爆发。同场最多一个替身、${MIRAGE.maxClouds} 片余雾。幻瘴可延长替身并强化自然绽放，蚀影强化现身后的反击。`,
 wuling:'沿实际路径闪避，最远 4.8 米、持续 0.52 秒，最初 0.32 秒免伤，基础冷却 2.3 秒。牵引路径上第一片主毒雾，起点在雾内也可搬运；移到实际落点，不复制、不延长剩余寿命，途中到期直接消散。搬运重置沉瘴成熟度。地形和碰撞会缩短距离，不能穿墙；空闪避不触发苔衣护盾。',
 tide:'按闪避键潜入召来的潮水，最多 2 秒无敌且无法被敌人锁定；敌人只会寻找你潜入前的位置，已出手的攻击仍落在原处。可控制移动但不能攻击，也不能穿过障碍。再次按闪避键或松开后重新攻击可提前浮出。基础冷却 6.5 秒，自动攻击不会自动取消潜潮。',
 lingya:'按住方向时优先向该方向燕步；不按方向且伙伴存活、相距 4—9 米、路径畅通时，自动向伙伴换位。最远 6.2 米，途中可小幅修正方向（最多偏转 45°）。伙伴错开路线撤向起点，最初 0.45 秒免伤；条件不符时使用普通燕步。基础冷却 3.6 秒。'
};
