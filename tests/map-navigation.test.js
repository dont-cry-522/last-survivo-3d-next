import {test} from 'node:test';import assert from 'node:assert/strict';
import {createExploration} from '../map-exploration.js';
import {knownMapPoints,mapWaypoint,waypointHint} from '../map-navigation.js';
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
