import test from 'node:test';
import assert from 'node:assert/strict';
import {ARCSTAFF,BRIARPOT,traceArcStaff,arcFocusMultiplier,wildWeaponBlock,BriarPods,briarStagger} from '../wild-weapons.js';
import {weaponStats} from '../rules.js';

const world=extra=>({half:64,obstacles:[],groundHeightAt:()=>0,...extra});
const foe=(x,z,extra={})=>({x,z,y:0,height:1.5,size:.5,alive:true,...extra});
const origin={x:0,y:1.2,z:0},aim={x:0,y:1.2,z:10};
const stats=(id,path,rank=3)=>weaponStats({weaponId:id,upgrades:{},weaponPath:path?{id:path,rank}:null});
const near=(a,b,tolerance=1e-5)=>assert(Math.abs(a-b)<tolerance,`${a} != ${b}`);

test('overlapping and rapid snare pods cannot permanently interrupt a foe',()=>{
 const e=foe(0,3),w=stats('briarpot','briarpot_snare');
 assert(briarStagger(e,w,0));near(e.stagger,.5);
 e.stagger=.1;assert(!briarStagger(e,w,.4));near(e.stagger,.1);
 e.stagger=0;for(const time of [.5,.735,1.47,1.999])assert(!briarStagger(e,w,time));
 near(e.stagger,0);assert(briarStagger(e,w,2));
 const fresh=foe(1,3);assert(briarStagger(fresh,w,.5),'each foe has its own cooldown');
 assert(!briarStagger(foe(0,3,{boss:true}),w,10));assert(!briarStagger(foe(0,3,{alive:false}),w,10));
 assert(!briarStagger(foe(0,3),stats('briarpot'),10));
});

test('arc stops at nearest live body, obstacle, roof, ground and actual world edge',()=>{
 const w=stats('arcstaff'),close=foe(0,4),far=foe(0,7),dead=foe(0,2,{alive:false});
 assert.equal(traceArcStaff(origin,aim,w,[far,dead,close],world()).hits[0].enemy,close);
 const obstacle={x:0,y:0,z:2,r:.4,height:5};
 const blocked=traceArcStaff(origin,aim,w,[close],world({obstacles:[obstacle]}));
 assert.equal(blocked.hits.length,0);assert.equal(blocked.block.obstacle,obstacle);assert(blocked.end.z<2);
 const roof={point:{x:0,y:1.2,z:2},normal:{x:0,y:-1,z:0}};
 assert.equal(traceArcStaff(origin,aim,w,[close],world({overhead:{firstHit:()=>roof}})).hits.length,0);
 assert.equal(traceArcStaff(origin,aim,w,[close],world({groundHeightAt:(x,z)=>z>=2&&z<=3?2:0})).hits.length,0);
 for(const half of [4,144]){
  const edge=wildWeaponBlock({x:half-1,y:2,z:0},{x:half+2,y:2,z:0},world({half}),.1);
  assert(edge.edge);near(edge.point.x,half-.1);
 }
});

test('arc chains once per body within both jump distance and total reach, respecting branch cover',()=>{
 const w=stats('arcstaff','arcstaff_chain'),targets=[foe(0,4),foe(2,4),foe(3,6),foe(4,8),foe(6,7),foe(0,12)];
 const result=traceArcStaff(origin,aim,w,targets,world());
 assert.equal(result.hits.length,5);assert.equal(new Set(result.hits.map(h=>h.enemy)).size,5);
 assert.equal(result.hits[0].scale,1);assert(result.hits.slice(1).every(h=>h.scale===ARCSTAFF.chainScale));
 assert(!result.hits.some(h=>h.enemy===targets.at(-1)));
 const isolated=traceArcStaff(origin,aim,w,targets.slice(0,2),world({obstacles:[{x:1,y:0,z:4,r:.3,height:5}]}));
 assert.equal(isolated.hits.length,1);
 assert.equal(traceArcStaff(origin,aim,stats('arcstaff','arcstaff_focus'),targets,world()).hits.length,1);
});

test('arc focus grows with elapsed time, caps, and resets on a miss, target change or interrupted stream',()=>{
 const p={},w=stats('arcstaff','arcstaff_focus'),a=foe(0,4),b=foe(1,4);
 near(arcFocusMultiplier(p,w,a,0),1);
 for(let i=1;i<=5;i++)near(arcFocusMultiplier(p,w,a,i*.25),1+ARCSTAFF.focusCap[3]*i*.25/ARCSTAFF.focusTime);
 near(arcFocusMultiplier(p,w,a,1.5),2.05);
 near(arcFocusMultiplier(p,w,b,1.75),1);
 near(arcFocusMultiplier(p,w,b,2.5),1);
 near(arcFocusMultiplier(p,w,null,2.75),1);assert.equal(p.arcFocus,null);
 near(arcFocusMultiplier(p,w,a,3),1);
 arcFocusMultiplier(p,stats('arcstaff'),a,3.25);assert.equal(p.arcFocus,null);
});

function podsRig(extra={}){
 const r={active:true,world:world(),foes:[],created:[],removed:[],landed:[],bursts:[],...extra};
 r.pods=new BriarPods({active:()=>r.active,world:()=>r.world,foes:()=>r.foes,
  create:p=>r.created.push(p),remove:p=>r.removed.push(p),land:p=>r.landed.push({x:p.x,y:p.y,z:p.z,flight:p.flight}),burst:p=>r.bursts.push(p)});
 return r;
}
const cast=(r,w=stats('briarpot'))=>r.pods.cast(origin,{x:0,y:.1,z:6},w);
function advance(r,seconds,step=1/60){for(let left=seconds;left>1e-9;){const dt=Math.min(left,step);r.pods.update(dt);left-=dt;}}

