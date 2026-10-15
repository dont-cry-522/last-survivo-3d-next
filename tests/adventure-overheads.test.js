import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../vendor/three.module.js';
import {buildWorld,clearAt,moveActor} from '../world.js';
import {polishEnvironmentModels} from '../environment-props.js';
import {installForestVista} from '../forest-vista.js';
import {AdventureCamera} from '../adventure-camera.js';
import {createOverheadQuery,mobilityCeiling,canMoveBelowOverhead,needsMobilityCeiling} from '../adventure-overheads.js';
import {installBiomePlaces} from '../biome-places.js?v=209';

globalThis.document={createElement:()=>({width:256,height:256,getContext:()=>({fillRect(){}})})};
const close=(a,b)=>assert(Math.abs(a-b)<1e-6,`${a} differs from ${b}`);
function world(id){const w=buildWorld(id,42);polishEnvironmentModels(w);installForestVista(w,id);w.group.updateMatrixWorld(true);for(const o of w.obstacles)o.height=Math.max(.15,new T.Box3().setFromObject(o.mesh).max.y);return w;}
const coast=world('coast');

test('new place roofs are solid while their central ground passage stays clear',()=>{
 const w=world('coast');installBiomePlaces(w,'coast');const query=createOverheadQuery(w);
 for(const p of w.biomePlaces){
  const roofs=p.mesh.children.filter(m=>m.userData.placeOverhead);assert(roofs.length&&roofs.every(m=>query.meshes.includes(m)));
  // A combined batch can span two roofs with empty space between them. Shoot
  // through an actual face along its normal, not through the batch AABB centre.
  for(const roof of roofs){const geo=roof.geometry,position=geo.attributes.position,index=geo.index,a=new T.Vector3(),b=new T.Vector3(),c=new T.Vector3(),normal=new T.Vector3();let checked=false;
   for(let i=0;i<index.count;i+=3){a.fromBufferAttribute(position,index.getX(i)).applyMatrix4(roof.matrixWorld);b.fromBufferAttribute(position,index.getX(i+1)).applyMatrix4(roof.matrixWorld);c.fromBufferAttribute(position,index.getX(i+2)).applyMatrix4(roof.matrixWorld);normal.crossVectors(b.clone().sub(a),c.clone().sub(a));if(normal.lengthSq()<1e-10)continue;
    normal.normalize();const center=a.add(b).add(c).multiplyScalar(1/3);assert(query.firstHit(center.clone().addScaledVector(normal,.2),center.clone().addScaledVector(normal,-.2)));checked=true;break;
   }assert(checked);
  }
  assert.equal(query.firstHit({x:p.x,y:2,z:p.z},{x:p.x,y:.2,z:p.z}),null);
 }
 w.group.traverse(o=>{if(o.isInstancedMesh)o.dispose();if(o.userData.ownedGeometry)o.geometry.dispose();});
});

test('the real coast warehouse roof stops the formerly clear camera segment',()=>{
 const query=createOverheadQuery(coast),camera=new T.PerspectiveCamera(58,1,.1,200),rig=new AdventureCamera(camera,{yaw:0,pitch:-.75,distance:6,shoulderOffset:0});
 const player={x:-3.6225922810547906,y:0,z:63.73799594210229};
 rig.update(0,player,coast.obstacles,{snap:true});
 const start={x:player.x,y:1.15,z:player.z},hit=query.firstHit(start,camera.position),safe=query.firstHit(start,camera.position,.25);
 assert(hit,'the actual roof beyond its narrow support cylinder was missed');
 assert(hit.distance<camera.position.distanceTo(new T.Vector3(start.x,start.y,start.z)));
 close(hit.point.y,3.0123906822047064);close(safe.distance,hit.distance-.25);
 close(new T.Vector3(...Object.values(safe.point)).distanceTo(new T.Vector3(...Object.values(hit.point))),.25);
});

test('roof queries preserve the ground passage and original render resources',()=>{
 const before=coast.obstacles.map(o=>[o.x,o.z,o.r]),query=createOverheadQuery(coast);
 assert(query.meshes.length>0&&query.meshes.length<=8);
 const roof=query.meshes[0],center=roof.getWorldPosition(new T.Vector3()),geometry=roof.geometry,material=roof.material,visible=roof.visible;
 assert(clearAt(coast,center.x,center.z,.45),'selected under-roof passage must be walkable');
 assert.equal(query.firstHit({x:center.x,y:1.5,z:center.z-1},{x:center.x,y:1.5,z:center.z+1}),null);
 assert.equal(roof.geometry,geometry);assert.equal(roof.material,material);assert.equal(roof.visible,visible);
 assert.deepEqual(coast.obstacles.map(o=>[o.x,o.z,o.r]),before);
});

