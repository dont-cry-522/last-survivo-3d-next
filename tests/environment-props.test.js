import test from'node:test';
import assert from'node:assert/strict';
import * as T from'../vendor/three.module.js';
import{polishEnvironmentModels,prepareBatchedSurface,batchedSurfaceMaterial}from'../environment-props.js';
import{placeTemplate}from'../biome-places.js?v=189';
import{installEnvironmentClusters}from'../environment-clusters.js?v=189';
import{groundWindTime,animateAdventureGroundDetail}from'../adventure-ground-detail.js?v=189';
import{buildWorld}from'../world.js';
import{boulderRockGeometry}from'../biome-scenery.js?v=189';
globalThis.document={createElement:()=>({getContext:()=>({fillRect(){}})})};

test('batched grain follows the piece axis and curved rope length without changing original geometry',()=>{
 const board=new T.BoxGeometry(1,.16,.3),beam=new T.CylinderGeometry(.10,.13,3,8),path=new T.CatmullRomCurve3([new T.Vector3(0,0,0),new T.Vector3(1,.2,.4),new T.Vector3(2,1,.5)]);
 beam.rotateZ(Math.PI/4);
 const curve=new T.TubeGeometry(path,12,.018,6,false),rope=new T.TorusGeometry(.4,.025,6,16),cloth=new T.SphereGeometry(.5,10,6);
 for(const [g,kind,scale,style]of[[board,'wood',{sx:4},1],[beam,'wood',{},1],[curve,'wood',{},3],[rope,'cloth',{},3],[cloth,'cloth',{sx:1.5,sz:.6},2]]){
  const original=Object.fromEntries(Object.entries(g.attributes).map(([key,a])=>[key,a.array.slice()])),index=g.index.array.slice();
  assert.strictEqual(prepareBatchedSurface(g,kind,scale),g);
  for(const [key,data]of Object.entries(original))assert.deepEqual(g.attributes[key].array,data,'surface frame changed '+key);
  assert.deepEqual(g.index.array,index);assert.equal(g.attributes.surfaceCoord.count,g.attributes.position.count);
  assert.equal(g.attributes.surfaceCoord.itemSize,4);assert([...g.attributes.surfaceCoord.array].every(Number.isFinite));assert([...g.attributes.surfaceKind.array].every(n=>n===style));
  const coord=g.attributes.surfaceCoord,ys=Array.from({length:coord.count},(_,i)=>coord.getY(i)),span=Math.max(...ys)-Math.min(...ys);
  if(g===board)assert(Math.abs(span-4)<1e-6,'wood grain follows the unscaled rather than real board length');
  if(g===beam)assert(Math.abs(span-3)<1e-5,'diagonal cylinder grain became world-vertical');
  if(g===curve)assert(span>2.3&&span<2.8,'curved line coordinates lost their distance along the rope');
  const before=coord.array.slice();g.rotateY(1.3);g.translate(40,0,-20);assert.deepEqual(coord.array,before,'world placement rotates the baked surface frame');g.dispose();
 }
});

