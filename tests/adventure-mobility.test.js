import test from 'node:test';
import assert from 'node:assert/strict';
import {MOBILITY,resetMobility,bodyHeight,attackReachesPlayer,beginJump,tickMobility} from '../adventure-mobility.js';
import {AIR_ROSTERS,AIR_ENEMIES,airWaveEligible,makeAirborne,tickAirborne} from '../airborne-enemies.js';
import {segmentBodyEntry} from '../adventure-combat.js';
const player=()=>{const p={standHeight:1.8,dashTime:0};resetMobility(p);return p;};
test('jump arc is time based, bounded, and lands without double jump',()=>{
 for(const hz of[30,60,144]){const p=player();assert(beginJump(p));let max=0,landed=false;for(let i=0;i<hz;i++){landed=tickMobility(p,1/hz)||landed;max=Math.max(max,p.y);if(i<hz*.5)assert.equal(beginJump(p),false);}assert(landed);assert.equal(p.y,0);assert(Math.abs(max-MOBILITY.takeoff**2/(2*MOBILITY.gravity))<.006);}
});
test('deep water, ability and landing recovery block jump',()=>{const p=player();assert(!beginJump(p,.6));p.dashTime=.2;assert(!beginJump(p));p.dashTime=0;p.jumpRest=.1;assert(!beginJump(p));});
test('crouch avoids high sweeps, jump avoids low shock, tall poison still hurts',()=>{const p=player();assert(attackReachesPlayer(p,'sweep'));tickMobility(p,.2,{crouching:true});assert(Math.abs(bodyHeight(p)-.99)<1e-9);assert(!attackReachesPlayer(p,'sweep'));assert(attackReachesPlayer(p,'poison'));beginJump(p);tickMobility(p,.3);assert(!attackReachesPlayer(p,'shock'));assert(attackReachesPlayer(p,'root'));assert(attackReachesPlayer(p,'unknown'));});
test('pause does not advance posture; reset clears all mobility',()=>{const p=player();beginJump(p);tickMobility(p,.2);const before={...p};tickMobility(p,0,{crouching:true});assert.deepEqual(p,before);resetMobility(p);assert.equal(p.y+p.jumpVelocity+p.crouch+p.landTime,0);});
test('ceiling stops upward movement and blocks uncrouching',()=>{const p=player();beginJump(p);tickMobility(p,.2,{ceiling:2});assert(p.y+bodyHeight(p)<=2+1e-9);assert(p.jumpVelocity<=0);resetMobility(p);p.crouch=1;tickMobility(p,.2,{ceiling:1.1});assert(bodyHeight(p)<=1.1+1e-9);tickMobility(p,.2);assert.equal(p.crouch,0);});
test('first swept collision handles vertical rays and foes already touching',()=>{const e={x:0,y:3,z:0,height:.6,radius:.4};const t=segmentBodyEntry({x:0,y:1,z:0},{x:0,y:5,z:0},e,.1);assert(Math.abs(t-.475)<1e-4);assert.equal(segmentBodyEntry({x:2,y:1,z:0},{x:2,y:5,z:0},e,.1),null);assert.equal(segmentBodyEntry({x:0,y:3.2,z:0},{x:0,y:5,z:0},e,.1),0);});
test('air waves respect start time and concurrent cap',()=>{assert(!airWaveEligible(23,[],()=>0));assert(airWaveEligible(24,[],()=>0));assert(!airWaveEligible(40,Array.from({length:3},()=>({alive:true,role:'flyer'})),()=>0));});
for(const [map,kind] of Object.entries(AIR_ROSTERS))test(map+' native flyer telegraphs, dives, recovers, and obeys pause',()=>{
 const cfg=AIR_ENEMIES[kind],e={...cfg,kind,id:1,x:0,z:6,y:cfg.altitude,alive:true,mesh:makeAirborne(kind)},p={x:0,y:0,z:0,height:1.8,radius:.35},events=[];let hit=0;const io={move:(e,x,z)=>{e.x+=x;e.z+=z;},visible:()=>true,sound:(_,event)=>events.push(event),player:()=>p,hit:()=>hit++};const stages=new Set();
 for(let i=0;i<330;i++){tickAirborne(e,p,1/60,i/60,io);stages.add(e.flight.stage);assert(Number.isFinite(e.y));}
 assert(stages.has('wind')&&stages.has('strike')&&stages.has('recover'));assert(events.includes('wind')&&events.includes('attack'));assert.equal(hit,1);const old={x:e.x,y:e.y,z:e.z,t:e.flight.timer};tickAirborne(e,p,0,10,io);assert.deepEqual({x:e.x,y:e.y,z:e.z,t:e.flight.timer},old);
 // A committed high pass misses a crouching body; low pass misses an elevated body.
 e.x=0;e.z=2;e.y=cfg.pass;e.flight={stage:'strike',timer:.5,from:{x:0,y:cfg.pass,z:2},to:{x:0,y:cfg.pass,z:-2},hit:false};p.height=.99;p.y=cfg.pass>1?0:1;hit=0;for(let i=0;i<90;i++)tickAirborne(e,p,1/60,10+i/60,io);assert.equal(hit,0);
});
