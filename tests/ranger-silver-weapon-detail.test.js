import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../vendor/three.module.js';
import {makeHero,poseCrossbow} from '../hero-model.js';
import {FirstPersonView} from '../first-person-view.js';
import {GRIP_POINTS} from '../weapon-grips.js';
import {WEAPON_OUTLETS} from '../weapon-outlets.js';

const ids=['rifle','shotgun','fire','crossbow','shuriken','dark'];
const make=id=>{const g=makeHero(['crossbow','shuriken','dark'].includes(id)?'silver':'scout',id).userData.weapon;g.removeFromParent();g.position.set(0,0,0);return g;};
const budget={rifle:[11,1000,[.1225,.426,1.0601]],shotgun:[11,1400,[.177,.379,1.0601]],fire:[7,2200,[.3401,1.610,.1345]],crossbow:[24,2800,[.9181,.3651,.7751]],shuriken:[5,2400,[.4606,.0471,.7375]],dark:[6,2000,[.2673,1.6114,.1149]]};

test('six refined weapons keep their original framing with bounded source geometry and no extra effect layer',()=>{
 for(const id of ids){
  const g=make(id);let meshes=0,triangles=0;
  g.traverse(o=>{assert(!o.isLight);if(!o.isMesh)return;meshes++;triangles+=(o.geometry.index?.count||o.geometry.attributes.position.count)/3;assert(!o.material.transparent);for(const name of ['position','normal'])assert(o.geometry.attributes[name].array.every(Number.isFinite));});
  const [count,limit,size]=budget[id];assert.equal(meshes,count,id);assert(triangles<=limit,id);new T.Box3().setFromObject(g).getSize(new T.Vector3()).toArray().forEach((v,i)=>assert(v<=size[i]+1e-6,id+' framing expanded'));
 }
});

test('both firearms provide an actual supporting surface and keep their outlet in the recessed main bore',()=>{
 for(const id of ['rifle','shotgun']){
  const g=make(id),fore=g.getObjectByName(id==='rifle'?'SM_Firearm_RiflePalmForeend':'SM_Firearm_ShotgunGroovedPump'),y=id==='rifle'?-.045:-.025;
  g.updateMatrixWorld(true);const ray=new T.Raycaster(new T.Vector3(0,-1,.34),new T.Vector3(0,1,0)),hit=ray.intersectObject(fore)[0];assert(hit);assert(Math.abs(hit.point.y-y)<.014,'support hand has no solid foreend');
  const grip=g.getObjectByName('SM_Firearm_ShapedGrip_'+id);assert.deepEqual(grip.position.toArray(),GRIP_POINTS[id]);assert(g.getObjectByName('SM_Firearm_TriggerAssembly_'+id));assert(grip.material.map&&grip.material.metalness===0);
  const barrel=g.getObjectByName('SM_Firearm_RecessedBarrel_Main'),box=new T.Box3().setFromObject(barrel);assert(Math.abs(box.max.z-WEAPON_OUTLETS[id][2])<1e-7);
  if(id==='shotgun'){assert.equal(g.userData.pump.children.length,1);const rest=fore.getWorldPosition(new T.Vector3());g.userData.pump.position.z=-.23;g.updateMatrixWorld(true);assert(Math.abs(fore.getWorldPosition(new T.Vector3()).z-rest.z+.23)<1e-8);}
 }
});

test('staff grips and forged crowns are real source surfaces while the existing cast crystals stay intact',()=>{
 for(const id of ['fire','dark']){
  const g=make(id),shaft=g.getObjectByName('SM_Staff_'+(id==='fire'?'Emberwood':'Nightfall')+'_CarvedShaft'),point=new T.Vector3(...GRIP_POINTS[id]);
  assert(shaft&&shaft.geometry.type==='LatheGeometry');assert(shaft.material.vertexColors);g.updateMatrixWorld(true);
  const hit=new T.Raycaster(point.clone().add(new T.Vector3(1,0,0)),new T.Vector3(-1,0,0)).intersectObject(shaft)[0];assert(hit&&hit.point.distanceTo(point)>.022&&hit.point.distanceTo(point)<.031);
  let crowns=0,crystals=0;g.traverse(o=>{if(!o.isMesh)return;if(o.name.includes('Prong')||o.name.includes('MoonFrame')){crowns++;assert(o.material.vertexColors&&o.material.metalness>.5);}if(o.geometry.type==='OctahedronGeometry'){crystals++;assert(o.material.emissiveIntensity>0);}});assert.equal(crystals,1);assert.equal(crowns,id==='fire'?2:1);
 }
});

test('moon blades have a thin honed perimeter and broader spine, while the crossbow keeps its moving parts',()=>{
 const moon=make('shuriken'),blades=[];moon.traverse(o=>{if(o.name.startsWith('SM_Shuriken_MoonBlade_'))blades.push(o);});assert.equal(blades.length,4);
 for(const blade of blades){const g=blade.geometry,p=g.attributes.position,c=g.attributes.color;assert(blade.material.vertexColors);let edge=0,spine=0;for(let i=0;i<p.count;i++){const thickness=Math.abs(p.getZ(i)-.009);if(c.getX(i)>.96)edge=Math.max(edge,thickness);if(c.getX(i)<.70)spine=Math.max(spine,thickness);}assert(edge<.0036&&spine>edge*2,'ground edge is as thick as the spine');}
 const bow=make('crossbow'),latch=bow.userData.crossbowLatch,bolt=bow.userData.crossbowBolt,shape=latch.children[0].geometry;
 assert(shape.attributes.position.count>40);assert.equal(bow.getObjectByName('SM_Crossbow_StringNock_-1').geometry.type,'LatheGeometry');assert.equal(bow.getObjectByName('SM_Crossbow_BoltHead_A').geometry.type,'BufferGeometry');
 for(const phase of [0,.18,.4,.74,1]){poseCrossbow(bow,phase);assert.equal(bow.userData.crossbowLatch,latch);assert.equal(latch.children[0].geometry,shape);assert.equal(bow.userData.crossbowBolt,bolt);assert.equal(latch.position.z,-bow.userData.stringPull);}
});

test('source finishing remains shared and survives repeated first-person rebinding',()=>{
 const view=new FirstPersonView(new T.PerspectiveCamera(60,16/9,.1,100));let disposed=0;const textures=new Set();
 try{for(const id of ids){
  const a=make(id),b=make(id),before=[];a.traverse(o=>{if(!o.isMesh)return;const twin=b.getObjectByName(o.name);if(o.userData.identityDetail&&twin){assert.equal(o.geometry,twin.geometry);assert.equal(o.material,twin.material);}for(const r of [o.geometry,o.material,o.material.map])if(r)r.addEventListener('dispose',()=>disposed++);if(o.material.map)textures.add(o.material.map);before.push([o,o.material,o.material.roughness,o.material.color.getHex()]);});
  for(let i=0;i<3;i++){view.setHero({visible:false,userData:{gun:a,attackAge:.12,reloadDuration:1,reloadPhase:.12}},id);view.update(i,.016,{visible:true});view.clear();}
  for(const [o,m,r,c]of before){assert.equal(o.material,m);assert.equal(m.roughness,r);assert.equal(m.color.getHex(),c);}assert.equal(disposed,0);
 }}finally{view.dispose();}
 assert.equal(textures.size,1,'each weapon allocates a new wood-grain texture');const [map]=textures;assert.equal(map.image.width,64);assert.equal(map.image.height,64);
});
