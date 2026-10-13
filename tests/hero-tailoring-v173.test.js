import test,{before} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import * as T from '../vendor/three.module.js';
import {clone} from '../vendor/SkeletonUtils.js';
import {loadCharacterData} from '../character-loader.js';
import {rebuildRanger} from '../ranger-rebuild.js';
import {rebuildShadowTide} from '../shadow-tide-rebuild.js';
let assets,clips;
before(async()=>{
 const saved=Object.fromEntries(['fetch','self','ProgressEvent','createImageBitmap'].map(k=>[k,globalThis[k]]));
 try{
  globalThis.self=globalThis;globalThis.ProgressEvent=class{constructor(type,data){Object.assign(this,data);}};globalThis.createImageBitmap=async()=>({width:512,height:512,close(){}});
  globalThis.fetch=async input=>{const url=typeof input==='string'?input:input.url;return url.startsWith('file:')?new Response(fs.readFileSync(fileURLToPath(url))):saved.fetch(input);};
  const data=await loadCharacterData();assets=data.models;clips=data.clips;
 }finally{for(const [key,value]of Object.entries(saved))if(value===undefined)delete globalThis[key];else globalThis[key]=value;}
});

function contactCheck(attachment,surfaces){
 const mat=new T.MeshBasicMaterial({side:T.DoubleSide}),probes=surfaces.map(o=>{const m=new T.Mesh(o.geometry,mat);m.updateMatrixWorld(true);return m;}),p=attachment.geometry.attributes.position,ray=new T.Raycaster(),gaps=[];
 for(let i=0;i<p.count;i++){
  ray.set(new T.Vector3(p.getX(i),p.getY(i),1),new T.Vector3(0,0,-1));const hit=ray.intersectObjects(probes,false)[0];assert(hit,attachment.name+' extends beyond its supporting garment at '+[p.getX(i),p.getY(i)].join(','));
  const gap=p.getZ(i)-hit.point.z;assert(gap>=.0003&&gap<.018,attachment.name+' is buried in cloth or floats: '+gap);gaps.push(gap);
 }
 mat.dispose();return Math.max(...gaps);
}

test('ranger shoulder patches and straps stay on their actual curved coats without guessed-depth corners',()=>{
 for(const kind of['scout','silver']){
  const root=clone(assets[kind+'-outfit'].scene);rebuildRanger(root,kind);const body=root.getObjectByName('SM_Hero_Body_'+kind);
  for(const part of['Harness','ShoulderYoke'])contactCheck(root.getObjectByName('SM_Hero_'+part+'_'+kind),[body]);
 }
});

test('tide harness follows actual jacket and vest, and bends with the original torso skeleton',()=>{
 const source=assets['tide-outfit'].scene,root=clone(source);rebuildShadowTide(root,'tide');const body=root.getObjectByName('Female_Peasant_Body'),vest=root.getObjectByName('SM_Hero_Tide_WovenLeatherVest'),harness=root.getObjectByName('Tide_coastal_harness'),strap=root.getObjectByName('SM_Hero_Tide_FittedHarness');
 assert.equal(harness.children.length,2,'plain harness grew extra ornaments');assert(harness.children.every(o=>o.isSkinnedMesh&&o.skeleton===body.skeleton));assert.equal(harness.parent,root,'harness is rigidly attached to one animated bone');
 contactCheck(strap,[body,vest]);
 const p=strap.geometry.attributes.position,weights=strap.geometry.attributes.skinWeight,indices=strap.geometry.attributes.skinIndex,top=0,bottom=p.count-1;
 const influences=i=>[0,1,2,3].filter(k=>weights.array[i*4+k]>.01).map(k=>indices.array[i*4+k]);assert.notDeepEqual(influences(top),influences(bottom),'waist and shoulder use the same rigid attachment');
 root.skeleton=body.skeleton;const mixer=new T.AnimationMixer(root),point=new T.Vector3(),samples=[];
 for(const name of['Idle_Loop','Jog_Fwd_Loop','Sword_Attack']){
  const clip=clips.find(c=>c.name===name);assert(clip);mixer.stopAllAction();mixer.clipAction(clip).play();
  for(let frame=0;frame<45;frame++){
   mixer.update(1/30);root.updateMatrixWorld(true);body.skeleton.update();
   for(let i=0;i<p.count;i+=9){strap.getVertexPosition(i,point);assert(point.toArray().every(Number.isFinite));assert(point.length()<2.2,'strap exploded under original animation');}
   samples.push(strap.getVertexPosition(bottom,new T.Vector3()));
  }
 }
 assert(samples.some(p=>p.distanceTo(samples[0])>.05),'test never exercised animated cloth');mixer.stopAllAction();mixer.uncacheRoot(root);
 assert(!source.getObjectByName('Tide_coastal_harness'),'source GLTF was modified');
});
