import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../vendor/three.module.js';
import {buildWorld} from '../world.js';
import {installAdventureCampfire,updateAdventureCampfire} from '../adventure-campfire.js';

globalThis.document={createElement:()=>({getContext:()=>({fillRect(){}})})};
const cleanup=world=>world.group.traverse(o=>{if(o.isInstancedMesh)o.dispose();if(o.userData.ownedGeometry)o.geometry.dispose();});
const pose=o=>[o.position.toArray(),o.quaternion.toArray(),o.scale.toArray()];
const poses=group=>group.children.map(pose);

test('all maps replace only glowing cones with three soft cards, retaining logs, lights and gameplay positions',()=>{
 const texture=new T.Texture();
 for(const id of['forest','snow','ash','sand','coast','confluence']){
  const world=buildWorld(id,7),firePose=pose(world.fire),light=world.light,lightPose=pose(light),intensity=light.intensity,color=light.color.clone();
  const original=[],cones=[];world.fire.traverse(o=>{if(o.isMesh&&o.geometry.type==='ConeGeometry'&&o.material.emissiveIntensity>0)cones.push(o);});
  world.group.traverse(o=>{if(o.isMesh&&!cones.includes(o))original.push({o,pose:pose(o),visible:o.visible,material:o.material,geometry:o.geometry});});
  const gameplay=JSON.stringify({spawn:world.spawn,obstacles:world.obstacles.map(o=>[o.x,o.z,o.r]),sites:world.sites.map(s=>[s.x,s.z,s.claimed])});
  const group=installAdventureCampfire(world,texture);assert(group);assert.equal(group.parent,world.fire);assert.equal(group.children.length,3);assert(cones.length>0&&cones.every(o=>!o.visible));
  assert.equal(installAdventureCampfire(world,texture),group);assert.equal(world.fire.children.filter(o=>o.name==='adventure-campfire').length,1);
  for(const flame of group.children){const m=flame.material;assert(flame.isMesh);assert.equal(m.map,texture);assert.equal(m.side,T.DoubleSide);assert(m.forceSinglePass&&!m.depthWrite&&m.depthTest&&m.transparent);assert(m.opacity<=.54);assert(!flame.castShadow&&!flame.receiveShadow);assert(!flame.userData.ownedGeometry);assert.equal(flame.geometry.index.count/3,2);}
  updateAdventureCampfire(world,9);
  assert.deepEqual(pose(world.fire),firePose);assert.equal(world.light,light);assert.deepEqual(pose(light),lightPose);assert.equal(light.intensity,intensity);assert(light.color.equals(color));
  for(const p of original){assert.deepEqual(pose(p.o),p.pose);assert.equal(p.o.visible,p.visible);assert.equal(p.o.material,p.material);assert.equal(p.o.geometry,p.geometry);}
  assert.equal(JSON.stringify({spawn:world.spawn,obstacles:world.obstacles.map(o=>[o.x,o.z,o.r]),sites:world.sites.map(s=>[s.x,s.z,s.claimed])}),gameplay);
  cleanup(world);
 }
 texture.dispose();
});

test('absolute scenery time is repeatable, bounded below one metre and never animates the whole fire',()=>{
 const world={fire:new T.Group()},texture=new T.Texture();world.fire.position.set(-9,.2,6);
 const group=installAdventureCampfire(world,texture),initial=poses(group),firePose=pose(world.fire),box=new T.Box3();
 updateAdventureCampfire(world,4);assert.notDeepEqual(poses(group),initial);const frozen=poses(group);
 for(let i=0;i<20;i++)updateAdventureCampfire(world,4);assert.deepEqual(poses(group),frozen);
 updateAdventureCampfire(world,NaN);updateAdventureCampfire(world,Infinity);assert.deepEqual(poses(group),frozen);
 for(let i=0;i<120;i++){
  updateAdventureCampfire(world,i*.37);world.fire.updateMatrixWorld(true);box.setFromObject(group);
  assert(box.max.y<1&&box.min.y>.14,'fire lifts off its logs or grows above the original fire');
  assert(box.max.x-box.min.x<.7&&box.max.z-box.min.z<.7);assert(group.children.every(m=>m.matrixWorld.elements.every(Number.isFinite)));
 }
 updateAdventureCampfire(world,4);assert.deepEqual(poses(group),frozen);assert.deepEqual(pose(world.fire),firePose);texture.dispose();
});

test('rebuilds share cards and texture-keyed materials without shared animation or disposal',()=>{
 const texture=new T.Texture(),otherTexture=new T.Texture(),make=()=>({group:new T.Group(),fire:new T.Group()});
 const a=make(),b=make();a.group.add(a.fire);b.group.add(b.fire);
 const one=installAdventureCampfire(a,texture),two=installAdventureCampfire(b,texture);let freed=0;
 const resources=new Set([texture,one.children[0].geometry,...one.children.map(o=>o.material)]),onDispose=()=>freed++;
 for(const resource of resources)resource.addEventListener('dispose',onDispose);
 try{
  for(let i=0;i<3;i++){assert.notEqual(one.children[i],two.children[i]);assert.equal(one.children[i].geometry,two.children[i].geometry);assert.equal(one.children[i].material,two.children[i].material);}
  const untouched=poses(two),materials=two.children.map(o=>[o.material.color.toArray(),o.material.opacity]);updateAdventureCampfire(a,13);assert.deepEqual(poses(two),untouched);assert.deepEqual(two.children.map(o=>[o.material.color.toArray(),o.material.opacity]),materials);
  cleanup(a);assert.equal(freed,0);assert.equal(installAdventureCampfire(b,otherTexture),two);assert(two.children.every(o=>o.material.map===otherTexture));assert.notEqual(one.children[0].material,two.children[0].material);cleanup(b);assert.equal(freed,0);
 }finally{for(const resource of resources)resource.removeEventListener('dispose',onDispose);texture.dispose();otherTexture.dispose();}
});

test('missing texture retains the original flame and non-glowing cones remain untouched',()=>{
 const fire=new T.Group(),material=new T.MeshStandardMaterial({emissive:0xff8800,emissiveIntensity:1}),glowing=new T.Mesh(new T.ConeGeometry(.2,.8,6),material),plain=new T.Mesh(glowing.geometry,new T.MeshStandardMaterial());fire.add(glowing,plain);
 const world={fire},texture=new T.Texture();assert.equal(installAdventureCampfire(world,null),null);assert(glowing.visible);assert.equal(installAdventureCampfire({},texture),null);
 updateAdventureCampfire({},0);installAdventureCampfire(world,texture);assert(!glowing.visible&&plain.visible);texture.dispose();glowing.geometry.dispose();material.dispose();plain.material.dispose();
});
