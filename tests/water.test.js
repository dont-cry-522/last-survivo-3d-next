import{test}from'node:test';import assert from'node:assert/strict';
import{waterDepth,terrainAt,buildPonds,animateWater}from'../water.js';
import{buildWorld,actor,animateActor}from'../world.js';
import{CLIMATE_LIGHT}from'../environment-lighting.js';
import * as T from'../vendor/three.module.js';import{seeded}from'../rules.js';
globalThis.document={createElement:()=>({getContext:()=>({fillRect(){}})})};
test('water depth follows the rotated shoreline and slows gradually without stacking mud',()=>{
 const pond={kind:'water',x:5,z:7,rx:6,rz:4,angle:Math.PI/2},world={patches:[pond,{kind:'slow',x:5,z:7,r:10}]};
 assert.equal(waterDepth(pond,5,7),1);assert.equal(waterDepth(pond,10,7),0);assert(waterDepth(pond,5,2)>0);
 assert.equal(terrainAt(world,5,7).speed,.48);assert.equal(terrainAt(world,5,7,'golem').speed,.76);assert.equal(terrainAt(world,5,7,'snowtotem').speed,1);assert.equal(terrainAt(world,50,50).speed,1);
 const speeds=[0,1,2,3,4,5,6,7].map(d=>terrainAt({patches:[pond]},5,7+d).speed);assert(speeds.every((n,i)=>!i||n>=speeds[i-1]));
});
test('ponds stay clear of trees, spawn and reward sites; ash stays dry; surface meshes are shared',()=>{
 let previous;for(const id of ['forest','snow','ash'])for(let seed=0;seed<30;seed++){
  const w=buildWorld(id,seed);assert.equal(w.ponds.length,id==='ash'?0:6);
  for(const p of w.ponds){assert(Math.hypot(p.x-w.spawn.x,p.z-w.spawn.z)>p.r+5);for(const s of w.sites)assert(Math.hypot(p.x-s.x,p.z-s.z)>p.r+7);for(const o of w.obstacles)assert(Math.hypot(p.x-o.x,p.z-o.z)>p.r);if(previous)assert.strictEqual(previous,p.mesh.geometry);previous=p.mesh.geometry;}
  w.group.traverse(o=>{if(o.isInstancedMesh)o.dispose();});
 }
});
test('water depth finish keeps a single surface pass and the existing two-layer shoreline',()=>{
 for(const id of['forest','snow','coast']){
  const w=buildWorld(id,7),waterMaterials=new Set(w.ponds.map(p=>p.mesh.material));assert.equal(waterMaterials.size,1);
  for(const p of w.ponds){assert(p.mesh.material.forceSinglePass);assert(!p.mesh.material.depthWrite);assert(p.mesh.material.transparent);assert.equal(p.mesh.position.y,.075);assert.equal(p.bank.position.y,.045);assert.equal(p.mesh.geometry.attributes.position.count,192);assert.equal(waterDepth(p,p.x,p.z),1);}
  w.group.traverse(o=>{if(o.isInstancedMesh)o.dispose();if(o.userData.ownedGeometry)o.geometry.dispose();});
 }
});
test('flow and wet banks share filtered detail and a simulation clock without moving water bounds',()=>{
 let texture;for(const id of['forest','snow','coast']){
  const group=new T.Group(),ponds=buildPonds(group,id,seeded(3),{x:-30,z:-30},[],[{x:2,z:4,rx:6,rz:5,angle:.3}]),p=ponds[0];
  const compile=(material,kind)=>{const shader={uniforms:{},vertexShader:T.ShaderLib[kind].vertexShader,fragmentShader:T.ShaderLib[kind].fragmentShader};material.onBeforeCompile(shader);return shader;};
  const surface=compile(p.mesh.material,'standard'),bank=compile(p.bank.material,'basic'),detail=surface.uniforms.waterDetail.value;
  assert.strictEqual(surface.uniforms.waterTime,bank.uniforms.waterTime);assert.strictEqual(detail,bank.uniforms.waterDetail.value);if(texture)assert.strictEqual(detail,texture);texture=detail;assert(detail.generateMipmaps);assert.equal(detail.minFilter,T.LinearMipmapLinearFilter);
  const before=[p.rx,p.rz,p.mesh.position.toArray(),p.mesh.scale.toArray(),waterDepth(p,6,6)],draws=group.children.length;
  for(const time of[8,8,12,0]){animateWater(id,time);assert.equal(surface.uniforms.waterTime.value,time);assert.equal(bank.uniforms.waterTime.value,time);assert.deepEqual([p.rx,p.rz,p.mesh.position.toArray(),p.mesh.scale.toArray(),waterDepth(p,6,6)],before);assert.equal(group.children.length,draws);}
  if(id==='coast')assert(surface.fragmentShader.indexOf('dFdx(waveHeight)')<surface.fragmentShader.indexOf('if(ownRadial>radial+.0001)discard'),'overlap clipping invalidates normal derivatives');
  group.traverse(o=>{if(o.isInstancedMesh)o.dispose();});
 }
});
test('low-angle water uses biome sky colors within the existing surface pass and texture budget',()=>{
 const palettes=[];
 for(const id of['forest','snow','coast']){
  const group=new T.Group(),ponds=buildPonds(group,id,seeded(31),{x:-30,z:-30},[],[{x:2,z:4,rx:6,rz:5,angle:.3}]),p=ponds[0];
  const compile=()=>{const shader={uniforms:{},vertexShader:T.ShaderLib.standard.vertexShader,fragmentShader:T.ShaderLib.standard.fragmentShader};p.mesh.material.onBeforeCompile(shader);return shader;};
  const shader=compile(),again=compile(),source=shader.fragmentShader;
  assert(shader.uniforms.waterSky.value.equals(new T.Color(CLIMATE_LIGHT[id].sky)));
  assert(shader.uniforms.waterHorizon.value.equals(new T.Color(CLIMATE_LIGHT[id].fog)));
  assert.strictEqual(shader.uniforms.waterSky,again.uniforms.waterSky,'recompilation must reuse cached reflection uniforms');
  assert.strictEqual(shader.uniforms.waterDetail,again.uniforms.waterDetail);
  palettes.push(shader.uniforms.waterSky.value.getHex());
  assert.equal((source.match(/texture2D\(waterDetail,/g)||[]).length,2,'shallow detail must reuse the two existing texture reads');
  assert(source.indexOf('dFdx(waveHeight)')<source.indexOf('vec3 waterReflection='),'reflection must see the final animated normal');
  assert(source.indexOf('outgoingLight=mix(outgoingLight,reflectedSky')<source.indexOf('#include <opaque_fragment>'),'reflection must precede alpha output');
  assert(source.includes('#include <tonemapping_fragment>')&&source.includes('#include <fog_fragment>'),'water reflection must retain scene tone mapping and distance fog');
  assert(source.includes('bedDetail=mix(.5,shoreGrain.b,rippleDetail)'),'close-up riverbed grain must fade before becoming subpixel');
  assert(!source.includes('totalEmissiveRadiance+='),'the water plane must not emit its own glow');
  assert.equal(group.children.length,4,'one pond still uses two surface meshes and two shared shore batches');
  group.traverse(o=>{if(o.isInstancedMesh)o.dispose();});
 }
 assert.equal(new Set(palettes).size,3,'forest, snow and coast keep their own reflection palettes');
});
test('water pose does not accumulate and returns to land for heroes and ground creatures',()=>{
 for(const kind of ['silver','scout','wraith','wolf','golem','mushroom']){const g=actor(kind),d=g.userData;d.waterDepth=1;
  for(let i=0;i<600;i++){animateActor(g,i/60,3,0,0);assert(Math.abs(d.rig.position.y)<1.2);g.traverse(o=>{assert(Number.isFinite(o.quaternion.w));assert(Number.isFinite(o.position.y));});}
  assert(d.waterBlend>.99);assert(d.rig.position.y<0);
  d.waterDepth=0;for(let i=600;i<720;i++)animateActor(g,i/60,0,0,0);assert(d.waterBlend<.001);assert(d.rig.position.y>-.1);
 }
});
