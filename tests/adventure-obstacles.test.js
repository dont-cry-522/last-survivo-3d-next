import test from 'node:test';
import assert from 'node:assert/strict';
import {clearAt,moveActor,supportHeight} from '../world.js';
import {MOBILITY,resetMobility,bodyHeight,airborne,beginJump,tickMobility} from '../adventure-mobility.js';

const world=(...obstacles)=>({half:20,obstacles});
const player=(x=-1.9,z=0)=>{const p={x,z,heroId:'scout',standHeight:1.8,dashTime:0};resetMobility(p);return p;};
const rock=(height=.6)=>({x:0,z:0,r:.45,height});
// Same public calls as the game: resolve vertical support before horizontal travel.
// After leaving a top, the following simulation step sees the lower support.
function step(w,p,dt,dx=0,dz=0,options={}){
 const landed=tickMobility(p,dt,{ground:supportHeight(w,p),...options});
 moveActor(w,p,dx,dz);
 assert(Number.isFinite(p.y)&&Number.isFinite(p.groundHeight));
 assert(p.y>=p.groundHeight-1e-9,'feet fell through the current support');
 return landed;
}

test('support is the highest reachable finite top overlapping the circular feet, never an unknown wall',()=>{
 const p=player(0),w=world(rock(.3),{...rock(),sceneryHeight:.6,height:undefined},rock(1.4),{x:.9,z:.9,r:.5,height:.85},{x:3,z:0,r:1,height:.9});
 p.y=.8;assert.equal(supportHeight(w,p),.6);p.y=1.6;assert.equal(supportHeight(w,p),1.4);
 p.y=0;assert.equal(supportHeight(w,p),0,'query must not pull a grounded player onto a box');
 for(const height of[undefined,NaN,Infinity,-Infinity,-1])assert.equal(supportHeight(world({...rock(),height}),{...p,y:5}),0,'invalid height became a platform');
 assert.equal(supportHeight(world({x:.79,z:0,r:.35,height:.4}),{...p,y:.5}),.4,'foot overlap must not require the actor centre to lie on the top');
 assert.equal(supportHeight(world({x:.81,z:0,r:.35,height:.4}),{...p,y:.5}),0);
});

for(const hz of[30,60,144]){
 test(hz+' Hz jump clears a 0.6 m obstacle without passing through a taller tree',()=>{
  for(const height of[.6,5]){
   const w=world(rock(height)),p=player();assert(beginJump(p));let crossed=false,maxY=0;
   for(let i=0;i<hz;i++){
    step(w,p,1/hz,6.5/hz);maxY=Math.max(maxY,p.y);
    if(Math.hypot(p.x,p.z)<.9-1e-6){assert(p.y>=height-.03,'actor crossed the side below the top');crossed=true;}
   }
   assert(Math.abs(maxY-MOBILITY.takeoff**2/(2*MOBILITY.gravity))<.006);
   assert.equal(p.y,0);assert(!airborne(p));
   if(height===.6){assert(crossed);assert(p.x>1.2,'jump did not cross the small obstacle');}
   else{assert(!crossed);assert(p.x<=-.9+1e-6,'high tree was treated as a low platform');}
  }
 });

 test(hz+' Hz jump lands on the top, can jump again there, and falls naturally after walking off',()=>{
  const w=world(rock()),p=player();assert(beginJump(p));let landed=false;
  for(let i=0;i<hz;i++)landed=step(w,p,1/hz,Math.min(4/hz,Math.max(0,-p.x)))||landed;
  assert(landed);assert(Math.abs(p.x)<1e-8);assert.equal(p.y,.6);assert.equal(p.groundHeight,.6);assert(!airborne(p));
  for(let i=0;i<hz/2;i++)step(w,p,1/hz);
  assert(beginJump(p),'nonzero support incorrectly prevents takeoff');let peak=p.y,landings=0;
  for(let i=0;i<hz;i++){
   if(step(w,p,1/hz))landings++;peak=Math.max(peak,p.y);
   if(i<hz*.45)assert.equal(beginJump(p),false,'air jump was allowed');
  }
  assert.equal(landings,1);assert(Math.abs(peak-(.6+MOBILITY.takeoff**2/(2*MOBILITY.gravity)))<.006);assert.equal(p.y,.6);assert(!airborne(p));
  let falling=false;
  for(let i=0;i<hz;i++){
   step(w,p,1/hz,3/hz);
   if(p.x>.9&&p.y>.001&&p.y<.6)falling=true;
  }
  assert(falling,'leaving the ledge teleported straight to the ground');assert.equal(p.y,0);assert.equal(p.groundHeight,0);assert(!airborne(p));
 });
}