test('briarpot preserves parabolic landing and one delayed burst from 15 to 120 fps',()=>{
 for(const fps of [15,30,60,120]){
  const r=podsRig(),p=cast(r),release=p.delay;
  advance(r,release-.001,1/fps);assert.equal(p.state,'held');assert.equal(r.bursts.length,0);
  advance(r,1,1/fps);assert.equal(r.landed.length,1);assert.equal(r.bursts.length,0);
  near(r.landed[0].z,6,.002);near(r.landed[0].y,.12);near(r.landed[0].flight,.86,.002);
  advance(r,BRIARPOT.arm,1/fps);assert.equal(r.bursts.length,1);assert.equal(r.pods.pods.length,0);assert.equal(r.removed.length,1);
  advance(r,5,1/fps);assert.equal(r.bursts.length,1);
 }
});

test('briarpot snare arms before triggering, respects cover, and expires without foes',()=>{
 const w=stats('briarpot','briarpot_snare',1),r=podsRig(),p=cast(r,w);
 advance(r,1.1);assert.equal(p.state,'armed');r.foes=[foe(0,6.3)];
 advance(r,.2);assert.equal(r.bursts.length,0);
 advance(r,.4);assert.equal(r.bursts.length,1);
 const covered=podsRig(),q=cast(covered,w);advance(covered,1.1);
 covered.foes=[foe(0,7.5)];covered.world.obstacles=[{x:0,y:0,z:6.8,r:.2,height:3}];
 advance(covered,1);assert.equal(q.state,'armed');assert.equal(covered.bursts.length,0);
 advance(covered,3);assert.equal(covered.bursts.length,1);assert.equal(covered.pods.pods.length,0);
});

test('briarpot snare reacts to the feet of a tall boss inside the blast area',()=>{
 const r=podsRig({foes:[foe(0,6,{height:6,boss:true})]});
 cast(r,stats('briarpot','briarpot_snare',1));advance(r,1.8);
 assert.equal(r.bursts.length,1,'a boss standing over the seed must trigger after arming, before its 3 second expiry');
});

test('briarpot stops its current update when a release callback ends the game',()=>{
 let active=true,moved=0,landed=0,bursts=0;
 const pods=new BriarPods({active:()=>active,world:()=>world(),foes:()=>[],
  release:()=>{active=false;pods.clear();},move:()=>moved++,land:()=>landed++,burst:()=>bursts++});
 pods.cast(origin,{x:0,y:.1,z:6},stats('briarpot'));pods.update(2);
 assert.equal(pods.pods.length,0);assert.equal(moved,0);assert.equal(landed,0);assert.equal(bursts,0);
});

test('briarpot pause, cancel, bounded cap and clear do not burst discarded pods or share mutable stats',()=>{
 const r=podsRig(),w=stats('briarpot'),p=cast(r,w);w.damage=999;
 assert.equal(p.w.damage,BRIARPOT.damage);
 r.active=false;advance(r,20);assert.equal(p.state,'held');near(p.delay,Math.min(.65,.9/w.rate)*.24);
 r.active=true;advance(r,.3);assert.equal(p.state,'flight');const held=cast(r);
 r.pods.cancelHeld();assert.deepEqual(r.pods.pods,[p]);assert(r.removed.includes(held));
 for(let i=0;i<12;i++)cast(r);assert.equal(r.pods.pods.length,BRIARPOT.max);assert(r.removed.includes(p));
 r.pods.clear();assert.equal(r.pods.pods.length,0);assert.equal(new Set(r.removed).size,r.created.length);assert.equal(r.bursts.length,0);
});

test('briarpot collides with a tall wall and plants on the near side',()=>{
 const obstacle={x:0,y:0,z:4,r:.8,height:8},r=podsRig({world:world({obstacles:[obstacle]})});
 cast(r);advance(r,1);
 assert.equal(r.landed.length,1);assert(r.landed[0].z<obstacle.z-obstacle.r);
 assert(!wildWeaponBlock({x:r.landed[0].x,y:.47,z:r.landed[0].z},{x:0,y:.7,z:2},r.world).blocked);
});

test('briarpot breaks at either face of a roof without planting or bursting through it',()=>{
 for(const height of [.5,2])for(const fps of [15,60,120]){
  const roof={firstHit(a,b){if((a.y-1)*(b.y-1)>0||a.y===b.y)return null;const t=(1-a.y)/(b.y-a.y);return{point:{x:a.x+(b.x-a.x)*t,y:1,z:a.z+(b.z-a.z)*t},normal:{x:0,y:height<1?-1:1,z:0}};}},r=podsRig({world:world({overhead:roof}),foes:[foe(0,6)]}),blocked=[];
  r.pods.api.blocked=(p,hit)=>blocked.push({y:p.y,hit});
  r.pods.cast({...origin,y:height},{x:0,y:.1,z:6},stats('briarpot','briarpot_snare'));
  advance(r,8,1/fps);
  assert.equal(blocked.length,1);near(blocked[0].y,1);assert(blocked[0].hit.roof);
  assert.equal(r.landed.length,0);assert.equal(r.bursts.length,0);assert.equal(r.removed.length,1);assert.equal(r.pods.pods.length,0);
 }
});
