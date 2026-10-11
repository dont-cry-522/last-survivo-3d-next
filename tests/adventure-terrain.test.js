import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../vendor/three.module.js';
import {moveActor,supportHeight,followTerrain} from '../world.js';
import {resetMobility,beginJump,tickMobility,airborne,attackReachesPlayer,MOBILITY} from '../adventure-mobility.js';
import {segmentGroundEntry,aimPoint,groundAim,segmentHitsBody} from '../adventure-combat.js';
import {AdventureCamera} from '../adventure-camera.js';
import {AIR_ENEMIES,makeAirborne,tickAirborne} from '../airborne-enemies.js';
import {tickBoss} from '../boss-combat.js';
import {PoisonCombat} from '../poison-combat.js';
import {MirageCombat} from '../mirage-combat.js';

const soil=(x,z)=>Math.max(0,.25*(1-Math.abs(x)/5));
const world=(groundHeightAt=soil)=>({half:30,obstacles:[],groundHeightAt});
const player=(x=-5,z=0)=>{const p={x,z,heroId:'scout',standHeight:1.8,dashTime:0};resetMobility(p,soil(x,z));return p;};
const near=(a,b,eps=1e-8)=>assert(Math.abs(a-b)<eps,`${a} != ${b}`);
function step(w,p,dt,dx=0){tickMobility(p,dt,{ground:supportHeight(w,p)});moveActor(w,p,dx,0);}

for(const hz of [30,60,144])test(hz+' Hz walking/rolling follows rising and falling soil without fake jumps or landing locks',()=>{
 const w=world(),p=player();p.dashTime=.25;
 for(let i=0;i<hz*2;i++){step(w,p,1/hz,5/hz);near(p.y,soil(p.x,p.z));near(p.groundHeight,p.y);assert(!airborne(p));assert.equal(p.jumpRest,0);}
 near(p.x,5);near(p.y,0);p.dashTime=0;assert(beginJump(p));
});

test('jump keeps its world-space arc across a slope, then lands on the sampled surface',()=>{
 const p=player(-2),w=world(),takeoff=p.y;assert(beginJump(p));let peak=p.y;
 for(let i=0;i<144;i++){step(w,p,1/144,3/144);peak=Math.max(peak,p.y);assert(p.y>=soil(p.x,p.z)-1e-9);}
 near(peak,takeoff+MOBILITY.takeoff**2/(2*MOBILITY.gravity),.001);near(p.y,soil(p.x,p.z));assert(!airborne(p));assert(beginJump(p));
});

test('soil support does not turn a box into a slope, or a roll into phasing',()=>{
 const w=world();w.obstacles.push({x:0,z:0,r:.5,height:.7});const p=player(-2);
 for(let i=0;i<120;i++)step(w,p,1/60,.06);
 assert(p.x<=-.95);near(p.y,soil(p.x,p.z));
 p.x=0;p.y=p.groundHeight=.7;let falling=false;
 for(let i=0;i<120;i++){step(w,p,1/60,.04);if(p.x>1&&p.y>soil(p.x,p.z)&&p.y<.7)falling=true;}
 assert(falling);near(p.y,soil(p.x,p.z));
 const foe={x:p.x+2,z:0,alive:true,size:1};w.solidActors=()=>[p,foe];const before=p.x;moveActor(w,p,4,0);assert(p.x<before+2,'rolling crossed a living body');
});

test('teleport landing, companions and grounded enemies use soil; fliers and legacy worlds retain altitude',()=>{
 const w=world(),p=player(-5);p.x=0;followTerrain(w,p,-5,0);near(p.y,.25);assert(!airborne(p));
 for(const p of [{x:-1,z:0,size:.8},{x:-1,z:0}]){moveActor(w,p,.5,0);near(p.y,soil(p.x,0));assert(!Object.hasOwn(p,'groundHeight'));}
 const flyer={x:-1,z:0,y:3,role:'flyer'};moveActor(w,flyer,.5,0);assert.equal(flyer.y,3);
 const old=world(undefined);delete old.groundHeightAt;const legacy={x:0,z:0,y:3};moveActor(old,legacy,.5,0);assert.equal(legacy.y,3);
});

test('ground-relative attack bands preserve crouch and jump evasion while box height still counts',()=>{
 const p=player(0);p.crouch=1;assert(!attackReachesPlayer(p,'sweep',.25));assert(attackReachesPlayer(p,'shock',.25));
 p.y=.8;assert(!attackReachesPlayer(p,'shock',.25),'standing on a box must not inherit its top as attack baseline');
 p.jumpVelocity=3;const old={...p};tickMobility(p,0,{ground:0});assert.deepEqual(p,old);
 resetMobility(p,.2);assert.equal(p.y,.2);assert.equal(p.groundHeight,.2);assert.equal(p.jumpVelocity+p.jumpRest+p.crouch+p.landTime,0);
});

