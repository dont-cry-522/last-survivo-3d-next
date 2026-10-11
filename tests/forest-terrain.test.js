import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../vendor/three.module.js';
import {buildWorld} from '../world.js';
import {installForestHabitats} from '../forest-habitats.js';
import {installExplorationRoutes} from '../exploration-routes.js';
import {installAdventureGroundDetail,installHabitatDetail} from '../adventure-ground-detail.js';
import {installForestTerrain} from '../forest-terrain.js';
import {installEnvironmentGrounding} from '../environment-grounding.js';
import {installForestFloorRelief} from '../forest-floor-relief.js';
import {installForestVista} from '../forest-vista.js';
import {installBiomePlaces} from '../biome-places.js';
import {installEnvironmentClusters} from '../environment-clusters.js';
import {installExplorationLandmarks} from '../exploration-landmarks.js';
import {installExplorationComposition} from '../exploration-composition.js';

globalThis.document={createElement:()=>({getContext:()=>({fillRect(){}})})};
const cleanup=w=>w.group.traverse(o=>{if(o.isInstancedMesh)o.dispose();if(o.userData.ownedGeometry)o.geometry.dispose();});
function forest(seed){const w=buildWorld('forest',seed);installForestHabitats(w,'forest');installExplorationRoutes(w);installAdventureGroundDetail(w,'forest');installHabitatDetail(w,'forest');return w;}

test('forest approach uses its rendered triangles for bounded shallow ground without moving solid footprints',()=>{
 for(const seed of [7,522,43837033]){
  const w=forest(seed),snapshot=JSON.stringify({spawn:w.spawn,obstacles:w.obstacles.map(o=>[o.x,o.z,o.r,o.height]),ponds:w.ponds.map(p=>[p.x,p.z,p.rx,p.rz]),sites:w.sites.map(s=>[s.x,s.z])});
  const old=w.ground.geometry;let released=0;old.addEventListener('dispose',()=>released++);const t=installForestTerrain(w,'forest');assert(t&&t.maxHeight>.04&&t.maxHeight<=.25);assert.equal(released,1);assert.equal(installForestTerrain(w,'forest'),t);
  assert.equal(JSON.stringify({spawn:w.spawn,obstacles:w.obstacles.map(o=>[o.x,o.z,o.r,o.height]),ponds:w.ponds.map(p=>[p.x,p.z,p.rx,p.rz]),sites:w.sites.map(s=>[s.x,s.z])}),snapshot);
  assert.equal(w.ground.geometry.index.count/3,144*144*2);assert.equal(w.groundHeightAt(w.spawn.x,w.spawn.z),0);
  for(const o of w.obstacles)for(let i=0;i<8;i++)assert.equal(w.groundHeightAt(o.x+Math.sin(i*Math.PI/4)*o.r,o.z+Math.cos(i*Math.PI/4)*o.r),0,'terrain entered a protected solid');
  for(const q of w.ponds)assert.equal(w.groundHeightAt(q.x,q.z),0,'water floor moved');
  w.group.updateMatrixWorld(true);const ray=new T.Raycaster(),down=new T.Vector3(0,-1,0),origin=new T.Vector3();let checked=0;
  for(let z=0;z<t.rows;z++)for(let x=0;x<t.cols;x++){
   const a=z*(t.cols+1)+x;if(!t.heights[a]&&!t.heights[a+1]&&!t.heights[a+t.cols+1]&&!t.heights[a+t.cols+2])continue;
   for(const [u,v]of [[.2,.3],[.8,.7]]){const px=-t.width/2+(x+u)*t.width/t.cols,pz=-t.height/2+(z+v)*t.height/t.rows;ray.set(origin.set(px,5,pz),down);const hit=ray.intersectObject(w.ground)[0];assert(hit);assert(Math.abs(hit.point.y+.03-w.groundHeightAt(px,pz))<1e-6,'feet do not follow rendered ground');checked++;}
  }
  assert(checked>8);for(let z=0;z<=t.rows;z++)for(let x=0;x<=t.cols;x++){const i=z*(t.cols+1)+x;if(x)assert(Math.abs(t.heights[i]-t.heights[i-1])<=t.width/t.cols*.035+1e-7);if(z)assert(Math.abs(t.heights[i]-t.heights[i-t.cols-1])<=t.height/t.rows*.035+1e-7);}
  cleanup(w);
 }
});

