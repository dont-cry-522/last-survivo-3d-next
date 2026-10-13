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
  const head=face.getObjectByName('Lingya-head'),eyes=[];face.traverse(o=>{if(o.isMesh&&/Lingya_eye_brown/.test(o.material.name))eyes.push(o);});
  // The replacement neck is one closed ring extending below the garment.
  // No truncated shoulder triangles or other exposed skin-boundary holes.
  const skinPosition=head.geometry.attributes.position,skinIndices=head.geometry.index.array,edges=new Map();
  for(let i=0;i<skinIndices.length;i+=3)for(let k=0;k<3;k++){const a=skinIndices[i+k],b=skinIndices[i+(k+1)%3],key=a<b?`${a},${b}`:`${b},${a}`;edges.set(key,(edges.get(key)||0)+1);}
  const boundary=[...edges].filter(([,count])=>count===1).map(([key])=>key.split(',').map(Number)),degree=new Map();assert(boundary.length>20);
  for(const edge of boundary)for(const i of edge){assert(Math.abs(skinPosition.getY(i)-1.425)<1e-5,'skin has an exposed cut above the neckline');degree.set(i,(degree.get(i)||0)+1);}
  assert([...degree.values()].every(n=>n===2),'neck boundary is not a complete ring');
  assert.equal(eyes.length,1,'use the native textured eye surface, not detached iris cards');
  assert(eyes[0].material.map,'authored brown eye texture was lost');
  const ray=new T.Raycaster(),origin=new T.Vector3(),direction=new T.Vector3(0,0,-1),point=new T.Vector3();
  const eyeBounds=[-1,1].map(side=>{const box=new T.Box3();for(const eye of eyes){const p=eye.geometry.attributes.position;for(let i=0;i<p.count;i++){point.fromBufferAttribute(p,i).applyMatrix4(eye.matrixWorld);if(point.x*side>0)box.expandByPoint(point);}}assert(!box.isEmpty());return box;});
  const rayZ=Math.max(...eyeBounds.map(box=>box.max.z))+.1;
  const front=(objects,x,y)=>{ray.set(origin.set(x,y,rayZ),direction);return ray.intersectObjects(objects,false)[0]?.point.z;};
  // Test the actual existing Blink contract: connected skin lid closes while
  // the native eye aperture contracts and its attachment retreats by 8 mm.
  // Eye meshes stay present; hiding them is not a substitute for skin coverage.
  const setBlink=value=>{head.morphTargetInfluences[0]=value;for(const eye of eyes){eye.morphTargetInfluences[0]=value;eye.position.z=-.008*value;}face.updateMatrixWorld(true);};
  for(const box of eyeBounds){
   setBlink(0);const center=box.getCenter(new T.Vector3()),size=box.getSize(new T.Vector3());
   for(const offset of[-.06,.06]){
    const y=center.y+size.y*offset,opened=front([head],center.x,y),eye=front(eyes,center.x,y);assert(Number.isFinite(eye));assert(opened===undefined||opened<eye-.005,'remodel blocked the open eye');
   }
  }
  setBlink(1);
  for(const side of[-1,1]){
   const box=new T.Box3();for(const eye of eyes)for(let i=0;i<eye.geometry.attributes.position.count;i++){eye.getVertexPosition(i,point).applyMatrix4(eye.matrixWorld);if(point.x*side>0)box.expandByPoint(point);}
   const size=box.getSize(new T.Vector3()),center=box.getCenter(new T.Vector3());assert(size.y>0&&eyes.every(e=>e.visible),'Blink hid the eye instead of covering it');
   const columns=32,rows=32;let samples=0;
   for(let column=0;column<columns;column++)for(let row=0;row<rows;row++){
    const x=box.min.x+size.x*(column+.5)/columns,y=box.min.y+size.y*(row+.5)/rows,eye=front(eyes,x,y);if(eye===undefined)continue;
    const lid=front([head],x,y);assert(Number.isFinite(lid)&&lid>eye,`Blink exposes the eye at ${x},${y}`);if(Math.abs(x-center.x)<size.x*.18&&Math.abs(y-center.y)<size.y*.18)assert(lid-eye<.008,'central closed lid floats above the front of its eye');samples++;
   }
   assert(samples>columns*rows*.5,'eye coverage scan missed the actual projected eye surface');
  }
  setBlink(0);
  // Check surface continuity without prescribing a smaller nose, mouth or eye.
  // The multi-angle rendering fixture, not these probes, judges appearance.
  // At y=1.545..1.546 the ray grazes the chin underside. Chin/nose-bottom
  // silhouettes can change projected depth quickly without a surface break.
  const normalMatrix=new T.Matrix3().getNormalMatrix(head.matrixWorld);let previous,forwardPairs=0,profileSamples=0;
  for(let y=1.542;y<=1.601;y+=.0002){
   ray.set(origin.set(0,y,rayZ),direction);const hit=ray.intersectObject(head,false)[0],z=hit?.point.z;assert(Number.isFinite(z));profileSamples++;
   const forward=hit.face.normal.clone().applyMatrix3(normalMatrix).normalize().z>=.4;
   if(forward&&previous?.forward){assert(Math.abs(z-previous.z)<.006,`forward-facing facial surface has a sharp depth discontinuity at ${y}: ${previous.z} to ${z}`);forwardPairs++;}
   previous={z,forward};
  }
  assert(forwardPairs>=profileSamples/2,'profile probe did not cover enough adjoining forward-facing face surfaces');
  face.traverse(o=>{if(!o.isMesh)return;const old=before.get(o.name);assert.notEqual(o.geometry,old.geometry);assert.notEqual(o.material,old.material);assert.equal(o.geometry.attributes.position.count,old.geometry.attributes.position.count);assert.deepEqual(o.geometry.index?.array,old.geometry.index?.array);for(const a of Object.values(o.geometry.attributes))assert(a.array.every(Number.isFinite));});
  source.traverse(o=>{if(o.isMesh)assert.deepEqual(o.geometry.attributes.position.array,before.get(o.name).positions);});
 }finally{for(const [key,value]of Object.entries(saved))if(value===undefined)delete globalThis[key];else globalThis[key]=value;}
});

test('redesigned woodland outfit drops ear covers and preserves the small satchel and animated hem',()=>{
 const a=lingyaAccessories(),b=lingyaAccessories();refineLingyaAccessories(a);
 assert.equal(a.hood.children.length,0,'the old round ear covers must not return');
 for(const part of ['hood','chest','bag','skirt'])assert(a[part]?.isGroup);
 const skirt=a.skirt.children[0],g=skirt.geometry;g.computeBoundingBox();assert(g.boundingBox.min.y>.78);assert(g.boundingBox.max.x<.215&&g.boundingBox.min.x>-.215);
 assert.deepEqual(Object.keys(skirt.userData.cloth).sort(),['hop','motion','time','turn']);assert.notEqual(skirt.material,b.skirt.children[0].material);assert.notEqual(skirt.geometry,b.skirt.children[0].geometry);
 a.bag.updateMatrixWorld(true);const box=new T.Box3().setFromObject(a.bag);assert(box.getSize(new T.Vector3()).x<.21,'satchel must remain smaller than the torso');
});
