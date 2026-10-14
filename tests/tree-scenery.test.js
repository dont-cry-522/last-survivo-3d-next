// v188: forest and confluence snapshots intentionally adopt the connected creek layout.
import{test}from'node:test';
import assert from'node:assert/strict';
import{createHash}from'node:crypto';
import{readFileSync}from'node:fs';
import * as T from'../vendor/three.module.js';
import{addTree,updateTreeDetail,animateTreeCanopy,installForestBackdrop}from'../tree-scenery.js';
import{buildWorld,animateWorld}from'../world.js';
import{damageTerrain,updateTactics}from'../map-tactics.js?v=193';
import{installDistantLandscape}from'../environment-lighting.js';

globalThis.document={createElement:()=>({getContext:()=>({fillRect(){}})})};
const dispose=w=>w.group.traverse(o=>{if(o.isInstancedMesh)o.dispose();if(o.userData.ownedGeometry)o.geometry.dispose();});
const trees=w=>w.obstacles.filter(o=>o.mesh.getObjectByName('tree-canopy'));

test('forest breeze pins the trunk and uses bounded, smooth motion at the same game time',()=>{
 const root=new T.Group(),leaf=addTree(root,'forest',4,{angle:.7}),trunk=root.children[0];root.position.set(14,.18,-9);
 const rest={x:leaf.position.x,z:leaf.position.z,phase:14*.17-9*.13},rootPose=root.matrix.clone(),trunkPose=trunk.matrix.clone(),geometry=leaf.geometry,positions=geometry.attributes.position.array.slice(),y=leaf.position.y;
 root.updateMatrix();trunk.updateMatrix();rootPose.copy(root.matrix);trunkPose.copy(trunk.matrix);
 let previous=null,largestStep=0;
 for(let frame=0;frame<=1800;frame++){
  animateTreeCanopy(leaf,frame/30,rest);
  assert(Math.hypot(leaf.position.x-rest.x,leaf.position.z-rest.z)<.0217,'wind moves canopy too far');
  assert(Math.hypot(leaf.rotation.x,leaf.rotation.z)<.0121,'wind tips the whole crown too far');
  if(previous)largestStep=Math.max(largestStep,Math.hypot(leaf.position.x-previous.x,leaf.position.z-previous.z));
  previous=leaf.position.clone();
 }
 assert(largestStep>.0001&&largestStep<.001,'wind jitters or no longer moves');
 const paused=[...leaf.position,...leaf.rotation.toArray()];for(let i=0;i<120;i++)animateTreeCanopy(leaf,60,rest);
 assert.deepEqual([...leaf.position,...leaf.rotation.toArray()],paused,'same paused game time drifts');
 animateTreeCanopy(leaf,NaN,rest);assert.deepEqual([...leaf.position,...leaf.rotation.toArray()],paused,'invalid time corrupts pose');
 assert.equal(leaf.position.y,y);assert.strictEqual(leaf.geometry,geometry);assert.deepEqual(geometry.attributes.position.array,positions,'wind rewrites shared vertex buffers');
 root.updateMatrix();trunk.updateMatrix();assert.deepEqual(root.matrix,rootPose);assert.deepEqual(trunk.matrix,trunkPose);assert.equal(root.children.length,2);
 const other=new T.Group(),otherLeaf=addTree(other,'forest',4,{angle:.7});other.position.set(-22,.18,31);animateTreeCanopy(otherLeaf,60,{x:rest.x,z:rest.z,phase:-22*.17+31*.13});
 assert(Math.hypot(otherLeaf.position.x-leaf.position.x,otherLeaf.position.z-leaf.position.z)>.001,'separate trees sway in lockstep');
 animateTreeCanopy(leaf,0,rest);const restart=[...leaf.position,...leaf.rotation.toArray()];animateTreeCanopy(leaf,17,rest);animateTreeCanopy(leaf,0,rest);assert.deepEqual([...leaf.position,...leaf.rotation.toArray()],restart,'restart retains old wind phase');
});

test('all forest LODs share one breeze uniform, weighted leaf tips and instancing-safe wind',()=>{
 let clock;
 for(const angle of[0,1,1.5]){
  const root=new T.Group(),leaf=addTree(root,'forest',4,{angle}),farCount=leaf.geometry.attributes.position.count;
  const shader={uniforms:{},vertexShader:T.ShaderLib.standard.vertexShader,fragmentShader:T.ShaderLib.standard.fragmentShader};leaf.material.onBeforeCompile(shader);
  if(clock)assert.strictEqual(shader.uniforms.treeBreezeTime,clock);else clock=shader.uniforms.treeBreezeTime;
  assert(shader.vertexShader.includes('modelMatrix*instanceMatrix'),'background batches lose per-tree phase');
  assert(shader.vertexShader.includes('treeLocalWind*treeFlutter*treeGust*treeLeafFlex'),'leaf flutter is not weighted');
  assert(shader.vertexShader.includes('treeBreezeTime*.42+treeOrigin.x*.08+treeOrigin.z*.06'));
  for(const distance of[40,20,5]){
   updateTreeDetail(leaf,distance,0);const g=leaf.geometry,flex=g.attributes.treeLeafFlex;
   assert.equal(flex.count,g.attributes.position.count);assert([...flex.array].every(v=>Number.isFinite(v)&&v>=0&&v<=1));
   for(let i=0;i<farCount;i+=7)assert.equal(flex.getX(i),0,'branch spray attachment is not pinned');
   for(let i=farCount;i<flex.count;i+=6){assert.equal(flex.getX(i),0,'individual leaf root floats');assert.equal(flex.getX(i+3),1,'individual leaf tip cannot flutter');}
   assert.equal(root.children.length,2);assert(!root.children[0].geometry.attributes.treeLeafFlex,'trunk acquired leaf deformation');
  }
  animateTreeCanopy(leaf,12.5,{x:leaf.position.x,z:leaf.position.z,phase:angle});assert.equal(clock.value,12.5);
  animateTreeCanopy(leaf,12.5,{x:0,z:0,phase:angle});assert.equal(clock.value,12.5,'pause advanced GPU wind time');
 }
});