test('wood and textile batches share finite surface data, shaders and unchanged render budgets across five places and instanced clusters',()=>{
 const source=new T.MeshStandardMaterial({color:0x9b876c,vertexColors:true});source.onBeforeCompile=s=>{s.fragmentShader='// retained author finish\n'+s.fragmentShader;};source.customProgramCacheKey=()=> 'authored-batch';
 for(const kind of['wood','cloth']){
  const material=batchedSurfaceMaterial(source,kind),shader={uniforms:{},vertexShader:T.ShaderLib.standard.vertexShader,fragmentShader:T.ShaderLib.standard.fragmentShader};
  assert.strictEqual(batchedSurfaceMaterial(source,kind),material);assert.strictEqual(batchedSurfaceMaterial(material,kind),material);assert(material.color.equals(source.color));
  material.onBeforeCompile(shader);assert(shader.fragmentShader.includes('// retained author finish'));
  assert.deepEqual(Object.keys(shader.uniforms),kind==='cloth'?['harborWindTime']:[]);
  if(kind==='cloth'){
   assert.strictEqual(shader.uniforms.harborWindTime,groundWindTime);
   animateAdventureGroundDetail(4.25);assert.equal(shader.uniforms.harborWindTime.value,4.25);
   animateAdventureGroundDetail(4.25);animateAdventureGroundDetail(NaN);assert.equal(shader.uniforms.harborWindTime.value,4.25,'an unchanged or invalid scenery clock must not advance cloth');
   animateAdventureGroundDetail(4.5);assert.equal(shader.uniforms.harborWindTime.value,4.5);animateAdventureGroundDetail(0);
   assert(shader.vertexShader.includes('harborFlex*.028'));assert(shader.vertexShader.includes('modelMatrix*harborPoint'));assert(shader.vertexShader.includes('instanceMatrix*harborPoint'));
  }
  assert(shader.vertexShader.includes('propCoord=surfaceCoord'));assert(shader.vertexShader.includes('propPoint=position'));assert(!shader.vertexShader.includes('instanceMatrix * vec4(surfaceCoord'),'instance placement must not stretch or swim the piece texture');
  for(const name of['woodRings','woodRelief','clothWeave','ropeTwist','propDamp'])assert(shader.fragmentShader.includes(name));
  assert(shader.fragmentShader.indexOf('float woodRelief')<shader.fragmentShader.indexOf('dFdx(woodRelief)'));assert(shader.fragmentShader.indexOf('float propDamp')<shader.fragmentShader.indexOf('roughnessFactor=clamp'));
  assert(shader.fragmentShader.includes('smoothstep(.009,.04,propPixel)'),'weave detail should fade before becoming subpixel noise');assert(!shader.fragmentShader.includes('undefined'));
 }
 assert.notEqual(batchedSurfaceMaterial(source,'wood').customProgramCacheKey(),batchedSurfaceMaterial(source,'cloth').customProgramCacheKey());
 const stone=batchedSurfaceMaterial(source,'stone'),stoneShader={uniforms:{},vertexShader:T.ShaderLib.standard.vertexShader,fragmentShader:T.ShaderLib.standard.fragmentShader};stone.onBeforeCompile(stoneShader);
 assert(stoneShader.fragmentShader.includes('stoneFoot'));assert(stoneShader.fragmentShader.indexOf('float stoneFoot')<stoneShader.fragmentShader.indexOf('roughnessFactor=clamp'));assert(!stoneShader.vertexShader.includes('surfaceCoord'),'stone retains its existing triplanar frame');
 assert.deepEqual(Object.keys(stoneShader.uniforms).sort(),['rockColor','rockHeight','rockReady']);
 const metal=new T.MeshStandardMaterial({color:0x687b81,metalness:.55}),cue=new T.MeshStandardMaterial({color:0x6ccbde,transparent:true,opacity:.3});
 assert.strictEqual(batchedSurfaceMaterial(metal,'metal'),metal);assert.strictEqual(batchedSurfaceMaterial(cue,'cue'),cue);metal.dispose();cue.dispose();
 for(const id of['forest','snow','ash','sand','coast']){
  const template=placeTemplate(id);assert(template.batches.length<=5);
  const w=buildWorld(id,522),state=installEnvironmentClusters(w,id);
  for(const b of[...template.batches,...state.group.children.filter(o=>o.isInstancedMesh)]){
   const g=b.geometry,material=b.material;if(!['wood-piece','cloth'].includes(material.userData.propSurface))continue;
   for(const key of['surfaceCoord','surfaceKind']){assert.equal(g.attributes[key].count,g.attributes.position.count);assert(g.attributes[key].array.every(Number.isFinite));}
   if(material.userData.propSurface==='cloth'){
    assert.equal(g.attributes.harborFlex.count,g.attributes.position.count);assert(g.attributes.harborFlex.array.every(n=>Number.isFinite(n)&&n>=0&&n<=1));
    if(id!=='coast')assert(g.attributes.harborFlex.array.every(n=>n===0),'harbor wind moved another map\'s resting cloth');
   }
   assert(g.attributes.color.array.every(Number.isFinite));assert(!material.transparent&&!material.map&&!material.normalMap);assert(material.roughness>=.89);
   if(b.isInstancedMesh)assert(b.instanceMatrix&&b.userData.ownedGeometry);
  }
  w.group.traverse(o=>{if(o.isInstancedMesh)o.dispose();if(o.userData.ownedGeometry)o.geometry.dispose();});
 }
 source.dispose();
});

