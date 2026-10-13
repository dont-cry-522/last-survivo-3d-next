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
  source.traverse(o=>{if(o.isMesh)before.set(o.name,{geometry:o.geometry,positions:o.geometry.attributes.position.array.slice(),material:o.material});});
  refineLingyaFace(face);face.updateMatrixWorld(true);
  const head=face.getObjectByName('Lingya-head'),eyes=[];face.traverse(o=>{if(o.isMesh&&/Lingya_eye_(white|iris|pupil)/.test(o.material.name))eyes.push(o);});
  assert.equal(eyes.length,3);const ray=new T.Raycaster(),origin=new T.Vector3(),direction=new T.Vector3(0,0,-1);
  const front=(objects,x,y)=>{ray.set(origin.set(x,y,.2),direction);return ray.intersectObjects(objects,false)[0]?.point.z;};
  // Keep the original central open/closed probes and also scan the entire eye,
  // including the lower lid and corners. Do not retreat or hide the eyeballs.
  for(const side of[-1,1])for(const y of[1.620,1.628]){
   head.morphTargetInfluences[0]=0;const opened=front([head],side*.03273,y),eye=front(eyes,side*.03273,y);assert(Number.isFinite(eye));assert(opened===undefined||opened<eye-.005,'remodel blocked the open eye');
   head.morphTargetInfluences[0]=1;const closed=front([head],side*.03273,y);assert(closed>eye,'Blink leaves the authored eye exposed');assert(closed-eye<.006,'lid floats above the authored eye');
  }
  for(const side of[-1,1]){
   let samples=0;head.morphTargetInfluences[0]=1;
   for(let x=.006;x<=.0661;x+=.002)for(let y=1.590;y<=1.6581;y+=.002){
    const eye=front(eyes,side*x,y);if(eye===undefined)continue;
    const lid=front([head],side*x,y);assert(Number.isFinite(lid)&&lid>eye,`Blink exposes the eye at ${side*x},${y}`);samples++;
   }
   assert(samples>500,'eye coverage scan missed part of the actual eye');
  }
  head.morphTargetInfluences[0]=0;
  // Check surface continuity without prescribing a smaller nose, mouth or eye.
  // The multi-angle rendering fixture, not these probes, judges appearance.
  let previous;for(let y=1.542;y<=1.601;y+=.001){const z=front([head],0,y);assert(Number.isFinite(z));if(previous!==undefined)assert(Math.abs(z-previous)<.006,'nose, lips and jaw have a sharp depth discontinuity');previous=z;}
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
