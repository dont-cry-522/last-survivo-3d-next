import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../vendor/three.module.js';
import {installDistantLandscape} from '../environment-lighting.js';
import {biomeAt} from '../confluence.js';

globalThis.document={createElement:()=>({getContext:()=>({fillRect(){}})})};
const down=new T.Vector3(0,-1,0),segments=192;
function setup(id='snow'){
 const world={half:96,group:new T.Group()},ridge=installDistantLandscape(world,id,biomeAt);
 world.group.updateMatrixWorld(true);
 return{world,ridge,dispose(){world.group.traverse(o=>{if(o.isInstancedMesh)o.dispose();if(o.userData.ownedGeometry)o.geometry.dispose();});}};
}
function nativeHits(mesh,ray){const hits=[];T.Mesh.prototype.raycast.call(mesh,ray,hits);return hits.sort((a,b)=>a.distance-b.distance);}
function hitData(hits){return hits.map(h=>({distance:h.distance,point:h.point.toArray(),faceIndex:h.faceIndex,face:{a:h.face.a,b:h.face.b,c:h.face.c,normal:h.face.normal.toArray(),materialIndex:h.face.materialIndex},normal:h.normal?.toArray(),uv:h.uv?.toArray(),barycoord:h.barycoord?.toArray()}));}
function compare(mesh,ray,label){assert.deepEqual(hitData(ray.intersectObject(mesh,false)),hitData(nativeHits(mesh,ray)),label);}
function radialRay(sector,offset=18){const angle=sector/segments*Math.PI*2,s=Math.sin(angle),c=Math.cos(angle),radius=96/Math.max(Math.abs(s),Math.abs(c))+offset;return new T.Raycaster(new T.Vector3(s*radius,200,c*radius),down);}

test('indexed ridge support queries match every native triangle hit at sector boundaries and the closed seam',()=>{
 for(const id of ['forest','coast','confluence']){
  const {ridge,dispose}=setup(id);
  try{
   for(let sector=0;sector<segments;sector+=3)for(const epsilon of [-1e-9,0,1e-9])for(const offset of [5,14,27,42,65,88]){
    compare(ridge,radialRay(sector+epsilon,offset),`${id} sector ${sector} ${epsilon}, radial offset ${offset}`);
   }
   for(const sector of [191.75,191.999999999,192])compare(ridge,radialRay(sector),'last sector/seam');
  }finally{dispose();}
 }
});

test('ridge queries remain equivalent under transformed parents, near/far clipping, and oblique rays',()=>{
 const {world,ridge,dispose}=setup();
 try{
  world.group.position.set(9,2,-7);world.group.rotation.set(.12,.31,-.08);world.group.scale.set(1.3,.85,.76);world.group.updateMatrixWorld(true);
  for(const sector of [0,.25,17.4,69.6,191.9]){
   const local=radialRay(sector),origin=local.ray.origin.clone().applyMatrix4(ridge.matrixWorld),direction=down.clone().transformDirection(ridge.matrixWorld);
   for(const [near,far] of [[0,Infinity],[0,90],[100,180],[180,400]])compare(ridge,new T.Raycaster(origin,direction,near,far),'transformed local vertical');
   for(const slant of [.0001,.025,.3]){
    const direction=new T.Vector3(slant,-1,-slant*.7).normalize().transformDirection(ridge.matrixWorld);
    compare(ridge,new T.Raycaster(origin,direction),'native oblique fallback');
   }
  }
 }finally{dispose();}
});

test('query acceleration preserves draw ranges, including when the underlying intersection throws',t=>{
 const {ridge,dispose}=setup(),ray=radialRay(25.4);
 try{
  for(const [start,count] of [[0,Infinity],[3,18426],[1200,300],[9600,300],[0,0]]){
   ridge.geometry.setDrawRange(start,count);compare(ridge,ray,'caller draw range');assert.deepEqual(ridge.geometry.drawRange,{start,count});
  }
  ridge.geometry.setDrawRange(3,18426);
  const mock=t.mock.method(ridge.geometry.index,'getX',()=>{throw new Error('intersection interrupted');});
  assert.throws(()=>ray.intersectObject(ridge,false),/intersection interrupted/);
  assert.deepEqual(ridge.geometry.drawRange,{start:3,count:18426});mock.mock.restore();
  compare(ridge,ray,'query after interruption');
 }finally{dispose();}
});

test('a normal support ray tests 96 existing triangles instead of the complete 6144, without changing geometry',t=>{
 const {ridge,dispose}=setup(),ray=radialRay(25.4),position=ridge.geometry.attributes.position,index=ridge.geometry.index;
 const native=T.Ray.prototype.intersectTriangle;let calls=0;
 const mock=t.mock.method(T.Ray.prototype,'intersectTriangle',function(...args){calls++;return native.apply(this,args);});
 try{
  const expected=hitData(nativeHits(ridge,ray)),fullCalls=calls;calls=0;
  assert.deepEqual(hitData(ray.intersectObject(ridge,false)),expected);
  assert.equal(fullCalls,6144);assert.equal(calls,96);assert.equal(ridge.geometry.attributes.position,position);assert.equal(ridge.geometry.index,index);
  assert.equal(index.count/3,6144);assert.deepEqual(ridge.geometry.drawRange,{start:0,count:Infinity});
 }finally{mock.mock.restore();dispose();}
});
