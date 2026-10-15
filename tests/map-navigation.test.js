import {test} from 'node:test';import assert from 'node:assert/strict';
import {createExploration} from '../map-exploration.js';
import {knownMapPoints,mapWaypoint,waypointHint,drawMapObstacles} from '../map-navigation.js';

test('small-map obstacles reuse pixels, invalidate destroyed trees and preserve the detailed vector map',()=>{
 const original=globalThis.document,paint=[],copies=[],layer={clearRect(){paint.length=0;},fillRect(...p){paint.push(p);}},canvas={getContext:()=>layer};
 globalThis.document={createElement:()=>canvas};
 try{
  const context={drawImage:c=>copies.push(c),fillRect:(...p)=>copies.push(p)},world={obstacles:[{x:3,z:4},{x:-3,z:0}]};
  drawMapObstacles(context,world,.5);assert.deepEqual(paint,[[73.5,74,1.5,1.5],[70.5,72,1.5,1.5]]);
  const list=world.obstacles;let iterations=0;
  list[Symbol.iterator]=function*(){iterations++;yield* [this[0],this[1]];};
  for(let i=0;i<100;i++)drawMapObstacles(context,world,.5);
  assert.equal(iterations,0,'stationary scenery must not be traversed on each HUD redraw');
  world.obstacles=[{x:0,z:2},{x:1,z:2}];drawMapObstacles(context,world,.5);
  assert.deepEqual(paint,[[72,73,1.5,1.5],[72.5,73,1.5,1.5]],'same-length replacement must invalidate');
  world.obstacles.push({x:4,z:2});drawMapObstacles(context,world,.5);assert.equal(paint.length,3);
  drawMapObstacles(context,world,1);assert.deepEqual(paint[2],[76,74,1.5,1.5]);
  const before=copies.length;drawMapObstacles(context,world,1,true);assert.equal(copies.length-before,3);assert.deepEqual(copies.at(-1),[76,74,1.5,1.5]);
  const next={obstacles:[]};drawMapObstacles(context,next,.5);assert.notEqual(next.obstacleMap,world.obstacleMap);assert.equal(paint.length,0);
 }finally{if(original===undefined)delete globalThis.document;else globalThis.document=original;}
});
test('map list and waypoint selection respect both discovery and exploration',()=>{
 const w={exploration:createExploration(140),sites:[{x:0,z:0,type:'relic',discovered:true},{x:2,z:0,type:'altar',discovered:false},{x:90,z:90,type:'heal',discovered:true}],discoveries:[],roaming:[]};
 assert.equal(knownMapPoints(w).length,0);assert.equal(mapWaypoint(w,0,0),null);w.exploration.reveal(0,0);
 assert.equal(knownMapPoints(w).length,1);assert.equal(mapWaypoint(w,1,1).name,'遗物遗迹');assert.equal(mapWaypoint(w,90,90),null);assert.equal(mapWaypoint(w,141,0),null);
 w.sites[0].claimed=true;assert.equal(knownMapPoints(w)[0].done,true);w.exploration=createExploration(140,'visible');assert.equal(knownMapPoints(w).length,2,'full terrain does not reveal undiscovered events');
 w.roaming=[{x:0,z:0,kind:'courier',discovered:true,state:'escaped'}];assert.equal(knownMapPoints(w).length,2);
});
test('waypoint directions match the diagonal gameplay camera',()=>{
 const p={x:0,z:0};assert(waypointHint(p,{x:-10,z:-10,name:'营地'}).startsWith('↑'));assert(waypointHint(p,{x:10,z:-10,name:'营地'}).startsWith('→'));assert(waypointHint(p,{x:10,z:10,name:'营地'}).startsWith('↓'));assert(waypointHint(p,{x:-10,z:10,name:'营地'}).startsWith('←'));assert.equal(waypointHint(p,null),'');
});

test('waypoint bearing follows a freely rotated camera',()=>{
 const p={x:0,z:0},point={x:0,z:5,name:'Ahead'};
 assert(waypointHint(p,point,0).startsWith('↑'));
 assert(waypointHint(p,point,Math.PI/2).startsWith('→'));
 assert(waypointHint(p,point,Math.PI).startsWith('↓'));
});
