import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../vendor/three.module.js';
import {EnvironmentImpacts,ENVIRONMENT_IMPACTS,impactProfile,waterCrossing,waterSurfaceAt} from '../environment-impact.js';
import {SkillVFX} from '../skill-vfx.js';

const world=()=>({ponds:[{x:0,z:0,rx:4,rz:3,r:5,mesh:{position:{y:.075}}}],groundHeightAt:()=>0});
test('water is hit only on the actual downward surface crossing, within exposed wet ground',()=>{
 const w=world(),start={x:0,y:2,z:0},end={x:0,y:-1,z:0};
 const hit=waterCrossing(w,start,end);assert(Math.abs(hit.t-(2-.075)/3)<1e-9);assert.equal(hit.y,.075);
 assert.equal(waterCrossing(w,{x:0,y:1,z:0},{x:2,y:1,z:0}),null);
 assert.equal(waterCrossing(w,end,start),null);assert.equal(waterCrossing(w,{x:8,y:2,z:0},{x:8,y:-1,z:0}),null);
 w.groundHeightAt=()=>.4;assert.equal(waterCrossing(w,start,end),null);w.groundHeightAt=()=>0;
 w.bridges=[{x:0,z:0,width:2,length:4,angle:0}];assert.equal(waterSurfaceAt(w,0,0),null);w.bridges=[];
 w.ice=[{x:0,z:0,rx:2,rz:2}];assert.equal(waterCrossing(w,start,end),null);
});
test('marks project onto the visible curved tree surface and follow raised soil',()=>{
 const scene=new T.Scene(),vfx=new SkillVFX(scene),fx=new EnvironmentImpacts(scene,vfx),tree=new T.Mesh(new T.CylinderGeometry(.4,.5,3,24),new T.MeshBasicMaterial());tree.position.set(0,1.5,0);scene.add(tree);
 const obstacle={x:0,z:0,r:.6,height:3,mesh:tree,state:'standing'},a={x:0,y:1,z:-2},b={x:0,y:1,z:0};
 try{
  const contact=fx.contact(obstacle,a,b,.1);assert(contact);assert(contact.z<-.4&&contact.z>-.5);assert(contact.normal.z<-.8);
  const graze=fx.contact(obstacle,{x:.53,y:1,z:-2},{x:.53,y:1,z:0},.1);assert(graze,'accepted wide collider contact projects inward to visible bark');assert(Math.hypot(graze.x,graze.z)<.5);
  fx.hit({id:'fire'},contact);const m=fx.active[0].mesh;assert(m.geometry.drawRange.count>0);
  const positions=m.geometry.attributes.position;for(let i=0;i<positions.count;i++){assert(Number.isFinite(positions.getX(i)+positions.getY(i)+positions.getZ(i)));}
  fx.ground({id:'crossbow'},{ponds:[],groundHeightAt:(x,z)=>2+x*.1},2,1);const ground=fx.active[1].mesh;
  for(let i=0;i<ground.geometry.attributes.position.count;i++){const a=ground.geometry.attributes.position;assert(Math.abs(a.getY(i)+ground.position.y-(2+(a.getX(i)+ground.position.x)*.1+.018))<1e-5);}
  obstacle.state='falling';fx.update(.01);assert.equal(fx.active.length,1,'destroyed trees must not leave hovering marks');
 }finally{fx.dispose();vfx.clear();tree.geometry.dispose();tree.material.dispose();}
});
test('bounded marks fade on simulation time, recycle the same buffers and clear without leaking',()=>{
 const scene=new T.Scene(),fx=new EnvironmentImpacts(scene,{particle(){}},{mobile:true});
 try{
  for(let i=0;i<80;i++)fx.ground({id:'rifle'},{ponds:[]},i,0);assert.equal(fx.active.length,24);assert.equal(scene.children.length,24);
  const mesh=fx.active[0].mesh,geometry=mesh.geometry,index=geometry.index,position=geometry.attributes.position,life=fx.active[0].life;
  fx.update(0);assert.equal(fx.active[0].life,life);fx.update(4);assert(fx.active.every(p=>p.mesh.material.opacity<.85));
  fx.clear();assert.equal(scene.children.length,0);assert.equal(fx.pool.length,24);
  for(let i=0;i<24;i++)fx.ground({id:'shuriken'},{ponds:[]},i,0);
  assert(fx.active.some(p=>p.mesh===mesh));assert.equal(mesh.geometry,geometry);assert.equal(geometry.index,index);assert.equal(geometry.attributes.position,position);
  fx.update(7);assert.equal(fx.active.length,0);assert.equal(scene.children.length,0);
  let disposed=0;for(const m of fx.pool)m.geometry.addEventListener('dispose',()=>disposed++);fx.dispose();assert.equal(disposed,24);fx.dispose();assert.equal(disposed,24);
 }finally{fx.dispose();}
});
test('weapon water profiles differ, overlap bursts are bounded, and ripples expand then expire',()=>{
 const scene=new T.Scene(),vfx=new SkillVFX(scene),fx=new EnvironmentImpacts(scene,vfx);
 try{
  assert.equal(Object.keys(ENVIRONMENT_IMPACTS).length,11);assert.equal(impactProfile({id:'harpoon'}),null);
  assert(impactProfile({id:'shotgun',pathId:'shotgun_slug'}).ripple>impactProfile({id:'shotgun'}).ripple);
  assert(impactProfile({id:'crossbow'}).splash>impactProfile({id:'shuriken'}).splash);
  assert(fx.water({id:'fire'},{x:0,y:.075,z:0}));assert.equal(vfx.active.length,9);assert(vfx.active.some(p=>p.shape==='vapor'));
  for(let i=0;i<10;i++)assert.equal(fx.water({id:'shotgun'},{x:0,y:.075,z:0}),false);
  const ripple=vfx.active.find(p=>p.motion==='ripple'),size=ripple.mesh.scale.x;vfx.update(.3);assert(ripple.mesh.scale.x>size);assert.equal(ripple.mesh.position.y,.1);
  vfx.update(2);assert.equal(vfx.active.length,0);fx.clear();assert(fx.water({id:'rifle'},{x:0,y:.075,z:0}));
  const other=vfx.particle('ember',0xffffff,3,1,3);fx.clear();assert.equal(vfx.active.length,1);assert.equal(vfx.active[0].mesh,other,'clearing environment feedback preserves another skill');
 }finally{fx.dispose();vfx.clear();}
});
