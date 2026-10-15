import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../vendor/three.module.js';
import {buildWorld,moveActor,supportHeight,clearAt} from '../world.js';
import {resetMobility,beginJump,tickMobility} from '../adventure-mobility.js';
import {groundAim,segmentGroundEntry} from '../adventure-combat.js';
import {terrainAt} from '../water.js';
import {installForestHabitats} from '../forest-habitats.js';
import {installExplorationRoutes} from '../exploration-routes.js';
import {installAdventureGroundDetail,installHabitatDetail} from '../adventure-ground-detail.js';
import {installForestTerrain} from '../forest-terrain.js';
import {installEnvironmentGrounding} from '../environment-grounding.js';
import {installForestFloorRelief} from '../forest-floor-relief.js';
import {installForestVista} from '../forest-vista.js';
import {installBiomePlaces} from '../biome-places.js?v=206';
import {installEnvironmentClusters} from '../environment-clusters.js?v=206';
import {installExplorationLandmarks} from '../exploration-landmarks.js';
import {installExplorationComposition} from '../exploration-composition.js';

globalThis.document={createElement:()=>({getContext:()=>({fillRect(){}})})};
const cleanup=w=>w.group.traverse(o=>{if(o.isInstancedMesh)o.dispose();if(o.userData.ownedGeometry)o.geometry.dispose();});
function forest(seed){const w=buildWorld('forest',seed);installForestHabitats(w,'forest');installExplorationRoutes(w);installAdventureGroundDetail(w,'forest');installHabitatDetail(w,'forest');return w;}
function completeWorld(id,seed){
 const w=buildWorld(id,seed);
 for(const install of [installForestVista,installForestHabitats,installBiomePlaces,installEnvironmentClusters,installExplorationRoutes,installExplorationLandmarks,installExplorationComposition,installAdventureGroundDetail,installHabitatDetail])install(w,id);
 return w;
}
function flatOverlays(w){
 w.group.updateMatrixWorld(true);const point=new T.Vector3(),entries=[];
 w.group.traverse(mesh=>{
  if(!mesh.isMesh||mesh===w.ground||mesh.isInstancedMesh||!mesh.userData.ownedGeometry||mesh.userData.groundCue)return;
  const geometry=mesh.geometry,attr=geometry.attributes.position;if(!attr)return;
  for(let i=0;i<attr.count;i++){point.fromBufferAttribute(attr,i).applyMatrix4(mesh.matrixWorld);if(point.y<-.06||point.y>.08)return;}
  const entry={mesh,geometry,released:0};geometry.addEventListener('dispose',()=>entry.released++);entries.push(entry);
 });return entries;
}
function gameplay(w){
 // Gameplay records can also hold Three objects; their serialized geometry is
 // deliberately changing. Snapshot the actual layout, collision and reward data.
 const fields=['id','kind','x','y','z','r','rx','rz','baseRx','baseRz','angle','width','length','half','height','sceneryHeight','event','hp','state','age','biome','claimed','active','cooldown','done','points','nodes'];
 const pick=value=>Array.isArray(value)?value.map(pick):value&&typeof value==='object'?Object.fromEntries(fields.filter(k=>value[k]!==undefined).map(k=>[k,pick(value[k])])):value;
 return JSON.stringify(Object.fromEntries(['spawn','obstacles','ponds','bridges','fords','ice','sites','discoveries','roaming','patches','biomePlaces','explorationRoutes'].map(key=>[key,pick(w[key])])));
}

