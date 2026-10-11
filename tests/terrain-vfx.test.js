import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../vendor/three.module.js';
import {groundCue,fitGroundCue,disposeCue} from '../ground-cues.js';
import {SkillVFX} from '../skill-vfx.js';
import {PoisonVFX} from '../poison-vfx.js';
import {MirageVFX} from '../mirage-vfx.js';

// Two linear triangle slopes with a shallow crease, not a constant height offset.
const ground=(x,z)=>Math.max(0,Math.min(.25,.09+.008*x+.004*z+.009*Math.abs(x)));
function onGround(mesh,clearance,epsilon=2e-6){
 mesh.updateWorldMatrix(true,false);const p=mesh.geometry.attributes.position,v=new T.Vector3();
 for(let i=0;i<p.count;i++){v.fromBufferAttribute(p,i).applyMatrix4(mesh.matrixWorld);assert(Math.abs(v.y-ground(v.x,v.z)-clearance)<epsilon,`buried/floating vertex ${i}: ${v.toArray()}`);}
}

test('ground cues drape private bounded buffers after final parent/scale/rotation and release exactly once',()=>{
 const mesh=groundCue(0xff0000,2),shared=mesh.geometry,before=Array.from(shared.attributes.position.array),parent=new T.Group();parent.position.set(3,0,-2);parent.rotation.y=.4;parent.add(mesh);mesh.position.set(1,.07,2);mesh.rotation.z=.35;
 fitGroundCue(mesh,ground);const owned=mesh.geometry;assert.notEqual(owned,shared);assert(owned.attributes.position.count<=81);onGround(mesh,.07);
 const version=owned.attributes.position.version;fitGroundCue(mesh,ground);assert.equal(mesh.geometry,owned);assert.equal(owned.attributes.position.version,version);
 mesh.scale.setScalar(.7);fitGroundCue(mesh,ground);assert.equal(mesh.geometry,owned);onGround(mesh,.07);
 assert.deepEqual(Array.from(shared.attributes.position.array),before);
 let disposed=0;owned.addEventListener('dispose',()=>disposed++);disposeCue(mesh);disposeCue(mesh);assert.equal(disposed,1);assert.equal(mesh.geometry,shared);
 const flat=groundCue(0xffffff);flat.position.y=.07;fitGroundCue(flat,()=>0);assert.equal(flat.geometry,shared);disposeCue(flat);
});

test('poison fields, turned curtains and bands follow the surface, reuse fitting and keep world-space pod launches',()=>{
 const scene=new T.Scene(),v=new PoisonVFX(scene,null,{groundHeight:ground}),cloud={id:1,x:1,z:2,r:1.6,stillRank:3,settledAt:0,expires:9,angle:.6,curtainUntil:0},points=[{x:-1,z:0},{x:0,z:.4},{x:1,z:.6}],combat={now:2,clouds:[cloud],bands:[{id:2,points,r:.65,expires:5}],pods:[{startX:0,startZ:0,startY:1.31,x:3,z:2,releaseAt:2,landAt:3}],shield:{amount:10,until:6}};
 v.update(combat,{x:1,z:2,y:.6});onGround(v.fog[0],.07);const field=v.fog[0].geometry,fieldVersion=field.attributes.position.version,band=v.bands[0].geometry,bandVersion=band.attributes.position.version;
 for(let i=0;i<points.length*2;i++){const p=band.attributes.position;assert(Math.abs(p.getY(i)-ground(p.getX(i),p.getZ(i))-.061)<1e-6);}
 const matrix=new T.Matrix4();v.pods.getMatrixAt(0,matrix);assert(Math.abs(matrix.elements[13]-1.31)<1e-6,'world muzzle is not lifted twice');v.guard.getMatrixAt(0,matrix);assert(matrix.elements[13]>1.2,'shield uses airborne player y');
 combat.now=2.1;v.update(combat,{x:1,z:2,y:.6});assert.equal(v.fog[0].geometry,field);assert.equal(field.attributes.position.version,fieldVersion);assert.equal(band.attributes.position.version,bandVersion);
 cloud.curtainUntil=4;cloud.x=2;v.update(combat,{x:1,z:2});assert.equal(v.fog[0].geometry,field);onGround(v.fog[0],.07);assert.equal(v.fog[0].scale.x,3.6);
 combat.now=3;v.update(combat,{x:1,z:2});v.pods.getMatrixAt(0,matrix);assert(Math.abs(matrix.elements[13]-ground(3,2))<1e-6,'pod ends on terrain');
 let disposed=0;field.addEventListener('dispose',()=>disposed++);v.clear();assert.equal(disposed,1);assert.equal(v.bands[0].userData.bandFit,undefined);v.dispose();assert.equal(disposed,1);assert.equal(scene.children.length,0);
});

