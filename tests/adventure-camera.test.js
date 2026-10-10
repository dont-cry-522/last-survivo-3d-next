import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../vendor/three.module.js';
import {AdventureCamera} from '../adventure-camera.js';

const near=(a,b,e=1e-9)=>assert(Math.abs(a-b)<e,`${a} differs from ${b}`);
const camera=opts=>new AdventureCamera(new T.PerspectiveCamera(65,16/9,.1,200),{shoulderOffset:0,...opts});
const player={x:0,z:0};
const outside=(point,o)=>assert(Math.hypot(point.x-o.x,point.z-o.z)>=o.r+.25-1e-9,'camera entered an expanded obstacle');

test('camera basis matches its visible screen, retains analog input, and does not accelerate diagonally',()=>{
 const rig=camera({pitch:0});rig.update(0,player);
 assert.deepEqual(rig.getShootDirection().toArray(),[0,0,1]);
 assert.deepEqual(rig.movement(0,1).toArray(),[0,0,1]);
 assert.deepEqual(rig.movement(1,0).toArray(),[-1,0,0]);
 near(rig.movement(1,1).length(),1);near(rig.movement(.2,0).length(),.2);
 for(const yaw of [0,Math.PI/2,Math.PI,-Math.PI/2]){
  rig.yaw=yaw;rig.update(0,player,[],{snap:true});
  const right=new T.Vector3().setFromMatrixColumn(rig.camera.matrixWorld,0),move=rig.movement(1,0);
  near(right.dot(move),1);near(rig.getRay().direction.dot(rig.getShootDirection()),1);
 }
});

test('switching modes preserves aim and zoom while first person uses the requested eye height',()=>{
 const rig=camera({yaw:.7,pitch:.45,distance:7.2});
 rig.update(0,{x:3,y:.4,z:9},[],{eyeHeight:1.48});const before=[rig.yaw,rig.pitch,rig.distance];
 rig.toggleMode().update(1/60,{x:4,y:.4,z:10},[],{eyeHeight:1.48});
 assert.equal(rig.mode,'first');assert.deepEqual(rig.camera.position.toArray(),[4,1.88,10]);
 const ray=rig.getRay();near(ray.direction.length(),1);near(ray.direction.y,Math.sin(.45));near(rig.getShootDirection().y,0);
 rig.toggleMode().update(0,{x:4,y:.4,z:10});assert.deepEqual([rig.yaw,rig.pitch,rig.distance],before);
 rig.rotate(1,100);near(rig.pitch,1.2);rig.rotate(0,-100);near(rig.pitch,-1.2);
 rig.zoom(-100);near(rig.distance,4.8);rig.zoom(100);near(rig.distance,8);
 assert.throws(()=>rig.setMode('top'),RangeError);
});

test('nearest cylinder retracts the camera immediately, independent of obstacle order or later array replacement',()=>{
 const nearTree={x:0,z:-2,r:.6},farStone={x:0,z:-4,r:.8},rig=camera({pitch:0});
 rig.update(0,player);near(rig.camera.position.z,-6);
 rig.update(1/144,player,[farStone,nearTree]);outside(rig.camera.position,nearTree);outside(rig.camera.position,farStone);
 assert(rig.camera.position.z>-1.15&&rig.camera.position.z<-1.1,'nearest hit was ignored');
 const reverse=camera({pitch:0});reverse.update(0,player,[nearTree,farStone]);near(reverse.camera.position.z,rig.camera.position.z);
 const blocked=rig.camera.position.z;rig.update(1/60,player,[]);
 assert(rig.camera.position.z<blocked&&rig.camera.position.z>-6,'distance recovery did not ease out');
 rig.update(10,player,[]);near(rig.camera.position.z,-6);
});

test('camera clearance catches grazing and near-pivot obstacles without imposing an unsafe minimum distance',()=>{
 const grazing={x:.8,z:-3,r:.6},rig=camera({pitch:0});rig.update(0,player,[grazing]);
 outside(rig.camera.position,grazing);assert(rig.camera.position.z>-3,'camera width was not considered');
 const close={x:0,z:-.8,r:.55};rig.update(1/60,player,[close]);outside(rig.camera.position,close);
 assert(rig.camera.position.distanceTo(new T.Vector3(0,1.15,0))<.03);
 assert(rig.camera.matrixWorld.elements.every(Number.isFinite));near(rig.getRay().direction.z,1);
});

test('a delayed follow target cannot drag the camera through a tree when the actor moves around it',()=>{
 const tree={x:0,z:0,r:.75},rig=camera({pitch:0});rig.update(0,{x:-3,z:0},[tree]);
 rig.update(1/144,{x:3,z:0},[tree]);near(rig.camera.position.x,3);outside(rig.camera.position,tree);
 assert.equal(tree.x,0);assert.equal(tree.r,.75);
});

