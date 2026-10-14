import test from 'node:test';
import assert from 'node:assert/strict';
import {buildWorld} from '../world.js';
import {roadDistance} from '../confluence.js';
import {waterDepth} from '../water.js';

globalThis.document={createElement:()=>({getContext:()=>({fillRect(){}})})};
const release=w=>w.group.traverse(o=>{if(o.isInstancedMesh)o.dispose();if(o.userData.ownedGeometry)o.geometry.dispose();});
const trees=w=>w.obstacles.filter(o=>o.mesh.userData.treeBiome==='forest');
function bank(w,o){
 let distance=Infinity,side=0;
 for(const p of w.ponds.filter(p=>p.biome==='forest')){
  const c=Math.cos(p.angle),s=Math.sin(p.angle),dx=o.x-p.x,dz=o.z-p.z,u=c*dx-s*dz,v=s*dx+c*dz;
  const d=Math.max(0,Math.hypot(u/p.rx,v/p.rz)-1)*p.rx;
  if(d<distance){distance=d;side=Math.sign(u);}
 }
 return{distance,side};
}

test('existing forest trees form staggered groves on both banks, within the old candidate budget and clearances',()=>{
 for(const id of ['forest','confluence'])for(const seed of [7,19,522,43837033]){
  const w=buildWorld(id,seed);
  try{
   const list=trees(w),near=list.map(o=>bank(w,o)).filter(b=>b.distance<10);
   assert(near.length>=24,`${id} ${seed} leaves the river in an open field`);
   for(const side of [-1,1])assert(near.filter(b=>b.side===side).length>=8,'one bank has no meaningful grove');
   assert(list.length<=(id==='forest'?300:850),'tree candidate budget expanded');
   for(const o of list){
    assert(Math.abs(o.x)<w.half&&Math.abs(o.z)<w.half,'tree outside the playable bounds');
    assert.equal(o.r,id==='forest'?.65:.7,'root collision radius changed');
    assert(Math.hypot(o.x-w.spawn.x,o.z-w.spawn.z)>=7,'spawn blocked');
    assert(w.sites.every(s=>Math.hypot(o.x-s.x,o.z-s.z)>=(id==='confluence'?11:s.event?9:7)),'reward approach blocked');
    if(id==='confluence')assert(roadDistance(o.x,o.z)>=5.8,'main road blocked');
    else assert(Math.abs(o.x-o.z)>=3&&Math.abs(o.x+o.z)>=3,'existing forest diagonal lane blocked');
    const wet=w.ponds.some(p=>waterDepth(id==='forest'?{...p,rx:p.rx+1.2,rz:p.rz+1.2,r:p.r+1.2}:{...p,rx:p.rx*1.4,rz:p.rz*1.4,r:p.r*1.4},o.x,o.z)>0);
    assert(!wet,'tree entered protected water/bank clearance');
   }
   if(id==='forest'){
    assert.equal(w.groves.length,22);
    for(let i=0;i<4;i++)assert.deepEqual(w.groves[i],{x:w.spawn.x+Math.sin(i*1.9+.4)*16,z:w.spawn.z+Math.cos(i*1.9+.4)*16},'original spawn grove moved');
   }
  }finally{release(w);}
 }
});

test('riverbank tree layout remains deterministic with distinct seeded layouts',()=>{
 for(const id of ['forest','confluence']){
  const a=buildWorld(id,522),b=buildWorld(id,522),c=buildWorld(id,19);
  const signature=w=>trees(w).map(o=>[o.x,o.z,o.r]);
  try{assert.deepEqual(signature(a),signature(b));assert.notDeepEqual(signature(a),signature(c));}
  finally{release(a);release(b);release(c);}
 }
});
