import{test}from'node:test';import assert from'node:assert/strict';
import{waterDepth,terrainAt,buildPonds,animateWater,updateWaterLighting}from'../water.js';
import{buildWorld,actor,animateActor}from'../world.js';
import{CLIMATE_LIGHT}from'../environment-lighting.js';
import * as T from'../vendor/three.module.js';import{seeded}from'../rules.js';
globalThis.document={createElement:()=>({getContext:()=>({fillRect(){}})})};
test('forest reed tips use the water clock with pinned roots and a bounded wind envelope',()=>{
 const group=new T.Group(),w={group,ponds:buildPonds(group,'forest',seeded(7),{x:-30,z:-30},[],[{x:2,z:4,rx:6,rz:5,angle:.3}])},reeds=w.group.getObjectByName('pond-reeds'),surface={uniforms:{},vertexShader:T.ShaderLib.standard.vertexShader,fragmentShader:T.ShaderLib.standard.fragmentShader},shader={uniforms:{},vertexShader:T.ShaderLib.standard.vertexShader,fragmentShader:T.ShaderLib.standard.fragmentShader};
 w.ponds[0].mesh.material.onBeforeCompile(surface);reeds.material.onBeforeCompile(shader);
 assert.strictEqual(shader.uniforms.reedTime,surface.uniforms.waterTime);
 assert(shader.vertexShader.includes('reedFlex*reedFlex*.055'));assert(shader.vertexShader.includes('clamp(position.y+.5,0.,1.)'));
 for(const time of[0,5,5,0]){animateWater('forest',time);assert.equal(shader.uniforms.reedTime.value,time);}
 const inflated=reeds.boundingSphere.radius;reeds.computeBoundingSphere();assert(Math.abs(inflated-reeds.boundingSphere.radius-.06)<1e-7);
 for(const id of['snow','coast']){const other=buildWorld(id,7),m=other.group.getObjectByName('pond-reeds').material;assert.notEqual(m.customProgramCacheKey(),'forest-bank-reed-wind');other.group.traverse(o=>{if(o.isInstancedMesh)o.dispose();});}
 w.group.traverse(o=>{if(o.isInstancedMesh)o.dispose();});
});
test('water depth follows the rotated shoreline and slows gradually without stacking mud',()=>{
 const pond={kind:'water',x:5,z:7,rx:6,rz:4,angle:Math.PI/2},world={patches:[pond,{kind:'slow',x:5,z:7,r:10}]};
 assert.equal(waterDepth(pond,5,7),1);assert.equal(waterDepth(pond,10,7),0);assert(waterDepth(pond,5,2)>0);
 assert.equal(terrainAt(world,5,7).speed,.48);assert.equal(terrainAt(world,5,7,'golem').speed,.76);assert.equal(terrainAt(world,5,7,'snowtotem').speed,1);assert.equal(terrainAt(world,50,50).speed,1);
 const speeds=[0,1,2,3,4,5,6,7].map(d=>terrainAt({patches:[pond]},5,7+d).speed);assert(speeds.every((n,i)=>!i||n>=speeds[i-1]));
});
test('rotated visible shoreline vertices keep shallow water inside and dry ground immediately outside',()=>{
 const point=new T.Vector3(),epsilon=.0001;
 for(const angle of[0,.31,Math.PI/2,-.74]){
  const group=new T.Group(),[pond]=buildPonds(group,'forest',seeded(8),{x:-30,z:-30},[],[{x:5,z:7,rx:6,rz:3.2,angle}]);
  group.updateMatrixWorld(true);const positions=pond.mesh.geometry.attributes.position;
  // Use the rendered outer-ring vertices, so rotation/scale or shore-profile mismatches fail here.
  for(let i=positions.count-48;i<positions.count;i++){
   point.fromBufferAttribute(positions,i).applyMatrix4(pond.mesh.matrixWorld);const dx=point.x-pond.x,dz=point.z-pond.z;
   assert(waterDepth(pond,point.x,point.z)<.000002,'visible shore disagrees with the water boundary');
   const inside=waterDepth(pond,pond.x+dx*(1-epsilon),pond.z+dz*(1-epsilon));
   assert(Math.abs(inside-epsilon/.48)<.000002,'water does not start gradually at the visible edge');
   assert.equal(waterDepth(pond,pond.x+dx*(1+epsilon),pond.z+dz*(1+epsilon)),0,'water extends beyond the visible edge');
  }
  group.traverse(o=>{if(o.isInstancedMesh)o.dispose();});
 }
});
test('ponds stay clear of trees, spawn and reward sites; ash stays dry; surface meshes are shared',()=>{
 let previous;for(const id of ['forest','snow','ash'])for(let seed=0;seed<30;seed++){
  const w=buildWorld(id,seed);if(id==='forest')assert(w.ponds.length>=3&&w.ponds.length<=8);else assert.equal(w.ponds.length,id==='ash'?0:6);
  for(const p of w.ponds){if(id==='forest'){for(const q of [w.spawn,...w.sites,...w.obstacles])assert.equal(waterDepth(p,q.x,q.z),0,'stream covers a spawn, reward or solid');}else{assert(Math.hypot(p.x-w.spawn.x,p.z-w.spawn.z)>p.r+5);for(const s of w.sites)assert(Math.hypot(p.x-s.x,p.z-s.z)>p.r+7);for(const o of w.obstacles)assert(Math.hypot(p.x-o.x,p.z-o.z)>p.r);}if(previous)assert.strictEqual(previous,p.mesh.geometry);previous=p.mesh.geometry;}
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
 let texture;for(const id of['forest','snow','coast','sand']){
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
 for(const id of['forest','snow','coast','sand']){
  const group=new T.Group(),ponds=buildPonds(group,id,seeded(31),{x:-30,z:-30},[],[{x:2,z:4,rx:6,rz:5,angle:.3}]),p=ponds[0];
  const compile=()=>{const shader={uniforms:{},vertexShader:T.ShaderLib.standard.vertexShader,fragmentShader:T.ShaderLib.standard.fragmentShader};p.mesh.material.onBeforeCompile(shader);return shader;};
  const shader=compile(),again=compile(),source=shader.fragmentShader;
  assert(shader.uniforms.waterSky.value.equals(new T.Color(CLIMATE_LIGHT[id].sky)));
  assert(shader.uniforms.waterHorizon.value.equals(new T.Color(CLIMATE_LIGHT[id].fog)));
  assert.strictEqual(shader.uniforms.waterSky,again.uniforms.waterSky,'recompilation must reuse cached reflection uniforms');
  assert.strictEqual(shader.uniforms.waterDetail,again.uniforms.waterDetail);
  palettes.push(shader.uniforms.waterSky.value.getHex());
  assert.equal((source.match(/texture2D\(waterDetail,/g)||[]).length,2,'the moving flow and stationary shore share two detail samples');
  assert.equal((source.match(/texture2D\(waterBed,/g)||[]).length,1,'each climate uses the same single gravel-bed sample');
  assert(source.indexOf('dFdx(waveHeight)')<source.indexOf('vec3 waterReflection='),'reflection must see the final animated normal');
  assert(source.indexOf('outgoingLight=mix(outgoingLight,reflectedSky')<source.indexOf('#include <opaque_fragment>'),'reflection must precede alpha output');
  assert(source.includes('#include <tonemapping_fragment>')&&source.includes('#include <fog_fragment>'),'water reflection must retain scene tone mapping and distance fog');
  assert(source.includes('bedDetail=mix(.5,shoreGrain.b,rippleDetail)'),'close-up riverbed grain must fade before becoming subpixel');
  assert(!source.includes('totalEmissiveRadiance+='),'the water plane must not emit its own glow');
  assert.equal(group.children.length,4,'one pond still uses two surface meshes and two shared shore batches');
  group.traverse(o=>{if(o.isInstancedMesh)o.dispose();});
 }
 assert.equal(new Set(palettes).size,4,'forest, snow, sand and coast keep their own reflection palettes');
});
test('all climate beds share one bounded filtered texture across water, wet banks and rebuilds',()=>{
 let texture;const uniforms=new Map();
 for(const id of['forest','forest','snow','coast','sand']){
  const group=new T.Group(),ponds=buildPonds(group,id,seeded(12),{x:-30,z:-30},[],[{x:2,z:4,rx:6,rz:5,angle:.3},{x:20,z:18,rx:5,rz:4,angle:-.6}]);
  for(const pond of ponds)for(const [material,kind]of[[pond.mesh.material,'standard'],[pond.bank.material,'lambert']]){
   const shader={uniforms:{},vertexShader:T.ShaderLib[kind].vertexShader,fragmentShader:T.ShaderLib[kind].fragmentShader};material.onBeforeCompile(shader);
   assert.equal((shader.fragmentShader.match(/texture2D\(waterDetail,/g)||[]).length,2,'water and wet banks keep their two existing detail samples');
   assert.equal((shader.fragmentShader.match(/texture2D\(waterBed,/g)||[]).length,1,'water and its continuous wet bank use one existing gravel sample');
   const bed=shader.uniforms.waterBed.value;
   if(texture)assert.strictEqual(bed,texture,'another climate or rebuild allocated a new gravel texture');else texture=bed;
   if(uniforms.has(id))assert.strictEqual(shader.uniforms.waterBed,uniforms.get(id),'one climate lost its shared water/bank uniform');else uniforms.set(id,shader.uniforms.waterBed);
   assert(bed.isDataTexture);assert.equal(bed.image.width,256);assert.equal(bed.image.height,256);assert.equal(bed.image.data.length,256*256*4);
   assert.equal(bed.colorSpace,T.NoColorSpace,'gravel RGB stores linear reflectance');assert.equal(bed.format,T.RGBAFormat);assert.equal(bed.type,T.UnsignedByteType);
   assert.equal(bed.wrapS,T.RepeatWrapping);assert.equal(bed.wrapT,T.RepeatWrapping);assert(bed.generateMipmaps);assert.equal(bed.minFilter,T.LinearMipmapLinearFilter);assert.equal(bed.magFilter,T.LinearFilter);
  }
  assert.equal(group.children.length,6,'gravel bed added a new rendered mesh');group.traverse(o=>{if(o.isInstancedMesh)o.dispose();});
 }
 assert([...texture.image.data].every(v=>Number.isFinite(v)&&v>=0&&v<=255),'gravel contains invalid channel values');
 for(let channel=0;channel<4;channel++){
  let min=255,max=0;for(let i=channel;i<texture.image.data.length;i+=4){min=Math.min(min,texture.image.data[i]);max=Math.max(max,texture.image.data[i]);}
  assert(max-min>16,'gravel reflectance or pebble height became a flat fill');
 }
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
   const batch=group.getObjectByName(name),points=[];let halfSubmerged=0;
   for(let i=0;i<batch.count;i++){
    batch.getMatrixAt(i,matrix);point.setFromMatrixPosition(matrix);scale.setFromMatrixScale(matrix);points.push(point.clone());
    assert(waterDepth(pond,point.x,point.z)<.12,'shore dressing drifted into swimming water');
    assert(scale.x>0&&scale.y>0&&scale.z>0);assert(point.y<.55,'shore plant conceals near-ground combat');
    if(name==='pond-shore-stones'){
     const vertices=batch.geometry.attributes.position,vertex=new T.Vector3();let bottom=Infinity,top=-Infinity;
     for(let j=0;j<vertices.count;j++){vertex.fromBufferAttribute(vertices,j).applyMatrix4(matrix);bottom=Math.min(bottom,vertex.y);top=Math.max(top,vertex.y);}
     assert(bottom>=-.05&&bottom<=-.02,'transformed shore stone floats or sinks too far');assert(top>.04,'small shore stone disappeared underground');
     if(waterDepth(pond,point.x,point.z)>0&&bottom<pond.mesh.position.y&&top>pond.mesh.position.y)halfSubmerged++;
    }
   }
   for(let i=0;i<points.length;i+=stride)for(let j=i+1;j<i+stride;j++)assert(points[i].distanceTo(points[j])<1.55,'one small shoreline cluster became a uniform ring');
   if(name==='pond-shore-stones')assert(halfSubmerged>0,'pond has no shore stone crossing its visible water plane');
  }
  group.traverse(o=>{if(o.isInstancedMesh)o.dispose();});
 }
});
test('continuous wet sediment keeps forest neutral, snow blue-gray, sand warm and coast cool',()=>{
 const banks={},bedTints=new Set();
 for(const id of['forest','snow','coast','sand']){
  const group=new T.Group(),[pond]=buildPonds(group,id,seeded(31),{x:-30,z:-30},[],[{x:2,z:4,rx:6,rz:5,angle:.3}]);
  banks[id]=pond.bank.material;
  assert.equal(pond.bank.scale.x,pond.rx*1.12);assert.equal(pond.mesh.scale.x,pond.rx);
  const compile=(material,type)=>{const shader={uniforms:{},vertexShader:T.ShaderLib[type].vertexShader,fragmentShader:T.ShaderLib[type].fragmentShader};material.onBeforeCompile(shader);return shader.fragmentShader;};
  const water=compile(pond.mesh.material,'standard'),bank=compile(pond.bank.material,'lambert');
  const tint=water.match(/bedGravel.rgb\*vec3\(([^)]+)\)/)[1],bankTint=bank.match(/bankGravel.rgb\*vec3\(([^)]+)\)/)[1];
  assert.equal(tint,bankTint,'riverbed changes color at the waterline');bedTints.add(tint);
  const scale=water.match(/rippleDetail\)\*(\.[0-9]+);/)[1];assert(bank.includes('bankWorld*'+scale),'bed texture changes scale at the shoreline');
  assert(bank.includes('smoothstep(.887,.960,dryEdge)'),'wet ground lost its continuous dry transition');
  assert(water.includes('waterFresnel')&&!water.includes('waterFresnel*.43)*(.48+depth*.52)'),'low-angle reflection becomes a depth-based ring');
  group.traverse(o=>{if(o.isInstancedMesh)o.dispose();});
 }
 const forest=banks.forest.color,luminance=c=>c.r*.2126+c.g*.7152+c.b*.0722;
 assert(luminance(forest)<.08&&luminance(forest)<luminance(banks.coast.color)*.5,'forest bank became a bright sandy outline');
 assert(forest.g>forest.r&&forest.b>forest.r*.9,'forest sediment became yellow rather than damp neutral soil');assert.equal(banks.forest.opacity,.82,'forest wet bank uses local shader fading at its outer edge');
 assert.equal(bedTints.size,4,'climate beds all use the same tint');
 assert(banks.snow.color.b>banks.snow.color.r&&banks.coast.color.b>banks.coast.color.r,'cold/tidal banks became green or yellow');
 assert(banks.sand.color.r>banks.sand.color.g&&banks.sand.color.g>banks.sand.color.b,'sand bank lost its warm mineral palette');
 for(const[id,opacity]of Object.entries({snow:.66,coast:.62,sand:.70}))assert.equal(banks[id].opacity,opacity,'shore opacity lost its bounded wet-to-dry fade');
});
test('water pose does not accumulate and returns to land for heroes and ground creatures',()=>{
 for(const kind of ['silver','scout','wraith','wolf','golem','mushroom']){const g=actor(kind),d=g.userData;d.waterDepth=1;
  for(let i=0;i<600;i++){animateActor(g,i/60,3,0,0);assert(Math.abs(d.rig.position.y)<1.2);g.traverse(o=>{assert(Number.isFinite(o.quaternion.w));assert(Number.isFinite(o.position.y));});}
  assert(d.waterBlend>.99);assert(d.rig.position.y<0);
  d.waterDepth=0;for(let i=600;i<720;i++)animateActor(g,i/60,0,0,0);assert(d.waterBlend<.001);assert(d.rig.position.y>-.1);
 }
});

test('forest reflection follows the rendered day/night sky and resets without altering other biomes',()=>{
 const materialFor=id=>{const group=new T.Group(),[pond]=buildPonds(group,id,seeded(5),{x:-30,z:-30},[],[{x:2,z:4,rx:6,rz:5,angle:0}]);const shader={uniforms:{},vertexShader:T.ShaderLib.standard.vertexShader,fragmentShader:T.ShaderLib.standard.fragmentShader};pond.mesh.material.onBeforeCompile(shader);group.traverse(o=>{if(o.isInstancedMesh)o.dispose();});return shader.uniforms;};
 const forest=materialFor('forest'),snow=materialFor('snow'),oldSnow=snow.waterSky.value.clone(),sky=forest.waterSky.value;
 const lighting={day:1,hemi:{color:new T.Color(0x9bbbd2)},scene:{fog:{color:new T.Color(0x829b91)}}};
 updateWaterLighting('forest',lighting);assert(sky.equals(lighting.hemi.color));
 lighting.day=0;lighting.hemi.color.setHex(0x8eafc2);lighting.scene.fog.color.setHex(0x3e5962);
 updateWaterLighting('confluence',lighting);assert.strictEqual(forest.waterSky.value,sky);assert(sky.equals(lighting.hemi.color.clone().multiplyScalar(.55)));assert(forest.waterHorizon.value.equals(lighting.scene.fog.color.clone().multiplyScalar(.55)));assert(snow.waterSky.value.equals(oldSnow));
 const night=sky.clone();updateWaterLighting('snow',{...lighting,day:1});assert(sky.equals(night));
 lighting.day=1;lighting.hemi.color.setHex(0x9bbbd2);updateWaterLighting('forest',lighting);assert(sky.equals(lighting.hemi.color));
});

test('connected forest reaches bind their own union on render and use strongest water depth',()=>{
 const aGroup=new T.Group(),bGroup=new T.Group(),a=buildPonds(aGroup,'forest',seeded(4),{x:-40,z:-40},[],[{x:0,z:0,rx:3,rz:8,angle:0},{x:1,z:9,rx:4,rz:8,angle:.2}]),b=buildPonds(bGroup,'forest',seeded(5),{x:-40,z:-40},[],[{x:35,z:12,rx:6,rz:5,angle:.3}]);
 const shader={uniforms:{},vertexShader:T.ShaderLib.standard.vertexShader,fragmentShader:T.ShaderLib.standard.fragmentShader};a[0].mesh.material.onBeforeCompile(shader);
 assert.strictEqual(a[0].mesh.material,b[0].mesh.material);
 a[0].mesh.onBeforeRender();assert.equal(shader.uniforms.coastCount.value,2);assert.equal(shader.uniforms.coastPonds.value[1].y,9);
 b[0].mesh.onBeforeRender();assert.equal(shader.uniforms.coastCount.value,1);assert.equal(shader.uniforms.coastPonds.value[0].x,35);
 a[1].bank.onBeforeRender();assert.equal(shader.uniforms.coastCount.value,2);assert.equal(shader.uniforms.coastPonds.value[0].x,0);
 assert(shader.fragmentShader.includes('coastRadial(waterWorld.xz,1.0,radial)'));
 assert(shader.fragmentShader.indexOf('dFdx(waveHeight)')<shader.fragmentShader.indexOf('if(ownRadial>radial+.0001)discard'));
 for(let z=0;z<=9;z+=.5){const x=z/9,depth=Math.max(...a.map(p=>waterDepth(p,x,z)));assert(depth>0);assert.equal(terrainAt({patches:a},x,z).depth,depth);}
 const matrix=new T.Matrix4();for(const name of ['pond-reeds','pond-shore-stones']){const mesh=aGroup.getObjectByName(name);for(let i=0;i<mesh.count;i++){mesh.getMatrixAt(i,matrix);const x=matrix.elements[12],z=matrix.elements[14];assert(!a.every(p=>waterDepth(p,x,z)>.3),'internal river join contains shore dressing');}}
 for(const group of[aGroup,bGroup])group.traverse(o=>{if(o.isInstancedMesh)o.dispose();});
});