test('mirage fog and decoy root follow terrain; explicit high burst contacts stay in world space',()=>{
 const scene=new T.Scene(),fx=new SkillVFX(scene,{groundHeight:ground}),v=new MirageVFX(scene,fx),hero=new T.Group();hero.position.set(1,.2,2);const body=new T.Mesh(new T.BoxGeometry(.3,1,.3),new T.MeshBasicMaterial());body.position.y=.5;hero.add(body);
 const combat={now:2,clouds:[{id:1,x:1,z:2,r:2,born:1,expires:4}],decoy:{id:2,x:3,z:4,hp:5,born:1,expires:4},shield:{amount:0}};
 v.update(combat,{x:1,z:2},hero);onGround(v.fog[0],.068);assert.equal(v.decoy.position.y,ground(3,4));assert(Math.abs(new T.Box3().setFromObject(v.decoy).min.y-ground(3,4))<1e-6);
 v.event({kind:'mirageBurst',x:3,z:4,r:2,w:{impactY:1.7}});const veil=fx.active.find(p=>p.shape==='veil');assert.equal(veil.mesh.position.y,1.79,'explicit impactY must not add ground');
 fx.clear();v.event({kind:'mirageHit',x:3,z:4,w:{impactY:1.7}});assert(fx.active.every(p=>p.mesh.position.y>=1.67&&p.mesh.position.y<=1.7));
 v.clear();fx.clear();assert.equal(v.snapshot.size,0);assert(v.fog.every(m=>!m.visible));v.dispose();assert.equal(scene.children.length,0);
});

test('spell ground layers drape through animation while particles and supplied contacts are lifted only once',()=>{
 const scene=new T.Scene(),v=new SkillVFX(scene,{mobile:true,groundHeight:ground});v.ice(2,1,3);
 const veil=v.active.find(p=>p.shape==='veil'),geometry=veil.mesh.geometry;onGround(veil.mesh,.06);
 const shard=v.active.find(p=>p.shape==='shard');assert(Math.abs(shard.mesh.position.y-ground(shard.mesh.position.x,shard.mesh.position.z)-.06)<1e-6);
 v.update(.1);assert.equal(veil.mesh.geometry,geometry);onGround(veil.mesh,.06);const version=geometry.attributes.position.version;v.update(0);assert.equal(geometry.attributes.position.version,version);
 let disposed=0;geometry.addEventListener('dispose',()=>disposed++);v.clear();assert.equal(disposed,1);
 const raw=v.particle('ember',0xffffff,2,1.5,1);assert.equal(raw.position.y,1.5);const lifted=v.groundParticle('ember',0xffffff,2,.5,1);assert.equal(lifted.position.y,.5+ground(2,1));v.update(.1);assert.equal(lifted.position.y,.5+ground(2,1));
 v.clear();v.muzzle({id:'crossbow'},2,1,0,1.4,true);assert(v.active.every(p=>Math.abs(p.mesh.position.y-1.4)<1e-6));
 v.clear();const contact={x:2,y:1.4,z:1,normal:{x:0,y:1,z:0}},flat=new SkillVFX(new T.Scene());v.boltImpact(2,1,false,0,contact);flat.boltImpact(2,1,false,0,contact);assert.deepEqual(v.active.map(p=>p.mesh.position.toArray()),flat.active.map(p=>p.mesh.position.toArray()));v.clear();flat.clear();assert.equal(scene.children.length,0);
});

test('draped particles remain within the existing mobile pool through repeat casts and cleanup',()=>{
 const v=new SkillVFX(new T.Scene(),{mobile:true,groundHeight:ground});
 for(let frame=0;frame<600;frame++){if(frame%25===0){v.ice(-2,3,4);v.fire(3,2,2);v.dark(-3,-1,2);}v.update(1/60);assert(v.active.length+v.pool.length<=110);for(const p of v.active){assert(p.mesh.position.toArray().every(Number.isFinite));if(p.groundHeight)assert(p.mesh.geometry.attributes.position.count<=81);}}
 v.clear();assert.equal(v.scene.children.length,0);for(const mesh of v.pool)assert(Object.values(v.geometry).includes(mesh.geometry),'clear restored shared geometry');
});
