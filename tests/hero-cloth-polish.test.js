import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import * as T from '../vendor/three.module.js';
const entry=fs.readFileSync(new URL('../world.js',import.meta.url),'utf8').match(/from['"](.\/skinned-hero\.js[^'"]*)['"]/)[1];
const {loadHeroAssets,createSkinnedHero,animateSkinnedHero,disposeHero}=await import(new URL(entry,new URL('../world.js',import.meta.url)));

test('coastal mantle has actual short tailoring, pinned shoulders and identical colour/shadow motion',async()=>{
 const saved=Object.fromEntries(['fetch','self','ProgressEvent','createImageBitmap'].map(k=>[k,globalThis[k]]));
 try{
  globalThis.self=globalThis;globalThis.ProgressEvent=class{constructor(type,data){Object.assign(this,data);}};globalThis.createImageBitmap=async()=>({width:512,height:512,close(){}});
  globalThis.fetch=async input=>{const url=typeof input==='string'?input:input.url;return url.startsWith('file:')?new Response(fs.readFileSync(fileURLToPath(url))):saved.fetch(input);};
  await loadHeroAssets();const hero=createSkinnedHero('tide','harpoon'),other=createSkinnedHero('tide','harpoon'),d=hero.userData,cape=d.cape,p=cape.geometry.attributes.position,uv=cape.geometry.attributes.uv,rest=p.array.slice();
  assert.equal(cape.name,'SM_Hero_Cape_Tide');assert(Math.abs(cape.scale.y-1)<1e-5);assert.notEqual(cape.geometry,other.userData.cape.geometry);assert(cape.castShadow&&cape.receiveShadow);
  const bounds=new T.Box3().setFromBufferAttribute(p);assert(bounds.getSize(new T.Vector3()).y>.32&&bounds.getSize(new T.Vector3()).y<.38);
  const shader={};cape.material.onBeforeCompile(shader);assert.deepEqual(shader,{},'colour-only wind would detach the shadow');
  const body=hero.getObjectByName('Female_Peasant_Body'),depthGeometry=new T.BufferGeometry(),positions=new Float32Array(body.geometry.attributes.position.count*3),depthMaterial=new T.MeshBasicMaterial({side:T.DoubleSide}),probe=new T.Mesh(depthGeometry,depthMaterial),point=new T.Vector3(),ray=new T.Raycaster();depthGeometry.setAttribute('position',new T.BufferAttribute(positions,3));depthGeometry.setIndex(body.geometry.index);probe.updateMatrixWorld(true);
  let contacts=0,minGap=Infinity,turned=false,firstRotation;
  for(let f=0;f<100;f++)animateSkinnedHero(hero,5+f/60,0,0,0);
  d.turnRate=2;for(let f=0;f<190;f++){
   animateSkinnedHero(hero,7+f/60,4,0,0);hero.updateMatrixWorld(true);body.skeleton.update();
   assert(cape.quaternion.angleTo(d.restCape)<1e-5,'short mantle stopped following its shoulder attachment');const rotation=cape.getWorldQuaternion(new T.Quaternion());if(!firstRotation)firstRotation=rotation;else turned ||= rotation.angleTo(firstRotation)>.02;
   const transform=cape.matrixWorld.clone().invert().multiply(body.matrixWorld);for(let i=0;i<positions.length/3;i++){body.getVertexPosition(i,point).applyMatrix4(transform);point.toArray(positions,i*3);}depthGeometry.computeBoundingSphere();
   // Compare real animated rear cloth depths, including the frame previously
   // shown by the screenshot fixture, instead of demanding a vertical sheet.
   for(let row=0;row<=28;row+=4)for(const column of[6,9,12,15,18]){const i=row*25+column;ray.set(new T.Vector3(p.getX(i),p.getY(i),-1),new T.Vector3(0,0,1));const hit=ray.intersectObject(probe,false)[0];if(!hit)continue;const gap=hit.point.z-p.getZ(i);contacts++;minGap=Math.min(minGap,gap);assert(gap>.001,'back garment crossed the mantle during stride: '+gap);}
  }
  assert(turned&&contacts>1000);assert(minGap>.001);depthGeometry.dispose();depthMaterial.dispose();
  let moving=0;for(let i=0;i<p.count;i++){const shift=Math.hypot(p.getX(i)-rest[i*3],p.getY(i)-rest[i*3+1],p.getZ(i)-rest[i*3+2]);if(uv.getY(i)===0)assert.equal(shift,0);else if(shift>.0001)moving++;assert(shift<.25,'relaxed hem exceeded the short mantle envelope');}
  assert(moving>100);assert.deepEqual(other.userData.cape.geometry.attributes.position.array,rest);
  const paused=p.array.slice();animateSkinnedHero(hero,7+189/60,4,0,0);assert.deepEqual(p.array,paused);
  let released=0;cape.geometry.addEventListener('dispose',()=>released++);disposeHero(hero);assert.equal(released,1);animateSkinnedHero(other,2,4,0,0);assert(other.userData.cape.geometry.attributes.position.array.every(Number.isFinite));disposeHero(other);
 }finally{for(const [k,v]of Object.entries(saved))if(v===undefined)delete globalThis[k];else globalThis[k]=v;}
});
