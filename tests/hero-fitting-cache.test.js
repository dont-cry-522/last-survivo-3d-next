import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import {wulingMask} from '../wuling-appearance.js';
import {mirageMask} from '../mirage-appearance.js';
const entry=fs.readFileSync(new URL('../world.js',import.meta.url),'utf8').match(/from['"](.\/skinned-hero\.js[^'"]*)['"]/)[1];
const {loadHeroAssets,createSkinnedHero,animateSkinnedHero,disposeHero}=await import(new URL(entry,new URL('../world.js',import.meta.url)));

test('cached rest masks retain exact legacy geometry and independently owned actor lifetimes',async t=>{
 const saved=Object.fromEntries(['fetch','self','ProgressEvent','createImageBitmap'].map(k=>[k,globalThis[k]]));
 try{
  globalThis.self=globalThis;globalThis.ProgressEvent=class{constructor(type,data){Object.assign(this,data);}};globalThis.createImageBitmap=async()=>({width:512,height:512,close(){}});
  globalThis.fetch=async input=>{const url=typeof input==='string'?input:input.url;return url.startsWith('file:')?new Response(fs.readFileSync(fileURLToPath(url))):saved.fetch(input);};
  await loadHeroAssets();
  for(const[kind,weapon,name,legacy]of[
   ['silver','crossbow','silver-face-mask'],['wraith','shade','wraith-shadow-veil'],
   ['wuling','sporelantern','wuling-full-mask',wulingMask],['mirage','miasmalantern','mirage-full-mask',mirageMask]
  ])await t.test(kind,()=>{
   const first=createSkinnedHero(kind,weapon),second=createSkinnedHero(kind,weapon),a=first.getObjectByName(name),b=second.getObjectByName(name);
   assert(a&&b);assert.notStrictEqual(a.geometry,b.geometry);assert.notStrictEqual(a.material,b.material);
   assert(first.userData.owned.includes(a)&&second.userData.owned.includes(b));
   const attributes=Object.fromEntries(Object.entries(a.geometry.attributes).map(([key,attribute])=>[key,attribute.array.slice()]));
   for(const[key,array]of Object.entries(attributes))assert.deepEqual(b.geometry.attributes[key].array,array);
   if(legacy){
    // Default factories still use Three's full-mesh raycast. They are an
    // independent oracle for both the broad shell and Mirage's folded rim.
    const reference=legacy(first.userData.model);
    assert.deepEqual(a.geometry.index.array,reference.geometry.index.array);
    for(const[key,array]of Object.entries(attributes))assert.deepEqual(reference.geometry.attributes[key].array,array,'accelerated '+key+' changed the mask');
    reference.geometry.dispose();reference.material.dispose();
   }
   const opacity=b.material.opacity;let ownReleases=0,otherReleases=0;
   a.geometry.addEventListener('dispose',()=>ownReleases++);a.material.addEventListener('dispose',()=>ownReleases++);
   b.geometry.addEventListener('dispose',()=>otherReleases++);b.material.addEventListener('dispose',()=>otherReleases++);
   a.material.opacity=.2;first.userData.mirageConceal=1;
   for(let i=0;i<12;i++)animateSkinnedHero(first,i/60,4,.1,0);
   assert.equal(b.material.opacity,opacity);for(const[key,array]of Object.entries(attributes))assert.deepEqual(b.geometry.attributes[key].array,array);
   disposeHero(first);assert.equal(ownReleases,2);assert.equal(otherReleases,0);
   // Disposing the first live mask must not invalidate the retained rest fit.
   const third=createSkinnedHero(kind,weapon),c=third.getObjectByName(name);
   for(const[key,array]of Object.entries(attributes))assert.deepEqual(c.geometry.attributes[key].array,array);
   assert.equal(c.material.opacity,opacity);animateSkinnedHero(second,1,4,0,0);assert(b.geometry.attributes.position.array.every(Number.isFinite));
   disposeHero(second);disposeHero(third);assert.equal(otherReleases,2);
  });
 }finally{for(const[k,v]of Object.entries(saved))if(v===undefined)delete globalThis[k];else globalThis[k]=v;}
});
