import test from'node:test';
import assert from'node:assert/strict';
import{buildWorld,clearAt}from'../world.js';
import{installForestVista}from'../forest-vista.js';
import{lobbyLandscape,entryLandscapeYaw}from'../lobby-landscape.js';
import{waterDepth}from'../water.js';
globalThis.document={createElement:()=>({getContext:()=>({fillRect(){}})})};

test('a new expedition faces its nearest scene entrance without changing spawn or reward state',()=>{
 const w={spawn:{x:2,z:3},biomePlaces:[{x:-5,z:3,index:1},{x:22,z:3,index:0},{x:2,z:33,index:0}]},before=JSON.stringify(w);
 assert.equal(entryLandscapeYaw(w),Math.PI/2);assert.equal(JSON.stringify(w),before);
 w.biomePlaces.reverse();assert.equal(entryLandscapeYaw(w),Math.PI/2);
 assert.equal(entryLandscapeYaw({spawn:{x:0,z:0}}),0);
});

test('lobby views use dry clear ground in real maps without changing gameplay or discovery',()=>{
 for(const id of['forest','snow','ash','sand','coast','confluence'])for(const seed of[7,522,43837033]){
  const w=buildWorld(id,seed);installForestVista(w,id);
  const snapshot=()=>JSON.stringify({spawn:w.spawn,obstacles:w.obstacles.map(o=>[o.x,o.z,o.r]),sites:w.sites.map(s=>[s.x,s.z,s.discovered,s.claimed,s.mesh.visible])});
  const before=snapshot(),view=lobbyLandscape(w,id);
  assert.equal(snapshot(),before);assert.deepEqual(lobbyLandscape(w,id),view);
  assert(clearAt(w,view.x,view.z,1.5),id+' viewpoint blocked');
  assert(w.ponds.every(p=>waterDepth(p,view.x,view.z)===0),id+' hero standing in water');
  if(view.focus)for(const d of[2,4,6])assert(clearAt(w,view.x+Math.sin(view.yaw)*d,view.z+Math.cos(view.yaw)*d,1.1),id+' camera foreground blocked');
  assert(Number.isFinite(view.yaw));assert(Math.abs(view.x)<w.half&&Math.abs(view.z)<w.half);
  if(seed===43837033)assert(view.focus,id+' failed to find its real landmark');
 }
});

test('impossible scenic placement falls back to spawn without revealing or moving landmarks',()=>{
 const w={spawn:{x:0,z:0},half:50,obstacles:[],patches:[],ponds:[],districts:[]};
 assert.deepEqual(lobbyLandscape(w,'forest'),{x:0,z:0,yaw:.66,focus:null});
 w.forestVista={gateCenter:{x:30,z:30}};w.obstacles=[{x:30,z:30,r:25}];
 assert.deepEqual(lobbyLandscape(w,'forest'),{x:0,z:0,yaw:.66,focus:null});
});
