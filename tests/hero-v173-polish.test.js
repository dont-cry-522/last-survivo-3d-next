import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import * as T from '../vendor/three.module.js';
import {loadCharacterData} from '../character-loader.js';
import {clone} from '../vendor/SkeletonUtils.js';
import {refineLingyaFace,refineLingyaAccessories} from '../lingya-face.js?v=173';
import {lingyaAccessories} from '../lingya-appearance.js';
import {mirageHair,miasmaLantern} from '../mirage-appearance.js?v=173';
import {sporeLantern} from '../wuling-appearance.js?v=173';
const entry=fs.readFileSync(new URL('../world.js',import.meta.url),'utf8').match(/from['"](.\/skinned-hero\.js[^'"]*)['"]/)[1];
const {loadHeroAssets,createSkinnedHero,animateSkinnedHero,disposeHero}=await import(new URL(entry,new URL('../world.js',import.meta.url)));

function components(g){
 const p=g.attributes.position,index=g.index.array,parent=Array.from({length:p.count},(_,i)=>i),positions=new Map(),find=i=>{while(parent[i]!==i){parent[i]=parent[parent[i]];i=parent[i];}return i;};
 for(let i=0;i<p.count;i++){const key=[p.getX(i),p.getY(i),p.getZ(i)].map(v=>Math.round(v*1e6)).join(',');if(positions.has(key))parent[find(i)]=find(positions.get(key));else positions.set(key,i);}
 for(let i=0;i<index.length;i+=3){parent[find(index[i])]=find(index[i+1]);parent[find(index[i+1])]=find(index[i+2]);}
 return new Set(index.map(i=>find(i))).size;
}

