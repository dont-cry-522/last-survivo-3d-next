import test from'node:test';
import * as T from'../vendor/three.module.js';
import{surfaceUniforms}from'../surface-textures.js?v=120';
import{wornStoneBlock}from'../environment-props.js?v=135';
import assert from'node:assert/strict';
import{buildWorld,clearAt}from'../world.js';
import{installForestVista}from'../forest-vista.js';
globalThis.document={createElement:()=>({getContext:()=>({fillRect(){}})})};

test('forest ruins reuse trunk footprints without changing collision, rewards, discovery or other biomes',()=>{
 for(const id of['forest','confluence','snow','ash','sand','coast']){
  const w=buildWorld(id,7),before=JSON.stringify({obstacles:w.obstacles.map(o=>[o.x,o.z,o.r]),sites:w.sites.map(s=>[s.x,s.z,s.claimed,s.discovered,s.mesh.visible])}),childCount=w.group.children.length;
  const priorOrphans=new Set([w,...(w.regions||[])].flatMap(scope=>scope.foliage.filter(f=>!f.leaf.parent).map(f=>f.leaf)));
  const breakables=w.breakables.map(o=>({o,children:o.mesh.children.slice(),scale:o.mesh.scale.toArray()}));
  const result=installForestVista(w,id);
  for(const b of breakables){assert.deepEqual(b.o.mesh.children,b.children,'ruin replaced a destructible model');assert.deepEqual(b.o.mesh.scale.toArray(),b.scale);}
  assert.equal(JSON.stringify({obstacles:w.obstacles.map(o=>[o.x,o.z,o.r]),sites:w.sites.map(s=>[s.x,s.z,s.claimed,s.discovered,s.mesh.visible])}),before);
  assert(clearAt(w,w.spawn.x,w.spawn.z,1));
  if(!['forest','confluence'].includes(id)){assert.equal(result,null);assert.equal(w.group.children.length,childCount);continue;}
  assert(result.columns>=2&&result.columns<=4);assert.equal(result.removedCanopies,result.columns);assert(result.thinnedCanopies<=3);
  for(const a of result.anchors){const o=w.obstacles.find(o=>o.x===a.x&&o.z===a.z);assert(!w.breakables.includes(o));assert(!o.mesh.children.some(m=>m.userData.treeCanopy));}
  for(const scope of[w,...(w.regions||[])])assert(scope.foliage.every(f=>f.leaf.parent||priorOrphans.has(f.leaf)),'newly removed canopy remains in animation list');assert.equal(installForestVista(w,id),result,'reinstallation duplicates scenery');
  for(const a of result.anchors)assert(w.obstacles.some(o=>o.x===a.x&&o.z===a.z&&o.r===a.r&&o.mesh.userData.treeBiome==='forest'));
  if(id==='confluence'){
   const forest=w.regions.find(r=>r.id==='forest');assert.equal(result.group.parent,forest.group);
   for(const m of result.group.children){const p=m.geometry.attributes.position;for(let i=0;i<p.count;i++)assert(forest.contains(p.getX(i),p.getZ(i)),'forest ruin crosses into another biome');}
  }
 }
});

test('ruin batches have bounded opaque geometry, finite shared materials and existing disposal ownership',()=>{
 const materials=new Set();
 for(const id of['forest','confluence'])for(const seed of[1,7,43,97,522]){
  const w=buildWorld(id,seed),r=installForestVista(w,id);assert(r.drawCalls<=3);assert(r.triangles<15000);assert(r.anchors.length<=4);
  assert(!r.group.children.some(o=>o.isLight));
  for(const m of r.group.children){
   materials.add(m.material);assert(!m.material.transparent);assert(m.userData.ownedGeometry);
   const p=m.geometry.attributes.position;for(let i=0;i<p.count;i++){assert(Number.isFinite(p.getX(i)+p.getY(i)+p.getZ(i)));assert(p.getY(i)<5,'ruin obstructs the whole camera');}
   let disposed=0;m.geometry.addEventListener('dispose',()=>disposed++);m.geometry.dispose();assert.equal(disposed,1);
  }
 }
 assert.equal(materials.size,3,'new builds create permanent material variants');
});

