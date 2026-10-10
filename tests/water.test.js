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
  for(const p of w.ponds){assert(p.mesh.material.forceSinglePass);assert(!p.mesh.material.depthWrite);assert(p.mesh.material.transparent);assert(p.bank.material.isMeshLambertMaterial&&p.bank.receiveShadow,'wet banks must respond to the existing light and shadow');assert(!p.bank.material.depthWrite);assert.equal(p.mesh.position.y,.075);assert.equal(p.bank.position.y,.045);assert.equal(p.mesh.geometry.attributes.position.count,192);assert.equal(waterDepth(p,p.x,p.z),1);}
  w.group.traverse(o=>{if(o.isInstancedMesh)o.dispose();if(o.userData.ownedGeometry)o.geometry.dispose();});
 }
});
test('flow and wet banks share filtered detail and a simulation clock without moving water bounds',()=>{
 let texture;for(const id of['forest','snow','coast']){
  const group=new T.Group(),ponds=buildPonds(group,id,seeded(3),{x:-30,z:-30},[],[{x:2,z:4,rx:6,rz:5,angle:.3}]),p=ponds[0];
  const compile=(material,kind)=>{const shader={uniforms:{},vertexShader:T.ShaderLib[kind].vertexShader,fragmentShader:T.ShaderLib[kind].fragmentShader};material.onBeforeCompile(shader);return shader;};
  const surface=compile(p.mesh.material,'standard'),bank=compile(p.bank.material,'lambert'),detail=surface.uniforms.waterDetail.value;
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
test('shore leaves bend and taper within the existing instances and preserve the layout RNG stream',()=>{
 let sharedGeometry;
 for(const id of['forest','snow','coast','sand']){
  let calls=0;const random=seeded(31),rnd=()=>{calls++;return random();},group=new T.Group();
  const ponds=buildPonds(group,id,rnd,{x:-30,z:-30},[],[{x:2,z:4,rx:6,rz:5,angle:.3}]);
  assert.equal(calls,222,'visual detail consumed extra layout randomness');assert.equal(rnd(),.9174752309918404);
  assert.deepEqual(ponds.map(p=>[p.x,p.z,p.rx,p.rz,p.angle]),[[2,4,6,5,.3]]);
  const reeds=group.getObjectByName('pond-reeds'),stones=group.getObjectByName('pond-shore-stones'),g=reeds.geometry,p=g.attributes.position;
  assert.equal(reeds.count,24);assert.equal(stones.count,6);assert.equal(group.children.length,4);
  assert.equal(g.index.count/3,12);assert.equal(reeds.material.side,T.DoubleSide);assert.equal(reeds.material.forceSinglePass,true);
  assert(reeds.material.vertexColors);if(sharedGeometry)assert.equal(g,sharedGeometry);sharedGeometry=g;
  const a=new T.Vector3(),b=new T.Vector3(),root=new T.Vector3(),middle=new T.Vector3(),tip=new T.Vector3();
  for(let leaf=0;leaf<2;leaf++){
   const offset=leaf*8,center=(row,out)=>out.fromBufferAttribute(p,offset+row*2).add(a.fromBufferAttribute(p,offset+row*2+1)).multiplyScalar(.5);
   center(0,root);center(1,middle);center(3,tip);
   assert.equal(root.y,-.5);assert(tip.y>.25&&tip.y<=.5);assert(Math.hypot(tip.x-root.x,tip.z-root.z)>1,'reed silhouette stayed a rigid upright spike');
   const span=row=>a.fromBufferAttribute(p,offset+row*2).distanceTo(b.fromBufferAttribute(p,offset+row*2+1));
   assert(span(3)<span(1)*.1,'leaf tip did not taper');assert(middle.x!==root.x||middle.z!==root.z);
  }
  for(const attribute of [p,g.attributes.normal,g.attributes.color])assert(Array.from(attribute.array).every(Number.isFinite));
  group.traverse(o=>{if(o.isInstancedMesh)o.dispose();});
 }
});
test('forest shore plants and stones form uneven small clusters without adding geometry or deep-water props',()=>{
 const matrix=new T.Matrix4(),point=new T.Vector3(),scale=new T.Vector3();
 for(let seed=0;seed<20;seed++){
  const group=new T.Group(),[pond]=buildPonds(group,'forest',seeded(seed),{x:-30,z:-30},[],[{x:2,z:4,rx:6,rz:5,angle:.3}]);
  for(const [name,stride]of [['pond-reeds',6],['pond-shore-stones',2]]){
   const batch=group.getObjectByName(name),points=[];
   for(let i=0;i<batch.count;i++){
    batch.getMatrixAt(i,matrix);point.setFromMatrixPosition(matrix);scale.setFromMatrixScale(matrix);points.push(point.clone());
    assert(waterDepth(pond,point.x,point.z)<.12,'shore dressing drifted into swimming water');
    assert(scale.x>0&&scale.y>0&&scale.z>0);assert(point.y<.55,'shore plant conceals near-ground combat');
    if(name==='pond-shore-stones'){
     const vertices=batch.geometry.attributes.position,vertex=new T.Vector3();let bottom=Infinity,top=-Infinity;
     for(let j=0;j<vertices.count;j++){vertex.fromBufferAttribute(vertices,j).applyMatrix4(matrix);bottom=Math.min(bottom,vertex.y);top=Math.max(top,vertex.y);}
     assert(bottom>=-.05&&bottom<=-.02,'transformed shore stone floats or sinks too far');assert(top>.04,'small shore stone disappeared underground');
    }
   }
   for(let i=0;i<points.length;i+=stride)for(let j=i+1;j<i+stride;j++)assert(points[i].distanceTo(points[j])<1.55,'one small shoreline cluster became a uniform ring');
  }
  group.traverse(o=>{if(o.isInstancedMesh)o.dispose();});
 }
});
test('forest wet sediment stays dark and neutral while other shore palettes retain their identity',()=>{
 const banks={};
 for(const id of['forest','snow','coast','sand']){
  const group=new T.Group(),[pond]=buildPonds(group,id,seeded(31),{x:-30,z:-30},[],[{x:2,z:4,rx:6,rz:5,angle:.3}]);
  banks[id]=pond.bank.material;
  assert.equal(pond.bank.scale.x,pond.rx*1.12);assert.equal(pond.mesh.scale.x,pond.rx);
  group.traverse(o=>{if(o.isInstancedMesh)o.dispose();});
 }
 const forest=banks.forest.color,luminance=c=>c.r*.2126+c.g*.7152+c.b*.0722;
 assert(luminance(forest)<.08&&luminance(forest)<luminance(banks.coast.color)*.5,'forest bank became a bright sandy outline');
 assert(forest.g>forest.r&&forest.b>forest.r*.9,'forest sediment became yellow rather than damp neutral soil');assert(banks.forest.opacity<=.25);
 for(const[id,color]of Object.entries({snow:0x798480,coast:0x82785d,sand:0x97845e}))assert.equal(banks[id].color.getHex(),color);
});
test('water pose does not accumulate and returns to land for heroes and ground creatures',()=>{
 for(const kind of ['silver','scout','wraith','wolf','golem','mushroom']){const g=actor(kind),d=g.userData;d.waterDepth=1;
  for(let i=0;i<600;i++){animateActor(g,i/60,3,0,0);assert(Math.abs(d.rig.position.y)<1.2);g.traverse(o=>{assert(Number.isFinite(o.quaternion.w));assert(Number.isFinite(o.position.y));});}
  assert(d.waterBlend>.99);assert(d.rig.position.y<0);
  d.waterDepth=0;for(let i=600;i<720;i++)animateActor(g,i/60,0,0,0);assert(d.waterBlend<.001);assert(d.rig.position.y>-.1);
 }
});
