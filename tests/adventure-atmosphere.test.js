import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../vendor/three.module.js';
import {AdventureAtmosphere} from '../adventure-atmosphere.js';
import {CLIMATE_LIGHT,EnvironmentLighting} from '../environment-lighting.js';

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
  assert(u.cloudAmount.value>0&&u.cloudAmount.value<=1);
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

test('biome cloud shapes differ, blend at the same rate and freeze with the game clock',()=>{
 const camera=new T.PerspectiveCamera(),shapes=new Set();
 for(const mapId of Object.keys(CLIMATE_LIGHT)){
  const sky=new AdventureAtmosphere(new T.Scene());sky.update(0,camera,{mapId});const p=sky.mesh.material.uniforms.cloudProfile.value;
  shapes.add(p.toArray().join(','));assert(p.x>0&&p.y>0&&p.z<p.w);sky.dispose();
 }
 assert.equal(shapes.size,5);
 const slow=new AdventureAtmosphere(new T.Scene()),fast=new AdventureAtmosphere(new T.Scene());slow.update(0,camera);fast.update(0,camera);
 for(let i=1;i<=60;i++){slow.update(i/30,camera,{mapId:'snow'});fast.update((i*2-1)/60,camera,{mapId:'snow'});fast.update(i/30,camera,{mapId:'snow'});}
 const a=slow.mesh.material.uniforms,b=fast.mesh.material.uniforms;assert(a.cloudProfile.value.clone().sub(b.cloudProfile.value).length()<1e-10);assert(a.cloudLayer.value.clone().sub(b.cloudLayer.value).length()<1e-10);assert(Math.abs(a.cloudAmount.value-b.cloudAmount.value)<1e-10);
 const frozen=a.cloudProfile.value.clone(),layer=a.cloudLayer.value.clone();slow.update(2,camera,{mapId:'ash'});assert(a.cloudProfile.value.equals(frozen),'pause changed cloud shape');assert(a.cloudLayer.value.equals(layer),'pause changed cloud altitude or light');
 slow.update(0,camera,{mapId:'forest'});assert.deepEqual(a.cloudProfile.value.toArray(),[3.4,3,.43,.64]);assert.deepEqual(a.cloudLayer.value.toArray(),[.025,.13,.86,1.04]);slow.dispose();fast.dispose();
});

test('cloud altitude separates low smoke, visible woodland masses and sparse desert high cloud',()=>{
 const camera=new T.PerspectiveCamera(),profiles={};
 for(const mapId of Object.keys(CLIMATE_LIGHT)){
  const sky=new AdventureAtmosphere(new T.Scene());sky.update(0,camera,{mapId});const u=sky.mesh.material.uniforms;
  profiles[mapId]={shape:u.cloudProfile.value.clone(),layer:u.cloudLayer.value.clone(),amount:u.cloudAmount.value};
  const p=profiles[mapId].layer;assert(p.x>=0&&p.x<p.y&&p.y<p.z&&p.z<.995&&p.w>0);sky.dispose();
 }
 assert(profiles.forest.layer.y<Math.sin(10*Math.PI/180),'woodland cloud is still hidden at the first-person low sky angle');
 assert(profiles.snow.shape.y/profiles.snow.shape.x>2,'snow should form wind sheets');
 assert(profiles.ash.layer.z<profiles.forest.layer.z&&profiles.ash.layer.w<profiles.forest.layer.w*.65,'ash must remain low and smoke-dark');
 assert(profiles.sand.layer.x>profiles.forest.layer.y&&profiles.sand.shape.z>profiles.forest.shape.z&&profiles.sand.amount<profiles.forest.amount,'sand cloud must remain higher and sparser');
 assert(profiles.coast.shape.x/profiles.coast.shape.y>2,'maritime cloud should form long bands');
});

