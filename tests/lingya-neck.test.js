import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import * as T from '../vendor/three.module.js';
const worldURL=new URL('../world.js',import.meta.url),entry=fs.readFileSync(worldURL,'utf8').match(/from['"](.\/skinned-hero\.js[^'"]*)['"]/)[1];
const {loadHeroAssets,createSkinnedHero,animateSkinnedHero,disposeHero}=await import(new URL(entry,worldURL));

test('Lingya neck stays with the collar while the same face follows Head, Blink and independent actor lifetimes',async()=>{
 const saved=Object.fromEntries(['fetch','self','ProgressEvent','createImageBitmap'].map(k=>[k,globalThis[k]]));let a,b;
 try{
  globalThis.self=globalThis;globalThis.ProgressEvent=class{constructor(type,data){Object.assign(this,data);}};globalThis.createImageBitmap=async()=>({width:512,height:512,close(){}});
  globalThis.fetch=async input=>{const url=typeof input==='string'?input:input.url;return url.startsWith('file:')?new Response(fs.readFileSync(fileURLToPath(url))):saved.fetch(input);};
  await loadHeroAssets();a=createSkinnedHero('lingya','boomerang');b=createSkinnedHero('lingya','boomerang');
  const head=a.userData.face.getObjectByName('Lingya-head'),other=b.userData.face.getObjectByName('Lingya-head'),g=head.geometry,p=g.attributes.position,w=g.attributes.skinWeight,ids=g.attributes.skinIndex;
  assert(head.isSkinnedMesh);assert.equal(head.skeleton,a.userData.model.skeleton);assert.equal(head.geometry,other.geometry);assert.notEqual(head.skeleton,other.skeleton);assert.notEqual(head.morphTargetInfluences,other.morphTargetInfluences);
  assert.equal(head.morphTargetDictionary.Blink,0);assert.equal(g.morphAttributes.position[0].count,p.count);assert.equal(g.morphAttributes.normal[0].count,p.count);
  const spine=head.skeleton.bones.find(b=>b.name==='spine_03'),headBone=a.userData.swimHead,low=[],high=[];
  for(let i=0;i<p.count;i++){
   assert(Math.abs(w.getX(i)+w.getY(i)+w.getZ(i)+w.getW(i)-1)<1e-6);
   for(let k=0;k<4;k++)assert(ids.array[i*4+k]<head.skeleton.bones.length);
   if(p.getY(i)<=1.435)low.push(i);if(p.getY(i)>=1.55)high.push(i);
  }
  assert(low.length>12&&high.length>100,'probe must cover the neck ring and actual upper face');
  const point=new T.Vector3(),relative=(mesh,i,bone)=>{mesh.getVertexPosition(i,point).applyMatrix4(mesh.matrixWorld);return bone.worldToLocal(point.clone());};
  a.updateMatrixWorld(true);const lowerRest=low.map(i=>relative(head,i,spine)),upperRest=high.filter((_,i)=>i%17===0).map(i=>[i,relative(head,i,headBone)]),positions=p.array.slice(),normals=g.attributes.normal.array.slice();
  const poseB=other.skeleton.bones.map(b=>b.quaternion.toArray());
  // Exercise the actual locomotion / cast / companion glance path, then add a
  // deliberate head turn to catch rigid-parent or double-transform regressions.
  for(let frame=0;frame<90;frame++){
   const d=a.userData;d.aimActive=frame>20;d.reloadDuration=2/3;d.reloadPhase=(frame%40)/40;d.shotSerial=1+Math.floor(frame/40);d.attackAge=(frame%40)/60;d.companionAngle=.4;d.turnRate=Math.sin(frame/12);
   animateSkinnedHero(a,frame/60,frame<55?4:0,frame%40<8?.25:0,0);d.swimHead.rotateY(.4);d.swimHead.rotateX(.18);
   head.morphTargetInfluences[0]=0;a.updateMatrixWorld(true);
   low.forEach((i,n)=>assert(relative(head,i,spine).distanceTo(lowerRest[n])<1e-5,'head movement dragged the collar ring'));
   for(const[i,rest]of upperRest)assert(relative(head,i,headBone).distanceTo(rest)<1e-5,'upper face detached from Head and eyes');
  }
  assert.deepEqual(p.array,positions);assert.deepEqual(g.attributes.normal.array,normals);assert.deepEqual(other.skeleton.bones.map(b=>b.quaternion.toArray()),poseB);
  head.morphTargetInfluences[0]=1;assert.equal(other.morphTargetInfluences[0],0);a.updateMatrixWorld(true);
  for(let i=0;i<p.count;i+=23)assert(head.getVertexPosition(i,point).toArray().every(Number.isFinite));
  let disposed=0;g.addEventListener('dispose',()=>disposed++);disposeHero(a);a=null;assert.equal(disposed,0,'shared face geometry was freed while another actor uses it');
  animateSkinnedHero(b,.2,3,.2,0);b.updateMatrixWorld(true);for(let i=0;i<p.count;i+=23)assert(other.getVertexPosition(i,point).toArray().every(Number.isFinite));
 }finally{if(a)disposeHero(a);if(b)disposeHero(b);for(const[k,v]of Object.entries(saved))if(v===undefined)delete globalThis[k];else globalThis[k]=v;}
});
