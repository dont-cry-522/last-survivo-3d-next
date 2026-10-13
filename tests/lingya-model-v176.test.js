import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import * as T from '../vendor/three.module.js';
import {loadCharacterData} from '../character-loader.js';
import {refineLingyaFace,refineLingyaAccessories} from '../lingya-face.js';
import {lingyaAccessories} from '../lingya-appearance.js';

test('source-authored Lingya face retains complete eyelid coverage and shared source isolation',async()=>{
 const saved=Object.fromEntries(['fetch','self','ProgressEvent','createImageBitmap'].map(k=>[k,globalThis[k]]));
 try{
  globalThis.self=globalThis;globalThis.ProgressEvent=class{constructor(type,data){Object.assign(this,data);}};globalThis.createImageBitmap=async()=>({width:512,height:512,close(){}});
  globalThis.fetch=async input=>{const url=typeof input==='string'?input:input.url;return url.startsWith('file:')?new Response(fs.readFileSync(fileURLToPath(url))):saved.fetch(input);};
  const {models}=await loadCharacterData(),source=models['lingya-face'].scene,face=source.clone(true),before=new Map();
  source.traverse(o=>{if(o.isMesh)before.set(o.name,{geometry:o.geometry,positions:o.geometry.attributes.position.array.slice(),colours:o.geometry.attributes.color?.array.slice(),material:o.material});});
  refineLingyaFace(face);face.updateMatrixWorld(true);
  const head=face.getObjectByName('Lingya-head'),eyes=[];face.traverse(o=>{if(o.isMesh&&/Lingya_eye_(white|iris|pupil)/.test(o.material.name))eyes.push(o);});
  const iris=eyes.find(o=>o.material.name==='Lingya_eye_iris'),irisSource=before.get(iris.name).geometry;
  assert(iris.material.vertexColors);assert.equal(iris.geometry.attributes.color.count,iris.geometry.attributes.position.count);assert.notEqual(iris.geometry.attributes.color,irisSource.attributes.color);assert.deepEqual(irisSource.attributes.color?.array,before.get(iris.name).colours,'iris finishing changed the shared source');
  const irisColours=iris.geometry.attributes.color.array;assert(irisColours.every(c=>Number.isFinite(c)&&c>=0&&c<=1));assert(new Set(irisColours).size>20,'iris shading lost its gradient');
  assert.equal(eyes.length,3);const ray=new T.Raycaster(),origin=new T.Vector3(),direction=new T.Vector3(0,0,-1),point=new T.Vector3();
  const eyeBounds=[-1,1].map(side=>{const box=new T.Box3();for(const eye of eyes){const p=eye.geometry.attributes.position;for(let i=0;i<p.count;i++){point.fromBufferAttribute(p,i).applyMatrix4(eye.matrixWorld);if(point.x*side>0)box.expandByPoint(point);}}assert(!box.isEmpty());return box;});
  const rayZ=Math.max(...eyeBounds.map(box=>box.max.z))+.1;
  const front=(objects,x,y)=>{ray.set(origin.set(x,y,rayZ),direction);return ray.intersectObjects(objects,false)[0]?.point.z;};
  // Follow the delivered eyeballs, not the previous model's dimensions. Each
  // projected eye gets the same coverage density, including its rim and corners.
  // Keep the actual eyes in place: a hidden or retreated eyeball cannot pass.
  for(const box of eyeBounds){
   const center=box.getCenter(new T.Vector3()),size=box.getSize(new T.Vector3());
   for(const offset of[-.06,.06]){
    const y=center.y+size.y*offset;
    head.morphTargetInfluences[0]=0;const opened=front([head],center.x,y),eye=front(eyes,center.x,y);assert(Number.isFinite(eye));assert(opened===undefined||opened<eye-.005,'remodel blocked the open eye');
    head.morphTargetInfluences[0]=1;const closed=front([head],center.x,y);assert(closed>eye,'Blink leaves the authored eye exposed');assert(closed-eye<.006,'lid floats above the authored eye');
   }
   const columns=32,rows=32;let samples=0;head.morphTargetInfluences[0]=1;
   for(let column=0;column<columns;column++)for(let row=0;row<rows;row++){
    const x=box.min.x+size.x*(column+.5)/columns,y=box.min.y+size.y*(row+.5)/rows,eye=front(eyes,x,y);if(eye===undefined)continue;
    const lid=front([head],x,y);assert(Number.isFinite(lid)&&lid>eye,`Blink exposes the eye at ${x},${y}`);samples++;
   }
   assert(samples>columns*rows*.5,'eye coverage scan missed the actual projected eye surface');
  }
  head.morphTargetInfluences[0]=0;
  // Check surface continuity without prescribing a smaller nose, mouth or eye.
  // The multi-angle rendering fixture, not these probes, judges appearance.
  // At y=1.545..1.546 the ray grazes the chin underside. Chin/nose-bottom
  // silhouettes can change projected depth quickly without a surface break.
  const normalMatrix=new T.Matrix3().getNormalMatrix(head.matrixWorld);let previous,forwardPairs=0,profileSamples=0;
  for(let y=1.542;y<=1.601;y+=.001){
   ray.set(origin.set(0,y,rayZ),direction);const hit=ray.intersectObject(head,false)[0],z=hit?.point.z;assert(Number.isFinite(z));profileSamples++;
   const forward=hit.face.normal.clone().applyMatrix3(normalMatrix).normalize().z>=.4;
   if(forward&&previous?.forward){assert(Math.abs(z-previous.z)<.006,'forward-facing facial surface has a sharp depth discontinuity');forwardPairs++;}
   previous={z,forward};
  }
  assert(forwardPairs>=profileSamples/2,'profile probe did not cover enough adjoining forward-facing face surfaces');
  face.traverse(o=>{if(!o.isMesh)return;const old=before.get(o.name);assert.notEqual(o.geometry,old.geometry);assert.notEqual(o.material,old.material);assert.equal(o.geometry.attributes.position.count,old.geometry.attributes.position.count);assert.deepEqual(o.geometry.index?.array,old.geometry.index?.array);for(const a of Object.values(o.geometry.attributes))assert(a.array.every(Number.isFinite));});
  source.traverse(o=>{if(o.isMesh)assert.deepEqual(o.geometry.attributes.position.array,before.get(o.name).positions);});
 }finally{for(const [key,value]of Object.entries(saved))if(value===undefined)delete globalThis[key];else globalThis[key]=value;}
});

