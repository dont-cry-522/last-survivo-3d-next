import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../vendor/three.module.js';
import {addTree} from '../tree-scenery.js';
import {buildWorld,animateWorld} from '../world.js';
import {biomeWeights,REGIONS} from '../confluence.js';
import {installForestVista} from '../forest-vista.js';
import {installForestHabitats} from '../forest-habitats.js';
import {polishEnvironmentModels} from '../environment-props.js';
import {installExplorationRoutes} from '../exploration-routes.js';
import {installExplorationLandmarks} from '../exploration-landmarks.js';
import {installExplorationComposition,sceneryRhythmAt} from '../exploration-composition.js';

globalThis.document={createElement:()=>({getContext:()=>({fillRect(){}})})};
const cleanup=w=>w.group.traverse(o=>{if(o.isInstancedMesh)o.dispose();if(o.userData.ownedGeometry)o.geometry.dispose();});
const transforms=o=>[o.position.toArray(),o.scale.toArray(),o.quaternion.toArray()];
const snapshot=w=>JSON.stringify({spawn:w.spawn,obstacles:w.obstacles.map(o=>[o.x,o.z,o.r,o.height,o.tactic]),sites:w.sites?.map(s=>[s.x,s.z,s.type]),ponds:w.ponds?.map(p=>[p.x,p.z,p.rx,p.rz,p.angle])});
function corridor(id='forest'){
 const group=new T.Group(),geometry=new T.PlaneGeometry(140,50,28,10),colors=new Float32Array(geometry.attributes.position.count*3).fill(.5);
 geometry.setAttribute('color',new T.BufferAttribute(colors,3));const ground=new T.Mesh(geometry,new T.MeshStandardMaterial({vertexColors:true}));ground.rotation.x=-Math.PI/2;ground.position.x=50;ground.position.y=-.03;ground.userData.ownedGeometry=true;group.add(ground);
 return{group,ground,obstacles:[],breakables:[],explorationRoutes:[{biome:id,points:[{x:0,z:0},{x:50,z:0},{x:100,z:0}]}],explorationLandmarks:[{biome:id,x:100,z:0}],spawn:{x:0,z:0}};
}
function tree(w,x,z,id='forest',lower=0){
 const root=new T.Group();root.position.set(x,lower,z);w.group.add(root);addTree(root,id,5,{angle:.8});const o={x,z,r:.65,height:7,mesh:root};w.obstacles.push(o);return o;
}

test('route rhythm opens at both ends, closes midway, and fades continuously into untouched terrain',()=>{
 const w=corridor();const points=JSON.stringify(w.explorationRoutes);installExplorationComposition(w,'forest');
 const start=sceneryRhythmAt(w,5,4),middle=sceneryRhythmAt(w,50,4),end=sceneryRhythmAt(w,96,4),far=sceneryRhythmAt(w,50,40);
 assert(start.opening>.95&&end.opening>.95);assert(middle.enclosure>.95&&middle.opening===0);assert(start.cover<middle.cover*.65&&end.cover<middle.cover*.65);
 assert.equal(far.cover,1);assert.equal(far.enclosure,0);assert.equal(far.opening,0);assert.equal(JSON.stringify(w.explorationRoutes),points);
 for(let x=0;x<=100;x++)for(const z of[0,6,12,18,24]){
  const a=sceneryRhythmAt(w,x,z),b=sceneryRhythmAt(w,x+.0001,z);
  for(const k of['enclosure','opening','cover']){assert(Number.isFinite(a[k])&&a[k]>=0&&a[k]<=1);assert(Math.abs(a[k]-b[k])<.001);}
  assert(a.cover>=.48,'low cover exceeds its old budget or vanishes');
 }
 cleanup(w);
});