test('snow preserves its previous canopy motion and does not inherit the forest wind shader',()=>{
 const root=new T.Group(),leaf=addTree(root,'snow',4,{angle:1}),rest={x:leaf.position.x,z:leaf.position.z,phase:2.7};
 for(const time of[0,.25,3,21]){
  animateTreeCanopy(leaf,time,rest);const sway=Math.sin(time*1.35+rest.phase)*.026+Math.sin(time*2.7+rest.phase)*.008;
  assert.equal(leaf.rotation.z,sway);assert.equal(leaf.rotation.x,0);assert.equal(leaf.position.x,rest.x+sway*1.3);assert.equal(leaf.position.z,rest.z+Math.cos(time*1.1+rest.phase)*.015);
 }
 const shader={uniforms:{},vertexShader:T.ShaderLib.standard.vertexShader,fragmentShader:T.ShaderLib.standard.fragmentShader};leaf.material.onBeforeCompile(shader);
 assert(!shader.uniforms.treeBreezeTime);assert(!shader.vertexShader.includes('treeLeafFlex'));
 for(const distance of[40,20,5]){updateTreeDetail(leaf,distance,0);assert(!leaf.geometry.attributes.treeLeafFlex);}
});

test('tree art preserves the established obstacle, reward, terrain and ground-detail layouts',()=>{
 const before={"forest":["62c6fbaeccf4aaa44429b96a9d0e854b4c4c7e0f924192cf4a0b0b50aa85593f","3cb03048cc5f99261c3faed88a57bdd88f453b7db2624d5cecef5ca52354ebff"],"snow":["b0abb255379b8280117d8ecbc5d3131483118603a25c01633fb71609556183d4","a40ac01130c5da5389c6840dc3d16bea0b45e302ac606e498ac337feadb48b7e"],"confluence":["11b961eb2048501a2661bb096d0249fa5b2ca66293862603b7fdee25792952cd","0498f7b555796d3c543c990b21e3493e79ce4fa1bc7a4ebef18d06d648583740"]};
 for(const id of Object.keys(before))for(const[i,seed]of[1,7].entries()){
  const w=buildWorld(id,seed),layout={obstacles:w.obstacles.map(o=>[o.x,o.z,o.r,o.tactic]),sites:w.sites.map(s=>[s.x,s.z,s.type,s.event,s.availableAt]),patches:w.patches.map(p=>[p.x,p.z,p.r,p.kind]),details:w.regions?w.regions.map(r=>r.scenery.records):w.scenery.records};
  assert.equal(createHash('sha256').update(JSON.stringify(layout)).digest('hex'),before[id][i],id+' gameplay layout changed');dispose(w);
 }
});

test('tree canopies clear human height and every tree renders as two shared opaque meshes',()=>{
 const geometries=new Set(),materials=new Set();
 for(const id of['forest','snow','confluence'])for(const seed of[1,7,19]){
  const w=buildWorld(id,seed);w.group.updateMatrixWorld(true);
  for(const o of trees(w)){
   assert.equal(o.mesh.children.length,2);const canopy=o.mesh.getObjectByName('tree-canopy'),bounds=new T.Box3().setFromObject(o.mesh,true),crown=new T.Box3().setFromObject(canopy,true),snow=o.mesh.userData.treeBiome==='snow';
   assert(bounds.max.y>6.2&&bounds.max.y<8.5,'tree height lost its human scale');assert(crown.min.y>3.2,'canopy intrudes into the fighting plane');
   assert(crown.max.x-crown.min.x<(snow?3.9:6.3),'crown became excessively broad');assert(canopy.geometry.attributes.normal&&canopy.geometry.attributes.color);
   assert([...canopy.geometry.attributes.color.array].every(v=>Number.isFinite(v)&&v>=0&&v<=1),'canopy tint contains invalid colors');
   if(!snow){assert(bounds.max.y<7.2,'forest trunk stretched into a pole');assert(crown.max.x-crown.min.x>3.4,'forest crown collapsed into narrow balls');}
   assert(o.mesh.children.reduce((n,m)=>n+(m.geometry.index?.count??m.geometry.attributes.position.count)/3,0)<=(snow?580:1350),'tree exceeds its shared geometry budget');
   for(const mesh of o.mesh.children){geometries.add(mesh.geometry);materials.add(mesh.material);assert(!mesh.material.transparent);assert(!mesh.userData.ownedGeometry,'shared tree geometry disposed with a single world');assert.equal(mesh.geometry.groups.length,0,'material groups multiply tree draw calls');}
  }
  const f=(w.regions?w.regions.find(r=>r.id==='forest'):w).foliage[0],before=f.leaf.position.x;animateWorld(w,2,w.spawn.x,w.spawn.z);assert.notEqual(f.leaf.position.x,before,'combined canopy stopped swaying');dispose(w);
 }
 // Bark, cutout broad leaves and folded double-sided fir sprays are fixed shared materials.
 assert.equal(materials.size,3,'world rebuilds allocate new tree materials');assert(geometries.size<=12,'world rebuilds allocate per-tree geometries');
});

test('tree variants have outward foliage, curved tapering forks and visible branch gaps',()=>{
 for(const id of['forest','snow']){
  const signatures=new Set();
  for(const angle of[0,1,1.5]){
   const g=new T.Group();addTree(g,id,4,{angle});const trunk=g.children[0].geometry,canopy=g.children[1].geometry,p=canopy.attributes.position,n=canopy.attributes.normal;
   signatures.add(createHash('sha256').update(Buffer.from(p.array.buffer)).digest('hex'));
   let outward=0;for(let i=0;i<p.count;i++)outward+=p.getX(i)*n.getX(i)+p.getZ(i)*n.getZ(i);
   if(id==='snow')assert(outward>0,'foliage normals face inward');
   assert([...trunk.attributes.position.array,...p.array,...n.array].every(Number.isFinite));
   const stem=trunk.attributes.position;
   const sides=id==='snow'?8:16,center=ring=>Array.from({length:sides},(_,i)=>stem.getX(ring*sides+i)).reduce((a,b)=>a+b,0)/sides;
   assert(Math.abs(center(id==='snow'?3:4)-(center(0)+center(id==='snow'?5:6))/2)>.005,'main trunk reverted to a straight rod');
   if(id==='snow'){
    // Snow uses geometric gaps; forest alpha-cut gaps are sampled separately below.
    const leaf=g.children[1];g.updateMatrixWorld(true);const y=leaf.position.y+(id==='snow'?1.40:leaf.geometry.boundingBox.max.y*.16)*leaf.scale.y,hits=[];
    for(let i=0;i<16;i++){const a=i/16*Math.PI*2,ray=new T.Raycaster(new T.Vector3(Math.cos(a)*5,y,Math.sin(a)*5),new T.Vector3(-Math.cos(a),0,-Math.sin(a)));hits.push(ray.intersectObject(leaf).length);}
    assert(hits.some(n=>n===0)&&hits.some(n=>n>0),id+' branch fans lost their gaps or became invisible');
   }
  }
  assert.equal(signatures.size,3,'finite tree variants became identical');
 }
});

