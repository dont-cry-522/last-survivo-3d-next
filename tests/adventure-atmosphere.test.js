import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../vendor/three.module.js';
import {AdventureAtmosphere} from '../adventure-atmosphere.js';
import {CLIMATE_LIGHT} from '../environment-lighting.js';

test('atmosphere is one background draw without altering the scene background, fog, or lighting',()=>{
 const scene=new T.Scene();scene.background=new T.Color(0x36545a);scene.fog=new T.FogExp2(0x36545a,.01);
 const background=scene.background,fog=scene.fog,light=new T.HemisphereLight();scene.add(light);
 const sky=new AdventureAtmosphere(scene),mesh=sky.mesh,m=mesh.material;
 assert.equal(scene.children.length,2);assert.equal(scene.children.filter(o=>o.isLight).length,1);assert.equal(mesh.visible,false);
 assert.equal(m.side,T.BackSide);assert.equal(m.transparent,false);assert.equal(m.depthWrite,false);assert.equal(m.depthTest,false);
 assert.equal(m.fog,false);assert.equal(m.toneMapped,true);assert.equal(mesh.renderOrder,-1000);assert(!mesh.castShadow&&!mesh.receiveShadow);
 mesh.geometry.computeBoundingSphere();assert(Math.abs(mesh.geometry.boundingSphere.radius-160)<1e-4);
 assert(mesh.geometry.index.count/3<600);assert(Object.values(m.uniforms).every(u=>!u.value?.isTexture));
 sky.update(0,new T.PerspectiveCamera(65,1,.1,200));
 assert.equal(scene.background,background);assert.equal(scene.fog,fog);assert.equal(background.getHex(),0x36545a);
 sky.dispose();assert.deepEqual(scene.children,[light]);
});

test('each climate supplies the existing palette and blended lighting colors are copied rather than retained',()=>{
 const scene=new T.Scene(),camera=new T.PerspectiveCamera(),sky=new AdventureAtmosphere(scene),u=sky.mesh.material.uniforms;
 for(const [mapId,climate]of Object.entries(CLIMATE_LIGHT)){
  sky.update(5,camera,{mapId});
  for(const field of ['sky','fog','sun'])assert(u[field+'Color'].value.equals(new T.Color(climate[field])),mapId+' '+field);
  assert(u.cloudAmount.value>0&&u.cloudAmount.value<=.15);
 }
 const skyColor=new T.Color(.22,.35,.43),fogColor=new T.Color(.13,.18,.21),sunColor=new T.Color(.9,.72,.5);
 const originals=[skyColor.clone(),fogColor.clone(),sunColor.clone()];
 sky.update(8,camera,{mapId:'confluence',skyColor,fogColor,sunColor});
 [skyColor,fogColor,sunColor].forEach(c=>c.set(0));
 ['skyColor','fogColor','sunColor'].forEach((key,i)=>assert(u[key].value.equals(originals[i])));
 sky.update(9,camera,{mapId:'unknown'});assert(u.skyColor.value.equals(new T.Color(CLIMATE_LIGHT.forest.sky)));sky.dispose();
});

test('sky follows camera translation while sun direction is world-fixed and repeated game time is stationary',()=>{
 const scene=new T.Scene(),parent=new T.Group(),camera=new T.PerspectiveCamera(),sky=new AdventureAtmosphere(scene);
 parent.position.set(12,3,-8);camera.position.set(2,1,5);parent.add(camera);scene.add(parent);
 sky.update(20,camera);assert.deepEqual(sky.mesh.position.toArray(),[14,4,-3]);
 const sun=sky.mesh.material.uniforms.sunDirection.value.clone();assert(sun.distanceTo(new T.Vector3(-18,30,14).normalize())<1e-12);
 camera.rotation.set(.4,1.2,.1);camera.position.set(7,2,9);sky.update(20,camera);
 assert.deepEqual(sky.mesh.position.toArray(),[19,5,1]);assert(sky.mesh.quaternion.equals(new T.Quaternion()));
 assert(sky.mesh.material.uniforms.sunDirection.value.equals(sun));assert.equal(sky.mesh.material.uniforms.skyTime.value,20);
 sky.update(NaN,camera);assert.equal(sky.mesh.material.uniforms.skyTime.value,20);
 sky.update(30,camera,{visible:false});assert.equal(sky.mesh.visible,false);assert.equal(sky.mesh.material.uniforms.skyTime.value,20);
 sky.update(30,camera,{visible:true});assert.equal(sky.mesh.visible,true);assert.equal(sky.mesh.material.uniforms.skyTime.value,30);sky.dispose();
});

test('dispose is idempotent and leaves another atmosphere and scene resources intact',()=>{
 const scene=new T.Scene(),one=new AdventureAtmosphere(scene),two=new AdventureAtmosphere(scene),camera=new T.PerspectiveCamera();
 let geometries=0,materials=0;one.mesh.geometry.addEventListener('dispose',()=>geometries++);one.mesh.material.addEventListener('dispose',()=>materials++);
 assert.notEqual(one.mesh.geometry,two.mesh.geometry);assert.notEqual(one.mesh.material,two.mesh.material);
 one.dispose();one.dispose();one.update(10,camera,{visible:true});
 assert.equal(geometries,1);assert.equal(materials,1);assert.equal(one.mesh.parent,null);assert.equal(one.mesh.visible,false);
 two.update(10,camera);assert.equal(two.mesh.visible,true);assert.equal(two.mesh.parent,scene);two.dispose();assert.equal(scene.children.length,0);
});