test('forest approach uses its rendered triangles for bounded valley shoulders without moving solid footprints',()=>{
 for(const seed of [7,522,43837033]){
  const w=forest(seed),snapshot=JSON.stringify({spawn:w.spawn,obstacles:w.obstacles.map(o=>[o.x,o.z,o.r,o.height]),ponds:w.ponds.map(p=>[p.x,p.z,p.rx,p.rz]),sites:w.sites.map(s=>[s.x,s.z])});
  const old=w.ground.geometry;let released=0;old.addEventListener('dispose',()=>released++);const t=installForestTerrain(w,'forest');assert(t&&t.maxHeight>.4&&t.maxHeight<=1.2);assert.equal(released,1);assert.equal(installForestTerrain(w,'forest'),t);
  assert.equal(JSON.stringify({spawn:w.spawn,obstacles:w.obstacles.map(o=>[o.x,o.z,o.r,o.height]),ponds:w.ponds.map(p=>[p.x,p.z,p.rx,p.rz]),sites:w.sites.map(s=>[s.x,s.z])}),snapshot);
  assert.equal(w.ground.geometry.index.count/3,144*144*2);assert.equal(w.groundHeightAt(w.spawn.x,w.spawn.z),0);
  for(const o of w.obstacles)for(let i=0;i<8;i++)assert.equal(w.groundHeightAt(o.x+Math.sin(i*Math.PI/4)*o.r,o.z+Math.cos(i*Math.PI/4)*o.r),0,'terrain entered a protected solid');
  for(const q of w.ponds)assert.equal(w.groundHeightAt(q.x,q.z),0,'water floor moved');
  w.group.updateMatrixWorld(true);const ray=new T.Raycaster(),down=new T.Vector3(0,-1,0),origin=new T.Vector3();let checked=0;
  for(let z=0;z<t.rows;z++)for(let x=0;x<t.cols;x++){
   const a=z*(t.cols+1)+x;if(!t.heights[a]&&!t.heights[a+1]&&!t.heights[a+t.cols+1]&&!t.heights[a+t.cols+2])continue;
   for(const [u,v]of [[.2,.3],[.8,.7]]){const px=-t.width/2+(x+u)*t.width/t.cols,pz=-t.height/2+(z+v)*t.height/t.rows;ray.set(origin.set(px,5,pz),down);const hit=ray.intersectObject(w.ground)[0];assert(hit);assert(Math.abs(hit.point.y+.03-w.groundHeightAt(px,pz))<1e-6,'feet do not follow rendered ground');checked++;}
  }
  assert(checked>8);for(let z=0;z<=t.rows;z++)for(let x=0;x<=t.cols;x++){const i=z*(t.cols+1)+x;if(x)assert(Math.abs(t.heights[i]-t.heights[i-1])<=t.width/t.cols*.12+1e-7);if(z)assert(Math.abs(t.heights[i]-t.heights[i-t.cols-1])<=t.height/t.rows*.12+1e-7);}
  cleanup(w);
 }
});

test('grass roots and owned ground overlays rise once; ground contact and root caps dispose with refined floor',()=>{
 const w=forest(522),matrix=new T.Matrix4(),point=new T.Vector3(),before=[];
 for(const group of [w.adventureGroundDetail,w.habitatDetail])for(const m of group.children)if(m.isInstancedMesh)for(let i=0;i<m.count;i++){m.getMatrixAt(i,matrix);before.push({m,i,matrix:matrix.clone()});}
 const t=installForestTerrain(w,'forest');assert(t.instances>0);for(const r of before){r.m.getMatrixAt(r.i,matrix);point.setFromMatrixPosition(r.matrix);assert(Math.abs(matrix.elements[13]-r.matrix.elements[13]-t.sample(point.x,point.z))<1e-6);for(const i of [0,2,8,10,12,14])assert.equal(matrix.elements[i],r.matrix.elements[i]);}
 const contact=installEnvironmentGrounding(w),cap=installForestFloorRelief(w,'forest');assert(contact&&cap);let freed=0;contact.texture.addEventListener('dispose',()=>freed++);cleanup(w);assert(t.disposed&&cap.userData.disposed&&contact.disposed);assert.equal(w.groundHeightAt,undefined);assert.equal(freed,1);
});

test('worlds without authored routes keep the original ground and allocate no height field',()=>{
 for(const id of ['snow','ash','sand','coast','confluence','forest']){const w=buildWorld(id,522),g=w.ground.geometry,positions=g.attributes.position.array.slice();assert.equal(installForestTerrain(w,id),null);assert.equal(w.ground.geometry,g);assert.deepEqual(g.attributes.position.array,positions);assert.equal(w.groundHeightAt,undefined);cleanup(w);}
});

