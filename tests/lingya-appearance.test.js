import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
const worldURL=new URL('../world.js',import.meta.url),entry=fs.readFileSync(worldURL,'utf8').match(/from['"](.\/skinned-hero\.js[^'"]*)['"]/)[1];
const {loadHeroAssets,createSkinnedHero,animateSkinnedHero,disposeHero}=await import(new URL(entry,worldURL));

test('new Lingya outfit replaces the old silhouette and animated hair survives independent actor disposal',async()=>{
 const saved=Object.fromEntries(['fetch','self','ProgressEvent','createImageBitmap'].map(k=>[k,globalThis[k]]));let a,b;
 try{
  globalThis.self=globalThis;globalThis.ProgressEvent=class{constructor(type,data){Object.assign(this,data);}};globalThis.createImageBitmap=async()=>({width:512,height:512,close(){}});
  globalThis.fetch=async input=>{const url=typeof input==='string'?input:input.url;return url.startsWith('file:')?new Response(fs.readFileSync(fileURLToPath(url))):saved.fetch(input);};
  await loadHeroAssets();a=createSkinnedHero('lingya','boomerang');b=createSkinnedHero('lingya','boomerang');
  assert.equal(a.userData.cape,undefined);assert.equal(a.userData.skirt,undefined);
  const hair=a.userData.lingyaHair,other=b.userData.lingyaHair;assert.equal(hair.parent.name,'Head');assert.notEqual(hair,other);
  const oldVisible=[];let shorts=0;a.traverse(o=>{if(o.visible&&['Hair_Long','SM_Hero_Cape_Lingya','SM_Hero_Lingya_SoftEars'].includes(o.name))oldVisible.push(o.name);if(o.geometry?.name==='SM_Hero_Lingya_ShortsLegsAndSocks')shorts++;});
  assert.deepEqual(oldVisible,[]);assert.equal(shorts,1);
  let freed=0;const rest=other.userData.braidPivots.map(p=>p.quaternion.toArray());
  hair.traverse(o=>{if(o.isMesh){assert.equal(o.geometry,other.getObjectByName(o.name).geometry);o.geometry.addEventListener('dispose',()=>freed++);o.material.addEventListener('dispose',()=>freed++);}});
  for(let i=0;i<90;i++){a.userData.turnRate=Math.sin(i/10);animateSkinnedHero(a,i/60,4,0,0);a.updateMatrixWorld(true);hair.traverse(o=>assert(o.matrixWorld.elements.every(Number.isFinite)));}
  assert.deepEqual(other.userData.braidPivots.map(p=>p.quaternion.toArray()),rest);
  assert.notDeepEqual(hair.userData.braidPivots.map(p=>p.quaternion.toArray()),rest);
  disposeHero(a);a=null;assert.equal(freed,0,'disposing one actor invalidated shared hair');
  animateSkinnedHero(b,2,3,.2,0);b.updateMatrixWorld(true);other.traverse(o=>assert(o.matrixWorld.elements.every(Number.isFinite)));
 }finally{if(a)disposeHero(a);if(b)disposeHero(b);for(const[k,v]of Object.entries(saved))if(v===undefined)delete globalThis[k];else globalThis[k]=v;}
});
