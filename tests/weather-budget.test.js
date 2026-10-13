import{test}from'node:test';
import assert from'node:assert/strict';
import{buildWorld,animateWorld}from'../world.js';
import{biomeWeights,REGIONS}from'../confluence.js';

globalThis.document={createElement:()=>({width:256,height:256,getContext:()=>({fillRect(){}})})};
const dispose=w=>w.group.traverse(o=>{if(o.isInstancedMesh)o.dispose();if(o.userData.ownedGeometry)o.geometry.dispose();});
function stillParticles(w,x,z){for(const r of w.regions)for(const p of r.weather.particles)Object.assign(p,{x,z,y:2,life:10,vx:0,vy:0,vz:0});}

test('zero-contribution weather skips soil samples, repeated matrix uploads and the empty batch draw',()=>{
 const w=buildWorld('confluence',522),focus={x:-72,z:20};let samples=0;
 try{
  stillParticles(w,focus.x,focus.z);w.groundHeightAt=()=>{samples++;return .8;};
  animateWorld(w,0,focus.x,focus.z);
  const total=w.regions.reduce((n,r)=>n+r.weather.particles.length,0),visible=w.regions.find(r=>r.id==='forest').weather.particles.length;
  assert.equal(total,252);assert.equal(visible,42);assert.equal(samples,visible);
  const versions=w.regions.map(r=>r.weather.mesh.instanceMatrix.version);samples=0;
  animateWorld(w,.04,focus.x,focus.z);
  assert.equal(samples,visible,'invisible weather still samples the terrain');
  for(const [i,r]of w.regions.entries()){
   const shown=r.id==='forest';assert.equal(r.weather.mesh.visible,shown);
   assert.equal(r.weather.mesh.instanceMatrix.version,versions[i]+Number(shown),'hidden batch re-uploaded unchanged matrices');
   assert(r.weather.particles.every(p=>p.life===9.96),'culling paused particle simulation');
  }
 }finally{dispose(w);}
});

test('weather uses each particle climate weight, including the visible edge of a zero-weight player region',()=>{
 const w=buildWorld('confluence',7),focus={x:-60,z:-40},r=w.regions.find(r=>r.id==='forest'),weather=r.weather;
 try{
  assert.equal(biomeWeights(focus.x,focus.z).forest,0);stillParticles(w,focus.x,focus.z);
  animateWorld(w,0,focus.x,focus.z);assert.equal(weather.mesh.visible,false);
  const p=weather.particles[0];p.z=-30;
  const weight=biomeWeights(p.x,p.z).forest;assert(weight>0&&weight<1);
  assert(Math.hypot(p.x-focus.x,p.z-focus.z)<30);
  animateWorld(w,.04,focus.x,focus.z);
  assert.equal(weather.mesh.visible,true);assert.equal(weather.hidden[0],0);
  const matrix=weather.mesh.matrix.clone();weather.mesh.getMatrixAt(0,matrix);
  const expected=p.scale*.8*weight*(.84+.16*Math.sin(.04*1.8+p.phase));
  assert(Math.abs(Math.hypot(...matrix.elements.slice(0,3))-expected)<1e-6,'boundary fade was removed');
  p.z=focus.z;animateWorld(w,.08,focus.x,focus.z);weather.mesh.getMatrixAt(0,matrix);
  assert.equal(weather.mesh.visible,false);assert.equal(weather.hidden[0],1);
  assert.equal(Math.hypot(...matrix.elements.slice(0,3)),0,'old visible instance remains after leaving its region');
 }finally{dispose(w);}
});

test('weather culling preserves seeded motion and renewal across all regions, and restores current visible matrices',()=>{
 const w=buildWorld('confluence',91),reference=buildWorld('confluence',91);
 // The same simulation with rendering weights disabled is an uncullable control.
 for(const r of reference.regions)r.regional=false;
 const seen=new Set();
 try{
  for(let frame=0;frame<180;frame++){
   const focus=REGIONS[Math.floor(frame/36)],time=frame/30;
   animateWorld(w,time,focus.x,focus.z);animateWorld(reference,time,focus.x,focus.z);
   for(let region=0;region<w.regions.length;region++){
    const a=w.regions[region].weather,b=reference.regions[region].weather;
    assert.deepEqual(a.particles,b.particles,'culling changed simulation or random renewal');
    if(frame%9)continue;
    const actual=a.mesh.matrix.clone(),expected=actual.clone();
    for(let i=0;i<a.particles.length;i++){
     const p=a.particles[i],weight=biomeWeights(p.x,p.z)[a.kind];if(!weight)continue;
     seen.add(a.kind);a.mesh.getMatrixAt(i,actual);b.mesh.getMatrixAt(i,expected);
     for(let k=0;k<16;k++){
      const value=expected.elements[k]*(k<12&&k%4!==3?weight:1);
      assert(Math.abs(actual.elements[k]-value)<2e-6,'visible weather changed its position, shape or transition weight');
     }
    }
   }
  }
  assert.equal(seen.size,5,'test did not restore every weather layer');
  for(let i=0;i<w.regions.length;i++)assert.equal(w.regions[i].weather.random(),reference.regions[i].weather.random(),'random stream changed');
 }finally{dispose(w);dispose(reference);}
});