test('soft ears curve below their roots and the shorter skirt preserves its animated cloth interface',()=>{
 const a=lingyaAccessories(),b=lingyaAccessories();refineLingyaAccessories(a);a.hood.updateMatrixWorld(true);
 for(let i=0;i<2;i++){
  const ear=a.hood.children[i],shell=ear.children[0],lining=ear.children[1],p=shell.geometry.attributes.position;assert.equal(shell.geometry,b.hood.children[i].children[0].geometry);assert.equal(lining.geometry,b.hood.children[i].children[1].geometry);
  shell.geometry.computeBoundingBox();const box=shell.geometry.boundingBox;assert(box.min.y<-.07&&box.max.y<.016,'ear should droop instead of standing like a round badge');assert(box.max.x-box.min.x<.085);assert(box.max.z-box.min.z>.025,'ear needs an actual curved depth profile');for(const attr of Object.values(shell.geometry.attributes))assert(attr.array.every(Number.isFinite));
  assert(ear.position.y<=1.71);assert(p.count<6000,'soft cloth ears must remain small assets');
 }
 const skirt=a.skirt.children[0],g=skirt.geometry;g.computeBoundingBox();assert(g.boundingBox.min.y>.75);assert(g.boundingBox.max.x<.245&&g.boundingBox.min.x>-.245);assert.deepEqual(Object.keys(skirt.userData.cloth).sort(),['hop','motion','time','turn']);assert.notEqual(skirt.material,b.skirt.children[0].material);assert.notEqual(skirt.geometry,b.skirt.children[0].geometry);
});

test('ear lining follows the real curved shell with a narrow, consistently visible seam',()=>{
 const ear=lingyaAccessories().hood.children[1],shell=ear.children[0].clone(),lining=ear.children[1].clone(),ray=new T.Raycaster(),origin=new T.Vector3(),direction=new T.Vector3(0,0,-1);shell.updateMatrixWorld(true);lining.updateMatrixWorld(true);let covered=0;
 for(let y=-.08;y<=.008;y+=.003)for(let x=-.04;x<=.06;x+=.003){
  ray.set(origin.set(x,y,.1),direction);const front=ray.intersectObject(lining)[0];if(!front)continue;
  const cloth=ray.intersectObject(shell)[0];assert(cloth,'ear lining escaped its supporting cloth');const gap=front.point.z-cloth.point.z;
  assert(gap>.0008&&gap<.0016,'closed overlapping shells made the ear lining intersect or float');covered++;
 }
 assert(covered>200,'probe did not cover the visible lining surface');
});