test('surface finishes follow wooden beam direction, cache variants and preserve authored material behavior',()=>{
 const wood=new T.MeshStandardMaterial({color:0x76614c,roughness:.75,emissiveIntensity:0}),bronze=new T.MeshStandardMaterial({color:0xb19761,metalness:.4,emissiveIntensity:0}),group=new T.Group();
 wood.onBeforeCompile=shader=>{shader.vertexShader='// authored-surface\n'+shader.vertexShader;};wood.customProgramCacheKey=()=> 'authored-wood';
 const add=(x,y,z,source=wood)=>{const mesh=new T.Mesh(new T.BoxGeometry(x,y,z),source);group.add(mesh);return mesh;};
 const horizontal=add(3,.3,.3),upright=add(.3,3,.3),repeat=add(2,.2,.2),metal=add(1,.2,.1,bronze);polishEnvironmentModels({group,obstacles:[]});
 assert.equal(horizontal.material.userData.propSurface,'wood-x');assert.equal(upright.material.userData.propSurface,'wood-y');assert.strictEqual(horizontal.material,repeat.material);assert.notStrictEqual(horizontal.material,upright.material);
 assert(!metal.material.userData.propSurface);assert.equal(metal.material.metalness,.4);assert.equal(wood.roughness,.75);assert(!wood.vertexColors);
 for(const mesh of[horizontal,upright]){
  assert(mesh.material.color.equals(wood.color));assert(mesh.material.customProgramCacheKey().startsWith('authored-wood|'));
  const shader={uniforms:{},vertexShader:T.ShaderLib.standard.vertexShader,fragmentShader:T.ShaderLib.standard.fragmentShader};mesh.material.onBeforeCompile(shader);
  assert(shader.vertexShader.includes('// authored-surface'));assert.equal(shader.vertexShader.match(/varying vec3 propPoint/g).length,1);
  assert(shader.fragmentShader.indexOf('float propPatch')<shader.fragmentShader.indexOf('roughnessFactor=clamp'));
  assert(!shader.fragmentShader.includes('undefined'));assert.deepEqual(shader.uniforms,{},'surface adds texture/uniform allocations');
  assert(shader.fragmentShader.includes('woodRings')&&shader.fragmentShader.includes('dFdx(woodRelief)'));assert(shader.fragmentShader.indexOf('float woodRelief')<shader.fragmentShader.indexOf('dFdx(woodRelief)'),'wood relief must be defined before its surface normal');
 }
 assert.notEqual(horizontal.material.customProgramCacheKey(),upright.material.customProgramCacheKey());
 const assigned=group.children.map(o=>o.material);polishEnvironmentModels({group,obstacles:[]});assert.deepEqual(group.children.map(o=>o.material),assigned);
});