test('real tilted roofs block upward, downward and angled rays only within the segment',()=>{
 const query=createOverheadQuery(coast),center=query.meshes[0].getWorldPosition(new T.Vector3());
 const below={x:center.x,y:2,z:center.z},above={x:center.x,y:4.5,z:center.z};
 const up=query.firstHit(below,above),down=query.firstHit(above,below);
 assert(up&&down);assert(up.point.y<down.point.y,'closed roof thickness should have two distinct faces');
 assert(query.firstHit({x:center.x,y:2,z:center.z-.4},{x:center.x,y:4.5,z:center.z+.4}));
 assert.equal(query.firstHit(below,{...below,y:up.point.y-.01}),null,'hits beyond endpoint must be excluded');
 assert.equal(query.firstHit(below,below),null);
 const clipped=query.firstHit(below,above,10);assert.equal(clipped.distance,0);assert.deepEqual(clipped.point,below);
});

test('real forest stone overhangs are queried outside the original trunk footprints',()=>{
 const forest=world('forest'),query=createOverheadQuery(forest),vista=forest.forestVista;
 assert(query.meshes.includes(vista.group.getObjectByName('forest-vista-stone')));
 assert(!query.meshes.some(m=>m.name==='forest-vista-leaf'||m.name==='forest-vista-gold'));
 const a=vista.anchors[0],b=vista.arches?vista.anchors[1]:vista.pathTarget,angle=Math.atan2(b.x-a.x,b.z-a.z),x=a.x+Math.sin(angle)*1.4,z=a.z+Math.cos(angle)*1.4;
 assert(Math.hypot(x-a.x,z-a.z)>a.r);
 const hit=query.firstHit({x,y:6,z},{x,y:2,z});assert(hit);assert(hit.point.y>3.4&&hit.point.y<4.2);
 assert.equal(query.firstHit({x,y:1,z:z-.3},{x,y:1,z:z+.3}),null);
});

test('sand overheads use current world transforms and skip low rubble or unrelated tall scenery',()=>{
 const sand=world('sand'),query=createOverheadQuery(sand);assert(query.meshes.length>0&&query.meshes.length<40);
 for(const m of query.meshes)assert(new T.Box3().setFromObject(m).min.y>2.5);
 const group=new T.Group(),district=new T.Group(),nested=new T.Group(),roof=new T.Mesh(new T.BoxGeometry(3,.2,2),new T.MeshBasicMaterial());
 district.userData.district='warehouse';district.position.set(5,3,2);nested.rotation.y=.4;roof.position.x=1;group.add(district);district.add(nested);nested.add(roof);
 group.add(new T.Mesh(roof.geometry,roof.material));
 const transformed=createOverheadQuery({group}),center=roof.getWorldPosition(new T.Vector3());assert.deepEqual(transformed.meshes,[roof]);
 const hit=transformed.firstHit({x:center.x,y:5,z:center.z},{x:center.x,y:1,z:center.z});assert(hit);close(hit.point.y,3.1);
});

test('hidden or removed roofs stop blocking and moved parents use their current transforms',()=>{
 const group=new T.Group(),parent=new T.Group(),roof=new T.Mesh(new T.BoxGeometry(3,.2,2),new T.MeshBasicMaterial());
 parent.userData.district='warehouse';parent.position.y=3;parent.add(roof);group.add(parent);
 const query=createOverheadQuery({group}),hitAt=x=>query.firstHit({x,y:5,z:0},{x,y:1,z:0});
 assert(hitAt(0));roof.visible=false;assert.equal(hitAt(0),null);roof.visible=true;
 parent.visible=false;assert.equal(hitAt(0),null);parent.visible=true;
 group.visible=false;assert(hitAt(0),'temporarily hiding the world must not alter collision');group.visible=true;
 parent.position.x=8;assert.equal(hitAt(0),null,'old matrix must not leave a ghost roof');assert(hitAt(8),'current parent transform must work without a render');
 parent.removeFromParent();assert.equal(hitAt(8),null);group.add(parent);assert(hitAt(8));
 roof.removeFromParent();assert.equal(hitAt(8),null);parent.add(roof);assert(hitAt(8));
});

