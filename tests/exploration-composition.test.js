import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../vendor/three.module.js';
import {addTree} from '../tree-scenery.js';
import {buildWorld,animateWorld} from '../world.js';
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
  const before=new Map(),meshes=[];w.group.traverse(o=>{before.set(o,transforms(o));if(o.isMesh)meshes.push([o,o.geometry,o.material]);});
  const stateBefore=snapshot(w),ground=w.ground.geometry.attributes.position.array.slice(),state=installExplorationComposition(w,id);
  assert.equal(state.trees,3);assert.equal(state.skippedLowTrees,1);assert.equal(snapshot(w),stateBefore);assert.deepEqual(w.ground.geometry.attributes.position.array,ground);
  for(const o of w.obstacles){
   assert.deepEqual(transforms(o.mesh),before.get(o.mesh));const trunk=o.mesh.getObjectByName('tree-trunk');assert.deepEqual(transforms(trunk),before.get(trunk));
   const canopy=o.mesh.getObjectByName('tree-canopy');assert.deepEqual(canopy.position.toArray(),before.get(canopy)[0]);
   if([low,tactical,elder,vista,landmark].includes(o))assert.deepEqual(transforms(canopy),before.get(canopy));
   else{
    assert(o===closed?canopy.scale.x>before.get(canopy)[1][0]*1.25:canopy.scale.x<before.get(canopy)[1][0]*.8);
    for(const tilt of[-.034,0,.034]){canopy.rotation.z=tilt;w.group.updateMatrixWorld(true);assert(new T.Box3().setFromObject(canopy).min.y>=3.2,'moving foliage drops below the headroom budget');}canopy.rotation.z=0;
   }
  }
  const after=[];w.group.traverse(o=>{if(o.isMesh)after.push([o,o.geometry,o.material]);});assert.deepEqual(after,meshes,'composition added or cloned GPU assets');
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

test('real map composition preserves layouts, shared tree templates and rebuild cleanup without crossing climate borders',()=>{
 let releases=0;
 for(const id of['forest','snow','ash','sand','coast','confluence']){
  const w=buildWorld(id,43837033);installForestVista(w,id);installForestHabitats(w,id);
  w.explorationRoutes=(w.regions||[{id,x:w.spawn.x,z:w.spawn.z}]).map(r=>({biome:r.id,points:[{x:r.x,z:r.z},{x:r.x+20,z:r.z+7},{x:r.x+45,z:r.z+10}]}));
  w.explorationLandmarks=w.explorationRoutes.map(r=>({biome:r.biome,...r.points.at(-1)}));
  const gameplay=snapshot(w),before=new Map();w.group.traverse(o=>{if(o.isMesh)before.set(o,[o.geometry,o.material]);});
  const state=installExplorationComposition(w,id);assert(state);assert.equal(snapshot(w),gameplay);
  w.group.traverse(o=>{if(o.isMesh)assert.deepEqual([o.geometry,o.material],before.get(o));});
  const geometries=new Set();for(const o of w.obstacles)for(const mesh of o.mesh.children)if(mesh.userData.treeCanopy)geometries.add(mesh.geometry);
  if(id==='confluence')for(const r of w.regions)assert.equal(sceneryRhythmAt(w,r.x,r.z).biome,r.id);
  const colors=w.ground.geometry.attributes.color.array.slice();animateWorld(w,2,w.spawn.x,w.spawn.z);assert.deepEqual(w.ground.geometry.attributes.color.array,colors,'composition requires per-frame ground work');
  const listen=()=>releases++;for(const geometry of geometries)geometry.addEventListener('dispose',listen);
  cleanup(w);for(const geometry of geometries)geometry.removeEventListener('dispose',listen);assert.equal(releases,0,'world cleanup releases a shared tree template');
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
