import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import * as T from '../vendor/three.module.js';
import {clone} from '../vendor/SkeletonUtils.js';
import {loadCharacterData} from '../character-loader.js';
import {lingyaOutfit,lingyaLegs} from '../lingya-appearance.js';
import {refineLingyaHead} from '../lingya-face.js';
import {wulingOutfit} from '../wuling-appearance.js';
import {mirageOutfit,mirageHair} from '../mirage-appearance.js';
import {rebuildWildMist} from '../wild-mist-rebuild.js';

test('wild/mist wardrobes rebuild the complete weighted silhouettes without changing the shared skeleton or hands',async t=>{
 const original=Object.fromEntries(['fetch','self','ProgressEvent','createImageBitmap'].map(k=>[k,globalThis[k]]));
 try{
  globalThis.self=globalThis;globalThis.ProgressEvent=class{constructor(type,data){Object.assign(this,data);}};globalThis.createImageBitmap=async()=>({width:512,height:512,close(){}});
  globalThis.fetch=async input=>{const url=typeof input==='string'?input:input.url;return url.startsWith('file:')?new Response(fs.readFileSync(fileURLToPath(url))):original.fetch(input);};
  const {models,clips}=await loadCharacterData(),source=models['silver-outfit'].scene,originalGeometry=new Map();source.traverse(o=>{if(o.isSkinnedMesh)originalGeometry.set(o.geometry,o.geometry.attributes.position.array.slice());});
  function prepare(kind){
   const root=clone(source);let first;root.traverse(o=>{if(o.isSkinnedMesh&&!first)first=o;});root.skeleton=first.skeleton;
   if(kind==='lingya')lingyaOutfit(root);else if(kind==='wuling')wulingOutfit(root);else mirageOutfit(root);
   const bind=mesh=>{const bones=new Map(root.skeleton.bones.map(b=>[b.name,b]));mesh.skeleton=new T.Skeleton(mesh.skeleton.bones.map(b=>bones.get(b.name)),mesh.skeleton.boneInverses);root.add(mesh);};
   if(kind==='lingya'){bind(lingyaLegs(clone(models['silver-base'].scene)));refineLingyaHead(root);}
   if(kind==='mirage'){const hair=clone(models['silver-hair'].scene);mirageHair(hair);const parts=[];hair.traverse(o=>{if(o.isSkinnedMesh)parts.push(o);});for(const part of parts)bind(part);}
   root.updateMatrixWorld(true);return root;
  }
  const built={};
  for(const kind of['lingya','wuling','mirage'])await t.test(kind+' changes body, sleeves, legs, boots and its head silhouette within the existing draw budget',()=>{
   const root=prepare(kind),other=prepare(kind),bones=root.skeleton.bones.slice(),rest=bones.map(b=>[...b.position.toArray(),...b.quaternion.toArray(),...b.scale.toArray()]),hands=root.getObjectByName('Female_Ranger_Arms_2'),handGeometry=hands.geometry,handMaterial=hands.material;
   const count=r=>{let n=0;r.traverse(o=>{if(o.isMesh&&o.visible)n++;});return n;},oldCalls=count(root),before=new Map();root.traverse(o=>{if(o.isSkinnedMesh)before.set(o,o.geometry);});
   rebuildWildMist(root,kind);assert.equal(rebuildWildMist(root,kind),root);assert.deepEqual(root.skeleton.bones,bones);assert.deepEqual(bones.map(b=>[...b.position.toArray(),...b.quaternion.toArray(),...b.scale.toArray()]),rest);assert.equal(hands.geometry,handGeometry);assert.equal(hands.material,handMaterial);assert(count(root)<=oldCalls);
   const parts=[];root.traverse(o=>{if(o.userData.wildMistPart)parts.push(o);});const names=new Set(parts.map(o=>o.userData.wildMistPart));for(const part of['robe','sleeves','cuffs','legs','boots',...(kind==='lingya'?[]:[kind==='mirage'?'long-hair':'hood'])])assert(names.has(part));
   if(kind==='lingya')assert.equal(root.getObjectByName('Female_Ranger_Head_Hood').visible,false,'retired hood still covers the new short hair');
   const triangles=m=>(m.geometry.index?.count??m.geometry.attributes.position.count)/3,geometry=parts.reduce((n,m)=>n+triangles(m),0);assert(geometry<10000);assert(parts.filter(m=>m.userData.wildMistPart!=='long-hair').reduce((n,m)=>n+triangles(m),0)<8000);
   for(const mesh of parts){const g=mesh.geometry,a=g.attributes;assert.notEqual(g,before.get(mesh));assert(mesh.castShadow&&mesh.receiveShadow);assert(g.boundingBox&&g.boundingSphere);for(const attr of Object.values(a))assert(attr.array.every(Number.isFinite));assert.equal(a.position.count,a.skinIndex.count);assert.equal(a.position.count,a.skinWeight.count);
    for(let i=0;i<a.position.count;i++){let sum=0;for(let j=0;j<4;j++){const k=i*4+j;assert(a.skinIndex.array[k]<mesh.skeleton.bones.length);assert(a.skinWeight.array[k]>=0);sum+=a.skinWeight.array[k];}assert(Math.abs(sum-1)<1e-5);}
    if(mesh.userData.wildMistPart!=='long-hair'){assert(a.color);assert.equal(mesh.material.map,null);assert(mesh.material.roughness>=.7);for(const map of[mesh.material.normalMap,mesh.material.roughnessMap]){assert(map.isDataTexture);assert.equal(map.image.width,128);assert.equal(map.image.height,128);assert.equal(map.wrapS,T.RepeatWrapping);assert.equal(map.colorSpace,T.NoColorSpace);assert(map.generateMipmaps);}}
   }
   assert.equal(other.userData.wildMistRebuilt,undefined);other.traverse(o=>{if(o.isSkinnedMesh)assert(!o.userData.wildMistPart);});assert.deepEqual(root.scale.toArray(),[1,1,1]);
   const boots=parts.find(o=>o.userData.wildMistPart==='boots').geometry.boundingBox;assert.equal(boots.min.y,Math.fround(.004));assert(Math.abs(boots.max.y-({lingya:.28,wuling:.47,mirage:.60}[kind]))<1e-6);
   const robeMesh=parts.find(o=>o.userData.wildMistPart==='robe'),robe=robeMesh.geometry.boundingBox;assert(robe.min.y<({lingya:1.0,wuling:.83,mirage:.94}[kind]));
   if(kind==='lingya'){
    const a=robeMesh.geometry.attributes,seams=new Map();let joined=0;
    for(let i=0;i<a.position.count;i++){
     const key=[a.position.getX(i),a.position.getY(i),a.position.getZ(i)].map(v=>Math.round(v*1e6)).join(','),prior=seams.get(key);
     if(prior!==undefined){for(const field of ['skinIndex','skinWeight'])assert.deepEqual(a[field].array.slice(i*4,i*4+4),a[field].array.slice(prior*4,prior*4+4),'coincident garment seam separates under animation');joined++;}else seams.set(key,i);
    }
    assert(joined>20,'missing the closed front seam samples');
   }
   built[kind]={root,parts};
  });
  await t.test('the rebuilt sleeves and soles remain finite through original walking, running, aiming and casting clips',()=>{
   const point=new T.Vector3();
   for(const {root,parts}of Object.values(built)){
    const mixer=new T.AnimationMixer(root);for(const name of['Walk_Loop','Jog_Fwd_Loop','Pistol_Aim_Neutral','Spell_Simple_Idle_Loop']){
     const clip=clips.find(c=>c.name===name);assert(clip);const action=mixer.clipAction(clip);action.play();
     for(let frame=0;frame<=8;frame++){mixer.setTime(frame/8*(clip.duration-.001));root.updateMatrixWorld(true);for(const mesh of parts){const p=mesh.geometry.attributes.position;for(let i=0;i<p.count;i++){mesh.getVertexPosition(i,point);assert(point.toArray().every(Number.isFinite));assert(point.length()<2.5,'garment escaped the existing character envelope');}}}
     action.stop();
    }
   }
  });
  await t.test('template inputs and unsupported heroes remain untouched',()=>{
   for(const [g,positions]of originalGeometry)assert.deepEqual(g.attributes.position.array,positions);
   const unsupported=new T.Group();assert.equal(rebuildWildMist(unsupported,'scout'),unsupported);assert.equal(unsupported.children.length,0);assert.equal(unsupported.userData.wildMistRebuilt,undefined);
   assert.throws(()=>rebuildWildMist(new T.Group(),'wuling'),/complete female ranger/);
  });
 }finally{for(const [key,value]of Object.entries(original))if(value===undefined)delete globalThis[key];else globalThis[key]=value;}
});
