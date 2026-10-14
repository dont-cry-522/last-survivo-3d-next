import test from 'node:test';import assert from 'node:assert/strict';import * as T from '../vendor/three.module.js';
import {actor,animateActor}from'../world.js';
import {enemyCastOrigin,enemyCastFlight}from'../enemy-cast-vfx.js';
test('casts launch from the moving focus and reach the existing delayed ground target',()=>{
 for(const kind of['spitter','icewitch','sandspitter','jellyseer','cinderwisp']){
  const mesh=actor(kind);mesh.position.set(2,1,-3);mesh.rotation.y=.9;animateActor(mesh,.3,1,.25);
  const e={mesh,x:2,y:1,z:-3,tx:-4,tz:7,attackAngle:.9,zone:({icewitch:'frost',sandspitter:'sand',jellyseer:'tide',cinderwisp:'ember'})[kind]||'poison'},events=[];
  const origin=enemyCastOrigin(e),socket=mesh.userData.attackSocket||mesh.userData.focus||mesh.userData.cores?.at(-1);
  if(socket)assert(origin.distanceTo(socket.getWorldPosition(new T.Vector3()))<1e-8);
  enemyCastFlight({particle(...a){events.push(a);}},e,()=>2);
  const flights=events.filter(a=>a[5].life===.75);assert.equal(flights.length,e.zone==='frost'?3:1);assert(events.length<=6);
  for(const[, ,x,y,z,o]of flights){const t=o.life;assert(Math.abs(x+o.velocity[0]*t-e.tx)<1e-8);assert(Math.abs(z+o.velocity[2]*t-e.tz)<1e-8);assert(Math.abs(y+o.velocity[1]*t-.5*o.gravity*t*t-2.15)<1e-8);assert(Math.abs(y-origin.y)<1e-8);}
 }
});