test('pause freezes elevated support and airborne state; reset removes support and jump state',()=>{
 const w=world(rock()),p=player(0);p.y=.6;tickMobility(p,.01,{ground:supportHeight(w,p)});assert(!airborne(p));
 assert(beginJump(p));step(w,p,.2);const before={...p};
 assert.equal(tickMobility(p,0,{ground:0,crouching:true,ceiling:.1}),false);assert.deepEqual(p,before);
 resetMobility(p);assert.equal(p.y,0);assert.equal(p.groundHeight,0);assert.equal(p.jumpVelocity,0);assert.equal(p.jumpRest,0);assert.equal(p.crouch,0);assert.equal(p.landTime,0);assert(!airborne(p));
 moveActor(w,p,.1,0);assert.equal(p.x,0,'reset actor retained permission to cross the platform');
});

test('an elevated floor keeps ceiling limits in world coordinates and never forces feet below its top',()=>{
 const w=world(rock()),p=player(0);p.y=.6;tickMobility(p,.01,{ground:.6});assert(beginJump(p));
 tickMobility(p,.2,{ground:.6,ceiling:2.6});assert(p.y+bodyHeight(p)<=2.6+1e-9);assert(p.jumpVelocity<=0);assert(p.y>=.6);
 for(let i=0;i<90;i++)step(w,p,1/60,0,0,{ceiling:2.6});
 assert.equal(p.y,.6);assert(!airborne(p));
 p.crouch=1;tickMobility(p,.2,{ground:.6,ceiling:1.8});assert(p.y+bodyHeight(p)<=1.8+1e-9,'uncrouching crossed a low roof above the platform');assert.equal(p.y,.6);
});

test('removing a support starts a fall instead of granting a new air jump or keeping invisible ground',()=>{
 const w=world(rock()),p=player(0);p.y=p.groundHeight=.6;
 w.obstacles=[];
 step(w,p,1/60);
 assert.equal(p.groundHeight,0);assert(p.y>0&&p.y<.6);assert(airborne(p));assert(!beginJump(p));
 for(let i=0;i<60;i++)step(w,p,1/60);
 assert.equal(p.y,0);assert(!airborne(p));assert(beginJump(p));
});

test('unknown-height obstacles still block elevated players, and ordinary rolls never step through low walls',()=>{
 for(const obstacle of[rock(),{x:0,z:0,r:.45},{x:0,z:0,r:.45,height:Infinity}]){
  const w=world(obstacle),p=player();p.dashTime=.2;
  for(let i=0;i<60;i++)moveActor(w,p,6.5/60,0);
  assert(p.x<=-.9+1e-6);assert.equal(p.y,0);assert.equal(p.groundHeight,0);
  if(!Number.isFinite(obstacle.height)){
   p.x=-1.9;p.y=2;
   for(let i=0;i<60;i++)moveActor(w,p,6.5/60,0);
   assert(p.x<=-.9+1e-6,'missing height disabled collision');
  }
 }
});

test('legacy clearance, ground enemy movement and map boundaries retain their ground rules',()=>{
 const w=world(rock());assert.equal(clearAt(w,0,0),false);assert.equal(clearAt(w,.9,0),true);assert.equal(clearAt(w,.9-1e-5,0),false);
 const e={x:-1.9,z:0,y:3,size:.75};
 for(let i=0;i<60;i++)moveActor(w,e,6.5/60,0);
 assert(e.x<=-.9+1e-6,'a legacy actor without mobility support bypassed obstacles');assert(!Object.hasOwn(e,'groundHeight'));
 const p=player(19.4);p.y=2;moveActor(w,p,1,0);assert.equal(p.x,19.4,'jump crossed the map boundary');
 assert.equal(clearAt(w,19.55,0),false);
});

test('a jumping player still collides with living ground enemies and bosses',()=>{
 for(const boss of[false,true]){
  const p=player(-3),foe={x:0,z:0,y:0,size:1,boss,alive:true},w=world();w.solidActors=()=>[p,foe];p.y=1;p.jumpVelocity=1;
  moveActor(w,p,6,0);assert(p.x<-(boss?1.6:.6)-.44,'jump enabled body phasing');
  foe.alive=false;moveActor(w,p,6,0);assert(p.x>2,'dead foe still blocks the jump');
 }
});