test('forest and snow crowns frame routes while keeping roots, tactical trees, vistas and landmarks untouched',()=>{
 for(const id of['forest','snow']){
  const w=corridor(id),opening=tree(w,8,7,id),closed=tree(w,48,7,id),ending=tree(w,94,7,id),low=tree(w,55,8,id,-1.4);
  const tactical=tree(w,46,-7,id),elder=tree(w,58,-7,id),vista=tree(w,28,7,id),landmark=tree(w,100,-7,id);
  tactical.tactic='timber';w.breakables.push(tactical);w.forestHabitats={elder};w.forestVista={gateCenter:{x:28,z:4}};
  w.explorationLandmarks[0].obstacle=landmark;w.explorationLandmarks[0].mesh=landmark.mesh;
  w.group.updateMatrixWorld(true);
  const before=new Map(),meshes=[],branches=new Map();w.group.traverse(o=>{before.set(o,transforms(o));if(o.isMesh)meshes.push([o,o.geometry,o.material]);});
  for(const o of w.obstacles){const trunk=o.mesh.getObjectByName('tree-trunk'),canopy=o.mesh.getObjectByName('tree-canopy');branches.set(o,{positions:trunk.geometry.attributes.position.clone(),matrix:trunk.matrixWorld.clone(),crown:canopy.matrixWorld.clone()});}
  const stateBefore=snapshot(w),ground=w.ground.geometry.attributes.position.array.slice(),state=installExplorationComposition(w,id);
  assert.equal(state.trees,3);assert.equal(state.skippedLowTrees,1);assert.equal(snapshot(w),stateBefore);assert.deepEqual(w.ground.geometry.attributes.position.array,ground);
  for(const o of w.obstacles){
   assert.deepEqual(transforms(o.mesh),before.get(o.mesh));const trunk=o.mesh.getObjectByName('tree-trunk');assert.deepEqual(transforms(trunk),before.get(trunk));
   const canopy=o.mesh.getObjectByName('tree-canopy');assert.deepEqual(canopy.position.toArray(),before.get(canopy)[0]);
   if([low,tactical,elder,vista,landmark].includes(o))assert.deepEqual(transforms(canopy),before.get(canopy));
   else{
    assert(o===closed?canopy.scale.x>before.get(canopy)[1][0]*1.25:canopy.scale.x<before.get(canopy)[1][0]*.8);
    const old=branches.get(o),positions=trunk.geometry.attributes.position,delta=canopy.matrixWorld.clone().multiply(old.crown.clone().invert()).multiply(old.matrix);let roots=0,upper=0;
    for(let i=0;i<positions.count;i++){
     if(old.positions.getY(i)<=1.8){assert.equal(positions.getX(i),old.positions.getX(i));assert.equal(positions.getY(i),old.positions.getY(i));assert.equal(positions.getZ(i),old.positions.getZ(i));roots++;}
     if(old.positions.getY(i)>=3.3){const expected=new T.Vector3().fromBufferAttribute(old.positions,i).applyMatrix4(delta),actual=trunk.localToWorld(new T.Vector3().fromBufferAttribute(positions,i));assert(actual.distanceTo(expected)<1e-5,'upper branches do not follow the accepted crown transform');upper++;}
    }assert(roots>20&&upper>20);
    for(const tilt of[-.034,0,.034]){canopy.rotation.z=tilt;w.group.updateMatrixWorld(true);assert(new T.Box3().setFromObject(canopy).min.y>=3.2,'moving foliage drops below the headroom budget');}canopy.rotation.z=0;
   }
  }
  const after=[];w.group.traverse(o=>{if(o.isMesh)after.push([o,o.geometry,o.material]);});assert.equal(after.length,meshes.length,'composition added scene meshes');
  for(let i=0;i<after.length;i++){assert.equal(after[i][0],meshes[i][0]);assert.equal(after[i][2],meshes[i][2]);if(after[i][1]!==meshes[i][1])assert(after[i][0].name==='tree-trunk'&&after[i][0].userData.ownedGeometry,'composition cloned a non-branch asset');}
  const colors=w.ground.geometry.attributes.color.array.slice(),scales=w.obstacles.map(o=>o.mesh.getObjectByName('tree-canopy').scale.toArray());
  assert.strictEqual(installExplorationComposition(w,id),state);assert.deepEqual(w.ground.geometry.attributes.color.array,colors);assert.deepEqual(w.obstacles.map(o=>o.mesh.getObjectByName('tree-canopy').scale.toArray()),scales);
  cleanup(w);
 }
});