test('every terminal forest twig follows its uneven leaf cluster in all three templates',()=>{
 for(const angle of[0,1,1.5]){
  const group=new T.Group(),leaf=addTree(group,'forest',4,{angle}),trunk=group.children[0],template=leaf.userData.treeTemplate;
  group.updateMatrixWorld(true);const p=trunk.geometry.attributes.position,end=new T.Vector3(),target=new T.Vector3();
  // A three-sided terminal twig has three rings plus two cap centers; the final cap is its endpoint.
  const start=p.count-template.sprays.length*11;
  for(const [i,[x,y,z,,,height]]of template.sprays.entries()){
   end.fromBufferAttribute(p,start+i*11+10).applyMatrix4(trunk.matrixWorld);
   target.set(x,y+height*.24-template.bottom,z).applyMatrix4(leaf.matrixWorld);
   assert(end.distanceTo(target)<.00001,'branch is detached from its repositioned foliage');
  }
  assert.equal(leaf.geometry.index.count/3,600,'interlocking lobes exceeded their shared far-LOD budget');
 }
});

test('mature forest forks support middle and outer lobes with sculpted roots inside their existing footprint',()=>{
 const centroids=[];
 for(const [variant,angle]of[0,1,1.5].entries()){
  const root=new T.Group(),leaf=addTree(root,'forest',4,{angle}),trunk=root.children[0],p=trunk.geometry.attributes.position,stemCount=p.count-4*20-20*11,center=new T.Vector3(),ends=[new T.Vector3().fromBufferAttribute(p,stemCount-1)],stem=[];
  assert.equal(trunk.geometry.index.count/3,728,'continuous roots exceeded their replacement triangle budget');
  for(const ring of[0,2,4,5,6]){center.set(0,0,0);for(let i=0;i<16;i++)center.add(new T.Vector3().fromBufferAttribute(p,ring*16+i));stem.push(center.clone().multiplyScalar(1/16));}
  for(let branch=0;branch<4;branch++){
   const base=new T.Vector3().fromBufferAttribute(p,stemCount+branch*20+18),near=new T.Vector3();let gap=Infinity;
   for(let i=0;i<4;i++){new T.Line3(stem[i],stem[i+1]).closestPointToPoint(base,true,near);gap=Math.min(gap,near.distanceTo(base));}
   assert(gap<.16,'primary fork floats away from its supporting trunk');ends.push(new T.Vector3().fromBufferAttribute(p,stemCount+branch*20+19));
  }
  const counts=new Map();
  for(let twig=0;twig<20;twig++){
   const base=new T.Vector3().fromBufferAttribute(p,stemCount+80+twig*11+9),distances=ends.map(e=>e.distanceTo(base)),nearest=Math.min(...distances),branch=distances.indexOf(nearest);
   assert(nearest<1e-6,'terminal twig starts in empty space');counts.set(branch,(counts.get(branch)||0)+1);
  }
  assert.equal(counts.size,5);assert(new Set([...counts.values()]).size>=3,'all forks regained the same three-leaf rhythm');
  const sprays=leaf.userData.treeTemplate.sprays;centroids.push(sprays.reduce((sum,s)=>sum+s[0],0)/sprays.length);
  assert.equal(sprays.length,20);assert(sprays.filter(([x,y,z])=>Math.hypot(x,z)<.6&&y>.5&&y<1.5).length>=4,'middle crown lobes left the fork hollow');
  for(const [distance,triangles]of[[40,600],[20,3600],[5,9000]]){updateTreeDetail(leaf,distance,0);assert.equal(leaf.geometry.index.count/3,triangles);}
 }
 assert(Math.max(...centroids)-Math.min(...centroids)>.25,'three tree silhouettes differ only by rotation');
});

test('continuous roots preserve the existing forest and snow forks and twig endpoints exactly',()=>{
 const hashes={forest:['afeed8264ba7e47e7167a4a7e20bd7174a899ff6be6d85e382a347b758714007','1902bc03190ae9c4ffff9e427ea6d4654fbdef4db23aa858653ccb7d52301c5e','d0ded63591c1ebe9c5c4ce4231f2047fcdfe80e02dfda75696c5d983cef61c90'],snow:['d38c9e3ed0fbd71711614ff06426af1f8054ff44f4718df4203d0e57fbb503cc','ff356c128770e2610978d1f9f3f2ed34df69b3107d409d6d3771a9a0708053eb','23b6607c1a2b90da9cc0344e05205f72bdcad38018ce2da901ad53ea868b2baa']};
 for(const id of['forest','snow'])for(const [i,angle]of[0,1,1.5].entries()){
  const root=new T.Group();addTree(root,id,4,{angle});const positions=root.children[0].geometry.attributes.position.array,branches=positions.slice(-(id==='snow'?42:300)*3);
  assert.equal(createHash('sha256').update(Buffer.from(branches.buffer)).digest('hex'),hashes[id][i],'root replacement moved a canopy attachment');
 }
});

