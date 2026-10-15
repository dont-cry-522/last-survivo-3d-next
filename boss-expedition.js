import{EXPEDITION_BOSS_TIME}from'./encounters.js?v=206';
export {BOSS_ROUTES} from './boss-roster.js?v=206';
export const BOSS_ROUNDS=[{health:2600,pressure:1},{health:3900,pressure:1.12},{health:5600,pressure:1.24}];
export const BOSS_BREAK=75;
export function createBossRun(){return{defeated:0,nextAt:EXPEDITION_BOSS_TIME};}
export function advanceBossRun(run,time){if(run.defeated>=3)return false;run.defeated++;run.nextAt=run.defeated<3?time+BOSS_BREAK:Infinity;return run.defeated===3;}