test('five climates use broad distinct ground transitions without moving vertices or touching shared ground',()=>{
 const colors=[];
 for(const id of['forest','snow','ash','sand','coast']){
  const w=corridor(id),p=w.ground.geometry.attributes.position.array.slice(),original=w.ground.geometry.attributes.color.array.slice();
  installExplorationComposition(w,id);assert.deepEqual(w.ground.geometry.attributes.position.array,p);assert.notDeepEqual(w.ground.geometry.attributes.color.array,original);colors.push(JSON.stringify([...w.ground.geometry.attributes.color.array]));
  assert(w.explorationComposition.groundVertices>100);assert(w.ground.geometry.attributes.color.array.every(n=>Number.isFinite(n)&&n>.35&&n<.57));cleanup(w);
  const shared=corridor(id);shared.ground.userData.ownedGeometry=false;const color=shared.ground.geometry.attributes.color.array.slice();installExplorationComposition(shared,id);assert.deepEqual(shared.ground.geometry.attributes.color.array,color);shared.ground.geometry.dispose();shared.ground.material.dispose();
 }
 assert.equal(new Set(colors).size,5);
});

test('wide floor patches vary gently within each climate and fade before joined climate boundaries',()=>{
 const closed={forest:[.80,.91,.86],snow:[.92,.96,1.01],ash:[.91,.88,.90],sand:[.93,.90,.86],coast:[.91,.96,.98]};
 const sample=(id,x,z,joined=false)=>{
  const w=corridor(id);w.ground.position.x=0;const p=w.ground.geometry.attributes.position;
  for(let i=0;i<p.count;i++)p.setXYZ(i,x,-z,0);
  w.explorationRoutes=[{biome:id,points:[{x:x-50,z},{x:x+50,z}]}];w.explorationLandmarks=[];
  if(joined)w.regions=[{id,contains:()=>true}];
  installExplorationComposition(w,id);const c=w.ground.geometry.attributes.color,result=[c.getX(0),c.getY(0),c.getZ(0)];cleanup(w);return result;
 };
 for(const [index,region]of REGIONS.entries()){
  const id=region.id,values=[];
  for(let x=-30;x<=30;x+=5){const a=sample(id,x,4),b=sample(id,x+.01,4.01);values.push(a[0]);for(let c=0;c<3;c++){assert(Math.abs(a[c]-.5*closed[id][c])<.018,'broad patch overwhelms the climate palette');assert(Math.abs(a[c]-b[c])<.0001,'patch creates a fine stripe or seam');}}
  assert(Math.max(...values)-Math.min(...values)>.002,'existing ground has no broad variation inside a uniform route section');
  const next=REGIONS[(index+1)%REGIONS.length];let lo=0,hi=1;
  for(let i=0;i<40;i++){const t=(lo+hi)/2,x=T.MathUtils.lerp(region.x,next.x,t),z=T.MathUtils.lerp(region.z,next.z,t);if(biomeWeights(x,z)[id]>.525)lo=t;else hi=t;}
  const x=T.MathUtils.lerp(region.x,next.x,(lo+hi)/2),z=T.MathUtils.lerp(region.z,next.z,(lo+hi)/2),actual=sample(id,x,z,true);
  assert(biomeWeights(x,z)[id]>.50&&biomeWeights(x,z)[id]<.55);
  for(let c=0;c<3;c++)assert(Math.abs(actual[c]-.5*closed[id][c])<1e-7,'new floor layer crossed the existing blended climate boundary');
 }
});