test('all six maps retain draw counts, layout and base colors while sharing finishes across rebuilds',()=>{
 const known=new Set();
 for(const id of['forest','snow','ash','sand','coast','confluence'])for(let run=0;run<2;run++){
  const w=buildWorld(id,43837033),meshes=[];w.group.traverse(o=>{if(o.isMesh)meshes.push(o);});
  const colors=meshes.map(o=>o.material?.color?.getHex()),collisions=JSON.stringify(w.obstacles.map(o=>[o.x,o.z,o.r]));polishEnvironmentModels(w);
  const after=[];w.group.traverse(o=>{if(o.isMesh)after.push(o);});assert.equal(after.length,meshes.length);assert.equal(JSON.stringify(w.obstacles.map(o=>[o.x,o.z,o.r])),collisions);
  const kinds=new Set();for(const [i,o]of after.entries()){
   assert.equal(o.material?.color?.getHex(),colors[i]);const kind=o.material?.userData.propSurface;if(!kind)continue;
   kinds.add(kind);assert(!o.material.transparent);assert(!o.material.map&&!o.material.normalMap);assert(o.material.roughness>=.85);
   assert.equal(o.material.vertexColors,!!o.geometry.attributes.color,id+' surface requires a missing color attribute');
   if(run)assert(known.has(o.material),'rebuild introduced new persistent material');else known.add(o.material);
  }
  assert(kinds.has('stone')&&kinds.has('wood-y'),id+' did not retain stone and wood identities');
  w.group.traverse(o=>{if(o.isInstancedMesh)o.dispose();if(o.userData.ownedGeometry)o.geometry.dispose();});
 }
});

test('colored blocks and bare cylinders sharing a source keep separate cached surface variants',()=>{
 const source=new T.MeshStandardMaterial({color:0x76614c,roughness:.8,emissiveIntensity:0}),group=new T.Group();
 const add=geometry=>{const mesh=new T.Mesh(geometry,source);group.add(mesh);return mesh;};
 const bare=add(new T.CylinderGeometry(.2,.3,2,8)),repeat=add(new T.CylinderGeometry(.3,.4,3,8)),block=add(new T.BoxGeometry(.4,2,.4));
 const colored=add(new T.CylinderGeometry(.2,.3,2,8));colored.geometry.setAttribute('color',new T.Float32BufferAttribute(new Float32Array(colored.geometry.attributes.position.count*3).fill(.9),3));
 polishEnvironmentModels({group,obstacles:[]});
 assert.equal(bare.material.vertexColors,false);assert.equal(block.material.vertexColors,true);assert.equal(colored.material.vertexColors,true);
 assert.strictEqual(bare.material,repeat.material);assert.strictEqual(block.material,colored.material);assert.notStrictEqual(bare.material,block.material);
 assert.notEqual(bare.material.customProgramCacheKey(),block.material.customProgramCacheKey());
 for(const mesh of[bare,repeat,block,colored])assert(mesh.material.color.equals(source.color));
 assert.equal(source.vertexColors,false);assert.equal(source.roughness,.8);
 const assigned=group.children.map(o=>o.material);polishEnvironmentModels({group,obstacles:[]});assert.deepEqual(group.children.map(o=>o.material),assigned);
});

test('eroded stone silhouettes stay inside their authored bounds and reuse geometry without altering source meshes',()=>{
 const group=new T.Group(),material=new T.MeshStandardMaterial({color:0xa49173,emissiveIntensity:0}),box=new T.BoxGeometry(1,1,1),column=new T.CylinderGeometry(.4,.6,2,10);
 const add=geometry=>{const mesh=new T.Mesh(geometry,material);group.add(mesh);return mesh;};
 const blocks=[add(box),add(box)],columns=[add(column),add(column)],source=Array.from(column.attributes.position.array);
 polishEnvironmentModels({group,obstacles:[]});
 assert.strictEqual(blocks[0].geometry,blocks[1].geometry);assert.strictEqual(columns[0].geometry,columns[1].geometry);
 assert.notStrictEqual(columns[0].geometry,column);assert.deepEqual(Array.from(column.attributes.position.array),source);
 for(const mesh of[blocks[0],columns[0]]){
  const p=mesh.geometry.attributes.position,n=mesh.geometry.attributes.normal,isBlock=mesh===blocks[0],top=[];
  for(let i=0;i<p.count;i++){
   assert(Math.abs(p.getX(i))<=(isBlock?.5:.600001));assert(Math.abs(p.getZ(i))<=(isBlock?.5:.600001));assert(Math.abs(p.getY(i))<=(isBlock?.5:1));
   assert(Number.isFinite(n.getX(i))&&Number.isFinite(n.getY(i))&&Number.isFinite(n.getZ(i)));
   if(p.getY(i)>(isBlock?.3:.9))top.push(p.getY(i));
  }
  assert(Math.max(...top)-Math.min(...top)>.025,'stone crown remained perfectly level');
 }
 const geometries=group.children.map(o=>o.geometry);polishEnvironmentModels({group,obstacles:[]});assert.deepEqual(group.children.map(o=>o.geometry),geometries);
});

