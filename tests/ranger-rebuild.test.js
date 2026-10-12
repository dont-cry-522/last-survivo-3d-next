import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import * as T from '../vendor/three.module.js';
import {clone} from '../vendor/SkeletonUtils.js';
import {loadCharacterData} from '../character-loader.js';
import {rebuildRanger} from '../ranger-rebuild.js';

function bruteSkin(source,x,y,z){
 const p=source.attributes.position,si=source.attributes.skinIndex,sw=source.attributes.skinWeight,near=[];
 for(const j of new Set(source.index.array)){const d=(x-p.getX(j))**2+(y-p.getY(j))**2+(z-p.getZ(j))**2;if(near.length<4||d<near[3][0]){near.push([d,j]);near.sort((a,b)=>a[0]-b[0]);near.length=Math.min(4,near.length);}}
 const weights=new Map();for(const [d,j]of near)for(let k=0;k<4;k++){const bone=si.array[j*4+k],amount=sw.array[j*4+k]/Math.max(1e-8,d);weights.set(bone,(weights.get(bone)||0)+amount);}
 const top=[...weights].sort((a,b)=>b[1]-a[1]).slice(0,4),sum=top.reduce((n,p)=>n+p[1],0);
 return{indices:Uint16Array.from({length:4},(_,k)=>top[k]?.[0]||0),weights:Float32Array.from({length:4},(_,k)=>(top[k]?.[1]||0)/sum)};
}

test('rebuilt expedition and silver garments keep real GLTF skin binding and distinct whole-body forms',async t=>{
 const original=Object.fromEntries(['fetch','self','ProgressEvent','createImageBitmap'].map(k=>[k,globalThis[k]]));
 try{
  globalThis.self=globalThis;globalThis.ProgressEvent=class{constructor(type,data){Object.assign(this,data);}};globalThis.createImageBitmap=async()=>({width:512,height:512,close(){}});
  globalThis.fetch=async input=>{const url=typeof input==='string'?input:input.url;return url.startsWith('file:')?new Response(fs.readFileSync(fileURLToPath(url))):original.fetch(input);};
  const assets=await loadCharacterData(),bodies=[];
  for(const kind of ['scout','silver'])await t.test(kind+' replaces the torso, sleeves, bracers and boots with normalized animated skin',()=>{
   const source=assets.models[kind+'-outfit'].scene,root=clone(source),meshes=[];root.traverse(o=>{if(o.isSkinnedMesh)meshes.push(o);});
   const body=meshes.find(o=>/_Body$/.test(o.name)),bodyBefore=body.geometry,skinHands=meshes.find(o=>o.material.name.includes('Regular')),handsBefore=skinHands.geometry,skinBefore=skinHands.geometry.attributes.skinWeight.array.slice(),skeleton=body.skeleton;
   let before=0;root.traverse(o=>{if(o.isMesh&&o.visible)before+=o.geometry.index.count/3;});
   rebuildRanger(root,kind);assert(root.userData.rangerRebuilt);assert.notEqual(body.geometry,bodyBefore);assert.equal(body.skeleton,skeleton);assert.notEqual(skinHands.geometry,handsBefore);for(let i=0;i<handsBefore.attributes.position.count;i++)if(Math.abs(handsBefore.attributes.position.getX(i))>(kind==='silver'?.766:.831))for(let k=0;k<3;k++)assert.equal(skinHands.geometry.attributes.position.array[i*3+k],handsBefore.attributes.position.array[i*3+k],'glove changed the finger grip');assert.deepEqual(skinHands.geometry.attributes.skinWeight.array,skinBefore);
   assert.equal(body.geometry.index.count/3,3200);assert.equal(body.geometry.attributes.position.count,1681);assert.equal(body.material.isMeshStandardMaterial,true);assert(!/Ranger|Peasant/.test(body.material.name));
   // The sorted-X acceleration must keep the original four-neighbour mapping,
   // including equal-distance duplicated UV vertices on the real outfit.
   const bp=body.geometry.attributes.position,bsi=body.geometry.attributes.skinIndex.array,bsw=body.geometry.attributes.skinWeight.array;
   for(let i=0;i<bp.count;i+=17){const expected=bruteSkin(bodyBefore,bp.getX(i),bp.getY(i),bp.getZ(i));assert.deepEqual(bsi.slice(i*4,i*4+4),expected.indices);for(let k=0;k<4;k++)assert(Math.abs(bsw[i*4+k]-expected.weights[k])<1e-7);}
   bodies.push(body.geometry.attributes.position.array.slice());
   const rebuilt=[];root.traverse(o=>{if(o.userData.rangerRebuild)rebuilt.push(o);});assert(rebuilt.some(o=>o.name.includes('Sleeves')));assert(rebuilt.some(o=>o.name.includes('Bracers')));assert(rebuilt.some(o=>o.name.includes('Boots')));assert(rebuilt.some(o=>o.name.includes('Harness')));
   for(const mesh of rebuilt){assert(mesh.isSkinnedMesh);const p=mesh.geometry.attributes.position,si=mesh.geometry.attributes.skinIndex,sw=mesh.geometry.attributes.skinWeight;assert.equal(si.count,p.count);assert.equal(sw.count,p.count);for(let i=0;i<p.count;i++){assert(Math.abs(sw.getX(i)+sw.getY(i)+sw.getZ(i)+sw.getW(i)-1)<1e-5);for(let c=0;c<4;c++)assert(si.array[i*4+c]<mesh.skeleton.bones.length);}assert(p.array.every(Number.isFinite));}
   const poses=['Idle_Loop','Jog_Fwd_Loop','Pistol_Aim_Neutral','Roll','Jump_Loop'];let tested=0,max=0;
   root.skeleton=skeleton;const mixer=new T.AnimationMixer(root),v=new T.Vector3(),posesSeen=new Set();
   for(const name of poses){const clip=assets.clips.find(c=>c.name===name);if(!clip)continue;const action=mixer.clipAction(clip);action.play();for(let frame=0;frame<30;frame++){mixer.update(1/30);root.updateMatrixWorld(true);posesSeen.add(skeleton.bones.find(b=>b.name==='upperarm_r').quaternion.toArray().map(v=>v.toFixed(4)).join(','));for(const mesh of rebuilt){mesh.skeleton.update();for(let i=0;i<mesh.geometry.attributes.position.count;i+=11){mesh.getVertexPosition(i,v);assert(v.toArray().every(Number.isFinite));assert(v.length()<3,'skin mapped to an unrelated bone');}}tested++;}action.stop();}
   assert(tested>=90);assert(posesSeen.size>40,'test did not actually drive the source skeleton');let after=0;root.traverse(o=>{if(o.isMesh&&o.visible)after+=o.geometry.index.count/3;});max=after-before;assert(max<4500,'rebuild overran per-hero triangle allowance');
   const count=root.children.length;rebuildRanger(root,kind);assert.equal(root.children.length,count,'rebuild duplicated garments');assert.equal(source.getObjectByName(kind==='silver'?'Female_Ranger_Body':'Male_Ranger_Body').geometry,bodyBefore,'source outfit was mutated');
   console.log(JSON.stringify({kind,visibleTrianglesBefore:before,visibleTrianglesAfter:after,delta:max,rebuiltParts:rebuilt.map(m=>m.name),animatedFrames:tested}));
  });
  assert.notDeepEqual(bodies[0],bodies[1],'identities share a recolored torso');
 }finally{for(const [key,value]of Object.entries(original))if(value===undefined)delete globalThis[key];else globalThis[key]=value;}
});