test('grass roots and owned ground overlays rise once; ground contact and root caps dispose with refined floor',()=>{
 const w=forest(522),matrix=new T.Matrix4(),point=new T.Vector3(),before=[];
 for(const group of [w.adventureGroundDetail,w.habitatDetail])for(const m of group.children)if(m.isInstancedMesh)for(let i=0;i<m.count;i++){m.getMatrixAt(i,matrix);before.push({m,i,matrix:matrix.clone()});}
 const t=installForestTerrain(w,'forest');assert(t.instances>0);for(const r of before){r.m.getMatrixAt(r.i,matrix);point.setFromMatrixPosition(r.matrix);assert(Math.abs(matrix.elements[13]-r.matrix.elements[13]-t.sample(point.x,point.z))<1e-6);for(const i of [0,2,8,10,12,14])assert.equal(matrix.elements[i],r.matrix.elements[i]);}
 const contact=installEnvironmentGrounding(w),cap=installForestFloorRelief(w,'forest');assert(contact&&cap);let freed=0;contact.texture.addEventListener('dispose',()=>freed++);cleanup(w);assert(t.disposed&&cap.userData.disposed&&contact.disposed);assert.equal(w.groundHeightAt,undefined);assert.equal(freed,1);
});

test('other maps and missing approaches keep the original ground and allocate no height field',()=>{
 for(const id of ['snow','ash','sand','coast','confluence','forest']){const w=buildWorld(id,522),g=w.ground.geometry,positions=g.attributes.position.array.slice();assert.equal(installForestTerrain(w,id),null);assert.equal(w.ground.geometry,g);assert.deepEqual(g.attributes.position.array,positions);assert.equal(w.groundHeightAt,undefined);cleanup(w);}
});

test('real forest route and soil triangles stay above the floor internally without adding meshes or losing worn edges',()=>{
 for(const seed of [7,19,522,43837033,9]){
  const w=buildWorld('forest',seed);
  for(const install of [installForestVista,installForestHabitats,installBiomePlaces,installEnvironmentClusters,installExplorationRoutes,installExplorationLandmarks,installExplorationComposition,installAdventureGroundDetail,installHabitatDetail])install(w,'forest');
  w.group.updateMatrixWorld(true);const point=new T.Vector3(),overlays=[];
  for(const mesh of w.group.children){
   if(!mesh.isMesh||mesh===w.ground||mesh.isInstancedMesh||!mesh.userData.ownedGeometry)continue;
   const geometry=mesh.geometry,attr=geometry.attributes.position;let flat=true;
   for(let i=0;i<attr.count;i++){point.fromBufferAttribute(attr,i).applyMatrix4(mesh.matrixWorld);if(point.y<-.06||point.y>.08){flat=false;break;}}
   if(flat){const entry={mesh,geometry,material:mesh.material,color:geometry.attributes.color?.array.slice(),released:0};geometry.addEventListener('dispose',()=>entry.released++);overlays.push(entry);}
  }
  const children=w.group.children.slice(),t=installForestTerrain(w,'forest');assert(t.overlayTrianglesAdded>=0&&t.overlayTrianglesAdded<=4096);if(seed===522)assert(t.overlayTrianglesAdded>0);if(seed===19)assert.equal(t.overlayTrianglesAdded,0,'flat overlays were unnecessarily refined');if(seed===9)assert.equal(t.overlayTrianglesAdded,4096,'budget saturation case no longer exercised');
  assert.deepEqual(w.group.children,children);let checked=0;
  for(const entry of overlays){
   const {mesh,geometry,color}=entry,g=mesh.geometry,attr=g.attributes.position,index=g.index;
   assert.equal(mesh.material,entry.material);assert.equal(entry.released,g===geometry?0:1);
   if(color)assert.deepEqual(g.attributes.color.array.slice(0,color.length),color,'subdivision changed the existing alpha falloff');
   const a=new T.Vector3(),b=new T.Vector3(),c=new T.Vector3();
   for(let i=0;i<index.count;i+=3){
    a.fromBufferAttribute(attr,index.getX(i)).applyMatrix4(mesh.matrixWorld);b.fromBufferAttribute(attr,index.getX(i+1)).applyMatrix4(mesh.matrixWorld);c.fromBufferAttribute(attr,index.getX(i+2)).applyMatrix4(mesh.matrixWorld);
    for(let u=0;u<=4;u++)for(let v=0;v<=4-u;v++){
     point.copy(a).multiplyScalar(u/4).addScaledVector(b,v/4).addScaledVector(c,1-(u+v)/4);const floor=t.sample(point.x,point.z)+w.ground.position.y;
     assert(point.y>=floor-1e-6,`seed ${seed}: overlay triangle interior sank below ground by ${floor-point.y}`);checked++;
    }
   }
  }
  assert(checked>100);const active=overlays.map(r=>r.mesh.geometry);assert.equal(installForestTerrain(w,'forest'),t);assert.deepEqual(overlays.map(r=>r.mesh.geometry),active);
  cleanup(w);assert(overlays.every(r=>r.released===1),'original overlay geometry was leaked or disposed twice');
 }
});
