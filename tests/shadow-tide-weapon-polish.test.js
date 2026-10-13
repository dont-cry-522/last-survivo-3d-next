import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../vendor/three.module.js';
import {shadowFocus} from '../shadow-gear.js';
import {makeHarpoon} from '../coast-models.js';

test('scythe keeps a nonmetal haft, flat leather wrap and a seated forged socket',()=>{
 const scythe=shadowFocus('shadowblade'),shaft=scythe.getObjectByName('SM_Scythe_BlackwoodShaft_A'),socket=scythe.getObjectByName('SM_Scythe_BladeSocket_A');
 assert.equal(shaft.material.metalness,0);assert(shaft.material.vertexColors);assert(socket.material.metalness>.6);
 for(const i of [0,1]){
  const grip=scythe.getObjectByName('SM_Scythe_LeatherBinding_'+i);
  assert.equal(grip.material.metalness,0);assert(grip.material.roughness>.8);
  assert.notEqual(grip.material,shaft.material);assert.notEqual(grip.material,socket.material);
  assert.equal(grip.geometry.type,'BufferGeometry');
  assert(new T.Box3().setFromObject(grip).intersectsBox(new T.Box3().setFromObject(shaft)));
 }
 assert(new T.Box3().setFromObject(socket).intersectsBox(new T.Box3().setFromObject(shaft)));
 assert(new T.Box3().setFromObject(socket).intersectsBox(new T.Box3().setFromObject(scythe.getObjectByName('SM_Scythe_ForgedBlade_A'))));
});

test('open grimoire has a continuous spine and its static ink touches actual curled paper',()=>{
 const book=shadowFocus('grimoire'),spine=book.getObjectByName('SM_Grimoire_ContinuousSpine');
 book.updateMatrixWorld(true);
 assert(spine&&book.getObjectByName('SM_Grimoire_FoldedGutter'));
 assert.deepEqual(book.userData.page.position.toArray(),[.095,.12,.06]);
 assert.deepEqual(book.userData.page.scale.toArray(),[.18,.004,.25]);
 for(const sign of[-1,1]){
  const cover=book.getObjectByName('SM_Grimoire_SoulhideCover_'+sign),pages=book.getObjectByName('SM_Grimoire_AshenPages_'+sign);
  assert(new T.Box3().setFromObject(spine).intersectsBox(new T.Box3().setFromObject(cover)));
  const surface=new T.Mesh(pages.geometry,pages.material);surface.position.copy(pages.position);surface.scale.copy(pages.scale);surface.updateMatrixWorld();
  const ray=new T.Raycaster(),ink=book.getObjectByName('SM_Grimoire_BoundPageScript_'+sign).geometry.attributes.position;
  let checked=0;
  for(let i=0;i<ink.count;i+=7){
   ray.set(new T.Vector3(ink.getX(i),1,ink.getZ(i)),new T.Vector3(0,-1,0));const hit=ray.intersectObject(surface,false)[0];
   assert(hit,'script leaves the paper surface');assert(Math.abs(ink.getY(i)-hit.point.y)<.002,'script floats more than 2 mm off the paper');checked++;
  }
  assert(checked>20);
 }
});

test('shade seams sit on separate folded lips rather than float across the empty center',()=>{
 const focus=shadowFocus('shade').userData.focus,surface=new T.Mesh(focus.geometry,focus.material),ray=new T.Raycaster();surface.updateMatrixWorld();
 for(const side of[-1,1]){
  const seam=focus.getObjectByName('SM_Shade_FoldedRiftLip_'+side),path=seam.geometry.parameters.path;
  for(let i=2;i<9;i++){
   const point=path.getPoint(i/10);ray.set(new T.Vector3(point.x,point.y,1),new T.Vector3(0,0,-1));const hit=ray.intersectObject(surface,false)[0];
   assert(hit,'rift seam crosses the open center');assert(Math.abs(point.z-hit.point.z)<.004,'rift seam is detached from its sheet');
  }
 }
});

test('harpoon has two continuous nonmetal grip surfaces, integral socket and unchanged contacts',()=>{
 const fork=makeHarpoon(),tip=fork.getObjectByName('SM_Harpoon_CentralGroundPoint');
 assert.deepEqual(tip.position.toArray(),[0,0,1.36]);assert.equal(tip.scale.x,.78);
 const shaft=fork.getObjectByName('SM_Harpoon_SaltedWoodHaft');assert.equal(shaft.material.metalness,0);
 for(const i of[0,1]){
  const grip=fork.getObjectByName('SM_Harpoon_SailclothGrip_'+i);assert(grip.material.vertexColors);assert.equal(grip.material.metalness,0);
  assert(new T.Box3().setFromObject(grip).intersectsBox(new T.Box3().setFromObject(shaft)));
 }
 assert(new T.Box3().setFromObject(fork.getObjectByName('SM_Harpoon_ForkSocket')).intersectsBox(new T.Box3().setFromObject(shaft)));
 let meshes=0;fork.traverse(n=>{if(n.isMesh)meshes++;});assert(meshes<=10,'wrapped grip regresses to separate ornament rings');
});

test('all four refinements share immutable surfaces but not pose nodes, with finite bounded geometry',()=>{
 for(const id of['shadowblade','grimoire','shade','harpoon']){
  const make=()=>id==='harpoon'?makeHarpoon():shadowFocus(id),a=make(),b=make();let triangles=0;
  a.traverse(n=>{
   if(!n.isMesh)return;triangles+=(n.geometry.index?.count??n.geometry.attributes.position.count)/3;
   for(const attr of ['position','normal'])assert([...n.geometry.attributes[attr].array].every(Number.isFinite));
   if(!n.userData.identityDetail)return;const other=b.getObjectByName(n.name);
   assert(other&&other!==n);assert.equal(other.geometry,n.geometry);assert.equal(other.material,n.material);
   const previous=other.position.clone();n.position.x+=.01;assert(other.position.equals(previous));
  });
  assert(triangles<5000);if(id==='grimoire')assert.notEqual(a.userData.page,b.userData.page);if(id==='shade')assert.notEqual(a.userData.focus,b.userData.focus);
 }
});
