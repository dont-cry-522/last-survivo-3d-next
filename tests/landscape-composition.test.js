import test from'node:test';
import assert from'node:assert/strict';
import * as T from'../vendor/three.module.js';
import{installDistantLandscape}from'../environment-lighting.js';
import{buildWorld}from'../world.js';
import{biomeAt}from'../confluence.js';

globalThis.document={createElement:()=>({getContext:()=>({fillRect(){}})})};
const release=world=>world.group.traverse(o=>{if(o.isInstancedMesh)o.dispose();if(o.userData.ownedGeometry)o.geometry.dispose();});

test('slope finishes carry normalized climate weights and fade on the far range without extra draws',()=>{
 let shared;
 for(const id of ['forest','snow','ash','sand','coast','confluence']){
  const world={half:96,group:new T.Group()},mesh=installDistantLandscape(world,id,biomeAt),g=mesh.geometry,w=g.attributes.ridgeClimate,l=g.attributes.ridgeLayer;
  if(shared)assert.equal(mesh.material,shared);shared=mesh.material;
  assert.equal(w.count,g.attributes.position.count);assert.equal(l.count,w.count);assert.equal(g.groups.length,0);assert.equal(g.index.count/3,6144);
  const seen=new Set();let blended=0;
  for(let i=0;i<w.count;i++){
   const weights=[w.getX(i),w.getY(i),w.getZ(i),w.getW(i)],total=weights.reduce((a,b)=>a+b,0);
   assert(weights.every(n=>Number.isFinite(n)&&n>=0&&n<=1)&&total<=1.000001);
   if(weights.filter(n=>n>0).length>1)blended++;
   weights.concat(Math.max(0,1-total)).forEach((n,k)=>{if(n>.01)seen.add(k);});
   assert(l.getX(i)>=0&&l.getX(i)<=(i<193*9?1:.281));
   if(i%9===0)assert.equal(l.getX(i),0,'detail must join the old foothill edge without a seam');
  }
  assert.equal(seen.size,id==='confluence'?5:1);if(id==='confluence')assert(blended>0,'joined regions lost their blended slope finish');
  release(world);
 }
});

test('broad distant ranges rise above foothills at eye level and retain substantial low passes',()=>{
 const rows=9,segments=192,ringSize=(segments+1)*rows;
 for(const id of['forest','snow','ash','sand','coast']){
  const world={half:96,group:new T.Group()},mesh=installDistantLandscape(world,id),p=mesh.geometry.attributes.position;
  const heights=[[],[]],elevations=[[],[]];
  for(let i=0;i<segments;i++){
   const radius=k=>Math.hypot(p.getX(k),p.getZ(k)),near=i*rows,far=ringSize+near;
   assert(radius(far)<radius(near+rows-1),id+' has an unsupported gap between near and far slopes');
   const edge=96/Math.max(Math.abs(Math.sin(i/segments*Math.PI*2)),Math.abs(Math.cos(i/segments*Math.PI*2)));
   assert(radius(far+rows-1)-edge>60,id+' far range is still a narrow strip immediately behind the foothills');
   for(let ring=0;ring<2;ring++){
    const top=ring*ringSize+near+rows-1,h=p.getY(top);heights[ring].push(h);elevations[ring].push(Math.atan2(h-1.65,radius(top)));
   }
  }
  const nearPeak=Math.max(...heights[0]),farPeak=Math.max(...heights[1]);
  assert(farPeak>nearPeak*1.6,id+' distant massif has no scale contrast');
  assert(Math.max(...elevations[1])>Math.max(...elevations[0])+Math.PI/60,id+' far peaks do not emerge above the foothills at eye level');
  assert(heights[1].filter(y=>y<farPeak*.3).length>=15,id+' skyline closes into a uniformly high bowl');
  release(world);
 }
});

test('the real harbor bay stays open through the far range on standalone and confluence maps',()=>{
 for(const id of['coast','confluence'])for(const seed of[7,522,43837033]){
  const world=buildWorld(id,seed),ridge=installDistantLandscape(world,id,biomeAt),bay=world.harborBay;
  assert(bay?.boats.length===2,'landscape change lost the existing offshore water or sailboats');
  ridge.updateWorldMatrix(true,false);const ray=new T.Raycaster(new T.Vector3(),new T.Vector3(0,-1,0),0,400);
  const s=Math.sin(bay.angle),c=Math.cos(bay.angle),edge=world.half/Math.max(Math.abs(s),Math.abs(c));
  for(const offset of[44,51,58]){
   ray.ray.origin.set(s*(edge+offset),200,c*(edge+offset));const hit=ray.intersectObject(ridge,false)[0];
   assert(hit&&hit.point.y<bay.y,id+' new far range blocks the water-facing opening');
  }
  release(world);
 }
});
