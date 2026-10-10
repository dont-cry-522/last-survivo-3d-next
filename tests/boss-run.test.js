import test from'node:test';import assert from'node:assert/strict';
import{BOSS_ROUTES,BOSS_ROUNDS,BOSS_BREAK,createBossRun,advanceBossRun}from'../boss-expedition.js';
import{chooseBossMove}from'../boss-combat.js';
import{bodyTravel,bodiesClear}from'../actor-collision.js';
import{moveActor}from'../world.js';
test('local expeditions require three different bosses and start subsequent timers at death',()=>{
 for(const [map,route]of Object.entries(BOSS_ROUTES)){assert.equal(route[0],map);assert.equal(new Set(route).size,3);}
 const r=createBossRun();assert.equal(r.nextAt,120);assert(!advanceBossRun(r,180));assert.equal(r.nextAt,180+BOSS_BREAK);assert(!advanceBossRun(r,300));assert(advanceBossRun(r,450));assert.equal(r.nextAt,Infinity);assert(!advanceBossRun(r,500));assert.equal(r.defeated,3);assert.equal(createBossRun().defeated,0);
 for(let i=1;i<3;i++){assert(BOSS_ROUNDS[i].health>BOSS_ROUNDS[i-1].health);assert(BOSS_ROUNDS[i].pressure>BOSS_ROUNDS[i-1].pressure);}
});
test('bosses choose reachable attacks rather than spend close-range swings at distant players',()=>{
 assert.equal(chooseBossMove({kind:'boss',phase:1,turn:0},20),null);assert.equal(chooseBossMove({kind:'boss',phase:1,turn:0},9).move,'roots');assert.equal(chooseBossMove({kind:'boss',phase:1,turn:0},3).move,'branches');assert.equal(chooseBossMove({kind:'dunescorpion',phase:1,turn:0},10).move,'burrow');
});
test('swept body collision blocks rolls and both actor directions, permits tangential escape and ignores dead targets',()=>{
 const p={heroId:'scout',x:0,z:0},e={x:0,z:3,size:1,alive:true},w={obstacles:[],solidActors:function*(){yield p;yield e;}};
 moveActor(w,p,0,9);assert(p.z<1.951&&p.z>1.94);assert(!bodiesClear(w,p,0,3));const z=e.z;moveActor(w,e,0,-9,.6);assert(Math.abs(e.z-z)<.003);moveActor(w,p,2,0);assert.equal(p.x,2);e.alive=false;moveActor(w,p,-2,5);assert(p.z>6);
});
test('boss body blocks knockback and magical traversal still rejects occupied landing points',()=>{
 const p={heroId:'scout',x:0,z:0},b={boss:true,x:0,z:4,alive:true},w={obstacles:[],solidActors:()=>[p,b]};
 assert(bodyTravel(w,p,0,10)<.2);p.heroId='tide';p.dashTime=1;assert.equal(bodyTravel(w,p,0,10),1);assert(!bodiesClear(w,p,0,4));assert(bodiesClear(w,p,0,7));p.heroId='mirage';p.mirageHidden=true;assert.equal(bodyTravel(w,p,0,10),1);
 p.mirageHidden=false;p.x=0;p.z=4;assert.equal(bodyTravel(w,p,0,1),1,'overlap must allow separation');
});

test('airborne bodies pass above small enemies but cannot fly through tall bosses at the same height',()=>{
 const p={role:'flyer',x:0,z:0,y:2.5,height:.6,size:.5},q={boss:true,x:0,z:4,height:4,alive:true},world={solidActors:()=>[p,q]};assert(bodyTravel(world,p,0,8,.3)<1);q.boss=false;q.size=.5;q.height=1;assert.equal(bodyTravel(world,p,0,8,.3),1);
});
