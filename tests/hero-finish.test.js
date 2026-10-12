import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../vendor/three.module.js';
import {smoothSeams,finishHeroSurface} from '../hero-finish.js';

test('finishing preserves the reconstructed coastal metal and cloth surface parameters',()=>{
 const root=new T.Group(),material=new T.MeshStandardMaterial({roughness:.52,metalness:.46});
 material.name='MAT_Hero_Tide_Copper';const buckle=new T.Mesh(new T.SphereGeometry(.03),material);buckle.userData.rebuiltPart=true;root.add(buckle);
 finishHeroSurface(root,'tide');assert.equal(buckle.material.roughness,.52);assert.equal(buckle.material.metalness,.46);assert.notEqual(buckle.material,material);
});

test('surface finishing preserves skin attributes, custom shaders and independent materials',()=>{
 const root=new T.Group(),geometry=new T.BoxGeometry(1,1,1),m=new T.MeshStandardMaterial({normalScale:new T.Vector2(.4,.4)});
 m.name='Superhero';const compile=()=>{},key=()=> 'custom-skin';m.onBeforeCompile=compile;m.customProgramCacheKey=key;
 geometry.setAttribute('skinIndex',new T.Uint16BufferAttribute(new Uint16Array(geometry.attributes.position.count*4).fill(1),4));geometry.setAttribute('skinWeight',new T.Float32BufferAttribute(new Float32Array(geometry.attributes.position.count*4).fill(.25),4));
 const actor=new T.Mesh(geometry,m);root.add(actor);const p=Array.from(geometry.attributes.position.array),w=Array.from(geometry.attributes.skinWeight.array);
 finishHeroSurface(root,'silver');assert.notEqual(actor.material,m);assert.notEqual(actor.geometry,geometry);assert.equal(actor.material.onBeforeCompile,compile);assert.equal(actor.material.customProgramCacheKey,key);assert.deepEqual(Array.from(actor.geometry.attributes.position.array),p);assert.deepEqual(Array.from(actor.geometry.attributes.skinWeight.array),w);assert.equal(m.normalScale.x,.4);
 smoothSeams(actor.geometry);assert(Array.from(actor.geometry.attributes.normal.array).every(Number.isFinite));
});
test('garment finishing retains texture masks and earlier palette shaders without changing the rig',()=>{
 const root=new T.Group(),texture=new T.Texture(),material=new T.MeshStandardMaterial({map:texture,metalnessMap:texture});
 material.name='Ranger';material.onBeforeCompile=s=>{s.fragmentShader+='\n// authored palette';};material.customProgramCacheKey=()=> 'violet-palette';
 for(const name of ['Body','Belt']){const mesh=new T.Mesh(new T.CylinderGeometry(.2,.3,.6,12),material);mesh.name=name;root.add(mesh);}
 const positions=root.children.map(m=>Array.from(m.geometry.attributes.position.array));finishHeroSurface(root,'mirage');
 for(const [i,mesh]of root.children.entries()){
  assert.equal(mesh.material.map,texture);assert.equal(mesh.material.metalnessMap,texture);assert.deepEqual(Array.from(mesh.geometry.attributes.position.array),positions[i]);
  const shader={fragmentShader:'#include <metalnessmap_fragment>'};mesh.material.onBeforeCompile(shader);assert.match(shader.fragmentShader,/authored palette/);assert.match(shader.fragmentShader,/roughnessFactor/);
  assert.match(mesh.material.customProgramCacheKey(),/^violet-palette-/);
 }
 assert.notEqual(root.children[0].material.customProgramCacheKey(),root.children[1].material.customProgramCacheKey());
 assert.equal(material.metalness,0);assert.equal(material.roughness,1);
});