test('v173 real face, connected robes and flowing hair retain their original animated function',async t=>{
 const saved=Object.fromEntries(['fetch','self','ProgressEvent','createImageBitmap'].map(k=>[k,globalThis[k]]));
 try{
  globalThis.self=globalThis;globalThis.ProgressEvent=class{constructor(type,data){Object.assign(this,data);}};globalThis.createImageBitmap=async()=>({width:512,height:512,close(){}});
  globalThis.fetch=async input=>{const url=typeof input==='string'?input:input.url;return url.startsWith('file:')?new Response(fs.readFileSync(fileURLToPath(url))):saved.fetch(input);};
  const {models}=await loadCharacterData();
  await t.test('face refinement is millimetric, preserves the authored Blink and does not alter the shared source',()=>{
   const source=models['lingya-face'].scene,face=source.clone(true),before=new Map();source.traverse(o=>{if(o.isMesh)before.set(o.name,o.geometry);});refineLingyaFace(face);const geometries=[];
   face.traverse(o=>{
    if(!o.isMesh)return;const original=before.get(o.name),g=o.geometry,p=g.attributes.position,q=original.attributes.position;geometries.push(g);assert.notEqual(g,original);assert.equal(p.count,q.count);assert.equal(g.morphTargetsRelative,original.morphTargetsRelative);
    let movement=0;for(let i=0;i<p.count;i++){const distance=Math.hypot(p.getX(i)-q.getX(i),p.getY(i)-q.getY(i),p.getZ(i)-q.getZ(i));movement=Math.max(movement,distance);assert(distance<.003,'face proportions were changed instead of surface smoothing');}if(o.name==='Lingya-head')assert(movement>.001);
    for(let target=0;target<(g.morphAttributes.position?.length||0);target++){const delta=g.morphAttributes.position[target],old=original.morphAttributes.position[target];let amplitude=0;for(let i=0;i<delta.count;i++){amplitude=Math.max(amplitude,Math.hypot(delta.getX(i),delta.getY(i),delta.getZ(i)));assert(Math.hypot(delta.getX(i)-old.getX(i),delta.getY(i)-old.getY(i),delta.getZ(i)-old.getZ(i))<.0011);}assert(amplitude>.004,'Blink no longer closes the authored eyelids');}
    for(const a of Object.values(g.attributes))assert(a.array.every(Number.isFinite));
   });
   refineLingyaFace(face);let i=0;face.traverse(o=>{if(o.isMesh)assert.equal(o.geometry,geometries[i++]);});source.traverse(o=>{if(o.isMesh)assert.equal(o.geometry,before.get(o.name));});
  });
  await t.test('smaller hood ears and recessed lining do not enlarge the head envelope',()=>{
   const a=lingyaAccessories(),before=new T.Box3().setFromObject(a.hood),geometry=a.hood.children.map(e=>e.children[0].geometry);refineLingyaAccessories(a);const after=new T.Box3().setFromObject(a.hood);assert(after.max.y<before.max.y-.015);assert(after.max.x<before.max.x);assert(after.min.x>before.min.x);assert(after.max.z<=before.max.z);
   a.hood.children.forEach((ear,i)=>assert.equal(ear.children[0].geometry,geometry[i]));const matrices=a.hood.children.map(e=>e.matrix.clone());refineLingyaAccessories(a);a.hood.updateMatrixWorld(true);a.hood.children.forEach((ear,i)=>assert.deepEqual(ear.matrix.elements,matrices[i].elements));
  });
  await t.test('long hair preserves the five actual fringe pieces and uses normalized weights on the new curved rear samples',()=>{
   const source=models['silver-hair'].scene,root=clone(source);let old,mesh;source.traverse(o=>{if(o.isSkinnedMesh)old=o;});root.traverse(o=>{if(o.isSkinnedMesh)mesh=o;});const original=old.geometry.attributes.position.array.slice();mirageHair(root);const g=mesh.geometry,p=g.attributes.position,region=g.attributes.hairRegion;
   assert(p.count>old.geometry.attributes.position.count);assert(g.index.count/3<4000);let untouched=0,long=0;
   for(let i=0;i<p.count;i++){let weight=0;for(let k=0;k<4;k++){weight+=g.attributes.skinWeight.array[i*4+k];assert(g.attributes.skinIndex.array[i*4+k]<mesh.skeleton.bones.length);}assert(Math.abs(weight-1)<1e-5);
    if(i<old.geometry.attributes.position.count&&!region.getX(i)){assert.deepEqual(Array.from(p.array.slice(i*3,i*3+3)),Array.from(original.slice(i*3,i*3+3)));untouched++;}if(p.getY(i)<1.3)long++;
   }
   assert(untouched>900,'front fringe was stretched into the rear hair');assert(long>200);assert.deepEqual(old.geometry.attributes.position.array,original);
  });
  await loadHeroAssets();
  for(const [kind,weapon]of[['wuling','sporelantern'],['mirage','miasmalantern'],['lingya','boomerang']])await t.test(kind+' retains finite walking, turning, attacks and dodge poses',()=>{
   const hero=createSkinnedHero(kind,weapon),d=hero.userData,wardrobe=[];hero.traverse(o=>{if(o.userData.wildMistPart)wardrobe.push(o);});assert(d.skinned);const robe=wardrobe.find(o=>o.userData.wildMistPart==='robe');assert.equal(components(robe.geometry),1,'a disconnected facing would collide with the robe again');
   const hair=d.mirageHair?.[0],rest=hair?.geometry.attributes.position.array.slice(),other=hair?createSkinnedHero(kind,weapon):null;let blinkMin=1,blinkMax=0,moved=false;const vertex=new T.Vector3();
   for(let frame=0;frame<180;frame++){
    d.travelAngle=Math.sin(frame/24)*.8;d.turnRate=Math.cos(frame/24)*1.7;d.aimActive=frame%60>30;d.reloadDuration=.9;d.reloadPhase=(frame%54)/54;d.shotSerial=1+Math.floor(frame/54);d.dashTime=frame>=100&&frame<130?(130-frame)/60:0;d.dashAngle=.5;
    animateSkinnedHero(hero,frame/60,frame<120?4:0,frame%54<10?.25:0,0);hero.updateMatrixWorld(true);
    for(const mesh of wardrobe)for(let i=0;i<mesh.geometry.attributes.position.count;i+=17){mesh.getVertexPosition(i,vertex);assert(vertex.toArray().every(Number.isFinite));assert(vertex.length()<2.5);}
    for(const face of d.faceMorphs||[]){blinkMin=Math.min(blinkMin,face.morphTargetInfluences[0]);blinkMax=Math.max(blinkMax,face.morphTargetInfluences[0]);}
    if(hair){const p=hair.geometry.attributes.position;for(let i=0;i<p.count;i+=11){const shift=Math.hypot(p.getX(i)-rest[i*3],p.getY(i)-rest[i*3+1],p.getZ(i)-rest[i*3+2]);if(rest[i*3+1]>=1.64)assert.equal(shift,0,'crown or clip anchor moved away from the head');else moved||=shift>.003;assert(shift<.19,'free hair motion escaped the rear silhouette');}}
   }
   if(d.faceMorphs){assert(blinkMax>.9&&blinkMin===0);assert(d.face.userData.lingyaFaceRefined);}
   if(hair){assert(moved);assert.notEqual(hair.geometry,other.userData.mirageHair[0].geometry);assert.deepEqual(other.userData.mirageHair[0].geometry.attributes.position.array,rest);const pause=hair.geometry.attributes.position.array.slice();animateSkinnedHero(hero,179/60,0,0,0);assert.deepEqual(hair.geometry.attributes.position.array,pause);disposeHero(other);}
   disposeHero(hero);
  });
 }finally{for(const [key,value]of Object.entries(saved))if(value===undefined)delete globalThis[key];else globalThis[key]=value;}
});

test('both lanterns keep their handle, glow and petal interfaces while joining the top fitting to the cover',()=>{
 for(const [create,kind,weapon,radius,y,socketName]of[[sporeLantern,'wuling','sporelantern',.085,-.070,'SM_Weapon_Spore_HandleSocket'],[miasmaLantern,'mirage','miasmalantern',.078,-.063,'SM_Weapon_Mirage_HandleSocket']]){
  const lamp=create();assert.deepEqual(lamp.userData.weaponIdentity,{hero:kind,weapon});const handle=lamp.children.find(o=>o.geometry?.type==='TorusGeometry');assert.equal(handle.geometry.parameters.radius,radius);assert.deepEqual(handle.position.toArray(),[0,y,0]);assert(lamp.userData.heart?.isMesh);if(kind==='mirage')assert.equal(lamp.userData.petals.length,4);
  const socket=lamp.getObjectByName(socketName);assert(socket);const box=new T.Box3().setFromObject(socket),handleBottom=y-radius;assert(box.min.y<handleBottom&&box.max.y>handleBottom,'the new fitting is detached from the unchanged hand ring');assert(box.max.x-box.min.x<.06);lamp.traverse(o=>{if(o.isMesh)assert(o.geometry.attributes.position.array.every(Number.isFinite));});
 }
});