test('soil sweep catches a mound between clear endpoints, honors raised floors and keeps old callers unchanged',()=>{
 const a={x:-6,y:.12,z:0},b={x:6,y:.12,z:0},t=segmentGroundEntry(a,b,soil);near(t,(6-2.6)/12,.00001);
 const hit={x:a.x+(b.x-a.x)*t,y:.12,z:0};near(hit.y,soil(hit.x,0),.00001);
 assert.equal(segmentGroundEntry({...a,y:1},{...b,y:1},soil),null);assert.equal(segmentGroundEntry(a,b),null);
 assert.equal(segmentGroundEntry({x:0,y:.1,z:0},b,soil),0);
 const before={x:-4,z:0,y:0,height:.6,radius:.3},behind={x:4,z:0,y:0,height:.6,radius:.3};
 assert(segmentHitsBody(a.x,a.y,a.z,hit.x,hit.y,hit.z,before));assert(!segmentHitsBody(a.x,a.y,a.z,hit.x,hit.y,hit.z,behind));
});

test('camera aim and ground spells use actual soil and retain horizontal range',()=>{
 const ray={origin:{x:0,y:2,z:0},direction:{x:0,y:-1,z:0}};
 near(aimPoint(ray,8,[],[],soil).y,.25,.00001);near(aimPoint(ray,8).y,-6);
 const point=groundAim(ray,{x:0,z:0},5,0,soil);near(point.y,.25);near(point.x,0);
 const sky=groundAim({origin:ray.origin,direction:{x:1,y:.1,z:0}},{x:0,z:0},3,0,soil);near(Math.hypot(sky.x,sky.z),3);near(sky.y,soil(sky.x,sky.z));
});

test('first/third person cameras keep eye height and retract before intersecting raised soil',()=>{
 for(const mode of ['first','third'])for(const pitch of [-1.2,0,.8,1.4]){
  const camera=new T.PerspectiveCamera(),rig=new AdventureCamera(camera,{mode,pitch,distance:8}),p={x:0,y:.25,z:0};
  rig.update(1/60,p,[],{groundHeight:soil,snap:true});assert(camera.position.y>=soil(camera.position.x,camera.position.z)+.3499);
  if(mode==='first')near(camera.position.y,p.y+1.65);
  else assert.equal(segmentGroundEntry({x:p.x,y:p.y+1.15,z:p.z},camera.position,soil,.349),null);
 }
});

test('bosses and native low fliers retain soil-relative altitude through their attack lifecycle',()=>{
 const floor=()=>.25,p={x:0,y:.25,z:0,height:1.8,standHeight:1.8,radius:.35},b={kind:'boss',x:0,z:8,hp:2000,maxHp:2000,phase:1,turn:0,mesh:new T.Group()};
 const io={groundHeight:floor,move:(e,x,z)=>{e.x+=x;e.z+=z;},visible:()=>true,landing:p=>({...p}),zone(){},sound(){},notice(){}};
 for(let i=0;i<120;i++){tickBoss(b,p,1/60,io);near(b.y,.25);near(b.mesh.position.y,.25);}
 for(const kind of ['duskbat','sunscarab']){
  const cfg=AIR_ENEMIES[kind],e={...cfg,kind,id:1,x:0,z:6,y:.25+cfg.altitude,alive:true,mesh:makeAirborne(kind)},stages=new Set();let hits=0;
  for(let i=0;i<330;i++){tickAirborne(e,p,1/60,i/60,{...io,player:()=>p,hit:()=>hits++});stages.add(e.flight.stage);assert(e.y>=.25);}
  assert.equal(hits,1);assert(stages.has('strike')&&stages.has('recover'));
 }
});

test('both poison areas use height above soil and keep elevated targets outside the original band',()=>{
 for(const [Combat,heroId]of [[PoisonCombat,'wuling'],[MirageCombat,'mirage']]){
  const c=new Combat({groundHeight:()=>.25,player:()=>({heroId}),active:()=>true});
  c.clouds.push({x:0,z:0,r:2,damage:20,born:0,expires:5,settledAt:0});
  const area=e=>Combat===PoisonCombat?c.strongest(e,1):c.area(e,1);
  assert(area({x:0,z:0,y:1.1}));assert.equal(area({x:0,z:0,y:1.2}),null);
  delete c.api.groundHeight;assert.equal(area({x:0,z:0,y:1.1}),null);
 }
});