test('forest and snow roots are one closed tapered stem with buried uneven lobes and no overlapping pieces',()=>{
 for(const id of['forest','snow'])for(const angle of[0,1,1.5]){
  const root=new T.Group();addTree(root,id,4,{angle});const g=root.children[0].geometry,p=g.attributes.position,n=g.attributes.normal,snow=id==='snow',sides=snow?8:16,stemCount=p.count-(snow?42:300),edges=new Map(),neighbors=Array.from({length:stemCount},()=>new Set()),radii=[];
  assert.equal(g.index.count/3,snow?168:728);assert.equal(root.children.length,2);
  for(let i=0;i<g.index.count;i+=3){
   const ids=[g.index.getX(i),g.index.getX(i+1),g.index.getX(i+2)];if(ids.some(v=>v>=stemCount))continue;
   for(let j=0;j<3;j++){const a=ids[j],b=ids[(j+1)%3],key=a<b?a+':'+b:b+':'+a;edges.set(key,(edges.get(key)||0)+1);neighbors[a].add(b);neighbors[b].add(a);}
  }
  assert([...edges.values()].every(count=>count===2),'root/stem surface has a seam or an uncapped end');
  const reached=new Set([0]),pending=[0];while(pending.length)for(const next of neighbors[pending.pop()])if(!reached.has(next)){reached.add(next);pending.push(next);}assert.equal(reached.size,stemCount,'roots are still separate pasted pieces');
  for(let i=0;i<stemCount;i++)if(p.getY(i)<.7)assert(Math.hypot(p.getX(i),p.getZ(i))<(snow?.61:.75),'root exceeds its existing ground footprint');
  for(let i=0;i<sides;i++){
   assert(Math.abs(p.getY(i)+.042)<1e-7,'root perimeter floats above the soil');radii.push(Math.hypot(p.getX(i),p.getZ(i)));
   const lower=Math.hypot(p.getX(sides+i),p.getZ(sides+i)),upper=Math.hypot(p.getX(2*sides+i),p.getZ(2*sides+i));assert(lower>upper,'root shoulder does not taper into the trunk');
   const a=new T.Vector3().fromBufferAttribute(n,sides+i),b=new T.Vector3().fromBufferAttribute(n,sides+(i+1)%sides);assert(a.dot(b)>(snow?.5:.7),'adjacent bark normals form a sharp pasted fin');
  }
  assert(Math.max(...radii)-Math.min(...radii)>.12,'root base became a circular skirt');
 }
});

test('snow boughs stagger their snow shelves and droop within the shared far-crown budget',()=>{
 for(const angle of[0,1,1.5]){
  const group=new T.Group(),leaf=addTree(group,'snow',4,{angle}),p=leaf.geometry.attributes.position;
  assert.equal(group.children.length,2);assert.equal(leaf.geometry.index.count/3,396);
  group.updateMatrixWorld(true);const bounds=new T.Box3().setFromObject(leaf,true),height=5.2+4*.52;
  assert(Math.abs(bounds.max.y-height)<.00001,'fuller snow crown moved the established tree top');
  assert(Math.abs(bounds.min.y-(height*.54-.24))<.00001&&bounds.min.y>3.2,'lower snow shelves invade the fighting plane');
  assert.equal(group.children[0].scale.y,(height-height*.46*.32)/5,'hanging snow stretched the trunk');
  for(let layer=0;layer<4;layer++){
   const heights=[];
   for(let branch=0;branch<6;branch++){
    const start=(layer*6+branch)*28,root=start+24,tip=root+2;heights.push(p.getY(root));
    assert(p.getY(root)-p.getY(tip)>.12,'snow bough tip lost its weighted droop');
   }
   assert(Math.max(...heights)-Math.min(...heights)>.07,'snow canopy returned to identical horizontal shelves');
  }
 }
});

test('full leaf sprays use one mipmapped cutout atlas without per-tree allocations',()=>{
 const maps=new Set(),materials=new Set(),geometries=new Set();
 for(const angle of[0,1,1.5])for(let repeat=0;repeat<3;repeat++){
  const leaf=addTree(new T.Group(),'forest',4,{angle}),mat=leaf.material,map=mat.map;
  maps.add(map);materials.add(mat);geometries.add(leaf.geometry);
  assert.equal(mat.side,T.DoubleSide);assert.equal(mat.transparent,false);assert.equal(mat.depthWrite,true);assert(mat.alphaTest>.2&&mat.alphaTest<.4);
  assert(leaf.castShadow&&leaf.receiveShadow);assert(map.isDataTexture);assert(map.image.width<=512&&map.image.height<=512);assert(map.generateMipmaps);assert.equal(map.minFilter,T.LinearMipmapLinearFilter);
  assert.equal(map.colorSpace,T.SRGBColorSpace);assert(leaf.geometry.attributes.uv);assert(!leaf.customDepthMaterial,'custom shadow material can lose the leaf alpha map');
  const normals=leaf.geometry.attributes.normal;
  for(let i=0;i<normals.count;i++)assert(Math.hypot(normals.getX(i),normals.getY(i),normals.getZ(i))>.99);
 }
 assert.equal(maps.size,1);assert.equal(materials.size,1);assert.equal(geometries.size,3);
 const map=[...maps][0],alpha=Array.from({length:map.image.width*map.image.height},(_,i)=>map.image.data[i*4+3]/255);
 for(let i=0;i<map.image.width;i++)for(const index of[i,(map.image.height-1)*map.image.width+i,i*map.image.width,i*map.image.width+map.image.width-1])assert.equal(alpha[index],0,'an opaque tile edge creates a straight card outline');
 let pixels=alpha,size=map.image.width;
 // Average down the real alpha image: the cutout must retain a readable crown at distance.
 for(let level=0;level<5;level++){
  const coverage=pixels.filter(a=>a>=.30).length/pixels.length;
  assert(coverage>.18&&coverage<.38,'branch atlas loses readable leaves or closes its internal gaps at mip '+level);
  assert.equal(pixels[0],0,'atlas reaches its rectangular corner');
  const next=[];
  for(let y=0;y<size;y+=2)for(let x=0;x<size;x+=2)next.push((pixels[y*size+x]+pixels[y*size+x+1]+pixels[(y+1)*size+x]+pixels[(y+1)*size+x+1])/4);
  pixels=next;size/=2;
 }
});

