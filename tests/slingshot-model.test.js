import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../vendor/three.module.js';
import {makeSlingshot,poseSlingshot,SLINGSHOT_GRIP,SLINGSHOT_OUTLET} from '../slingshot-model.js';
import {slingshotMechanism} from '../weapon-performance.js';
import {GRIP_POINTS,primaryGripFrame} from '../weapon-grips.js';
import {WEAPON_OUTLETS} from '../weapon-outlets.js';

test('the wood sling is a compact distinct model with shared immutable resources',()=>{
 const a=makeSlingshot(),b=makeSlingshot();let meshes=0,triangles=0;
 a.traverse(o=>{if(!o.isMesh)return;meshes++;triangles+=(o.geometry.index?.count||o.geometry.attributes.position.count)/3;const twin=b.getObjectByName(o.name);assert.equal(twin.geometry,o.geometry);assert.equal(twin.material,o.material);assert(o.castShadow&&o.receiveShadow);assert([...o.geometry.attributes.position.array,...o.geometry.attributes.normal.array].every(Number.isFinite));});
 assert(meshes<16&&triangles<4000);assert.equal(a.userData.bands.length,2);assert.notEqual(a.userData.pouch,b.userData.pouch);assert.deepEqual(GRIP_POINTS.boomerang,SLINGSHOT_GRIP);assert.deepEqual(WEAPON_OUTLETS.boomerang,SLINGSHOT_OUTLET);assert(primaryGripFrame('boomerang').angleTo(primaryGripFrame('rifle'))<1e-8);
 const box=new T.Box3().setFromObject(a);assert(box.max.y-box.min.y>.48);assert(box.max.x-box.min.x>.30);assert(!a.getObjectByName('SM_Boomerang_RoundedBone_A'));
});

test('two bands keep attached to the fork and moving pouch through draw and recoil',()=>{
 const sling=makeSlingshot();for(const period of [.08,.2,.4,1])for(let n=0;n<=200;n++){
  const age=n/200*period,m=poseSlingshot(sling,age,period),d=sling.userData;sling.updateMatrixWorld(true);assert.deepEqual(m,slingshotMechanism(age,period));
  for(const [i,band] of d.bands.entries()){
   const tip=band.localToWorld(new T.Vector3(0,-.5,0)),pouch=band.localToWorld(new T.Vector3(0,.5,0));assert(tip.distanceTo(d.bandAnchors[i])<1e-7);assert(pouch.distanceTo(d.pouch.position.clone().add(new T.Vector3((i?1:-1)*.036,0,0)))<1e-7);
  }
  assert.equal(d.projectile.visible,m.stoneVisible);assert.equal(d.pouch.position.z,-.07-.30*m.pull);assert(m.handPull+1e-7>=m.pull);
 }
 const after=slingshotMechanism(.55*.38,1);assert.equal(after.pull,0);assert(after.handPull>.9,'pulling fingers follow the rubber back into the fork');
});
