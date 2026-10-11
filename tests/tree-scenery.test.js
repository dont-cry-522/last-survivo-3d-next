import{test}from'node:test';
import assert from'node:assert/strict';
import{createHash}from'node:crypto';
import{readFileSync}from'node:fs';
import * as T from'../vendor/three.module.js';
import{addTree,updateTreeDetail,installForestBackdrop}from'../tree-scenery.js';
import{buildWorld,animateWorld}from'../world.js';
import{damageTerrain,updateTactics}from'../map-tactics.js?v=149';

globalThis.document={createElement:()=>({getContext:()=>({fillRect(){}})})};
const dispose=w=>w.group.traverse(o=>{if(o.isInstancedMesh)o.dispose();if(o.userData.ownedGeometry)o.geometry.dispose();});
const trees=w=>w.obstacles.filter(o=>o.mesh.getObjectByName('tree-canopy'));

test('tree art preserves the established obstacle, reward, terrain and ground-detail layouts',()=>{
 const before={forest:['1c485468e05a8657eff1b670350553cb666c403693a607332926b653f1f536d2','ebf829a3b04a874d0704b2694466aebf4e9347246448562584bd2dbe5cd4535b'],snow:['b0abb255379b8280117d8ecbc5d3131483118603a25c01633fb71609556183d4','a40ac01130c5da5389c6840dc3d16bea0b45e302ac606e498ac337feadb48b7e'],confluence:['61a3e28ac98ef4704f18e8c4722c18a8d0e03d8f4079eb8337860cac335d5ed2','2949ce831ae43f87aeb8d274d0253388c2793e746ef1499a06ca967eeb4f2f2b']};
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
   assert(o.mesh.children.reduce((n,m)=>n+(m.geometry.index?.count??m.geometry.attributes.position.count)/3,0)<=(snow?470:1200),'tree exceeds its shared geometry budget');
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
   const center=ring=>Array.from({length:8},(_,i)=>stem.getX(ring*8+i)).reduce((a,b)=>a+b,0)/8;
   assert(Math.abs(center(2)-(center(0)+center(4))/2)>.005,'main trunk reverted to a straight rod');
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
  assert.equal(leaf.geometry.index.count/3,450,'rounded crowns added extra far-LOD triangles');
 }
});

test('snow boughs stagger their snow shelves and droop within the shared far-crown budget',()=>{
 for(const angle of[0,1,1.5]){
  const group=new T.Group(),leaf=addTree(group,'snow',4,{angle}),p=leaf.geometry.attributes.position;
  assert.equal(group.children.length,2);assert.equal(leaf.geometry.index.count/3,284);
  group.updateMatrixWorld(true);const bounds=new T.Box3().setFromObject(leaf,true),height=5.2+4*.52;
  assert(Math.abs(bounds.max.y-height)<.00001,'fuller snow crown moved the established tree top');
  assert(Math.abs(bounds.min.y-(height*.54-.24))<.00001&&bounds.min.y>3.2,'lower snow shelves invade the fighting plane');
  assert.equal(group.children[0].scale.y,(height-height*.46*.32)/5,'hanging snow stretched the trunk');
  for(let layer=0;layer<4;layer++){
   const heights=[];
   for(let branch=0;branch<4;branch++){
    const start=(layer*4+branch)*28,root=start+24,tip=root+2;heights.push(p.getY(root));
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
  assert(covered>310&&covered<600,'branch canopy has become a sparse skeleton or lost its light gaps');
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
   const geometry=leaf.geometry;caches[level].add(geometry);assert(geometry.index.count/3<=7650);assert.deepEqual(geometry.boundingBox,far.boundingBox,'detail enlarged the collision/clearance envelope');
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
   const count=g.index.count/3;assert.equal(count,[3704,968,284][level]);
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
 const pending=module.loadTreeTextures();assert.strictEqual(module.loadTreeTextures(),pending);assert.equal(await pending,true);assert.equal(requests,2);assert.equal(strokes,7);assert.equal(draws,56,'scan compositor no longer uses the bounded 54-leaf twig pattern');
 assert.equal(disposed,1);assert.equal(rawDisposed,1);assert.notStrictEqual(crown.material.map,oldCrown);assert.notStrictEqual(a.map,oldRaw);assert.notStrictEqual(a.map,crown.material.map,'raw leaf materials received the composed branch atlas');assert.strictEqual(retired.map,oldRaw,'disposed material stayed in the update registry');
 const late=module.applyTreeLeafSurface(new T.MeshStandardMaterial());assert.strictEqual(late.map,a.map);assert(a.map.flipY);assert.equal(a.map.image.width,1024);assert(a.map.generateMipmaps);assert.equal(a.map.colorSpace,T.SRGBColorSpace);assert.equal(a.map.image.data[1],128);
 assert.deepEqual(crown.geometry.attributes.position.array,matrices[0]);assert.deepEqual(crown.geometry.attributes.uv.array,matrices[1]);assert.equal(crown.parent.children.length,2);
 a.dispose();late.dispose();assert.equal(rawDisposed,1,'material cleanup disposed the shared live scan');
});