test('layered crowns are full from above and below while retaining alpha-cut light gaps',()=>{
 for(const angle of[0,1,1.5]){
  const group=new T.Group(),leaf=addTree(group,'forest',4,{angle});group.updateMatrixWorld(true);
  const bounds=new T.Box3().setFromObject(leaf,true),down=new T.Raycaster(),up=new T.Raycaster(),image=leaf.material.map.image;let covered=0;
  const normals=leaf.geometry.attributes.normal,normalMatrix=new T.Matrix3().getNormalMatrix(leaf.matrixWorld),normal=new T.Vector3();let horizontal=0,steep=0;
  for(let i=0;i<normals.count;i++){normal.fromBufferAttribute(normals,i).applyMatrix3(normalMatrix).normalize();const slope=Math.acos(Math.abs(normal.y));horizontal+=Number(slope<25*Math.PI/180);steep+=Number(slope>60*Math.PI/180);}
  assert(horizontal/normals.count<.25&&steep/normals.count>.20,'crown sheets flattened into horizontal trays');
  const opaque=hits=>hits.some(hit=>{
   const x=Math.min(image.width-1,Math.floor(hit.uv.x*image.width)),y=Math.min(image.height-1,Math.floor(hit.uv.y*image.height));
   return image.data[(y*image.width+x)*4+3]/255>=leaf.material.alphaTest;
  });
  // Raycaster alone ignores alpha. Sample actual UVs so blank sheet corners do not count as foliage.
  for(let x=0;x<31;x++)for(let z=0;z<31;z++){
   const px=T.MathUtils.lerp(bounds.min.x,bounds.max.x,(x+.5)/31),pz=T.MathUtils.lerp(bounds.min.z,bounds.max.z,(z+.5)/31);
   down.set(new T.Vector3(px,bounds.max.y+1,pz),new T.Vector3(0,-1,0));up.set(new T.Vector3(px,bounds.min.y-1,pz),new T.Vector3(0,1,0));
   const fromAbove=opaque(down.intersectObject(leaf)),fromBelow=opaque(up.intersectObject(leaf));
   assert.equal(fromAbove,fromBelow,'cutout foliage disappears from its underside');covered+=Number(fromAbove);
  }
  assert(covered>490&&covered<650,'interlocking crown lost its middle foliage or closed its light gaps');
 }
});

test('forest lobes and folded snow tiers keep a full side silhouette with open edges',()=>{
 for(const biome of['forest','snow'])for(const angle of[0,1,1.5]){
  const root=new T.Group(),leaf=addTree(root,biome,4,{angle});root.updateMatrixWorld(true);
  const box=new T.Box3().setFromObject(leaf,true),ray=new T.Raycaster(),image=leaf.material.map?.image;let covered=0;
  for(let x=0;x<31;x++)for(let y=0;y<31;y++){
   ray.set(new T.Vector3(T.MathUtils.lerp(box.min.x,box.max.x,(x+.5)/31),T.MathUtils.lerp(box.min.y,box.max.y,(y+.5)/31),box.min.z-1),new T.Vector3(0,0,1));
   covered+=Number(ray.intersectObject(leaf).some(hit=>{
    if(!image)return true;
    const u=T.MathUtils.clamp(Math.floor(hit.uv.x*image.width),0,image.width-1),v=T.MathUtils.clamp(Math.floor(hit.uv.y*image.height),0,image.height-1);
    return image.data[(v*image.width+u)*4+3]/255>=leaf.material.alphaTest;
   }));
  }
  assert(covered>(biome==='forest'?430:300)&&covered<720,biome+' became thin branch cards or a solid block from ground-facing views');
 }
});

test('replacing a tree with breakable timber keeps the existing fall and collision lifecycle',()=>{
 const w=buildWorld('forest',1),timber=w.breakables[0],other=trees(w)[0].mesh,geometry=other.children[0].geometry;
 assert(timber&&!timber.mesh.getObjectByName('tree-canopy'));assert(!w.foliage.some(f=>f.leaf.parent===timber.mesh));
 assert(damageTerrain(timber,100,{x:timber.x-2,z:timber.z}));
 const context={player:{x:100,z:100},foes:[],clear:()=>true,fx:()=>{}};updateTactics(w,.8,context);assert.equal(timber.state,'fallen');assert(w.obstacles.some(o=>o.owner===timber));
 updateTactics(w,8,context);assert.equal(timber.state,'spent');assert(!w.obstacles.some(o=>o.owner===timber));assert.strictEqual(other.children[0].geometry,geometry);assert(geometry.attributes.position.count>0);dispose(w);
});


test('forest canopy LOD preserves the silhouette, shadow material and mesh identity with bounded shared detail',()=>{
 const caches=[new Set(),new Set(),new Set()];
 for(const angle of[0,1,1.5])for(let repeat=0;repeat<3;repeat++){
  const parent=new T.Group(),leaf=addTree(parent,'forest',4,{angle}),material=leaf.material,far=leaf.geometry;
  for(const [distance,level]of[[40,2],[20,1],[5,0],[10,0],[12,1],[30,1],[34,2],[30,2],[27,1]]){
   updateTreeDetail(leaf,distance,0);assert.equal(leaf.userData.treeLOD,level);assert.strictEqual(leaf.material,material);assert.strictEqual(leaf.parent,parent);assert.equal(parent.children.length,2);
   const geometry=leaf.geometry;caches[level].add(geometry);assert(geometry.index.count/3<=9000);assert.deepEqual(geometry.boundingBox,far.boundingBox,'detail enlarged the collision/clearance envelope');
   for(const attribute of Object.values(geometry.attributes))assert([...attribute.array].every(Number.isFinite));
   assert.equal(geometry.attributes.position.count,geometry.attributes.uv.count);assert(!leaf.userData.ownedGeometry);
  }
  assert.strictEqual(leaf.geometry,leaf.userData.treeTemplate.lods[1]);
 }
 for(const cache of caches)assert.equal(cache.size,3,'LOD allocations grow with trees or restarts');
 const counts=caches.map(set=>[...set][0].index.count);assert(counts[0]>counts[1]&&counts[1]>counts[2]);
});

