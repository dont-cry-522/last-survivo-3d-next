import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import * as T from '../vendor/three.module.js';
import {actor,animateActor} from '../world.js';
const entry=fs.readFileSync(new URL('../world.js',import.meta.url),'utf8').match(/from['"](.\/skinned-hero\.js[^'"]*)['"]/)[1];
const {loadHeroAssets,disposeHero}=await import(new URL(entry,new URL('../world.js',import.meta.url)));

test('Tide wave clasp stays close to its actual animated upper jacket without floating off the shoulder',async()=>{
 const saved=Object.fromEntries(['fetch','self','ProgressEvent','createImageBitmap'].map(k=>[k,globalThis[k]]));
 let hero;
 const material=new T.MeshBasicMaterial({side:T.DoubleSide}),ray=new T.Raycaster(),point=new T.Vector3(),probes=[];
 try{
  globalThis.self=globalThis;globalThis.ProgressEvent=class{constructor(type,data){Object.assign(this,data);}};globalThis.createImageBitmap=async()=>({width:512,height:512,close(){}});
  globalThis.fetch=async input=>{const url=typeof input==='string'?input:input.url;return url.startsWith('file:')?new Response(fs.readFileSync(fileURLToPath(url))):saved.fetch(input);};
  await loadHeroAssets();hero=actor('tide','harpoon');const mark=hero.getObjectByName('SM_Hero_Identity_tide');
  assert.equal(mark.parent.name,'spine_03');hero.updateMatrixWorld(true);const attachment=mark.matrix.clone();
  hero.traverse(o=>{if(!o.isSkinnedMesh||!o.visible||!(/Female_Peasant_Body$/.test(o.name)||/SM_Hero_Tide_(WovenLeatherVest|FoldedOpenCollar)/.test(o.name)))return;
   const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.BufferAttribute(new Float32Array(o.geometry.attributes.position.count*3),3));geometry.setIndex(o.geometry.index);
   const mesh=new T.Mesh(geometry,material);mesh.updateMatrixWorld(true);probes.push({source:o,mesh});
  });
  const meshes=probes.map(p=>p.mesh);let minGap=Infinity,maxGap=0,maxCenterGap=0,contacts=0;
  for(let frame=0;frame<180;frame++){
   hero.userData.travelAngle=.12;hero.userData.aimActive=false;animateActor(hero,7+frame/60,5.5,0);hero.updateMatrixWorld(true);
   assert.deepEqual(mark.matrix.elements,attachment.elements,'the clasp was dynamically moved instead of seated on its bone');
   const inverse=new T.Matrix4().compose(mark.getWorldPosition(new T.Vector3()),mark.getWorldQuaternion(new T.Quaternion()),new T.Vector3(1,1,1)).invert();
   for(const {source,mesh}of probes){source.skeleton.update();const positions=mesh.geometry.attributes.position,matrix=inverse.clone().multiply(source.matrixWorld);for(let i=0;i<positions.count;i++){source.getVertexPosition(i,point).applyMatrix4(matrix);positions.setXYZ(i,point.x,point.y,point.z);}mesh.geometry.computeBoundingSphere();}
   const samples=[];mark.traverse(o=>{if(!o.isMesh)return;const positions=o.geometry.attributes.position,matrix=inverse.clone().multiply(o.matrixWorld);for(let i=0;i<positions.count;i+=Math.max(1,Math.floor(positions.count/12)))samples.push(new T.Vector3().fromBufferAttribute(positions,i).applyMatrix4(matrix));});samples.push(new T.Vector3());
   for(const [i,p]of samples.entries()){
    ray.set(new T.Vector3(p.x,p.y,.4),new T.Vector3(0,0,-1));const hit=ray.intersectObjects(meshes,false)[0];assert(hit,'a clasp tip has no jacket beneath it');const gap=-hit.point.z;contacts++;minGap=Math.min(minGap,gap);maxGap=Math.max(maxGap,gap);
    assert(gap>.0005&&gap<.02,'clasp backing crossed the cloth or floated off: '+gap);
    if(i===samples.length-1){maxCenterGap=Math.max(maxCenterGap,gap);assert(gap<.008,'clasp centre visibly floats away from the upper jacket');}
   }
  }
  assert(contacts>2000);console.log(JSON.stringify({frames:180,minGapMm:minGap*1000,maxGapMm:maxGap*1000,maxCenterGapMm:maxCenterGap*1000}));
 }finally{
  for(const {mesh}of probes)mesh.geometry.dispose();material.dispose();if(hero)disposeHero(hero);
  for(const [k,v]of Object.entries(saved))if(v===undefined)delete globalThis[k];else globalThis[k]=v;
 }
});