test('full forest pipeline keeps every terminal spray and branch join attached after route framing',()=>{
 for(const id of['forest','confluence'])for(const seed of[522,43837033]){
  const w=buildWorld(id,seed);installForestVista(w,id);installForestHabitats(w,id);installExplorationRoutes(w);installExplorationLandmarks(w,id);
  const owned=new Map();w.group.traverse(o=>{if(o.name==='tree-trunk'&&o.userData.ownedGeometry)owned.set(o,o.geometry);});
  const state=installExplorationComposition(w,id);assert(state.trees>0);w.group.updateMatrixWorld(true);let tips=0,joins=0;
  for(const o of w.obstacles){const canopy=o.mesh.getObjectByName('tree-canopy'),trunk=o.mesh.getObjectByName('tree-trunk'),template=canopy?.userData.treeTemplate;if(!template||template.snow||!owned.has(trunk))continue;
   assert.equal(trunk.geometry,owned.get(trunk),'route framing cloned an already-owned habitat trunk');
   const p=trunk.geometry.attributes.position,start=p.count-template.sprays.length*11,ends=[new T.Vector3().fromBufferAttribute(p,41),...[0,1,2,3].map(i=>new T.Vector3().fromBufferAttribute(p,130+i*20+19))];
   if(o!==w.forestHabitats.elder){
    const stem=[];for(let ring=0;ring<5;ring++){const center=new T.Vector3();for(let i=0;i<8;i++)center.add(new T.Vector3().fromBufferAttribute(p,ring*8+i));stem.push(center.multiplyScalar(1/8));}
    for(let branch=0;branch<4;branch++){const base=new T.Vector3().fromBufferAttribute(p,130+branch*20+18),near=new T.Vector3();let gap=Infinity;for(let i=1;i<stem.length;i++){new T.Line3(stem[i-1],stem[i]).closestPointToPoint(base,true,near);gap=Math.min(gap,near.distanceTo(base));}assert(gap<.16,'primary fork escaped its supporting trunk');}
   }
   for(const[i,[x,y,z,,,height]]of template.sprays.entries()){
    const end=trunk.localToWorld(new T.Vector3().fromBufferAttribute(p,start+i*11+10)),target=canopy.localToWorld(new T.Vector3(x,y+height*.24-template.bottom,z));
    assert(end.distanceTo(target)<1e-5,'route framing detached a terminal twig');tips++;
    const base=new T.Vector3().fromBufferAttribute(p,start+i*11+9);assert(Math.min(...ends.map(e=>e.distanceTo(base)))<1e-5,'terminal twig detached from its primary fork');joins++;
   }
  }assert(tips>500&&joins===tips);cleanup(w);
 }
});

test('real map composition preserves layouts, shared tree templates and rebuild cleanup without crossing climate borders',()=>{
 let releases=0;
 for(const id of['forest','snow','ash','sand','coast','confluence']){
  const w=buildWorld(id,43837033);installForestVista(w,id);installForestHabitats(w,id);
  w.explorationRoutes=(w.regions||[{id,x:w.spawn.x,z:w.spawn.z}]).map(r=>({biome:r.id,points:[{x:r.x,z:r.z},{x:r.x+20,z:r.z+7},{x:r.x+45,z:r.z+10}]}));
  w.explorationLandmarks=w.explorationRoutes.map(r=>({biome:r.biome,...r.points.at(-1)}));
  const gameplay=snapshot(w),before=new Map();w.group.traverse(o=>{if(o.isMesh)before.set(o,[o.geometry,o.material]);});
  const state=installExplorationComposition(w,id);assert(state);assert.equal(snapshot(w),gameplay);
  w.group.traverse(o=>{if(o.isMesh){const[g,m]=before.get(o);assert.equal(o.material,m);if(o.geometry!==g)assert(o.name==='tree-trunk'&&o.userData.ownedGeometry,'composition replaced a non-branch asset');}});
  const geometries=new Set();for(const o of w.obstacles)for(const mesh of o.mesh.children)if(mesh.userData.treeCanopy)geometries.add(mesh.geometry);
  if(id==='confluence')for(const r of w.regions)assert.equal(sceneryRhythmAt(w,r.x,r.z).biome,r.id);
  const colors=w.ground.geometry.attributes.color.array.slice();animateWorld(w,2,w.spawn.x,w.spawn.z);assert.deepEqual(w.ground.geometry.attributes.color.array,colors,'composition requires per-frame ground work');
  const listen=()=>releases++;for(const geometry of geometries)geometry.addEventListener('dispose',listen);
  const owned=new Set();w.group.traverse(o=>{if(o.name==='tree-trunk'&&o.userData.ownedGeometry)owned.add(o.geometry);});let ownedReleased=0;for(const g of owned)g.addEventListener('dispose',()=>ownedReleased++);
  cleanup(w);for(const geometry of geometries)geometry.removeEventListener('dispose',listen);assert.equal(releases,0,'world cleanup releases a shared tree template');assert.equal(ownedReleased,owned.size,'owned branches were leaked or disposed twice');
 }
 const empty=corridor();empty.explorationRoutes=[];assert.equal(installExplorationComposition(empty,'forest'),null);assert.equal(empty.explorationComposition,undefined);cleanup(empty);
});