test('right shoulder framing leaves the hero left of the reticle and retracts when wedged beside a tree',()=>{
 const rig=camera({pitch:0,shoulderOffset:.5});rig.update(0,player);
 near(rig.camera.position.x,-.5);near(rig.camera.position.z,-6);
 assert(new T.Vector3(0,1.15,0).project(rig.camera).x<0,'hero blocks the center/right of the view');
 const tree={x:-.85,z:0,r:.45};rig.update(1/144,player,[tree]);outside(rig.camera.position,tree);
 assert(rig.camera.position.x>-.15&&rig.camera.position.x<0,'shoulder offset was not retracted');
 const behind={x:rig.camera.position.x,z:-2,r:.6};rig.update(0,player,[tree,behind]);
 outside(rig.camera.position,tree);outside(rig.camera.position,behind);assert(rig.camera.position.z>-1.15);
 rig.setMode('first').update(0,player,[tree]);near(rig.camera.position.x,0);
 // Both legs of the shoulder-offset path miss this stone; the direct sightline
 // to the actor still crosses it and must retract the camera.
 const corner={x:.1,z:-.55,r:.2};rig.setMode('third').update(0,player,[corner]);outside(rig.camera.position,corner);
 assert(rig.camera.position.z>-.3,'shoulder offset let the direct view cut an obstacle corner');
});

test('flat ground limits orbit distance without changing the requested view direction',()=>{
 const rig=camera({pitch:1.2,distance:8});rig.update(0,{x:2,y:2,z:3},[],{groundY:2});
 near(rig.camera.position.y,2.35);near(rig.getRay().direction.y,Math.sin(1.2));
 rig.rotate(0,-2.4).update(0,{x:2,y:2,z:3},[],{groundY:2,snap:true});assert(rig.camera.position.y>2.35);
});

test('follow and unobstructed distance recovery have the same result at 30, 60, and 144 Hz',()=>{
 const poses=[];
 for(const hz of [30,60,144]){
  const rig=camera({pitch:0});rig.update(0,player,[{x:0,z:-2,r:.6}]);
  for(let i=0;i<hz;i++)rig.update(1/hz,{x:5,z:2},[]);
  poses.push(rig.camera.position.clone());
 }
 assert(poses[0].distanceTo(poses[1])<1e-9);assert(poses[0].distanceTo(poses[2])<1e-9);
 const rig=camera();rig.update(0,player);const before=rig.camera.position.clone();
 rig.update(0,{x:3,z:2});assert(before.equals(rig.camera.position));
 rig.update(NaN,{x:3,z:2});assert(before.equals(rig.camera.position));
});

test('measured low rocks allow the camera overhead while tall trees still retract it',()=>{
 const rig=camera({pitch:-.2,distance:6}),rock={x:0,z:-2,r:.8,height:.5};
 rig.update(0,player,[rock],{snap:true});assert(rig.camera.position.z<-5.5);
 rig.update(0,player,[{...rock,height:5}],{snap:true});assert(rig.camera.position.z>-1.1);
 const flat=camera({pitch:0,distance:6});flat.update(0,player,[{...rock,height:1.1}],{snap:true});assert(flat.camera.position.z>-1.1);
});


test('dodge bank does not change the center aim ray or accumulate across frames',()=>{
 for(const mode of ['first','third']){
  const rig=camera({mode,yaw:.7,pitch:.2});rig.update(0,player);const ray=rig.getRay().direction.clone(),plain=rig.camera.quaternion.clone();
  for(let i=0;i<120;i++){rig.update(1/60,player,[],{eyeHeight:1.27,shoulderHeight:1.03,roll:.028});assert(ray.distanceTo(rig.getRay().direction)<1e-9);}
  const bank=rig.camera.quaternion.clone();rig.update(0,player,[],{roll:.028});assert(bank.angleTo(rig.camera.quaternion)<1e-7);
  rig.update(0,player,[],{roll:0});assert(plain.angleTo(rig.camera.quaternion)<1e-7);
 }
});
test('lowered dodge views retain floor and obstacle clearance; stronger follow pauses and is frame-rate independent',()=>{
 const tree={x:0,z:-2,r:.6,height:5},poses=[];
 for(const hz of [30,60,144]){
  const rig=camera({pitch:0});rig.update(0,player,[tree],{shoulderHeight:.87});outside(rig.camera.position,tree);
  for(let i=0;i<hz;i++)rig.update(1/hz,{x:4,z:2},[],{followRate:24,shoulderHeight:.87});poses.push(rig.camera.position.clone());
  const held=rig.camera.position.clone();rig.update(0,{x:9,z:5},[],{followRate:24,shoulderHeight:.87});assert(held.distanceTo(rig.camera.position)<1e-9);
  rig.setMode('first').update(0,{x:4,y:-.55,z:2},[],{eyeHeight:.2});near(rig.camera.position.y,.35);
 }
 assert(poses[0].distanceTo(poses[1])<1e-9);assert(poses[0].distanceTo(poses[2])<1e-9);
});
