import test from 'node:test';
import assert from 'node:assert/strict';
import {aimPoint,segmentHitsBody,launchVelocity,groundAim,bodyContact} from '../adventure-combat.js';

const ray=(x,y,z,dx,dy,dz)=>({origin:{x,y,z},direction:{x:dx,y:dy,z:dz}});
const close=(a,b)=>assert(Math.abs(a-b)<1e-7,`${a} differs from ${b}`);
const enemy=(z,extra={})=>({x:0,z,size:1,alive:true,...extra});

test('aim selects the nearest body surface, respects camera range, and ignores dead bodies',()=>{
 const r=ray(0,1,0,0,0,1);close(aimPoint(r,20,[enemy(9),enemy(4)]).z,3.3);
 close(aimPoint(r,3,[enemy(9),enemy(4)]).z,3);
 close(aimPoint(r,20,[enemy(4,{alive:false}),enemy(9)]).z,8.3);
 close(aimPoint(ray(0,1,0,0,0,3),3,[enemy(9)]).z,3);
});

test('a nearer obstacle blocks the enemy and finite heights permit aiming over it',()=>{
 const foes=[enemy(8,{height:5})],wall={x:0,z:4,r:1};
 close(aimPoint(ray(0,1,0,0,0,1),20,foes,[wall]).z,3);
 close(aimPoint(ray(0,4,0,0,0,1),20,foes,[{...wall,height:2}]).z,7.3);
 close(aimPoint(ray(0,1,0,0,0,1),2,foes,[wall]).z,2);
});

test('skyward rays miss ground bodies, downward rays can hit their top, and raised bodies use base y',()=>{
 const point=aimPoint(ray(0,1.6,0,0,1,1),10,[enemy(5)]);assert(point.y>8);assert(point.z>7);
 const down=aimPoint(ray(0,5,5,0,-1,0),10,[enemy(5)]);close(down.y,2);close(down.z,5);
 close(aimPoint(ray(0,1,0,0,0,1),10,[enemy(5,{y:3})]).z,10);
 close(aimPoint(ray(0,4,0,0,0,1),10,[enemy(5,{y:3})]).z,4.3);
});

test('swept projectiles cannot tunnel through a body or hit it from above',()=>{
 const e=enemy(5);assert(segmentHitsBody(0,1,0,0,1,12,e,.08));
 assert(!segmentHitsBody(0,4,0,0,4,12,e,.08));
 assert(!segmentHitsBody(0,1.6,0,0,8,12,e,.08));
 assert(segmentHitsBody(0,4,5,0,-1,5,e,.08));
 assert(segmentHitsBody(0,1,5,0,1,5,e,.08));
 assert(!segmentHitsBody(0,1,5,0,1,5,{...e,alive:false},.08));
 assert(!segmentHitsBody(0,1,0,0,1,12,{...e,y:3},.08));
});

test('projectile radius catches grazing sides while rounded top corners do not create false hits',()=>{
 const e=enemy(5);assert(segmentHitsBody(.77,1,0,.77,1,10,e,.08));
 assert(!segmentHitsBody(.80,1,0,.80,1,10,e,.08));
 assert(!segmentHitsBody(.79,2.09,4,.79,2.09,6,e,.10));
 assert(segmentHitsBody(.74,2.04,4,.74,2.04,6,e,.10));
});

test('explicit obstacle radii override enemy size defaults in swept collision',()=>{
 const obstacle={x:0,z:5,height:6},sweep=radius=>segmentHitsBody(1,1,0,1,1,10,{...obstacle,radius},.05);
 assert(sweep(1.2),'the outer section of a wide trunk must block a projectile');
 assert(!sweep(.2),'a slim trunk must not inherit a larger default body');
 assert(segmentHitsBody(.85,1,0,.85,1,10,{...obstacle,size:.1,radius:1},0),'explicit radius wins over size');
 assert(!segmentHitsBody(.85,1,0,.85,1,10,{...obstacle,size:1},0),'enemies without radius retain size × 0.7');
 assert(!segmentHitsBody(0,7,0,0,7,10,{...obstacle,radius:2},.05),'wide obstacles still have finite height');
});

test('muzzle convergence uses all three axes at the requested speed without mutating inputs',()=>{
 const origin=Object.freeze({x:.2,y:1,z:0}),target=Object.freeze({x:0,y:2,z:10}),v=launchVelocity(origin,target,12);
 close(Math.hypot(v.vx,v.vy,v.vz),12);assert(v.vx<0&&v.vy>0&&v.vz>0);close(v.angle,Math.atan2(-.2,10));
 assert.deepEqual(launchVelocity(origin,origin,12),{vx:0,vy:0,vz:0,angle:0});
});

test('ground spells clamp to the player instead of the camera and sky aim falls back horizontally',()=>{
 const origin={x:2,y:0,z:3};
 const near=groundAim(ray(2,2,3,0,-1,1),origin,8,.3);assert.deepEqual(near,{x:2,y:0,z:5});
 const far=groundAim(ray(20,3,-5,0,-.01,1),origin,8,.3);close(Math.hypot(far.x-origin.x,far.z-origin.z),8);assert.equal(far.y,0);
 assert.deepEqual(groundAim(ray(20,3,-5,0,1,1),origin,8,.3),{x:2,y:0,z:11});
 const up=groundAim(ray(20,3,-5,0,1,0),origin,8,Math.PI/2);close(up.x,10);close(up.z,3);
 assert.deepEqual(groundAim(ray(0,2,0,0,-1,1),origin,0),origin);
});


test('visual contacts use the near body surface and impact height without moving hitboxes',()=>{
 const e=Object.freeze(enemy(5,{height:2}));
 const c=bodyContact(0,1.4,0,0,1.4,12,e,.08);close(c.z,4.3);close(c.y,1.4);assert.deepEqual(c.normal,{x:0,y:0,z:-1});assert.deepEqual(c.direction,{x:0,y:0,z:1});
 const cap=bodyContact(0,5,5,0,-1,5,e,.08);close(cap.y,2);assert.deepEqual(cap.normal,{x:0,y:1,z:0});
 const grazing=bodyContact(.77,1,0,.77,1,10,e,.08);close(Math.hypot(grazing.x-e.x,grazing.z-e.z),.7);close(grazing.y,1);close(Math.hypot(...Object.values(grazing.normal)),1);
 const raised=bodyContact(0,3.8,0,0,3.8,12,{...e,y:3},.08);close(raised.y,3.8);close(raised.z,4.3);
});
test('visual contacts remain finite for inside starts and stationary return weapons',()=>{
 const e=enemy(5);
 for(const end of [[0,1,5],[0,2,5],[0,0,5],[1,1,6]]){
  const c=bodyContact(0,1,5,...end,e,.1);assert(Object.values(c).filter(x=>typeof x==='number').every(Number.isFinite));close(Math.hypot(...Object.values(c.normal)),1);
  assert(Math.abs(Math.hypot(c.x-e.x,c.z-e.z)-.7)<1e-7||c.y===0||c.y===2,'contact stayed inside the body');
 }
});


test('legacy planar boomerang grazing contact uses the nearest side instead of the back face',()=>{
 const c=bodyContact(.9,1,4,.9,1,6,enemy(5),.08);close(c.x,.7);close(c.z,5);close(c.y,1);assert.deepEqual(c.normal,{x:1,y:0,z:0});
});