test('unequal intersecting routes blend without a nearest-route color or vegetation seam',()=>{
 const w=corridor();w.explorationRoutes.push({biome:'forest',points:[{x:46,z:-10},{x:46,z:12}]});installExplorationComposition(w,'forest');
 for(let x=39;x<56;x+=.5)for(let z=-4;z<9;z+=.5){
  const a=sceneryRhythmAt(w,x,z),b=sceneryRhythmAt(w,x+.001,z+.001);
  for(const k of['opening','enclosure','cover','shade'])assert(Math.abs(a[k]-b[k])<.002,'fork creates a sharp composition seam');
 }
 cleanup(w);
});

test('real joined coast folds blend continuously where the nearest segment changes',()=>{
 const w=buildWorld('confluence',43837033);polishEnvironmentModels(w);installForestVista(w,'confluence');installForestHabitats(w,'confluence');installExplorationRoutes(w);installExplorationLandmarks(w,'confluence');installExplorationComposition(w,'confluence');
 // The route passes both sides of the tidal inlet. Its nearest progress flips
 // from .52 to .78 here; that diagnostic must not produce a visible field seam.
 const a=sceneryRhythmAt(w,16.25,92),b=sceneryRhythmAt(w,16.26,92.01);
 assert(Math.abs(a.progress-b.progress)>.2,'fixture no longer crosses the folded trail bisector');
 for(const key of['opening','enclosure','cover','shade'])assert(Math.abs(a[key]-b[key])<.005,key+' jumps at the folded route');
 for(let x=12;x<=22;x+=.25)for(let z=87;z<=99;z+=.25){
  const first=sceneryRhythmAt(w,x,z),second=sceneryRhythmAt(w,x+.01,z+.01);
  for(const key of['opening','enclosure','cover','shade'])assert(Math.abs(first[key]-second[key])<.005,key+' has a nearby seam');
 }
 cleanup(w);
});

test('short forest approaches frame a sheltered middle and a small open shore without a giant landmark clearing',()=>{
 const world=corridor();world.explorationRoutes=[{biome:'forest',points:[{x:0,z:0},{x:26,z:0}]}];world.explorationLandmarks=[{biome:'forest',x:19,z:4}];
 world.forestHabitats={approach:{start:{x:0,z:0},shore:{x:26,z:0},points:[{x:0,z:0},{x:12,z:0},{x:26,z:0}]}};
 const before=JSON.stringify(world.explorationRoutes),state=installExplorationComposition(world,'forest');assert(state.approach);
 const start=sceneryRhythmAt(world,1,3),middle=sceneryRhythmAt(world,13,3),shore=sceneryRhythmAt(world,25.8,3);
 assert(start.opening>.95&&shore.opening>.95);assert(middle.enclosure>.85&&middle.opening<.05,'the entire short walk was flattened into an open clearing');
 assert(middle.cover>start.cover&&middle.cover>shore.cover);assert.equal(JSON.stringify(world.explorationRoutes),before);
 for(let x=0;x<30;x+=.25)for(const z of[0,3,6,9,12]){
  const a=sceneryRhythmAt(world,x,z),b=sceneryRhythmAt(world,x+.001,z+.001);
  for(const key of['opening','enclosure','cover','shade'])assert(Math.abs(a[key]-b[key])<.004,'approach transition has a sharp field seam');
 }
 cleanup(world);
});