test('unobstructed routes keep a low walking lane between unequal, climate-shaped shoulders',()=>{
 const profiles=[];
 for(const biome of ['forest','snow','ash','sand','coast']){
  const group=new T.Group(),ground=new T.Mesh(new T.PlaneGeometry(64,64,16,16));ground.rotation.x=-Math.PI/2;ground.position.y=-.03;ground.userData.ownedGeometry=true;group.add(ground);
  const w={group,ground,spawn:{x:25,z:25},explorationRoutes:[{biome,points:[{x:0,z:-24},{x:0,z:24}]}]},t=installForestTerrain(w,biome);
  for(const z of [-12,-6,0,6,12])assert.equal(t.sample(0,z),0,'walking lane became a road hump');
  assert(t.sample(-8,0)>.6&&t.sample(8,0)>.6,'route shoulders lack a readable cross-section');
  assert(t.sample(-8,0)>t.sample(8,0),'both shoulders became mechanically symmetrical');
  assert.equal(t.sample(20,0),0);assert.equal(t.sample(8,25),0);
  profiles.push([-12,-6,0,6,12].map(z=>Number(t.sample(8,z).toFixed(4))).join(','));cleanup(w);
 }
 assert.equal(new Set(profiles).size,5,'climate profiles were reduced to one repeated shape');
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
  const children=w.group.children.slice(),t=installForestTerrain(w,'forest');assert(t.overlayTrianglesAdded>=0&&t.overlayTrianglesAdded<=4096);if(seed===522)assert(t.overlayTrianglesAdded>0);
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

test('all five climates and their joined regions have bounded visible relief while every wet or solid footprint stays fixed',()=>{
 const maps=['forest','snow','ash','sand','coast'];
 for(const id of [...maps,'confluence'])for(const seed of [7,522,43837033]){
  const w=completeWorld(id,seed),before=gameplay(w),children=[];w.group.traverse(o=>children.push(o));
  const wet=[...(w.ponds||[]).map(p=>({...p,rx:(p.baseRx??p.rx)*(p.baseRx===undefined?1:1.19)*1.12*1.115,rz:(p.baseRz??p.rz)*(p.baseRz===undefined?1:1.19)*1.12*1.115})),...(w.ice||[]).map(p=>({...p,rx:p.rx*1.16,rz:p.rz*1.16}))];
  const samples=wet.flatMap(q=>Array.from({length:16},(_,i)=>{assert(q.rx>0&&q.rz>0);const a=i*Math.PI/8,u=Math.cos(a)*q.rx,v=Math.sin(a)*q.rz,c=Math.cos(q.angle||0),s=Math.sin(q.angle||0);return{x:q.x+c*u+s*v,z:q.z-s*u+c*v};}));
  const kinds=samples.map(p=>terrainAt(w,p.x,p.z));
  const t=installForestTerrain(w,id);assert(t,`${id}/${seed} did not install`);assert.equal(gameplay(w),before);const after=[];w.group.traverse(o=>after.push(o));assert.deepEqual(after,children);
  assert(t.maxHeight>.4&&t.maxHeight<=1.2);assert.equal(t.cols,id==='confluence'?160:144);assert.equal(w.ground.geometry.index.count/3,t.cols*t.rows*2);assert(t.overlayTrianglesAdded<=4096);
  for(const biome of id==='confluence'?maps:[id]){
   const region=w.regions?.find(r=>r.id===biome),routes=t.corridors.filter(r=>r.biome===biome);assert(routes.length>=1&&routes.length<=2,`${id}/${seed}/${biome}: corridor count`);
   let peak=0,area=0;
   for(let i=0;i<t.heights.length;i++){const x=i%(t.cols+1)*t.width/t.cols-t.width/2,z=Math.floor(i/(t.cols+1))*t.height/t.rows-t.height/2;if(region&&!region.contains(x,z))continue;peak=Math.max(peak,t.heights[i]);if(t.heights[i]>(region?.3:.5))area+=t.width/t.cols*t.height/t.rows;}
   assert(peak>(region?.4:.65)&&area>(region?20:50),`${id}/${seed}/${biome}: relief was protected down to an invisible patch (${peak}m/${area}m2)`);
  }
  if(id==='forest')assert.equal(t.corridors.length,2,'forest retains its approach and gains a second route');
  for(const [i,p] of samples.entries()){assert.equal(t.sample(p.x,p.z),0,`${id}/${seed}: highest tide or ice edge raised`);assert.deepEqual(terrainAt(w,p.x,p.z),kinds[i]);}
  for(const q of [...(w.biomePlaces||[]).map(p=>({...p,hx:10,hz:10})),...(w.bridges||[]).map(p=>({...p,hx:p.width/2+1,hz:p.length/2+1})),...(w.fords||[]).map(p=>({...p,hx:p.half+1,hz:p.width/2+1}))]){
   const c=Math.cos(q.angle||0),s=Math.sin(q.angle||0);for(const u of[-q.hx,0,q.hx])for(const v of[-q.hz,0,q.hz])assert.equal(t.sample(q.x+c*u+s*v,q.z-s*u+c*v),0,`${id}/${seed}: place/bridge/ford approach raised`);
  }
  for(const o of w.obstacles)for(let a=0;a<8;a++)assert.equal(t.sample(o.x+Math.cos(a*Math.PI/4)*o.r,o.z+Math.sin(a*Math.PI/4)*o.r),0,`${id}/${seed}: collider raised`);
  for(let z=0;z<=t.rows;z++)for(let x=0;x<=t.cols;x++){const i=z*(t.cols+1)+x;assert(Number.isFinite(t.heights[i])&&t.heights[i]>=0);if(x)assert(Math.abs(t.heights[i]-t.heights[i-1])<=t.width/t.cols*.12+1e-7);if(z)assert(Math.abs(t.heights[i]-t.heights[i-t.cols-1])<=t.height/t.rows*.12+1e-7);}
  const active=w.ground.geometry;let disposed=0;active.addEventListener('dispose',()=>disposed++);assert.equal(installForestTerrain(w,id),t);cleanup(w);assert(t.disposed);assert.equal(w.groundHeightAt,undefined);assert.equal(disposed,1);
 }
});

test('nested regional overlays stay above triangle interiors and release only their owned replacements',()=>{
 let nested=0,refined=0;
 for(const id of ['snow','ash','sand','coast','confluence'])for(const seed of[7,522,43837033]){
  const w=completeWorld(id,seed),entries=flatOverlays(w),t=installForestTerrain(w,id);assert(t.overlayTrianglesAdded<=4096);
  for(const entry of entries){
   const mesh=entry.mesh,g=mesh.geometry,attr=g.attributes.position,index=g.index,a=new T.Vector3(),b=new T.Vector3(),c=new T.Vector3(),point=new T.Vector3();let raised=false;
   const count=index?.count??attr.count;
   for(let i=0;i<count;i+=3){
    a.fromBufferAttribute(attr,index?.getX(i)??i).applyMatrix4(mesh.matrixWorld);b.fromBufferAttribute(attr,index?.getX(i+1)??i+1).applyMatrix4(mesh.matrixWorld);c.fromBufferAttribute(attr,index?.getX(i+2)??i+2).applyMatrix4(mesh.matrixWorld);
    for(let u=0;u<=4;u++)for(let v=0;v<=4-u;v++){
     point.copy(a).multiplyScalar(u/4).addScaledVector(b,v/4).addScaledVector(c,1-(u+v)/4);const height=t.sample(point.x,point.z);if(height<=0)continue;raised=true;
     assert(point.y>=height+w.ground.position.y-1e-6,`${id}/${seed}: ${mesh.name||'overlay'} interior buried by ${height+w.ground.position.y-point.y}m (${t.overlayTrianglesAdded} added triangles)`);
    }
   }
   if(raised&&mesh.parent!==w.group)nested++;if(g!==entry.geometry){refined++;assert.equal(entry.released,1);}else assert.equal(entry.released,0);
   let released=0;g.addEventListener('dispose',()=>released++);entry.activeReleased=()=>released;
  }
  cleanup(w);assert(entries.every(e=>e.released===1&&e.activeReleased()===1),'overlay geometry was leaked or disposed twice');
 }
 assert(nested>0,'test never reached a regional ground overlay');assert(refined>0,'test never exercised owned geometry replacement');
});

test('existing feet, jump and spatial projectile queries use the same raised triangles in every map',()=>{
 for(const id of ['forest','snow','ash','sand','coast','confluence']){
  const w=completeWorld(id,522),t=installForestTerrain(w,id);let i=t.heights.indexOf(t.maxHeight),x=i%(t.cols+1)*t.width/t.cols-t.width/2,z=Math.floor(i/(t.cols+1))*t.height/t.rows-t.height/2;
  assert(clearAt(w,x,z));const hero={x:x-.5,z,standHeight:1.8,dashTime:0};resetMobility(hero,t.sample(hero.x,hero.z));
  moveActor(w,hero,1,0);assert.equal(hero.x,x+.5);assert(Math.abs(hero.y-t.sample(hero.x,hero.z))<1e-7);assert.equal(supportHeight(w,hero),hero.y);
  const foe={x:x-.5,z,y:0},pet={x,z:z-.5,y:0};moveActor(w,foe,1,0);moveActor(w,pet,0,1);assert.equal(foe.y,t.sample(foe.x,foe.z));assert.equal(pet.y,t.sample(pet.x,pet.z));
  assert(beginJump(hero));let airborne=false;for(let frame=0;frame<65;frame++){moveActor(w,hero,.01,0);tickMobility(hero,1/60,{ground:supportHeight(w,hero)});airborne||=hero.y>hero.groundHeight+.5;}assert(airborne);assert.equal(hero.y,t.sample(hero.x,hero.z));
  const ray={origin:{x,y:2,z},direction:{x:0,y:-1,z:0}},aim=groundAim(ray,{x,z},12,0,t.sample),hit=segmentGroundEntry(ray.origin,{x,y:-1,z},t.sample);
  assert(Math.abs(aim.y-t.sample(x,z))<1e-6);assert(hit!==null&&Math.abs(2-hit*3-t.sample(x,z))<.001);assert.equal(segmentGroundEntry({x:x-1,y:t.maxHeight+.2,z},{x:x+1,y:t.maxHeight+.2,z},t.sample),null);
  // A low, horizontal shot must stop at a real shoulder, not pass through it.
  let blocked=false;for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]){const a={x:x+dx*16,y:t.maxHeight*.7,z:z+dz*16};if(t.sample(a.x,a.z)<a.y){assert(segmentGroundEntry(a,{x,y:a.y,z},t.sample)!==null);blocked=true;}}assert(blocked);
  cleanup(w);
 }
});
