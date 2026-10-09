import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../vendor/three.module.js';
import {buildWorld,clearAt} from '../world.js';
import {polishEnvironmentModels} from '../environment-props.js';
import {installForestVista} from '../forest-vista.js';
import {AdventureCamera} from '../adventure-camera.js';
import {createOverheadQuery} from '../adventure-overheads.js';

globalThis.document={createElement:()=>({width:256,height:256,getContext:()=>({fillRect(){}})})};
const close=(a,b)=>assert(Math.abs(a-b)<1e-6,`${a} differs from ${b}`);
function world(id){const w=buildWorld(id,42);polishEnvironmentModels(w);installForestVista(w,id);w.group.updateMatrixWorld(true);for(const o of w.obstacles)o.height=Math.max(.15,new T.Box3().setFromObject(o.mesh).max.y);return w;}
const coast=world('coast');

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