test('snow shares three bounded LODs with rounded snow above and dark needles below',()=>{
 const caches=[new Set(),new Set(),new Set()];
 for(const angle of[0,1,1.5])for(let repeat=0;repeat<2;repeat++){
  const parent=new T.Group(),leaf=addTree(parent,'snow',4,{angle}),far=leaf.geometry,material=leaf.material,bounds=far.boundingBox.clone(),trunk=parent.children[0];
  for(const [distance,level]of[[40,2],[20,1],[5,0],[10,0],[12,1],[30,1],[34,2],[30,2],[27,1]]){
   updateTreeDetail(leaf,distance,0);assert.equal(leaf.userData.treeLOD,level);assert.strictEqual(leaf.material,material);assert.strictEqual(parent.children[0],trunk);assert.equal(parent.children.length,2);
   const g=leaf.geometry;assert.deepEqual(g.boundingBox,bounds,'snow detail changed canopy clearance');caches[level].add(g);
   assert.equal(g.groups.length,0);assert(!leaf.userData.ownedGeometry);assert([...g.attributes.treeSurface.array].every(v=>v===2));
   for(const a of Object.values(g.attributes))assert([...a.array].every(Number.isFinite));
   const n=g.attributes.normal;for(let i=0;i<n.count;i++)assert(Math.abs(Math.hypot(n.getX(i),n.getY(i),n.getZ(i))-1)<.00001);
   const count=g.index.count/3;assert.equal(count,[5256,1368,396][level]);
   if(level!==2){
    // Trace both sides of a real needle cushion rather than only inspecting its tint.
    const p=g.attributes.position,ray=new T.Raycaster(),center=new T.Vector3().fromBufferAttribute(p,0),hits=[];
    for(const direction of[-1,1]){ray.set(new T.Vector3(center.x,direction<0?bounds.max.y+1:bounds.min.y-1,center.z),new T.Vector3(0,direction,0));hits.push(ray.intersectObject(new T.Mesh(g,material)).filter(h=>Math.abs(h.point.y-center.y)<.22));}
    assert(hits[0].length>=2&&hits[1].length>=2,'close snow cushion has no separate lower needle surface');
    const color=g.attributes.color,above=[],below=[];
    for(let i=0;i<n.count;i++){const l=.2126*color.getX(i)+.7152*color.getY(i)+.0722*color.getZ(i);if(n.getY(i)>.9)above.push(l);if(n.getY(i)<-.9)below.push(l);}
    assert(below.length>=96,'lower needles were replaced by white back faces');assert(above.reduce((a,b)=>a+b,0)/above.length>below.reduce((a,b)=>a+b,0)/below.length*1.7,'snow top and underside lost their material contrast');
   }
  }
 }
 for(const cache of caches)assert.equal(cache.size,3,'snow detail allocations grow with tree count or restarts');
 const leaf=addTree(new T.Group(),'snow',4),shader={uniforms:{},vertexShader:T.ShaderLib.standard.vertexShader,fragmentShader:T.ShaderLib.standard.fragmentShader};leaf.material.onBeforeCompile(shader);
 assert(shader.fragmentShader.includes('if(!gl_FrontFacing)'),'far fir underside no longer has needle shading');assert(!shader.uniforms.treeTexture,'snow detail adds no extra texture');
});

test('snow leaders taper into a narrow green tip rather than a separate round snow cap',()=>{
 for(const angle of[0,1,1.5]){
  const leaf=addTree(new T.Group(),'snow',4,{angle});
  for(const distance of[40,20,5]){
   updateTreeDetail(leaf,distance,0);const g=leaf.geometry,p=g.attributes.position,top=g.boundingBox.max.y,peak=new T.Vector3();
   for(let i=0;i<p.count;i++)if(p.getY(i)===top){peak.fromBufferAttribute(p,i);break;}
   const mesh=new T.Mesh(g,leaf.material),ray=new T.Raycaster();
   for(let i=0;i<4;i++){
    const a=i*Math.PI*.5,dx=Math.cos(a),dz=Math.sin(a);ray.set(new T.Vector3(peak.x+dx,top-.09,peak.z+dz),new T.Vector3(-dx,0,-dz));
    const hits=ray.intersectObject(mesh);assert(hits.length>0,'leader has a detached or missing tip');
    assert(hits.every(h=>Math.hypot(h.point.x-peak.x,h.point.z-peak.z)<.065),'leader grew an isolated bulb above its branch group');
   }
   const c=g.attributes.color;let green=0;
   for(let i=0;i<p.count;i++)if(p.getY(i)>top-.1&&c.getY(i)<.25)green++;
   assert(green>0,'top of the leader became a solid white snow ornament');
  }
 }
});

test('close-up leaves stay small and gently folded before canopy scaling',()=>{
 for(const angle of[0,1,1.5]){
  const leaf=addTree(new T.Group(),'forest',4,{angle}),baseCount=leaf.geometry.attributes.position.count;
  updateTreeDetail(leaf,5,0);const p=leaf.geometry.attributes.position,uv=leaf.geometry.attributes.uv,image=leaf.material.map.image,a=new T.Vector3(),b=new T.Vector3();
  for(let i=baseCount;i<p.count;i+=6){
   a.fromBufferAttribute(p,i);b.fromBufferAttribute(p,i+3);assert(a.distanceTo(b)<.185,'one near leaf becomes a large pointed sheet');
   const box=new T.Box3();for(let j=0;j<6;j++)box.expandByPoint(a.fromBufferAttribute(p,i+j));assert(box.getSize(b).length()<.22);
   for(let j=0;j<6;j++){
    const u=uv.getX(i+j),v=uv.getY(i+j);assert(u>=0&&u<1&&v>=0&&v<1,'leaf tangent coordinates leaked into its atlas UV');
    assert.equal(image.data[(Math.floor(v*image.height)*image.width+Math.floor(u*image.width))*4+3],255,'small solid leaf samples a transparent atlas texel');
   }
  }
 }
});

