import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../vendor/three.module.js';
import {createLingyaHair,animateLingyaHair} from '../lingya-hair.js';
import {readFile} from 'node:fs/promises';

test('Lingya twin plaits replace the bob with finite fitted surfaces and independent motion',()=>{
 const a=createLingyaHair(),b=createLingyaHair(),before=new Map();let triangles=0;
 a.traverse(mesh=>{if(!mesh.isMesh)return;const other=b.getObjectByName(mesh.name),g=mesh.geometry;assert.equal(g,other.geometry);assert.equal(mesh.material,other.material);assert(g.attributes.position.array.every(Number.isFinite));assert(g.attributes.normal.array.every(Number.isFinite));triangles+=g.index.count/3;before.set(mesh.name,g.attributes.position.array.slice());});
 assert(triangles<8000,'hair must remain suitable for the existing actor budget');
 const box=new T.Box3().setFromObject(a);assert(box.min.y>1.40&&box.max.y<1.77);assert(box.max.x>.12&&box.min.x<-.12,'two distinct side plaits are missing');assert.equal(a.userData.braidPivots.length,2);
 const untouched=b.userData.braidPivots.map(p=>p.quaternion.toArray());
 for(let i=0;i<90;i++){animateLingyaHair(a,i/60,4,Math.sin(i/14));a.updateMatrixWorld(true);a.traverse(o=>assert(o.matrixWorld.elements.every(Number.isFinite)));}
 assert.deepEqual(b.userData.braidPivots.map(p=>p.quaternion.toArray()),untouched);assert.notDeepEqual(a.userData.braidPivots.map(p=>p.quaternion.toArray()),untouched);
 a.traverse(mesh=>{if(mesh.isMesh)assert.deepEqual(mesh.geometry.attributes.position.array,before.get(mesh.name),'animation modified a shared vertex buffer');});
});

test('the fitted crown covers the actual forehead sides and scalp without a floating shell',async()=>{
 const base=new URL('../assets/characters/',import.meta.url),json=JSON.parse(await readFile(new URL('lingya-face.gltf',base),'utf8')),buffer=await readFile(new URL(json.buffers[0].uri,base)),primitive=json.meshes.find(m=>m.name==='Lingya-head').primitives[0];
 const read=index=>{const a=json.accessors[index],v=json.bufferViews[a.bufferView],offset=(v.byteOffset||0)+(a.byteOffset||0),length=a.count*(a.type==='VEC3'?3:1),copy=buffer.subarray(offset,offset+length*4);return a.componentType===5126?new Float32Array(copy.buffer,copy.byteOffset,length):new Uint32Array(copy.buffer,copy.byteOffset,length);};
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(read(primitive.attributes.POSITION),3));g.setIndex(new T.Uint32BufferAttribute(read(primitive.indices),1));
 const skin=new T.Mesh(g,new T.MeshBasicMaterial({side:T.DoubleSide})),hair=createLingyaHair(),crown=hair.getObjectByName('SM_Hero_Lingya_Hair_Crown');skin.updateMatrixWorld(true);hair.updateMatrixWorld(true);
 const ray=new T.Raycaster();
 for(const[origin,direction]of[[[.045,1.700,1],[0,0,-1]],[[-.045,1.700,1],[0,0,-1]],[[.015,2,-.020],[0,-1,0]],[[.3,1.675,-.015],[-1,0,0]],[[-.3,1.675,-.015],[1,0,0]]]){
  ray.set(new T.Vector3(...origin),new T.Vector3(...direction));const faceHit=ray.intersectObject(skin,false)[0],hairHit=ray.intersectObject(crown,false)[0];assert(faceHit&&hairHit,'crown left exposed scalp at a principal view');const gap=faceHit.distance-hairHit.distance;assert(gap>.0005&&gap<.008,`crown must fit outside the scalp, got ${gap}`);
 }
 g.dispose();skin.material.dispose();
});