test('the actual browser seed finds a gateway pair before choosing a lone nearest tree',()=>{
 // environment-rendering-check resets qaSeed to 522, then main.build consumes
 // the first LCG sample for its world seed; it does not buildWorld(map, 522).
 const worldSeed=Math.floor(((Math.imul(522,1664525)+1013904223)>>>0)/4294967296*1e8);
 assert.equal(worldSeed,43837033);
 for(const id of['forest','confluence']){
  const w=buildWorld(id,worldSeed),r=installForestVista(w,id);
  assert.equal(r.arches,1);assert.equal(r.archFragments,2);assert(clearAt(w,r.gateCenter.x,r.gateCenter.z,.75));
 }
 const anchor=installForestVista(buildWorld('forest',7),'forest').anchors[0],solo=buildWorld('forest',7);solo.obstacles=solo.obstacles.filter(o=>o.x===anchor.x&&o.z===anchor.z);
 const fragment=installForestVista(solo,'forest');assert.equal(fragment.columns,1);assert.equal(fragment.arches,0);assert.equal(fragment.archFragments,1,'a sparse map has a plain pillar with no identifiable arch');
});

test('worn columns and arch halves retain continuous stone support rather than floating courses',()=>{
 for(const seed of[7,43837033]){
  const ruins=installForestVista(buildWorld('forest',seed),'forest'),stone=ruins.group.getObjectByName('forest-vista-stone'),ray=new T.Raycaster();stone.updateMatrixWorld(true);
  for(const [i,a]of ruins.anchors.entries()){
   const height=i===0?3.1:i===1?2.7:1.4+i*.37;
   for(let y=.25;y<height;y+=.025){
    ray.set(new T.Vector3(a.x-.7,y,a.z),new T.Vector3(1,0,0));ray.far=1.4;
    assert(ray.intersectObject(stone).length,`column ${i} has a full-width gap at ${y}`);
   }
  }
  if(!ruins.arches)continue;
  const [a,b]=ruins.anchors,span=new T.Vector3(b.x-a.x,0,b.z-a.z).normalize(),cross=new T.Vector3(span.z,0,-span.x);
  for(const [anchor,side,base]of[[a,1,3.22],[b,-1,2.84]])for(let f=0;f<=1;f+=.025){
   const center=new T.Vector3(anchor.x,base+f*.44,anchor.z).addScaledVector(span,side*(.32+f*.96));
   ray.set(center.addScaledVector(cross,.7),cross.clone().negate());ray.far=1.4;
   assert(ray.intersectObject(stone).length,`arch half has an unsupported gap at ${f}`);
  }
 }
});


test('merged ruin stones retain shared rock texture uniforms and release temporary geometry without altering shared stone',()=>{
 const world=buildWorld('forest',43837033),dispose=T.BufferGeometry.prototype.dispose,clone=wornStoneBlock.clone,original=wornStoneBlock.attributes.position.array.slice();const vines=new Set(),stoneCopies=new Set(),disposed=new Set();
 wornStoneBlock.clone=function(){const copy=clone.call(this);stoneCopies.add(copy);return copy;};
 T.BufferGeometry.prototype.dispose=function(){assert.notEqual(this,wornStoneBlock,'shared scenery stone was released');disposed.add(this);if(this.type==='TubeGeometry'){assert(!vines.has(this));vines.add(this);}return dispose.call(this);};
 let ruins;try{ruins=installForestVista(world,'forest');}finally{T.BufferGeometry.prototype.dispose=dispose;delete wornStoneBlock.clone;}
 assert.equal(vines.size,ruins.columns*2,'source and baked vine buffers must both be released');
 assert(stoneCopies.size>0);assert([...stoneCopies].every(g=>disposed.has(g)),'a temporary fractured stone geometry survived merging');
 assert.deepEqual(wornStoneBlock.attributes.position.array,original,'local ruin wear altered all shared stone models');
 const stone=ruins.group.getObjectByName('forest-vista-stone'),shader={uniforms:{},vertexShader:T.ShaderLib.standard.vertexShader,fragmentShader:T.ShaderLib.standard.fragmentShader};
 stone.material.onBeforeCompile(shader);
 assert.equal(stone.material.userData.propSurface,'stone');assert(stone.material.vertexColors);
 for(const key of['rockColor','rockHeight','rockReady'])assert.strictEqual(shader.uniforms[key],surfaceUniforms[key]);
 assert.equal((shader.fragmentShader.match(/texture2D\(rockColor/g)||[]).length,3);
 assert(shader.fragmentShader.includes('dFdx(stoneRelief)'));
 for(const a of ruins.anchors){const root=world.obstacles.find(o=>o.x===a.x&&o.z===a.z).mesh;assert.equal(root.getObjectByName('tree-trunk').visible,false,'bare branches protrude through stone');}
});
