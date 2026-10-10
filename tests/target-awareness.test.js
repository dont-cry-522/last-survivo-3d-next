import{test}from'node:test';import assert from'node:assert/strict';
import{observePlayer,playerHidden}from'../target-awareness.js';import{tickBoss,BOSS_STYLES}from'../boss-combat.js';import{advanceRoaming}from'../roaming-events.js';
test('only active tide dive hides the player; ordinary invulnerability and swimming do not',()=>{for(const heroId of['scout','silver','wraith','guardian','lingya'])assert(!playerHidden({heroId,dashTime:2,inv:10,waterDepth:1}));assert(!playerHidden({heroId:'tide',dashTime:0,waterDepth:1}));assert(playerHidden({heroId:'tide',dashTime:.01}));});
test('target memory copies the dive origin and never follows submerged coordinates or velocity',()=>{
 const e={x:0,z:5},p={heroId:'tide',x:1,z:2,vx:6,vz:3,dashTime:0};assert.strictEqual(observePlayer(e,p),p);p.dashTime=2;p.x=15;p.z=-20;assert.deepEqual(observePlayer(e,p,.1),{x:1,z:2,vx:0,vz:0});assert(e.targetLost);p.x=70;assert.equal(observePlayer(e,p,.1).x,1);assert.equal(e.searchTime,.2);p.dashTime=0;assert.strictEqual(observePlayer(e,p),p);assert(e.reacquired&&!e.targetLost);observePlayer(e,p);assert(!e.reacquired);
});
test('an enemy born during the dive has no hidden location to pursue',()=>{const e={x:2,z:8},p={heroId:'tide',dashTime:1,x:-50,z:12};assert.deepEqual(observePlayer(e,p),{x:2,z:8,vx:0,vz:0});assert.equal(e.lastSeenPlayer,undefined);});
function boss(kind){return{kind,x:0,z:6,hp:100,maxHp:100,phase:1,stage:'walk',cool:0,angle:0,mesh:{userData:{},rotation:{y:0},position:{set(){}}}};}
function io(zones){return{visible:()=>true,move:(b,x,z)=>{b.x+=x;b.z+=z},landing:p=>({...p}),zone:z=>zones.push({...z}),sound(){},notice(){}};}
test('all five bosses search last sighting without new attack plans, then reacquire after surfacing',()=>{
 for(const kind of Object.keys(BOSS_STYLES)){const b=boss(kind),p={heroId:'tide',x:0,z:0,dashTime:0},zones=[];observePlayer(b,p);p.dashTime=2;p.x=20;for(let i=0;i<90;i++)tickBoss(b,p,1/60,io(zones));assert.equal(zones.length,0,kind);assert(Math.abs(b.x)<.001,kind);assert.equal(b.lastSeenPlayer.x,0);p.dashTime=0;tickBoss(b,p,.016,io(zones));assert(!b.targetLost);assert(b.cool>.3);assert.equal(b.lastSeenPlayer.x,20);for(let i=0;i<45;i++)tickBoss(b,p,1/60,io(zones));assert.equal(zones.length,0,'still outside reach');for(let i=0;i<60*12&&!zones.length;i++)tickBoss(b,p,1/60,io(zones));assert(zones.length>0,kind);}
});
test('committed boss attacks retain their original target through dive and complete without new locks',()=>{
 for(const kind of Object.keys(BOSS_STYLES)){const b=boss(kind),p={heroId:'tide',x:1,z:0,dashTime:0},zones=[];tickBoss(b,p,.016,io(zones));assert.equal(b.stage,'wind');const count=zones.length,target={...b.target},plan=JSON.stringify(zones);p.dashTime=2;p.x=50;p.z=-60;for(let i=0;i<300;i++)tickBoss(b,p,1/60,io(zones));assert.deepEqual(b.target,target);assert.equal(JSON.stringify(zones),plan);assert.equal(zones.length,count);assert.equal(b.stage,'walk');}
});
test('submerged players cannot wake a camp or start a proximity chase',()=>{
 const p={heroId:'tide',dashTime:1,x:0,z:0};let spawned=0;const context={time:80,player:p,spawn(){spawned++;return null},notify(){},reward(){},remove(){}};
 for(const kind of['camp','courier']){const s={kind,x:0,z:0,availableAt:0,state:'waiting',discovered:true,members:[],mesh:{visible:true}};advanceRoaming(s,.02,context);assert.equal(s.state,'waiting');assert.equal(spawned,0);}
 const runner={x:0,z:0,hp:20,maxHp:20,alive:true},s={kind:'courier',x:0,z:0,availableAt:0,state:'waiting',discovered:true,runner,remaining:18};advanceRoaming(s,.1,context);assert.equal(s.state,'waiting');assert.equal(s.remaining,18);p.dashTime=0;advanceRoaming(s,.1,context);assert.equal(s.state,'running');
});
