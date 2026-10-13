import {before,test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import * as T from '../vendor/three.module.js';
import {clone} from '../vendor/SkeletonUtils.js';
import {loadCharacterData} from '../character-loader.js';
import {rebuildShadowTide} from '../shadow-tide-rebuild.js';
import {finishHeroSurface} from '../hero-finish.js';
let assets,clips;
before(async()=>{
 const original=Object.fromEntries(['fetch','self','ProgressEvent','createImageBitmap'].map(k=>[k,globalThis[k]]));
 try{
  globalThis.self=globalThis;globalThis.ProgressEvent=class{constructor(type,data){Object.assign(this,data);}};globalThis.createImageBitmap=async()=>({width:512,height:512,close(){}});
  globalThis.fetch=async input=>{const url=typeof input==='string'?input:input.url;return url.startsWith('file:')?new Response(fs.readFileSync(fileURLToPath(url))):original.fetch(input);};
  const data=await loadCharacterData();assets=data.models;clips=data.clips;
 }finally{for(const [key,value]of Object.entries(original))if(value===undefined)delete globalThis[key];else globalThis[key]=value;}
});
const sourceFor=kind=>assets[kind==='wraith'?'scout-outfit':'tide-outfit'].scene;

test('shadow chest is a continuous cloth front rather than raised source armour bars',()=>{
 const root=clone(sourceFor('wraith'));rebuildShadowTide(root,'wraith');
 const p=root.getObjectByName('Male_Ranger_Body').geometry.attributes.position;let samples=0;
 for(let i=0;i<p.count;i++)if(Math.abs(p.getX(i))<.09&&p.getY(i)>1.28&&p.getY(i)<1.40&&p.getZ(i)>.03){
  samples++;assert(p.getZ(i)<.125,'source chest armour still protrudes through the cloth profile');
 }
 assert(samples>20,'fixture does not inspect the actual chest');
});

test('both outfits are substantially resculpted without changing source UVs, bone weights or another hero',()=>{
 for(const kind of['wraith','tide']){
  const source=sourceFor(kind),root=clone(source),old=new Map();
  root.traverse(o=>{if(o.isSkinnedMesh)old.set(o,{geometry:o.geometry,material:o.material,vertexColors:o.material.vertexColors,position:o.geometry.attributes.position.array.slice(),weights:o.geometry.attributes.skinWeight.array.slice(),indices:o.geometry.attributes.skinIndex.array.slice(),uv:o.geometry.attributes.uv.array.slice()});});
  rebuildShadowTide(root,kind);const stats=root.userData.heroRebuild;assert(stats.sculptedVertices>9000,kind+' only changes a few attachments');assert(stats.addedMeshes>=5);
  // The two tide harness surfaces now live on the template skeleton; they
  // replace three rigid runtime attachments, rather than adding new ornaments.
  assert(stats.addedMeshes<=(kind==='tide'?11:9));
  let changed=0;
  for(const [mesh,data]of old){
   assert.deepEqual(data.geometry.attributes.position.array,data.position,'shared source vertices were changed');assert.equal(data.material.vertexColors,data.vertexColors,'shared source surface was recolored');
   if(!mesh.userData.rebuiltPart)continue;changed++;
   assert.notEqual(mesh.geometry,data.geometry);assert.notEqual(mesh.material,data.material);if(!mesh.userData.retopologized){assert.deepEqual(mesh.geometry.attributes.skinWeight.array,data.weights);assert.deepEqual(mesh.geometry.attributes.skinIndex.array,data.indices);assert.deepEqual(mesh.geometry.attributes.uv.array,data.uv);}else assert(mesh.geometry.attributes.skinWeight.count===mesh.geometry.attributes.position.count);
   assert(mesh.geometry.name.startsWith('SM_Hero_'));assert(mesh.material.name.startsWith('MAT_Hero_'));assert(mesh.castShadow&&mesh.receiveShadow);
  }
  assert(changed>=(kind==='wraith'?8:4));
  const count=root.children.length;rebuildShadowTide(root,kind);assert.equal(root.children.length,count);assert.equal(root.userData.heroRebuild,stats,'repeat rebuild changed resources');
 }
});

test('shadow hood is rounded and lower, boots remain grounded, tide sleeves and collar have physical structure',()=>{
 const wraith=clone(sourceFor('wraith')),tide=clone(sourceFor('tide'));rebuildShadowTide(wraith,'wraith');rebuildShadowTide(tide,'tide');
 const hood=wraith.getObjectByName('Male_Ranger_Head_Hood');hood.geometry.computeBoundingBox();assert(hood.geometry.boundingBox.max.y<1.834&&hood.geometry.boundingBox.max.y>1.78,'hood remains a pointed peak');assert(hood.geometry.boundingBox.max.x>.151,'hood silhouette was narrowed');
 assert.equal(wraith.getObjectByName('Male_Ranger_Acc_Pauldron').visible,false);assert.equal(wraith.getObjectByName('Male_Ranger_Body_Belt_1').visible,false);
 for(const [root,name]of[[wraith,'Male_Ranger_Feet_Boots'],[tide,'Female_Peasant_Feet']]){const g=root.getObjectByName(name).geometry;g.computeBoundingBox();assert(g.boundingBox.min.y>=-.003001&&g.boundingBox.min.y<.001,'boot grounding changed');}
 const feet=tide.getObjectByName('Female_Peasant_Feet').geometry;assert(feet.boundingBox.max.y>.51,'high boots were only recolored');
 const collar=tide.getObjectByName('SM_Hero_Tide_FoldedOpenCollar'),cuff=tide.getObjectByName('SM_Hero_Tide_RolledSleeveCuffs');assert(collar?.isSkinnedMesh&&cuff?.isSkinnedMesh);assert(tide.getObjectByName('SM_Hero_Tide_SplitDeckCoat'));assert(wraith.getObjectByName('SM_Hero_Wraith_SplitTunicHem'));
 const vest=tide.getObjectByName('SM_Hero_Tide_WovenLeatherVest'),vp=vest.geometry.attributes.position;
 // Check the visible top edge instead of accepting clipped source triangles.
 for(let i=1;i<18;i++){
  assert(Math.abs(vp.getY(i-1)-2*vp.getY(i)+vp.getY(i+1))<.002,'vest neckline is jagged');
  assert(Math.abs(vp.getZ(i)-vp.getZ(i+1))<.018,'vest projection jumps across a missing surface');
 }
 const cp=collar.geometry.attributes.position;for(let i=0;i<cp.count-1;i++)if(i%7!==6)assert(Math.abs(cp.getZ(i)-cp.getZ(i+1))<.028,'collar projection jumps across a missing surface');
 const old=sourceFor('tide').getObjectByName('Female_Peasant_Body').geometry.attributes.position,next=tide.getObjectByName('Female_Peasant_Body').geometry.attributes.position;let lowered=0;for(let i=0;i<old.count;i++)if(Math.abs(old.getX(i))<.05&&old.getZ(i)>.04&&old.getY(i)>1.418&&next.getY(i)<old.getY(i)-.006)lowered++;assert(lowered>8,'open neckline was only recolored');
});

test('added garment surfaces remain skinned, finite and bounded during actual idle, running, attack and roll clips',()=>{
 for(const kind of['wraith','tide']){
  const root=clone(sourceFor(kind));root.traverse(o=>{if(o.isSkinnedMesh&&!root.skeleton)root.skeleton=o.skeleton;});rebuildShadowTide(root,kind);let triangles=0,added=0;
  root.traverse(o=>{if(o.isSkinnedMesh&&o.name.startsWith('SM_Hero_')){
   added++;const g=o.geometry,p=g.attributes.position,w=g.attributes.skinWeight,ids=g.attributes.skinIndex;
   triangles+=(g.index?.count||p.count)/3;assert.equal(w.count,p.count);assert.equal(ids.count,p.count);
   for(let i=0;i<w.count;i++){const sum=w.getX(i)+w.getY(i)+w.getZ(i)+w.getW(i);assert(Math.abs(sum-1)<.0002);for(let k=0;k<4;k++)assert(ids.array[i*4+k]<o.skeleton.bones.length);}
   assert([...p.array,...g.attributes.normal.array].every(Number.isFinite));
  }});
  assert(triangles<6000,kind+' rebuild adds excessive faces');assert(added<=(kind==='tide'?11:9));
  const mixer=new T.AnimationMixer(root),names=clips.filter(c=>/Idle_Loop|Jog_Fwd|Sword_Attack|Roll|Walk_Loop/.test(c.name)),before=root.skeleton.bones.map(b=>b.quaternion.clone());assert(names.length>3);let animated=0;
  for(const clip of names.slice(0,10)){
   mixer.stopAllAction();const action=mixer.clipAction(clip);action.play();
   for(const dt of[.016,.07,.16,.35]){mixer.update(dt);root.updateMatrixWorld(true);root.traverse(o=>{
    if(!o.isSkinnedMesh||!o.name.startsWith('SM_Hero_'))return;o.skeleton.update();const p=o.geometry.attributes.position;
    for(let i=0;i<p.count;i+=11){const v=o.getVertexPosition(i,new T.Vector3());assert(v.toArray().every(Number.isFinite));assert(v.length()<3,'skinned garment explodes during '+clip.name);}
   });animated=Math.max(animated,root.skeleton.bones.filter((b,i)=>b.quaternion.angleTo(before[i])>.01).length);}
  }assert(animated>10,'fixture did not animate the actual skeleton');mixer.stopAllAction();mixer.uncacheRoot(root);
 }
});

test('final surface pass retains the rebuilt fabrics and still compiles map and no-map variants',()=>{
 for(const kind of['wraith','tide']){
  const root=clone(sourceFor(kind));rebuildShadowTide(root,kind);finishHeroSurface(root,kind);
  root.traverse(o=>{if(!o.isMesh||!o.userData.rebuiltPart)return;assert(o.material.roughness>=.48);assert(o.material.metalness<.5);
   if(o.material.vertexColors&&!o.userData.retopologized){const shader={fragmentShader:'#include <map_fragment>\n#include <metalnessmap_fragment>',vertexShader:''};o.material.onBeforeCompile(shader);assert(shader.fragmentShader.includes('tailoringTone'));assert(shader.fragmentShader.includes('#ifdef USE_MAP'));assert(!shader.fragmentShader.includes('vColor*'),'palette is multiplied again before Three color_fragment');assert(o.material.customProgramCacheKey().startsWith('rebuilt-'));}
  });
 }
});