test('ash columns have shared broken crowns and inward seams without moving their base or other biomes',()=>{
 const originals=boulderRockGeometry.attributes.position.array.slice(),shared=new Set(),reference=boulderRockGeometry.attributes.position;
 for(const id of ['ash','ash','forest','snow','sand','coast','confluence']){
  const w=buildWorld(id,43837033),before=new Map();w.group.traverse(o=>{if(o.isMesh)before.set(o,[o.position.toArray(),o.scale.toArray(),o.quaternion.toArray()]);});
  const collision=JSON.stringify(w.obstacles.map(o=>[o.x,o.z,o.r]));polishEnvironmentModels(w);let count=0;
  w.group.traverse(o=>{
   if(!o.geometry?.name.startsWith('SM_Rock_AshColumn_'))return;count++;
   assert(['ash','confluence'].includes(id),'ash silhouette leaked into another biome');
   assert.deepEqual([o.position.toArray(),o.scale.toArray(),o.quaternion.toArray()],before.get(o),'ash shape adjustment moves an existing obstacle');
   assert(o.geometry.index.count/3<=480);assert(!o.userData.ownedGeometry,'persistent ash shapes must be reused, not disposed with a world');
   shared.add(o.geometry);const p=o.geometry.attributes.position,tops=[];
   for(let i=0;i<p.count;i++){
    assert(Math.hypot(p.getX(i),p.getZ(i))<=Math.hypot(reference.getX(i),reference.getZ(i))+1e-6,'an ash ridge enlarges the stone footprint');
    if(reference.getY(i)<=-.42)assert.deepEqual([p.getX(i),p.getY(i),p.getZ(i)],[reference.getX(i),reference.getY(i),reference.getZ(i)],'the grounded lower bole changed');
    if(reference.getY(i)>.75)tops.push(p.getY(i));
   }
   assert(Math.max(...tops)-Math.min(...tops)>.035,'the broken crown became level');assert(Math.max(...tops)<.85,'the ash column retained its rounded high tip');
  });
  if(id==='ash')assert(count>30,'ash obstacles were not identified');assert.equal(JSON.stringify(w.obstacles.map(o=>[o.x,o.z,o.r])),collision);
  const models=[];w.group.traverse(o=>{if(o.isMesh)models.push(o);});assert.equal(models.length,before.size,'ash silhouette introduced extra meshes');
  const assigned=models.map(o=>o.geometry);polishEnvironmentModels(w);assert.deepEqual(models.map(o=>o.geometry),assigned,'a second polish changes shared ash shapes');
  w.group.traverse(o=>{if(o.isInstancedMesh)o.dispose();if(o.userData.ownedGeometry)o.geometry.dispose();});
 }
 assert.equal(shared.size,3);assert.deepEqual(boulderRockGeometry.attributes.position.array,originals,'ash carving polluted the common boulder geometry');
});


test('bark finish is explicit and does not turn boat planks or ropes into bark',()=>{
 const bark=new T.CylinderGeometry(.8,.8,3,16),board=new T.BoxGeometry(2,.1,.4);bark.userData.bark=true;
 prepareBatchedSurface(bark,'wood');prepareBatchedSurface(board,'wood');assert([...bark.attributes.surfaceKind.array].every(v=>v===4));assert([...board.attributes.surfaceKind.array].every(v=>v===1));
 bark.dispose();board.dispose();
});