function overheadFixture(parts){
 const group=new T.Group();
 for(const part of parts){part.userData.placeOverhead=true;group.add(part);}
 const w={group};w.overhead=createOverheadQuery(w);return w;
}
function boxRoof(x,y,z,width,thickness,depth){
 const mesh=new T.Mesh(new T.BoxGeometry(width,thickness,depth),new T.MeshBasicMaterial());mesh.position.set(x,y,z);return mesh;
}
test('mobility ceiling excludes the platform under raised feet and reports world height',()=>{
 const platform=boxRoof(0,.4,0,4,.8,4),roof=boxRoof(0,2.75,0,4,.2,4),w=overheadFixture([platform,roof]);
 const p={x:0,y:.8,z:0,standHeight:1.8,size:.45};
 close(mobilityCeiling(w,p),2.57);close(p.y,.8);
 roof.visible=false;assert.equal(mobilityCeiling(w,p),Infinity);
 roof.visible=true;roof.position.x=7;
 assert.equal(mobilityCeiling(w,p),Infinity);close(mobilityCeiling(w,p,7,0),2.57);
 for(const m of[platform,roof]){m.geometry.dispose();m.material.dispose();}
});
test('airborne side sweeps block passing through a roof even when the destination is clear',()=>{
 const roof=boxRoof(0,2.2,0,1,.2,2),w=overheadFixture([roof]),p={x:-2,y:.7,z:0,standHeight:1.8,size:.45};
 assert.equal(mobilityCeiling(w,p,2,0),Infinity);
 assert.equal(canMoveBelowOverhead(w,p,2,0),false);
 assert.equal(canMoveBelowOverhead(w,{...p,y:0},2,0),true,'ordinary ground movement is unchanged');
 assert.equal(canMoveBelowOverhead(w,{...p,crouch:1},2,0),true,'a body entirely below the roof must fit');
 assert.equal(canMoveBelowOverhead(w,{...p,y:2.3},2,0),true,'a roof below the feet is a support, not a head collision');
 assert.equal(canMoveBelowOverhead(w,p,p.x,p.z),true);
 roof.geometry.dispose();roof.material.dispose();
});
test('airborne shoulder radius and single-sided overhead faces are included',()=>{
 const edge=boxRoof(0,2.43,.45,.4,.06,.14),w=overheadFixture([edge]),p={x:-2,y:.65,z:0,standHeight:1.8,size:.45};
 assert.equal(w.overhead.firstHit({x:-2,y:2.43,z:0},{x:2,y:2.43,z:0}),null);
 assert.equal(canMoveBelowOverhead(w,p,2,0),false,'the shoulder must not clip a roof missed by the centre ray');
 edge.visible=false;assert.equal(canMoveBelowOverhead(w,p,2,0),true);
 const sheet=new T.Mesh(new T.PlaneGeometry(1,.4),new T.MeshBasicMaterial());sheet.rotation.y=Math.PI/2;sheet.position.set(0,2.43,0);
 const oneSided=overheadFixture([sheet]);assert.equal(canMoveBelowOverhead(oneSided,p,2,0),false);
 assert.equal(canMoveBelowOverhead({},p,2,0),true);
 for(const m of[edge,sheet]){m.geometry.dispose();m.material.dispose();}
});
test('destination ceiling rejects entering a thin sloped roof between body sweep levels',()=>{
 const roof=boxRoof(0,1.83,0,1,.04,2);roof.rotation.z=.15;
 const w=overheadFixture([roof]),p={x:-2,y:.7,z:0,standHeight:1.8,size:.45};
 assert.equal(canMoveBelowOverhead(w,p,0,0),false);
 assert.equal(canMoveBelowOverhead(w,p,-1.5,0),true);
 roof.geometry.dispose();roof.material.dispose();
});

test('ordinary steps on nonzero natural ground cast no roof rays, while platform/jump/crouch retain queries',()=>{
 let rays=0;const w={half:20,obstacles:[],groundHeightAt:x=>.15+x*.005,overhead:{meshes:[{}],firstHit(){rays++;return null;}}};
 const player=()=>({x:0,z:0,y:.15,groundHeight:.15,heroId:'scout',standHeight:1.8,jumpVelocity:0,crouch:0});
 const p=player();assert.equal(needsMobilityCeiling(w,p),false);
 for(let i=0;i<60;i++){if(needsMobilityCeiling(w,p))mobilityCeiling(w,p);moveActor(w,p,.05,0);close(p.y,w.groundHeightAt(p.x,p.z));}
 assert.equal(rays,0,'hill walking accidentally entered the airborne roof path');
 for(const state of[{y:.8,groundHeight:.8},{jumpVelocity:6.4},{crouch:1}]){
  const q={...player(),...state};rays=0;assert(needsMobilityCeiling(w,q));mobilityCeiling(w,q);moveActor(w,q,.1,0);assert(rays>10,'posture must keep vertical and side checks');
 }
 assert(needsMobilityCeiling(w,player(),true),'initial crouch input must query before pose blending');
 const flat={...w,groundHeightAt:undefined};assert.equal(needsMobilityCeiling(flat,{...player(),y:0,groundHeight:0}),false);assert(needsMobilityCeiling(flat,{...player(),y:.6,groundHeight:.6}));
 rays=0;moveActor(w,{x:0,z:0,y:2,role:'flyer',size:.4},.1,0);assert.equal(rays,0,'non-mobility flyers retained their old clearance');
});

test('natural ground exemption never lets a raised platform cross a real overhead',()=>{
 const roof=boxRoof(0,2.3,0,1,.2,2),w={...overheadFixture([roof]),half:20,obstacles:[],groundHeightAt:()=>.2};
 const p={x:-2,y:.8,z:0,groundHeight:.8,heroId:'scout',standHeight:1.8};moveActor(w,p,2,0);close(p.x,-2);
 assert.equal(needsMobilityCeiling(w,{...p,y:.2,groundHeight:.2}),false);
 close(mobilityCeiling(w,{...p,y:.2},0,0),2.12,'explicit teleport destination query stays available');
 roof.geometry.dispose();roof.material.dispose();
});
