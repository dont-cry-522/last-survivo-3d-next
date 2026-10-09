import test from'node:test';
import assert from'node:assert/strict';
import * as T from'../vendor/three.module.js';
import{EnvironmentLighting,CLIMATE_LIGHT,installDistantLandscape}from'../environment-lighting.js';
import{polishEnvironmentModels}from'../environment-props.js';
import{buildWorld,clearAt}from'../world.js';
globalThis.document={createElement:()=>({getContext:()=>({fillRect(){}})})};

test('climate transitions reuse lights and interpolate physical colors without flashes',()=>{
 const scene=new T.Scene(),renderer={toneMappingExposure:1},hemi=new T.HemisphereLight(),sun=new T.DirectionalLight(),rim=new T.DirectionalLight();
 scene.fog=new T.FogExp2();scene.background=new T.Color();scene.add(hemi,sun,rim);const lighting=new EnvironmentLighting(scene,renderer,hemi,sun,rim);
 for(const id of Object.keys(CLIMATE_LIGHT)){lighting.update(id);assert.equal(scene.fog.color.getHex(),CLIMATE_LIGHT[id].fog);assert.equal(renderer.toneMappingExposure,CLIMATE_LIGHT[id].exposure);}
 lighting.update('forest');const before=scene.fog.color.clone();lighting.update('snow',null,1/60);assert(!before.equals(scene.fog.color));assert.notEqual(scene.fog.color.getHex(),CLIMATE_LIGHT.snow.fog);
 lighting.update('confluence',{forest:.5,snow:.5});assert(Math.abs(scene.fog.density-(CLIMATE_LIGHT.forest.density+CLIMATE_LIGHT.snow.density)/2)<1e-9);assert.equal(scene.children.length,3);
});
test('shadow fill keeps sunlight directional and retains the existing fog and exposure ranges',()=>{
 const scene=new T.Scene(),renderer={toneMappingExposure:1},hemi=new T.HemisphereLight(),sun=new T.DirectionalLight(),rim=new T.DirectionalLight();
 scene.fog=new T.FogExp2();scene.background=new T.Color();scene.add(hemi,sun,rim);
 const shadow=sun.shadow,camera=shadow.camera,size=shadow.mapSize.clone(),lighting=new EnvironmentLighting(scene,renderer,hemi,sun,rim);
 const atmosphere={forest:[.0105,1.08],snow:[.012,1.02],ash:[.014,1.08],sand:[.009,1.04],coast:[.011,1.06]};
 for(const [id,[density,exposure]]of Object.entries(atmosphere)){
  lighting.update(id);assert.equal(scene.fog.density,density);assert.equal(renderer.toneMappingExposure,exposure);
  assert(sun.shadow.intensity>=.85&&sun.shadow.intensity<1,'cast shadows still erase all direct detail');
  assert(sun.intensity>hemi.intensity*2,'sunlit forms lost their directional contrast');
  assert(sun.color.r>sun.color.b&&hemi.color.b>hemi.color.r,'warm sunlight/cool ambient relation lost');
  assert.equal(sun.shadow,shadow);assert.equal(shadow.camera,camera);assert(shadow.mapSize.equals(size));assert.equal(scene.children.length,3);
 }
});
test('forest-to-border light changes stay bounded and take the same time at 30 and 60 Hz',()=>{
 const rig=()=>{
  const scene=new T.Scene(),renderer={toneMappingExposure:1},hemi=new T.HemisphereLight(),sun=new T.DirectionalLight(),rim=new T.DirectionalLight();
  scene.fog=new T.FogExp2();scene.background=new T.Color();scene.add(hemi,sun,rim);
  const light=new EnvironmentLighting(scene,renderer,hemi,sun,rim),values=()=>[...hemi.color.toArray(),...hemi.groundColor.toArray(),...sun.color.toArray(),...rim.color.toArray(),...scene.fog.color.toArray(),hemi.intensity,sun.intensity,rim.intensity,scene.fog.density,renderer.toneMappingExposure];
  light.update('forest');return{scene,light,values};
 };
 for(const neighbor of ['snow','ash','sand','coast']){
  const slow=rig(),fast=rig(),target=rig(),weights={forest:.35,[neighbor]:.65},start=slow.values();target.light.update('confluence',weights);const end=target.values();
  for(let i=0;i<60;i++){
   slow.light.update('confluence',weights,1/30);fast.light.update('confluence',weights,1/60);fast.light.update('confluence',weights,1/60);
   const a=slow.values(),b=fast.values();for(let j=0;j<a.length;j++){assert(Number.isFinite(a[j]));assert(a[j]>=Math.min(start[j],end[j])-1e-12&&a[j]<=Math.max(start[j],end[j])+1e-12,'climate lighting overshot its color/exposure range');assert(Math.abs(a[j]-b[j])<1e-12,'transition speed changed with refresh rate');}
  }
  assert.equal(slow.scene.children.length,3);assert.equal(fast.scene.children.length,3);
 }
});
test('distant scenery stays beyond map bounds and scenery finish preserves playable layouts',()=>{
 for(const id of ['forest','snow','ash','sand','coast','confluence']){
  const w=buildWorld(id,7),snapshot=JSON.stringify(w.obstacles.map(o=>[o.x,o.z,o.r])),draws=[];
  w.group.traverse(o=>{if(o.isMesh)draws.push(o);});polishEnvironmentModels(w);
  const after=[];w.group.traverse(o=>{if(o.isMesh)after.push(o);});assert.equal(after.length,draws.length);assert.equal(JSON.stringify(w.obstacles.map(o=>[o.x,o.z,o.r])),snapshot);assert(clearAt(w,w.spawn.x,w.spawn.z,1));
  const ridge=installDistantLandscape(w,id,()=> 'forest'),position=ridge.geometry.attributes.position;
  assert.equal(ridge.geometry.index.count/3,1152);assert(!ridge.material.transparent&&!ridge.castShadow&&ridge.userData.ownedGeometry);
  for(let i=0;i<position.count;i++){assert(Math.max(Math.abs(position.getX(i)),Math.abs(position.getZ(i)))>w.half+4);assert(Number.isFinite(position.getY(i)));}
  const scales=after.map(o=>o.scale.toArray());polishEnvironmentModels(w);assert.deepEqual(after.map(o=>o.scale.toArray()),scales,'second finish changed scale');
  w.group.traverse(o=>{if(o.isInstancedMesh)o.dispose();if(o.userData.ownedGeometry)o.geometry.dispose();});
 }
});
test('distant layers have different ridgelines, softer far colors and a closed lighting seam',()=>{
 let sharedMaterial;
 for(const id of Object.keys(CLIMATE_LIGHT)){
  const world={half:96,group:new T.Group()},mesh=installDistantLandscape(world,id);
  const {position,color,normal}=mesh.geometry.attributes,segments=144,ringSize=(segments+1)*3;
  assert.equal(mesh.geometry.index.count/3,1152);assert.equal(position.count,ringSize*2);
  if(sharedMaterial)assert.equal(mesh.material,sharedMaterial);else sharedMaterial=mesh.material;
  const ratios=[],fog=new T.Color(CLIMATE_LIGHT[id].fog),near=new T.Color(),far=new T.Color();
  const distance=c=>Math.hypot(c.r-fog.r,c.g-fog.g,c.b-fog.b);
  for(let i=0;i<segments;i++){
   const top=i*3+2;ratios.push(position.getY(top+ringSize)/position.getY(top));
   assert(position.getY(top)>0&&position.getY(top+ringSize)>0);
   near.fromBufferAttribute(color,top);far.fromBufferAttribute(color,top+ringSize);
   assert(distance(far)<distance(near),id+' far ridge lost its haze separation');
  }
  assert(Math.max(...ratios)-Math.min(...ratios)>.5,id+' far ridge repeats a scaled near silhouette');
  for(let ring=0;ring<2;ring++)for(let row=0;row<3;row++){
   const first=ring*ringSize+row,last=first+segments*3;
   for(const attribute of [position,color,normal]){
    const a=new T.Vector3().fromBufferAttribute(attribute,first),b=new T.Vector3().fromBufferAttribute(attribute,last);
    assert(a.distanceTo(b)<1e-6,id+' has an open geometry/color/normal seam');
   }
   const n=new T.Vector3().fromBufferAttribute(normal,first);assert(Math.abs(n.length()-1)<1e-6);
  }
  for(const index of mesh.geometry.index.array)assert(index>=0&&index<position.count);
  mesh.geometry.dispose();
 }
});
