import{EXPEDITION_BOSS_TIME}from'./encounters.js?v=114';
// Existing bosses visit each local arena; the five-region expedition keeps its own progression.
export const BOSS_ROUTES={forest:['forest','sand','snow'],snow:['snow','forest','ash'],ash:['ash','sand','coast'],sand:['sand','ash','forest'],coast:['coast','snow','sand']};
export const BOSS_ROUNDS=[{health:2600,pressure:1},{health:3900,pressure:1.12},{health:5600,pressure:1.24}];
export const BOSS_BREAK=75;
export function createBossRun(){return{defeated:0,nextAt:EXPEDITION_BOSS_TIME};}
export function advanceBossRun(run,time){if(run.defeated>=3)return false;run.defeated++;run.nextAt=run.defeated<3?time+BOSS_BREAK:Infinity;return run.defeated===3;}