test('the shader keeps four noise samples and an exact output-space fog horizon while exposing low-angle cloud',()=>{
 const sky=new AdventureAtmosphere(new T.Scene()),shader=sky.mesh.material.fragmentShader;
 assert.equal((shader.match(/\bcloudNoise\(/g)||[]).length,5,'one definition plus four samples; no extra cloud octave');
 assert(!/texture(?:2D|Cube)?\s*\(/.test(shader));
 const fade=shader.match(/float height=smoothstep\(([^,]+),([^,]+),direction.y\)/);assert(fade,'horizon fade is missing');
 const low=Number(fade[1]),high=Number(fade[2]);assert.equal(T.MathUtils.smoothstep(0,low,high),0);
 assert(T.MathUtils.smoothstep(Math.sin(10*Math.PI/180),low,high)>.6,'terrain fog still dilutes most of the visible first-person sky');
 const output=shader.indexOf('#include <colorspace_fragment>'),horizon=shader.indexOf('vec3 horizon=linearToOutputTexel(vec4(fogColor,1.)).rgb;');
 assert(horizon>output);assert(shader.slice(horizon).includes('mix(horizon,gl_FragColor.rgb,height)'),'direct and HDR horizon must retain the scene fog color');
 sky.dispose();
});

test('the sky tracks gradual mixed-biome lighting without resetting its geometry, sun or time',()=>{
 const scene=new T.Scene(),camera=new T.PerspectiveCamera(),hemi=new T.HemisphereLight(),sun=new T.DirectionalLight(),rim=new T.DirectionalLight();
 scene.fog=new T.FogExp2();scene.background=new T.Color();scene.add(hemi,sun,rim);
 const sky=new AdventureAtmosphere(scene),lighting=new EnvironmentLighting(scene,{toneMappingExposure:1},hemi,sun,rim);
 const geometry=sky.mesh.geometry,material=sky.mesh.material,u=material.uniforms,direction=u.sunDirection.value.clone();
 lighting.update('forest');
 for(const neighbor of ['snow','ash','sand','coast'])for(let frame=0;frame<30;frame++){
  lighting.update('confluence',{forest:1-frame/29,[neighbor]:frame/29},1/30);
  sky.update(12,camera,{mapId:'confluence',skyColor:hemi.color,fogColor:scene.fog.color,sunColor:sun.color});
  assert(u.skyColor.value.equals(hemi.color));assert(u.fogColor.value.equals(scene.fog.color));assert(u.sunColor.value.equals(sun.color));
  assert.equal(sky.mesh.geometry,geometry);assert.equal(sky.mesh.material,material);assert(u.sunDirection.value.equals(direction));assert.equal(u.skyTime.value,12);
  for(const key of ['skyColor','fogColor','sunColor'])assert(u[key].value.toArray().every(value=>Number.isFinite(value)&&value>=0&&value<=1));
 }
 assert.equal(scene.children.filter(o=>o.isLight).length,3);sky.dispose();
});

test('a new world initializes its own clouds on the continuing clock without changing regional blends or pause',()=>{
 const sky=new AdventureAtmosphere(new T.Scene()),camera=new T.PerspectiveCamera(),forest={},ash={},coast={},u=sky.mesh.material.uniforms;
 sky.update(20,camera,{world:forest,mapId:'forest'});
 sky.update(20.4,camera,{world:ash,mapId:'ash'});
 assert.deepEqual(u.cloudProfile.value.toArray(),[2.2,3,.30,.64]);assert.deepEqual(u.cloudLayer.value.toArray(),[.012,.09,.58,.58]);
 const paused=u.cloudLayer.value.clone();sky.update(20.4,camera,{world:ash,mapId:'coast'});assert(u.cloudLayer.value.equals(paused),'paused region change advanced cloud climate');
 sky.update(20.5,camera,{world:ash,mapId:'coast'});assert(u.cloudLayer.value.w>.58&&u.cloudLayer.value.w<1.02,'same-world region transition snapped instead of blending');
 sky.update(20.5,camera,{world:coast,mapId:'coast'});assert.deepEqual(u.cloudLayer.value.toArray(),[.02,.12,.82,1.02]);assert.equal(u.cloudAmount.value,.88);
 // A hidden lobby may install the new world before its first combat draw.
 const nextForest={};sky.update(21,camera,{world:nextForest,mapId:'forest',visible:false});
 sky.update(21,camera,{world:nextForest,mapId:'forest'});assert.deepEqual(u.cloudProfile.value.toArray(),[3.4,3,.43,.64]);assert.deepEqual(u.cloudLayer.value.toArray(),[.025,.13,.86,1.04]);
 assert.equal(u.skyTime.value,21);sky.dispose();assert.equal(sky.world,null);
});