test('late scenery shares a soft soil bed without extra assets, raised ground or compounded dark seams',()=>{
 for(const id of['forest','snow','ash','sand','coast']){
  const plain=corridor(id),w=corridor(id);
  w.biomePlaces=[{x:50,z:20,angle:0,biome:id}];
  w.environmentClusters={records:[{x:65,z:20,angle:.2,footprint:2,biome:id},{x:65,z:20,angle:.2,footprint:2,biome:id}]};
  const positions=w.ground.geometry.attributes.position.array.slice(),geometry=w.ground.geometry,material=w.ground.material,count=w.group.children.length;
  installExplorationComposition(plain,id);const state=installExplorationComposition(w,id);
  assert(state.bedVertices>10);assert.equal(w.group.children.length,count);assert.equal(w.ground.geometry,geometry);assert.equal(w.ground.material,material);assert.deepEqual(geometry.attributes.position.array,positions);
  const base=plain.ground.geometry.attributes.color,c=geometry.attributes.color,p=geometry.attributes.position;let bridge=0,untouched=0;
  for(let i=0;i<p.count;i++){
   const x=p.getX(i)+50,z=-p.getY(i),delta=Math.abs(c.getX(i)-base.getX(i))+Math.abs(c.getY(i)-base.getY(i))+Math.abs(c.getZ(i)-base.getZ(i));
   for(let channel=0;channel<3;channel++){const ratio=c.array[i*3+channel]/base.array[i*3+channel];assert(ratio>=.869999&&ratio<=1.018001,'overlapping soil beds multiply or overpower the ground colour');}
   if(x>=55&&x<=65&&z===20){assert(delta>.005,'a bare seam separates place and nearby scenery');bridge++;}
   if(x<30||x>80){assert(delta===0,'soil tint spread beyond its actual scenery');untouched++;}
  }
  assert(bridge>=3&&untouched>100);const color=c.array.slice();installExplorationComposition(w,id);assert.deepEqual(c.array,color);cleanup(w);cleanup(plain);
 }
});

test('late scenery soil fades out before joined climate boundaries',()=>{
 for(const [i,region]of REGIONS.entries()){
  const next=REGIONS[(i+1)%REGIONS.length];let lo=0,hi=1;
  for(let j=0;j<40;j++){const t=(lo+hi)/2,x=T.MathUtils.lerp(region.x,next.x,t),z=T.MathUtils.lerp(region.z,next.z,t);if(biomeWeights(x,z)[region.id]>.525)lo=t;else hi=t;}
  const x=T.MathUtils.lerp(region.x,next.x,(lo+hi)/2),z=T.MathUtils.lerp(region.z,next.z,(lo+hi)/2),plain=corridor(region.id),w=corridor(region.id);
  for(const q of[plain,w]){q.regions=[{id:region.id,contains:()=>true}];q.ground.position.x=0;const p=q.ground.geometry.attributes.position;for(let n=0;n<p.count;n++)p.setXYZ(n,x,-z,0);}
  w.biomePlaces=[{x:x-7,z,angle:0,biome:region.id}];w.environmentClusters={records:[{x,z,biome:region.id,angle:0,footprint:2}]};
  installExplorationComposition(plain,region.id);installExplorationComposition(w,region.id);assert.deepEqual(w.ground.geometry.attributes.color.array,plain.ground.geometry.attributes.color.array,'soil colour makes a hard climate seam');cleanup(plain);cleanup(w);
 }
});