test('forest backdrop stays beyond play bounds, batches at most 240 trees and releases only instances',()=>{
 const geometries=new Set(),materials=new Set();
 for(let repeat=0;repeat<2;repeat++){
  const world={group:new T.Group(),half:96,obstacles:[]},group=installForestBackdrop(world,'forest');
  assert.equal(group.children.length,6);assert(group.children.reduce((n,b)=>n+b.count*b.geometry.index.count/3,0)<140000,'backdrop triangle budget exceeded');assert.equal(group.userData.records.length,240);assert.strictEqual(installForestBackdrop(world,'forest'),group);assert.equal(world.obstacles.length,0);
  for(const batch of group.children){
   assert(batch.isInstancedMesh);assert(!batch.userData.ownedGeometry);assert(!batch.castShadow,'distant forest added an unbounded shadow pass');geometries.add(batch.geometry);materials.add(batch.material);
   batch.geometry.computeBoundingBox();const matrix=new T.Matrix4();
   for(let i=0;i<batch.count;i++){batch.getMatrixAt(i,matrix);const bounds=batch.geometry.boundingBox.clone().applyMatrix4(matrix);assert(bounds.min.x>world.half||bounds.max.x<-world.half||bounds.min.z>world.half||bounds.max.z<-world.half,'background tree enters the playable square');}
   batch.dispose();assert(!batch.visible);assert(batch.geometry.attributes.position.count>0);
  }
  assert(group.userData.disposed);
 }
 assert.equal(geometries.size,6);assert.equal(materials.size,2);
 const joined={group:new T.Group(),half:144},group=installForestBackdrop(joined,'confluence',(x,z)=>x>0&&z<0?'forest':'snow');assert(group.userData.records.every(p=>p.x>0&&p.z<0));
 assert.equal(installForestBackdrop({group:new T.Group(),half:96},'snow'),null);
});

test('distant trees form uneven groves with depth instead of an equally spaced narrow ring',()=>{
 const build=()=>installForestBackdrop({group:new T.Group(),half:96},'forest'),a=build(),b=build(),records=a.userData.records;
 assert.deepEqual(records,b.userData.records,'backdrop consumes the world random sequence or changes between restarts');
 const angles=records.map(p=>(p.angle+Math.PI*2)%(Math.PI*2)).sort((a,b)=>a-b),gaps=angles.map((a,i)=>(angles[(i+1)%angles.length]-a+Math.PI*2)%(Math.PI*2));
 assert(gaps.filter(g=>g>.06).length>=5,'groves have no visible gaps');assert(gaps.filter(g=>g<.012).length>60,'groves remain evenly spaced');
 const depth=records.map(p=>Math.hypot(p.x,p.z)-96/Math.max(Math.abs(Math.sin(p.angle)),Math.abs(Math.cos(p.angle))));
 assert(Math.max(...depth)-Math.min(...depth)>18,'backdrop remains a single thin radial band');assert(Math.min(...depth)>=10.99);
 assert.equal(records.length,240);assert.equal(a.children.length,6);for(const group of[a,b])for(const mesh of group.children)mesh.dispose();
});

test('distant grove roots sample the actual hill triangles once and survive transformed world parents',()=>{
 const world={group:new T.Group(),half:96};world.group.position.set(9,2,-7);world.group.rotation.y=.31;
 const ridge=installDistantLandscape(world,'forest'),group=world.forestBackdrop,records=group.userData.records,ray=new T.Raycaster(),point=new T.Vector3(),down=new T.Vector3(0,-1,0),inverse=world.group.matrixWorld.clone().invert();
 assert.equal(records.length,240);let min=Infinity,max=-Infinity;
 for(const p of records){
  ray.set(point.set(p.x,80,p.z).applyMatrix4(world.group.matrixWorld),down);const hit=ray.intersectObject(ridge)[0];assert(hit,'distant tree has no supporting terrain');
  const height=point.copy(hit.point).applyMatrix4(inverse).y;assert(Math.abs(height-p.y-.025)<1e-6,'tree root is floating above or buried in the hill');min=Math.min(min,p.y);max=Math.max(max,p.y);
 }
 assert(max-min>5,'the depth groups did not follow the actual rising landscape');
 const before=ridge.raycast;let calls=0;ridge.raycast=function(...args){calls++;return before.apply(this,args);};
 assert.strictEqual(installForestBackdrop(world,'forest'),group);assert.equal(calls,0,'repeated install repeats terrain sampling');ridge.raycast=before;
 for(const batch of group.children)batch.dispose();ridge.geometry.dispose();
});


test('scanned leaf maps remain local, attributed and below 0.3 MB',()=>{
 const root=new URL('../assets/environment/',import.meta.url),source=JSON.parse(readFileSync(new URL('tree-leaf-sources.json',root)));let bytes=0;
 assert.equal(source.license,'CC0-1.0');assert.equal(new URL(source.page).hostname,'polyhaven.com');assert.equal(source.files.length,2);
 for(const f of source.files){const data=readFileSync(new URL(f.file,root));assert.equal(createHash('sha256').update(data).digest('hex'),f.sha256);assert.equal(data.length,f.bytes);assert.equal(new URL(f.source).hostname,'dl.polyhaven.org');bytes+=data.length;}
 assert(bytes<300000);
});

test('unavailable scanned leaf images keep shared fallback and never retry every world rebuild',async t=>{
 const module=await import('../tree-scenery.js?failed-scan-test'),a=module.addTree(new T.Group(),'forest',4),map=a.material.map;let requests=0,disposed=0;map.addEventListener('dispose',()=>disposed++);
 t.mock.method(T.ImageLoader.prototype,'loadAsync',async()=>{requests++;throw Error('fixture missing leaf map');});
 const pending=module.loadTreeTextures();assert.strictEqual(module.loadTreeTextures(),pending);assert.equal(await pending,false);assert.equal(requests,2);assert.equal(disposed,0);assert.strictEqual(a.material.map,map);
 const b=module.addTree(new T.Group(),'forest',4);module.updateTreeDetail(b,0,0);assert.strictEqual(b.material.map,map);assert([...b.geometry.attributes.uv.array].every(Number.isFinite));
});

