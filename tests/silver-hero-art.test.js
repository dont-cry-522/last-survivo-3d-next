import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import * as T from '../vendor/three.module.js';
const entry=fs.readFileSync(new URL('../world.js',import.meta.url),'utf8').match(/from['"](.\/skinned-hero\.js[^'"]*)['"]/)[1];
const {loadHeroAssets,createSkinnedHero,animateSkinnedHero,disposeHero}=await import(new URL(entry,new URL('../world.js',import.meta.url)));

test('silver hair and tailored cape preserve the loaded rig, face fit and independent lifetimes',async t=>{
 const original=Object.fromEntries(['fetch','self','ProgressEvent','createImageBitmap'].map(k=>[k,globalThis[k]]));
 try{
  globalThis.self=globalThis;globalThis.ProgressEvent=class{constructor(type,data){Object.assign(this,data);}};
  globalThis.createImageBitmap=async()=>({width:512,height:512,close(){}});
  globalThis.fetch=async input=>{const url=typeof input==='string'?input:input.url;return url.startsWith('file:')?new Response(fs.readFileSync(fileURLToPath(url))):original.fetch(input);};
  await loadHeroAssets();
  const hero=createSkinnedHero('silver','crossbow'),other=createSkinnedHero('silver','dark'),d=hero.userData,mesh=d.silverHair[0],p=mesh.geometry.attributes.position,n=mesh.geometry.attributes.normal,rest=p.array.slice();
  await t.test('short hair roots and garment attachment stay pinned; free ends and pleats actually move',()=>{
   assert.equal(d.silverHair.length,1);assert.notEqual(mesh.geometry,other.userData.silverHair[0].geometry);assert.notEqual(mesh.material,other.userData.silverHair[0].material);
   assert.equal(mesh.geometry.attributes.skinWeight.count,p.count);assert.equal(d.cape.name,'SM_Hero_Cape_Silver');assert.equal(d.cape.geometry.index.count/3,1344);
   const capeRest=d.cape.geometry.attributes.position.array.slice(),capeUV=d.cape.geometry.attributes.uv;let moved=0,capeMoved=0;
   d.turnRate=2;for(let i=0;i<120;i++){animateSkinnedHero(hero,i/60,4,0,0);const down=new T.Vector3(0,-1,0).applyQuaternion(d.cape.getWorldQuaternion(new T.Quaternion()));assert(down.y<-.97,'running torso lifts the cape into a horizontal panel');}
   for(let i=0;i<p.count;i++){
    const shift=Math.hypot(p.getX(i)-rest[i*3],p.getY(i)-rest[i*3+1],p.getZ(i)-rest[i*3+2]);
    if(rest[i*3+1]>=1.72)assert.equal(shift,0,'crown slid from the skull');else if(shift>.00001)moved++;
    assert(shift<.013,'hair excursion breaks the bob silhouette');assert(Math.abs(Math.hypot(n.getX(i),n.getY(i),n.getZ(i))-1)<1e-5);
   }
   const cape=d.cape.geometry.attributes.position;
   for(let i=0;i<cape.count;i++){const shift=Math.hypot(cape.getX(i)-capeRest[i*3],cape.getZ(i)-capeRest[i*3+2]);if(capeUV.getY(i)===0)assert.equal(shift,0,'shoulder seam detached');else if(shift>.0001)capeMoved++;assert(shift<.065);}
   assert(moved>100);assert(capeMoved>100);assert.deepEqual(other.userData.silverHair[0].geometry.attributes.position.array,rest,'lobby clone moved with the combat hero');
   const paused=p.array.slice(),pausedCape=cape.array.slice();animateSkinnedHero(hero,119/60,4,0,0);assert.deepEqual(p.array,paused);assert.deepEqual(cape.array,pausedCape);
   assert(mesh.castShadow&&mesh.receiveShadow&&d.cape.castShadow&&d.cape.receiveShadow);
  });
  await t.test('black mask still fits nose and cheeks while leaving eyes open',()=>{
   const mask=hero.getObjectByName('silver-face-mask');assert.equal(mask.parent,d.swimHead);assert(mask.geometry.attributes.uv);
   let skin;hero.traverse(o=>{if(o.isSkinnedMesh&&o.material.name.includes('Superhero'))skin=o;});
   const material=new T.MeshBasicMaterial({side:T.DoubleSide}),probe=new T.Mesh(skin.geometry,material),cover=new T.Mesh(mask.geometry,material),ray=new T.Raycaster();probe.updateMatrixWorld();cover.updateMatrixWorld();
   const pos=mask.geometry.attributes.position;
   for(let i=0;i<pos.count;i++){ray.set(new T.Vector3(pos.getX(i),pos.getY(i),1),new T.Vector3(0,0,-1));const hit=ray.intersectObject(probe)[0];assert(hit);const gap=pos.getZ(i)-hit.point.z;assert(gap>.002&&gap<.028);}
   for(const [x,y,covered]of[[0,1.64,true],[.03,1.625,true],[0,1.58,true],[.03,1.675,false]]){ray.set(new T.Vector3(x,y,1),new T.Vector3(0,0,-1));assert.equal(!!ray.intersectObject(cover)[0],covered);}
   material.dispose();
  });
  await t.test('disposing one hero releases only its deformed surfaces',()=>{
   let geometryDisposals=0,materialDisposals=0;for(const part of [mesh,d.cape]){part.geometry.addEventListener('dispose',()=>geometryDisposals++);part.material.addEventListener('dispose',()=>materialDisposals++);}
   disposeHero(hero);assert.equal(geometryDisposals,2);assert.equal(materialDisposals,2);animateSkinnedHero(other,1,4,0,0);other.updateMatrixWorld(true);other.traverse(o=>assert(o.matrixWorld.elements.every(Number.isFinite)));disposeHero(other);
  });
 }finally{for(const [key,value]of Object.entries(original))if(value===undefined)delete globalThis[key];else globalThis[key]=value;}
});
