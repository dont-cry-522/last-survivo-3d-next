import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../vendor/three.module.js';
import {restSurface} from '../hero-rest-surface.js';

test('rest fitting keeps exact front/back triangle depths, holes, boundaries and rest transforms',()=>{
 const geometries=[new T.SphereGeometry(.18,48,32),new T.TorusGeometry(.14,.035,16,40).toNonIndexed()];
 const transforms=[new T.Matrix4(),new T.Matrix4().compose(new T.Vector3(.015,1.61,-.03),new T.Quaternion().setFromEuler(new T.Euler(.15,-.24,.07)),new T.Vector3(-1.1,.86,1.06))];
 const material=new T.MeshBasicMaterial({side:T.DoubleSide}),ray=new T.Raycaster();let checked=0,hits=0;
 for(const geometry of geometries)for(const transform of transforms){
  const before=geometry.attributes.position.array.slice(),index=geometry.index?.array.slice(),sample=restSurface(geometry,transform),probe=new T.Mesh(geometry,material);
  probe.matrixAutoUpdate=false;probe.matrix.copy(transform);probe.updateMatrixWorld(true);
  assert.strictEqual(restSurface(geometry,transform.clone()),sample);
  const bounds=new T.Box3().setFromObject(probe),size=bounds.getSize(new T.Vector3());
  for(let row=-1;row<=24;row++)for(let col=-1;col<=24;col++)for(const front of[true,false]){
   const x=bounds.min.x+size.x*col/23,y=bounds.min.y+size.y*row/23;
   ray.set(new T.Vector3(x,y,front?1:-1),new T.Vector3(0,0,front?-1:1));
   const old=ray.intersectObject(probe,false)[0],actual=sample(x,y,front);checked++;
   assert.equal(!!actual,!!old,`changed hit coverage at ${x},${y},${front}`);
   if(old){hits++;assert(actual.point.distanceTo(old.point)<1e-7,'rest sampler changed the authored surface');}
  }
  assert.deepEqual(geometry.attributes.position.array,before);assert.deepEqual(geometry.index?.array,index);
 }
 assert(checked>5000&&hits>1500);geometries.forEach(g=>g.dispose());material.dispose();
});

test('candidate buckets reduce exact triangle work without bypassing drawRange or nearest surfaces',()=>{
 const geometry=new T.PlaneGeometry(.4,.4,80,80),p=geometry.attributes.position;
 for(let i=0;i<p.count;i++)p.setZ(i,.08+Math.sin(p.getX(i)*24)*Math.cos(p.getY(i)*19)*.015);
 geometry.computeBoundingSphere();const sample=restSurface(geometry),material=new T.MeshBasicMaterial({side:T.DoubleSide}),probe=new T.Mesh(geometry,material),ray=new T.Raycaster();probe.updateMatrixWorld(true);
 const original=T.Ray.prototype.intersectTriangle;let calls=0;
 try{
  T.Ray.prototype.intersectTriangle=function(...args){calls++;return original.apply(this,args);};
  let brute=0,fast=0;
  for(let i=0;i<37;i++){
   const x=-.19+i*.0102,y=Math.sin(i*1.37)*.18;ray.set(new T.Vector3(x,y,1),new T.Vector3(0,0,-1));
   calls=0;const old=ray.intersectObject(probe,false)[0];brute+=calls;
   calls=0;const actual=sample(x,y);fast+=calls;assert(actual.point.distanceTo(old.point)<1e-8);
  }
  assert(fast<brute*.02,`candidate work was ${fast}/${brute} triangle tests`);
 }finally{T.Ray.prototype.intersectTriangle=original;}
 const partial=geometry.clone();partial.setDrawRange(0,geometry.index.count/2);const limited=restSurface(partial),part=new T.Mesh(partial,material);part.updateMatrixWorld(true);
 for(const y of[-.15,.15]){ray.set(new T.Vector3(.013,y,1),new T.Vector3(0,0,-1));assert.equal(!!limited(.013,y),!!ray.intersectObject(part,false)[0]);}
 geometry.dispose();partial.dispose();material.dispose();
});