test('branch fallback has real internal openings and a directional silhouette rather than an opaque disc',()=>{
 const image=addTree(new T.Group(),'forest',4).material.map.image,{width,height,data}=image;let inside=0,covered=0;
 for(let y=height*.25;y<height*.75;y++)for(let x=width*.25;x<width*.75;x++){inside++;covered+=Number(data[(y*width+x)*4+3]>=77);}
 assert(covered/inside>.30&&covered/inside<.65,'the central branch region became a solid leaf plate');
 const opaque=(u,v)=>data[(Math.floor(v*height)*width+Math.floor(u*width))*4+3]>=77;
 let asymmetric=0;for(let y=1;y<10;y++)for(let x=1;x<10;x++)asymmetric+=Number(opaque(x/10,y/10)!==opaque(1-x/10,1-y/10));
 assert(asymmetric>15,'leaf arrangement regained a radially repeated disc outline');
 assert(opaque(.5,.5),'fixed geometric-leaf UV must survive the atlas change');
});

test('raw leaf surface preserves wind, shares fallback and has correct single-leaf UVs',async()=>{
 const module=await import('../tree-scenery.js?raw-leaf-test'),a=new T.MeshStandardMaterial(),b=new T.MeshStandardMaterial();let windCalls=0;
 a.onBeforeCompile=shader=>{windCalls++;shader.uniforms.windClock={value:2};shader.vertexShader+='\n// existing wind';};a.customProgramCacheKey=()=> 'existing-wind';
 assert.strictEqual(module.applyTreeLeafSurface(a),a);assert.strictEqual(module.applyTreeLeafSurface(a),a);module.applyTreeLeafSurface(b);assert.strictEqual(a.map,b.map);assert(a.map.flipY);
 assert.strictEqual(a.alphaMap,null);assert.equal(a.side,T.DoubleSide);assert(a.alphaTest>=.3&&a.alphaTest<=.4);assert(!a.transparent&&a.depthWrite);
 const shader={uniforms:{},vertexShader:T.ShaderLib.standard.vertexShader,fragmentShader:T.ShaderLib.standard.fragmentShader};a.onBeforeCompile(shader);
 assert.equal(windCalls,1);assert.equal(shader.uniforms.windClock.value,2);assert(shader.vertexShader.includes('// existing wind'));assert(shader.fragmentShader.includes('hemisphereLights[0].skyColor'));assert(shader.fragmentShader.includes('gl_FrontFacing?.045:.19'));assert(a.customProgramCacheKey().startsWith('existing-wind'));
 const {data,width,height}=a.map.image,alpha=(u,v)=>data[(Math.min(height-1,Math.floor((1-v)*height))*width+Math.min(width-1,Math.floor(u*width)))*4+3];
 assert.equal(module.TREE_LEAF_UVS.length,8);
 for(const [u,v,w,h]of module.TREE_LEAF_UVS){assert(u>=0&&v>=0&&u+w<=1&&v+h<=1);assert.equal(alpha(u+w*.5,v+h*.5),255);assert(alpha(u+w*.02,v+h*.5)<87&&alpha(u+w*.98,v+h*.5)<87,'single leaf still renders a square tile');}
 assert.equal(alpha(.085,.78),255);a.dispose();b.dispose();
});

test('scanned maps update early and late leaf materials atomically while retaining crown ownership',async t=>{
 const module=await import('../tree-scenery.js?successful-scan-test'),crown=module.addTree(new T.Group(),'forest',4),oldCrown=crown.material.map,a=module.applyTreeLeafSurface(new T.MeshStandardMaterial()),retired=module.applyTreeLeafSurface(new T.MeshStandardMaterial()),oldRaw=a.map;
 const matrices=[crown.geometry.attributes.position.array.slice(),crown.geometry.attributes.uv.array.slice()];retired.dispose();let requests=0,disposed=0,rawDisposed=0,draws=0,strokes=0;
 oldCrown.addEventListener('dispose',()=>disposed++);oldRaw.addEventListener('dispose',()=>rawDisposed++);
 t.mock.method(T.ImageLoader.prototype,'loadAsync',async url=>{requests++;return{mask:url.includes('_alpha_')};});
 t.mock.method(globalThis.document,'createElement',()=>{
  let image={mask:false};const ctx={drawImage(source){image=source;draws++;},clearRect(){},putImageData(){},save(){},restore(){},translate(){},rotate(){},fillRect(){},beginPath(){},moveTo(){},lineTo(){},stroke(){strokes++;},getImageData(){const data=new Uint8ClampedArray(1024*1024*4);for(let i=0;i<data.length;i+=4)data.set(image.mask?[255,255,255,255]:[93,128,70,255],i);return{data};}};
  return{getContext:()=>ctx};
 });
 const pending=module.loadTreeTextures();assert.strictEqual(module.loadTreeTextures(),pending);assert.equal(await pending,true);assert.equal(requests,2);assert.equal(strokes,7);assert.equal(draws,68,'scan compositor no longer uses the bounded 66-leaf twig pattern');
 assert.equal(disposed,1);assert.equal(rawDisposed,1);assert.notStrictEqual(crown.material.map,oldCrown);assert.notStrictEqual(a.map,oldRaw);assert.notStrictEqual(a.map,crown.material.map,'raw leaf materials received the composed branch atlas');assert.strictEqual(retired.map,oldRaw,'disposed material stayed in the update registry');
 const late=module.applyTreeLeafSurface(new T.MeshStandardMaterial());assert.strictEqual(late.map,a.map);assert(a.map.flipY);assert.equal(a.map.image.width,1024);assert(a.map.generateMipmaps);assert.equal(a.map.colorSpace,T.SRGBColorSpace);assert.equal(a.map.image.data[1],128);
 assert.deepEqual(crown.geometry.attributes.position.array,matrices[0]);assert.deepEqual(crown.geometry.attributes.uv.array,matrices[1]);assert.equal(crown.parent.children.length,2);
 a.dispose();late.dispose();assert.equal(rawDisposed,1,'material cleanup disposed the shared live scan');
});
