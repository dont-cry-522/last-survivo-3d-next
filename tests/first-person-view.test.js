import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../vendor/three.module.js';
import {FirstPersonView} from '../first-person-view.js';
import {makeHero,poseCrossbow} from '../hero-model.js';
import {shadowFocus} from '../shadow-gear.js';
import {SHADOW_PALETTE} from '../shadow-appearance.js';
import {createShadowAura,updateShadowAura,disposeShadowAura} from '../shadow-aura.js';
import {miasmaLantern} from '../mirage-appearance.js';
import {sporeLantern,sporePod} from '../wuling-appearance.js';
import {makeSlingshot,poseSlingshot} from '../slingshot-model.js';
import {makeHarpoon} from '../coast-models.js';
import {HERO_LOADOUTS} from '../rules.js';
import {slingshotMechanism} from '../weapon-performance.js';
import {POISON} from '../poison-config.js';

function weapon(id){return ['shade','shadowblade','grimoire'].includes(id)?shadowFocus(id):id==='miasmalantern'?miasmaLantern():id==='sporelantern'?sporeLantern():id==='boomerang'?makeSlingshot():id==='harpoon'?makeHarpoon():makeHero(['crossbow','shuriken','dark'].includes(id)?'silver':'scout',id).userData.weapon;}
const hero=gun=>({visible:false,userData:{gun}});

test('the herbalist throws one shared seed pod with her left hand while the lantern stays carried',()=>{
 const camera=new T.PerspectiveCamera(60,16/9,.1,100),view=new FirstPersonView(camera),actor=hero(sporeLantern()),pod=sporePod();actor.userData.sporePod=pod;
 try{
  Object.assign(actor.userData,{attackAge:10,reloadDuration:1,reloadPhase:1,shotSerial:1});view.setHero(actor,'sporelantern');view.update(1,.016,{visible:true});
  assert.equal(view.pod.parent,view.hands[1]);assert.equal(view.pod.children.length,2);assert.equal(view.pod.children[0].geometry,pod.children[0].geometry);assert.notEqual(view.pod.children[0].material,pod.children[0].material);
  const idle=view.hands.map(hand=>hand.position.clone()),release=POISON.castRecovery*POISON.releaseFraction;
  Object.assign(actor.userData,{attackAge:release-.00001,reloadPhase:release-.00001});view.update(1,.016,{visible:true});assert(view.pod.visible);
  const leftTravel=view.hands[1].position.distanceTo(idle[1]),rightTravel=view.hands[0].position.distanceTo(idle[0]);assert(leftTravel>rightTravel*3,'lamp hand performs the throw instead of the free hand');
  Object.assign(actor.userData,{attackAge:release+.00001,reloadPhase:release+.00001});view.update(1,.016,{visible:true});assert(!view.pod.visible);assert(view.hands[1].morphTargetInfluences[0]>.6);
  const pose=view.hands[1].position.clone();Object.assign(actor.userData,{attackAge:1,reloadPhase:1});view.update(30,0,{visible:true});assert(!view.pod.visible);assert(view.hands[1].position.equals(pose));
  view.update(1,.016,{visible:true});assert(view.pod.visible);assert(view.hands[1].position.distanceTo(idle[1])<1e-7);
  let disposed=0;pod.children[0].geometry.addEventListener('dispose',()=>disposed++);view.clear();assert.equal(view.pod,null);assert.equal(disposed,0);
  view.setHero(hero(sporeLantern()),'sporelantern');const fallbackGeometry=view.pod.children[0].geometry;view.clear();
  view.setHero(hero(sporeLantern()),'sporelantern');assert.equal(view.pod.children[0].geometry,fallbackGeometry,'fallback reallocates its cached pod geometry');view.clear();assert.equal(disposed,0);
 }finally{view.dispose();}
});

test('both lamp grips keep their local orientation through distinct gestures and mobile framing',()=>{
 const camera=new T.PerspectiveCamera(60,16/9,.1,100),view=new FirstPersonView(camera),contact=new T.Vector3(0,.045,-.023),signatures=[];
 try{for(const id of ['sporelantern','miasmalantern']){
  const actor=hero(weapon(id));Object.assign(actor.userData,{attackAge:10,reloadDuration:1,reloadPhase:1});view.setHero(actor,id);view.update(1,.016,{visible:true});
  const grip=view.weapon.quaternion.clone().invert().multiply(view.hands[0].quaternion);
  for(const aspect of [16/9,19.5/9,9/19.5])for(const age of [0,.08,.15,.218,.24,.4,.72,1]){
   camera.aspect=aspect;camera.updateProjectionMatrix();Object.assign(actor.userData,{attackAge:age,reloadPhase:age});view.update(1,.016,{visible:true,pitch:.8,yaw:.4});camera.updateMatrixWorld(true);
   const local=view.weapon.quaternion.clone().invert().multiply(view.hands[0].quaternion);assert(grip.angleTo(local)<1e-7,'lamp handle rotates inside the closed hand');
   assert(contact.clone().applyMatrix4(view.hands[0].matrixWorld).distanceTo(view.grip.clone().applyMatrix4(view.weapon.matrixWorld))<1e-6);
   for(const hand of view.hands){assert(hand.position.toArray().every(Number.isFinite));const p=hand.getWorldPosition(new T.Vector3()).project(camera);assert(Math.abs(p.x)<1.4&&p.y>-1.35&&p.y<1);}
  }
  Object.assign(actor.userData,{attackAge:.12,reloadPhase:.12});view.update(1,.016,{visible:true});signatures.push([...view.weapon.position.toArray(),...view.hands[1].position.toArray()].map(v=>v.toFixed(4)).join(','));
 }}finally{view.dispose();}
 assert.notEqual(...signatures);
});

test('first-person slingshot keeps its fork held while pouch, pebble and pulling hand follow one clock',()=>{
 const camera=new T.PerspectiveCamera(60,16/9,.1,100),view=new FirstPersonView(camera),gun=makeSlingshot(),actor=hero(gun),contact=new T.Vector3(0,.045,-.023);
 try{
  Object.assign(actor.userData,{attackAge:10,reloadDuration:1,reloadPhase:1,shotSerial:1});view.setHero(actor,'boomerang');view.update(1,.016,{visible:true});const idle=view.hands[0].position.clone();
  for(const period of [.2,.4,1])for(const phase of [0,.04,.1,.2,.4,.7,1]){
   Object.assign(actor.userData,{attackAge:10,reloadDuration:period,reloadPhase:phase});poseSlingshot(gun,phase*period,period);view.update(1,.016,{visible:true});const action=slingshotMechanism(phase*period,period);camera.updateMatrixWorld(true);
   assert.equal(view.motion.pull,action.pull);assert.equal(view.motion.handPull,action.handPull);assert.equal(view.model.userData.projectile.visible,action.stoneVisible);assert(view.model.userData.pouch.position.equals(gun.userData.pouch.position));assert(view.weapon.visible);assert.equal(view.hands[0].morphTargetInfluences[0],0);
   const target=new T.Vector3(0,.22,-.07-.30*action.handPull).sub(view.center).applyMatrix4(view.weapon.matrixWorld);assert(contact.clone().applyMatrix4(view.hands[1].matrixWorld).distanceTo(target)<1e-6);
  }
  Object.assign(actor.userData,{boomerangAway:true,catchReady:0,reloadDuration:1,reloadPhase:1});view.update(1,.016,{visible:true});assert(view.weapon.visible);assert(view.hands[0].position.distanceTo(idle)<1e-7,'retired boomerang flag still lowers the sling');
 }finally{view.dispose();}
});

test('shadow focus remains in an open palm with restrained finger-led casting',()=>{
 const camera=new T.PerspectiveCamera(60,16/9,.1,100),view=new FirstPersonView(camera),actor=hero(shadowFocus('shade'));view.setHero(actor,'shade');
 try{for(const aspect of [16/9,19.5/9,9/19.5])for(const fov of [50,72])for(let i=0;i<=60;i++){
  camera.aspect=aspect;camera.fov=fov;camera.updateProjectionMatrix();Object.assign(actor.userData,{attackAge:i/60,reloadDuration:1,reloadPhase:i/60});view.update(1,.016,{visible:true});camera.updateMatrixWorld(true);
  assert(view.hands[0].morphTargetInfluences[0]>.65);assert(Math.abs(view.weapon.position.z)<.025);assert(Math.abs(view.weapon.position.x)<.04);
  for(const hand of view.hands){const point=hand.getWorldPosition(new T.Vector3()).project(camera);assert(point.y>-.93&&point.y<-.3&&Math.abs(point.x)<.92,'a casting hand is hidden beyond the view');}
  // The upper edge of the cuff needs to be visible as well as the fingertips.
  const cuff=view.hands[0].localToWorld(new T.Vector3(0,-.038,0)).project(camera);assert(cuff.y>-1,'right cuff falls wholly below the frame');
 }}
 finally{view.dispose();}
});

test('identity structure and material finish survive first-person copying for all thirteen weapons',()=>{
 const view=new FirstPersonView(new T.PerspectiveCamera(70,16/9,.1,100));
 try{for(const [kind,ids]of Object.entries(HERO_LOADOUTS))for(const id of ids){
  const gun=weapon(id),model=hero(gun);model.userData.kind=kind;view.setHero(model,id);let details=0;
  for(const [source,node]of view.parts){
   if(!source.isMesh)continue;
   if(source.userData.identityDetail){assert.equal(node.geometry,source.geometry,id+' replaces the actual identity geometry');details++;}
   if(source.userData.identityDetail||source.material.userData.identityFinish){
    assert(node.material.color.equals(source.material.color),id+' changes an identity tint');
    for(const prop of['roughness','metalness','side','transparent','depthWrite','depthTest'])assert.equal(node.material[prop],source.material[prop],id+' changes '+prop);
   }
  }assert(details>0);
  if(id==='boomerang')assert(!view.details.some(n=>n.name==='First_person_bone-carving'),'two carving patterns were overlaid');
  for(let phase=0;phase<=1;phase+=.1){Object.assign(model.userData,{reloadPhase:phase,reloadDuration:1,attackAge:phase});view.update(phase,.016,{visible:true,attack:Math.max(0,.18-phase)});assert(view.parts.every(([,o])=>o.position.toArray().every(Number.isFinite)));}
 }}finally{view.dispose();}
});

test('scythe and book soul engravings are on exposed surfaces rather than behind blade or paper',()=>{
 const camera=new T.PerspectiveCamera(70,16/9,.1,100),view=new FirstPersonView(camera),ray=new T.Raycaster();ray.layers.set(1);
 try{for(const id of['shadowblade','grimoire']){
  view.setHero(hero(weapon(id)),id);view.update(2,.016,{visible:true});camera.updateMatrixWorld(true);
  const identity=new Set(view.parts.filter(([s])=>s.userData.identityDetail).map(([,n])=>n)),origin=camera.getWorldPosition(new T.Vector3());let exposed=0;
  for(const mesh of identity){const p=mesh.geometry.attributes.position,index=mesh.geometry.index;for(let i=0;i<(index?.count||p.count);i+=12){
   const point=new T.Vector3();for(let k=0;k<3;k++)point.add(new T.Vector3().fromBufferAttribute(p,index?index.getX(i+k):i+k));point.multiplyScalar(1/3).applyMatrix4(mesh.matrixWorld);
   ray.set(origin,point.sub(origin).normalize());if(identity.has(ray.intersectObject(view.root,true)[0]?.object))exposed++;
  }}assert(exposed>0,id+' soul engraving is completely buried or on the hidden face');
 }}finally{view.dispose();}
});

test('first-person sleeves reuse the rebuilt cloth micro-surface without disposing its shared maps',()=>{
 const view=new FirstPersonView(new T.PerspectiveCamera(70,16/9,.1,100)),model=hero(weapon('crossbow'));
 const map=new T.Texture(),roughness=new T.Texture(),cloth=new T.MeshStandardMaterial({normalMap:map,roughnessMap:roughness,normalScale:new T.Vector2(.12,.12),roughness:.86});
 const sleeve=new T.Mesh(new T.CylinderGeometry(.05,.07,.3),cloth);sleeve.geometry.name='SM_Hero_Silver_Sleeves';model.userData.model=new T.Group();model.userData.model.add(sleeve);let disposed=0;map.addEventListener('dispose',()=>disposed++);roughness.addEventListener('dispose',()=>disposed++);
 view.setHero(model,'crossbow');assert.equal(view.arms[0].material.normalMap,map);assert.equal(view.arms[0].material.roughnessMap,roughness);assert.notEqual(view.arms[0].material,cloth);assert.equal(view.arms[0].material.normalScale.x,.12);
 view.dispose();assert.equal(disposed,0);sleeve.geometry.dispose();cloth.dispose();map.dispose();roughness.dispose();
});

test('seven wardrobes have distinct sleeve cuts with unchanged elbow and wrist endpoints',()=>{
 const view=new FirstPersonView(new T.PerspectiveCamera(70,16/9,.1,100)),shapes=new Set();
 try{for(const [kind,id]of Object.entries({scout:'rifle',silver:'crossbow',wraith:'shadowblade',tide:'harpoon',lingya:'boomerang',wuling:'sporelantern',mirage:'miasmalantern'})){
  const model=hero(weapon(id));model.userData.kind=kind;view.setHero(model,id);
  const g=view.arms[0].geometry,p=g.attributes.position;shapes.add(Array.from(p.array).join(','));
  assert(g.name.includes(kind));assert.equal(g.index.count/3,1280);
  for(let i=0;i<p.count;i++){assert(Number.isFinite(p.getX(i)+p.getY(i)+p.getZ(i)));assert(p.getY(i)>=0&&p.getY(i)<=1);}
  assert.notEqual(view.hands[0].material,view.arms[0].material,'leather and cloth share one highlight');
  assert(view.hands[0].material.roughness<view.arms[0].material.roughness);
 }}finally{view.dispose();}
 assert.equal(shapes.size,7,'wardrobes differ only by tint');
});

test('idle scythe hooks down-left and leaves the central view clear on desktop and phone',()=>{
 const camera=new T.PerspectiveCamera(70,16/9,.1,100),view=new FirstPersonView(camera),ray=new T.Raycaster();ray.layers.set(1);
 try{
  view.setHero(hero(weapon('shadowblade')),'shadowblade');
  for(const aspect of[16/9,844/390,390/844]){
   camera.aspect=aspect;camera.updateProjectionMatrix();view.update(1,.016,{visible:true});camera.updateMatrixWorld(true);
   const tip=view.model.localToWorld(new T.Vector3(1.075,.25,.045)).project(camera),socket=view.model.localToWorld(new T.Vector3(.025,.70,.02)).project(camera);
   assert(tip.x<socket.x&&tip.y<socket.y,'hook points away from down-left');
   assert(tip.y<-.4&&socket.x>.5,'idle blade occupies the center');
   for(const x of[-.2,0,.2])for(const y of[-.2,0,.2]){
    ray.setFromCamera(new T.Vector2(x,y),camera);assert.equal(ray.intersectObject(view.root,true).length,0,'idle equipment blocks the central view');
   }
  }
 }finally{view.dispose();}
});

test('held movement settles, turns wrap safely, pause freezes and re-entry clears turn inertia',()=>{
 const camera=new T.PerspectiveCamera(70,16/9,.1,200),v=new FirstPersonView(camera);
 try{
  v.setHero(hero(weapon('crossbow')),'crossbow');
  for(let i=0;i<60;i++)v.update(i/60,1/60,{visible:true,moving:1,strafe:1,yaw:i*.02});
  assert(v.sway>.99);assert(v.sideSway>.99);assert(v.lookSwayX<-.005);const aim=camera.quaternion.clone();
  const pose=[...v.root.position.toArray(),...v.root.quaternion.toArray(),v.gait,v.lookSwayX];
  v.update(50,0,{visible:true,moving:0,strafe:-1,yaw:-2});
  assert.deepEqual([...v.root.position.toArray(),...v.root.quaternion.toArray(),v.gait,v.lookSwayX],pose);
  for(let i=0;i<90;i++)v.update(1+i/60,1/60,{visible:true,moving:0,yaw:1.18});
  assert(v.sway<.001&&Math.abs(v.sideSway)<.001&&Math.abs(v.lookSwayX)<.0001);
  assert(camera.quaternion.equals(aim),'weapon inertia changes camera aim');
  v.update(3,1/60,{visible:false});v.update(3.1,1/60,{visible:true,yaw:Math.PI-.001});
  assert.equal(v.lookSwayX,0);v.update(3.2,1/60,{visible:true,yaw:-Math.PI+.001});assert(Math.abs(v.lookSwayX)<.001,'wrapped yaw causes a large kick');
  for(let i=0;i<80;i++)v.update(4+i/60,1/60,{visible:true,yaw:i%2?2:-2,pitch:i%2?1:-1,strafe:i%2?-1:1});
  assert(Math.abs(v.lookSwayX)<=.026&&Math.abs(v.lookSwayY)<=.018);assert(v.hands.every(h=>h.position.toArray().every(Number.isFinite)));
 }finally{v.dispose();}
});

test('harpoon fork meets the committed contact on screen, including moving and portrait views',()=>{
 const camera=new T.PerspectiveCamera(70,16/9,.1,200),view=new FirstPersonView(camera),actor=hero(weapon('harpoon'));
 camera.position.set(12,1.8,-9);camera.rotation.y=.8;camera.updateMatrixWorld(true);
 try{
  view.setHero(actor,'harpoon');
  for(const aspect of[16/9,390/844])for(const combo of[0,1,2])for(const moving of[0,1]){
   camera.aspect=aspect;camera.updateProjectionMatrix();
   const target=camera.localToWorld(new T.Vector3(.15,-.45,-3.3));
   Object.assign(actor.userData,{attackAge:.192,reloadDuration:1,reloadPhase:.192,harpoonCombo:combo,harpoonTarget:target});
   view.update(3,.016,{visible:true,moving});camera.updateMatrixWorld(true);
   const fork=view.weapon.localToWorld(new T.Vector3(0,0,1.75).sub(view.center)).project(camera),contact=target.clone().project(camera);
   assert(Math.hypot(fork.x-contact.x,fork.y-contact.y)<1e-6,'fork misses its screen contact');
   assert(view.hands.every(h=>h.position.toArray().every(Number.isFinite)));
   const frozen=view.weapon.position.clone();view.update(3,0,{visible:true,moving});assert(view.weapon.position.equals(frozen),'pause advances thrust');
  }
  actor.userData.harpoonTarget=camera.localToWorld(new T.Vector3(200,0,-.4));view.update(4,.016,{visible:true});
  assert(view.weapon.position.length()<1,'off-screen target throws hands out of view');
  actor.userData.attackAge=1;view.update(5,.016,{visible:true});const recovered=view.weapon.position.clone();
  actor.userData.harpoonTarget=null;view.update(5,.016,{visible:true});assert(view.weapon.position.equals(recovered),'old target affects recovery');
 }finally{view.dispose();}
});

test('all 13 actual weapon graphs fit ahead of the camera, without mutating source poses or materials',()=>{
 const camera=new T.PerspectiveCamera(60,16/9,.1,200);camera.position.set(14,2,-8);camera.rotation.y=1.2;
 const view=new FirstPersonView(camera);assert.equal(view.root.parent,camera);
 try{for(const id of Object.values(HERO_LOADOUTS).flat()){
  const gun=weapon(id);gun.position.set(9,3,4);gun.rotation.set(1.4,.6,.3);gun.scale.setScalar(.65);
  const original=gun.matrix.clone(),flags=[];gun.traverse(m=>{if(m.isMesh)flags.push([m.material,m.material.depthTest,m.material.depthWrite,m.material.transparent]);});
  view.setHero(hero(gun),id);assert(view.weapon,id);assert(view.parts.length>0);
  for(const aspect of[16/9,390/844]){camera.aspect=aspect;camera.updateProjectionMatrix();view.update(1,.016,{visible:true,moving:1});camera.updateMatrixWorld(true);
   assert(view.root.visible);assert(view.root.position.z<-.6);assert(view.weapon.scale.x>0);
   const box=new T.Box3().setFromObject(view.weapon),size=box.getSize(new T.Vector3());assert(Math.max(size.x,size.y,size.z)<(id==='harpoon'?1.9:1.15),id+' fills the view');
   for(const [source,clone]of view.parts){assert(clone.matrixWorld.elements.every(Number.isFinite));assert.deepEqual(clone.userData,{});if(clone.isMesh){assert(clone.geometry===source.geometry||view.ownedGeometry.includes(clone.geometry));assert.notEqual(clone.material,source.material);assert.equal(clone.material.depthTest,source.material.depthTest);assert.equal(clone.material.depthWrite,source.material.depthWrite);assert.equal(clone.material.transparent,source.material.transparent);assert.equal(clone.layers.mask,2);assert(clone.renderOrder>=10000);assert.equal(clone.castShadow,false);}}
  }
  assert.deepEqual(gun.position.toArray(),[9,3,4]);assert.equal(gun.scale.x,.65);assert(gun.matrix.equals(original));
  for(const [m,depthTest,depthWrite,transparent]of flags){assert.equal(m.depthTest,depthTest);assert.equal(m.depthWrite,depthWrite);assert.equal(m.transparent,transparent);}
 }}finally{view.dispose();}
});

test('moving bow strings, pump, book page and lantern petals are mirrored via real node pairs',()=>{
 const view=new FirstPersonView(new T.PerspectiveCamera(60,1.5,.1,100));
 try{for(const id of['crossbow','shotgun','grimoire','miasmalantern']){
  const gun=weapon(id);view.setHero(hero(gun),id);
  const source=id==='crossbow'?gun.userData.crossbowStrings[0]:id==='shotgun'?gun.userData.pump:id==='grimoire'?gun.userData.page:gun.userData.petals[0];
  const clone=view.parts.find(([s])=>s===source)?.[1];assert(clone,id);
  const original=source.position.clone();source.position.z-=.03;source.rotation.y+=.2;source.visible=false;
  view.update(2,.016,{visible:true,attack:.09,attackDuration:.18});assert(clone.position.equals(source.position));assert(clone.quaternion.equals(source.quaternion));assert.equal(clone.visible,false);
  source.position.copy(original);
 }
 const gun=weapon('shuriken');view.setHero(hero(gun),'shuriken');gun.visible=false;view.update(2,.016,{visible:true});assert.equal(view.weapon.visible,false);assert(view.hands.every(h=>h.visible));assert(view.hands[0].morphTargetInfluences[0]>.8,'empty throwing hand should open rather than disappear');
 }finally{view.dispose();}
});

test('an idle unposed bow gets connected viewmodel strings without editing the source or masking later animation',()=>{
 const camera=new T.PerspectiveCamera(60,16/9,.1,100),view=new FirstPersonView(camera),gun=weapon('crossbow');
 for(const string of gun.userData.crossbowStrings){string.position.set(0,0,0);string.scale.y=1;string.quaternion.identity();}
 try{
  view.setHero(hero(gun),'crossbow');view.update(1,.016,{visible:true});camera.updateMatrixWorld(true);
  for(let i=0;i<2;i++){
   const source=gun.userData.crossbowStrings[i],clone=view.bowStrings[i][1];
   assert.deepEqual(source.position.toArray(),[0,0,0]);assert.equal(source.scale.y,1);
   const a=new T.Vector3(0,-.5,0).applyMatrix4(clone.matrix),b=new T.Vector3(0,.5,0).applyMatrix4(clone.matrix);
   assert(a.distanceTo(new T.Vector3(i?.44:-.44,.11,.36))<1e-6);assert(b.distanceTo(new T.Vector3(0,.16,-.01))<1e-6);
   assert(Math.abs(b.y-a.y)<.06,'bow string is still a vertical unit cylinder');
   source.position.set(.1,.2,.3);source.rotation.set(.2,.4,.8);source.scale.y=.48;
  }
  view.update(1.1,.016,{visible:true});
  for(const [source,clone]of view.bowStrings){assert(clone.position.equals(source.position));assert(clone.quaternion.equals(source.quaternion));assert(clone.scale.equals(source.scale));}
 }finally{view.dispose();}
});

test('shader material hooks and uniform state survive cloning without aliasing owned containers',()=>{
 const gun=weapon('shade'),aura=createShadowAura('shade');gun.add(aura);const view=new FirstPersonView(new T.PerspectiveCamera(60,1.5,.1,100));
 try{view.setHero(hero(gun),'shade');const original=aura.children[0],clone=view.parts.find(([s])=>s===original)[1];
  assert.notEqual(clone.material,original.material);assert.notEqual(clone.material.uniforms,original.material.uniforms);assert.equal(clone.material.onBeforeCompile,original.material.onBeforeCompile);
  updateShadowAura(aura,2,4,.1,0);view.update(2,.016,{visible:true});
  for(const key of ['time','run','attack'])if(original.material.uniforms[key])assert.equal(clone.material.uniforms[key].value,original.material.uniforms[key].value);
  const position=view.root.position.clone(),rotation=view.root.quaternion.clone(),gait=view.gait;view.update(2,0,{visible:true});assert.equal(view.gait,gait);assert(view.root.position.equals(position));assert(view.root.quaternion.equals(rotation));
 }finally{view.dispose();disposeShadowAura(aura);}
});

test('rebinding and disposal release only owned materials/cuffs and remove the old graph',()=>{
 const camera=new T.PerspectiveCamera(60,1.5,.1,100),view=new FirstPersonView(camera),gun=weapon('crossbow');let sharedDisposed=0,ownedDisposed=0;
 const shared=new Set();gun.traverse(o=>{if(o.isMesh){shared.add(o.geometry);shared.add(o.material);}});for(const resource of shared)resource.addEventListener('dispose',()=>sharedDisposed++);
 view.setHero(hero(gun),'crossbow');const old=view.weapon,owned=[...view.materials.values(),...view.ownedGeometry];for(const resource of owned)resource.addEventListener('dispose',()=>ownedDisposed++);
 view.setHero(hero(weapon('grimoire')),'grimoire');assert.equal(old.parent,null);assert.equal(ownedDisposed,owned.length);assert.equal(sharedDisposed,0);
 view.dispose();view.dispose();assert.equal(sharedDisposed,0);assert.equal(view.root.parent,null);assert.equal(view.root.children.length,0);assert.equal(view.model,null);assert.equal(view.hero,null);
 view.update(5,.016,{visible:true});assert.equal(view.root.visible,false);view.setHero(hero(gun),'crossbow');assert.equal(view.root.children.length,0);
});

test('both articulated hands meet weapon contacts and curved sleeves meet their wrists',()=>{
 const camera=new T.PerspectiveCamera(60,16/9,.1,100),view=new FirstPersonView(camera),contact=new T.Vector3(0,.045,-.023),wrist=new T.Vector3(0,-.038,0);
 try{for(const id of Object.values(HERO_LOADOUTS).flat()){
  view.setHero(hero(weapon(id)),id);view.update(1,.016,{visible:true});camera.updateMatrixWorld(true);
  assert.equal(view.hands.length,2);assert.equal(view.arms.length,2);assert(view.ownedGeometry.length<=14,'unexpected viewmodel geometry allocations');assert(view.details.length<=2,'detail draw calls are unbounded');
  const hand=view.hands[0],actual=contact.clone().applyMatrix4(hand.matrixWorld),target=view.grip.clone().applyMatrix4(view.weapon.matrixWorld);
  assert(actual.distanceTo(target)<1e-6,id+' gripping hand detached from the handle');
  assert(hand.geometry.morphAttributes.position[0].count>300,'hand lost its thumb/finger articulation');
  assert(hand.geometry.morphAttributes.normal[0]);
  for(let i=0;i<2;i++){
   const end=new T.Vector3(0,1,0).applyMatrix4(view.arms[i].matrixWorld),start=wrist.clone().applyMatrix4(view.hands[i].matrixWorld);
   assert(end.distanceTo(start)<1e-6,id+' sleeve detached from wrist');
   assert(view.arms[i].scale.y>.1&&view.arms[i].scale.y<.9);
  }
 }}finally{view.dispose();}
});

test('weapon recovery drives cocking, pumping and distinct attacks without editing the source rig',()=>{
 const view=new FirstPersonView(new T.PerspectiveCamera(60,16/9,.1,100)),signatures=new Set();
 try{for(const id of['rifle','shotgun','crossbow','harpoon','boomerang','sporelantern','grimoire','shade','fire']){
  const gun=weapon(id),actor=hero(gun);Object.assign(actor.userData,{attackAge:10,reloadDuration:1,reloadPhase:1});view.setHero(actor,id);view.update(1,.016,{visible:true});
  const idle=view.weapon.position.clone(),support=view.hands[1].position.clone(),original=gun.quaternion.clone();
  Object.assign(actor.userData,{attackAge:.1,reloadPhase:.5});if(gun.userData.pump)gun.userData.pump.position.z=-.15;
  view.update(1.1,.016,{visible:true});assert(view.weapon.position.distanceTo(idle)>.001,id+' has no visible attack gesture');assert(gun.quaternion.equals(original));
  signatures.add([...view.weapon.position.toArray(),...view.weapon.rotation.toArray().slice(0,3)].map(n=>n.toFixed(3)).join(','));
  if(['crossbow','shotgun'].includes(id))assert(view.hands[1].position.distanceTo(support)>.03,id+' support hand never operates the mechanism');
  const pose=view.root.position.clone(),weaponPose=view.weapon.quaternion.clone();view.update(1.1,0,{visible:true});assert(view.root.position.equals(pose));assert(view.weapon.quaternion.equals(weaponPose));
  Object.assign(actor.userData,{attackAge:10,reloadPhase:1});view.update(3,.016,{visible:true});assert(view.weapon.position.distanceTo(idle)<.001,id+' failed to recover');
 }
 assert(signatures.size>=8,'weapon families share one generic recoil');
 }finally{view.dispose();}
});

test('camera equipment clears the near plane and idle crosshair in landscape and portrait',()=>{
 const camera=new T.PerspectiveCamera(60,16/9,.1,100),view=new FirstPersonView(camera),point=new T.Vector3(),ray=new T.Raycaster();ray.layers.set(1);
 try{for(const id of Object.values(HERO_LOADOUTS).flat()){
  const actor=hero(weapon(id));Object.assign(actor.userData,{attackAge:10,reloadDuration:1,reloadPhase:1});view.setHero(actor,id);
  for(const aspect of[16/9,844/390,390/844]){
   camera.aspect=aspect;camera.updateProjectionMatrix();view.update(1,.016,{visible:true});camera.updateMatrixWorld(true);
   ray.setFromCamera(new T.Vector2(),camera);assert.equal(ray.intersectObject(view.root,true).length,0,id+' covers the idle crosshair');
   for(const age of[10,.10,.35,.7]){
    Object.assign(actor.userData,{attackAge:age,reloadPhase:Math.min(1,age)});view.update(1,.016,{visible:true});camera.updateMatrixWorld(true);
    view.root.traverse(mesh=>{if(!mesh.isMesh)return;const p=mesh.geometry.attributes.position;
     for(let i=0;i<p.count;i++){mesh.getVertexPosition(i,point);point.applyMatrix4(mesh.matrixWorld).applyMatrix4(camera.matrixWorldInverse);assert(point.z<-.16,id+' clips through the near plane');assert(Number.isFinite(point.x+point.y+point.z));}
    });
   }
   Object.assign(actor.userData,{attackAge:10,reloadPhase:1});
  }
 }}finally{view.dispose();}
});

test('hand and sleeve palettes differ by hero without changing shared weapon colors',()=>{
 const view=new FirstPersonView(new T.PerspectiveCamera(60,1.6,.1,100)),palettes=new Set(),gun=weapon('rifle');
 try{for(const kind of Object.keys(HERO_LOADOUTS)){view.setHero({userData:{gun,kind}},'rifle');palettes.add(Array.from(view.arms[0].geometry.attributes.color.array.slice(0,9)).join(','));}
 assert.equal(palettes.size,7);
 }finally{view.dispose();}
});

test('harpoon is held behind the forward fork with two spaced contacts and three distinct recoveries',()=>{
 const camera=new T.PerspectiveCamera(60,16/9,.1,100),view=new FirstPersonView(camera),gun=weapon('harpoon'),actor=hero(gun),contact=new T.Vector3(0,.045,-.023),point=new T.Vector3();
 Object.assign(actor.userData,{attackAge:10,reloadDuration:.48,reloadPhase:1});view.setHero(actor,'harpoon');
 try{for(const aspect of[16/9,844/390,390/844]){
  camera.aspect=aspect;camera.updateProjectionMatrix();view.update(1,.016,{visible:true});camera.updateMatrixWorld(true);
  assert.deepEqual(view.center.toArray(),[0,0,-.08]);assert(view.grip.length()<1e-8);
  const rear=contact.clone().applyMatrix4(view.hands[0].matrixWorld),front=contact.clone().applyMatrix4(view.hands[1].matrixWorld),tip=new T.Vector3(0,0,1.75).sub(view.center).applyMatrix4(view.weapon.matrixWorld);
  assert(front.distanceTo(rear)>.23&&front.distanceTo(rear)<.31,'hands pinch the same short section of the pole');assert(tip.z<rear.z-.95);assert(tip.z< -1.7,'fork has no forward perspective');
  let min=Infinity,max=-Infinity;
  for(const [source,node]of view.parts)if(source.geometry?.type==='ExtrudeGeometry')for(let i=0;i<node.geometry.attributes.position.count;i++){
   node.getVertexPosition(i,point);point.applyMatrix4(node.matrixWorld).project(camera);min=Math.min(min,point.x);max=Math.max(max,point.x);
  }
  assert(max-min<.43,'distant fork is too wide on screen');
  const gestures=new Set();
  for(let combo=0;combo<3;combo++){
   Object.assign(actor.userData,{harpoonCombo:combo,attackAge:.16,reloadPhase:.16/.48});view.update(1.16,.016,{visible:true});camera.updateMatrixWorld(true);
   gestures.add([...view.weapon.position.toArray(),...view.weapon.rotation.toArray().slice(0,3)].map(n=>n.toFixed(3)).join(','));
   for(let i=0;i<2;i++)assert(contact.clone().applyMatrix4(view.hands[i].matrixWorld).distanceTo(view.handPoints[i].clone().applyMatrix4(view.weapon.matrixWorld))<1e-6,'pole slips away from a hand during a combo');
   Object.assign(actor.userData,{attackAge:10,reloadPhase:1});view.update(2,.016,{visible:true});assert(view.weapon.position.length()<1e-8,'combo failed to recover');
  }
  assert.equal(gestures.size,3);
 }}finally{view.dispose();}
});

test('all equipment tucks for five dodge kinds without breaking contacts or clipping phone views',()=>{
 const camera=new T.PerspectiveCamera(60,16/9,.1,100),view=new FirstPersonView(camera),point=new T.Vector3(),contact=new T.Vector3(0,.045,-.023);
 try{for(const id of Object.values(HERO_LOADOUTS).flat()){
  const actor=hero(weapon(id));Object.assign(actor.userData,{attackAge:10,reloadPhase:1,reloadDuration:1});view.setHero(actor,id);
  for(const aspect of[16/9,844/390,390/844]){
   camera.aspect=aspect;camera.updateProjectionMatrix();view.update(1,.016,{visible:true});const idle=view.root.position.clone(),rotation=view.root.quaternion.clone(),signatures=new Set();
   for(const kind of['roll','blink','dive','hop','mist'])for(const side of[-1,1]){
    const age=side<0?.12:10;Object.assign(actor.userData,{attackAge:age,reloadPhase:Math.min(1,age),harpoonCombo:side<0?1:0});
    view.update(1,.016,{visible:true,dodgePose:{kind,weight:1,side,forward:side}});camera.updateMatrixWorld(true);
    assert(view.root.position.y<idle.y-.10);assert.equal(actor.userData.attackAge,age);signatures.add([...view.root.position.toArray(),...view.root.rotation.toArray().slice(0,3)].join(','));
    assert(contact.clone().applyMatrix4(view.hands[0].matrixWorld).distanceTo(view.grip.clone().applyMatrix4(view.weapon.matrixWorld))<1e-6,id+' hand detached during dodge');
    view.root.traverse(mesh=>{if(!mesh.isMesh)return;for(let i=0;i<mesh.geometry.attributes.position.count;i++){
     mesh.getVertexPosition(i,point);point.applyMatrix4(mesh.matrixWorld);assert(Number.isFinite(point.x+point.y+point.z));assert(point.z<-.16,id+' clips the camera during '+kind);
    }});
   }
   assert(signatures.size>=5);view.update(1,.016,{visible:true,dodgePose:null});assert(view.root.position.equals(idle));assert(view.root.quaternion.equals(rotation));
  }
 }}finally{view.dispose();}
});

test('active dodge freezes at dt zero, explicit cancellation clears it, and rebinding cannot carry it over',()=>{
 const camera=new T.PerspectiveCamera(60,1.7,.1,100),view=new FirstPersonView(camera),actor=hero(weapon('harpoon'));
 Object.assign(actor.userData,{attackAge:.16,reloadDuration:.48,reloadPhase:.3});view.setHero(actor,'harpoon');
 try{
  view.update(1,.016,{visible:true,dodgePose:{kind:'dive',weight:.8,side:.4,forward:1}});camera.updateMatrixWorld(true);
  const frozen=[];view.root.traverse(n=>frozen.push([n,n.position.clone(),n.quaternion.clone(),n.scale.clone()]));const age=view.attackAge;
  view.update(300,0,{visible:true,attack:1,moving:1,dodgePose:{kind:'roll',weight:1,side:-1,forward:-1}});
  for(const [node,p,q,s]of frozen){assert(node.position.equals(p));assert(node.quaternion.equals(q));assert(node.scale.equals(s));}assert.equal(view.attackAge,age);
  view.update(300,0,{visible:true,dodgePose:null});assert.equal(view.dodgeWeight,0);assert(view.root.position.equals(view.dodgeBasePosition));assert(view.root.rotation.equals(view.dodgeBaseRotation));assert.equal(view.attackAge,age);
  view.update(301,.016,{visible:true,dodgePose:{kind:'dive',weight:1}});view.update(301,0,{visible:false,dodgePose:null});assert.equal(view.dodgeWeight,0);assert.equal(view.root.visible,false);
  view.setHero(hero(weapon('rifle')),'rifle');view.update(0,0,{visible:true});assert.equal(view.dodgeWeight,0);assert(Math.abs(view.root.rotation.x)<1e-8);
  view.update(0,.016,{visible:true,dodgePose:{weight:NaN,kind:'other',side:Infinity,forward:NaN}});assert(view.root.position.toArray().every(Number.isFinite));assert.equal(view.dodgeWeight,0);
 }finally{view.dispose();}
});

 test('equipment overlay preserves world renderer state and owns its self-occlusion depth',()=>{
 const camera=new T.PerspectiveCamera(60,1.6,.1,100),scene=new T.Scene(),view=new FirstPersonView(camera);scene.add(camera);scene.background=new T.Color(0x344455);camera.layers.enable(4);
 const background=scene.background,mask=camera.layers.mask,events=[];
 const renderer={autoClear:true,clearDepth(){events.push('clear');},render(s,c){events.push('render');assert.equal(c.layers.mask,2);assert.equal(s.background,null);assert.equal(this.autoClear,false);}};
 try{
  view.setHero(hero(weapon('crossbow')),'crossbow');view.render(renderer,scene);assert.equal(events.length,0);
  view.update(1,.016,{visible:true});view.render(renderer,scene);assert.deepEqual(events,['clear','render']);assert.equal(camera.layers.mask,mask);assert.equal(scene.background,background);assert.equal(renderer.autoClear,true);
  for(const hand of view.hands){assert(hand.material.depthTest&&hand.material.depthWrite);assert.equal(hand.material.transparent,false);assert.equal(hand.layers.mask,2);}
  renderer.render=()=>{throw Error('render failed');};assert.throws(()=>view.render(renderer,scene));assert.equal(camera.layers.mask,mask);assert.equal(scene.background,background);assert.equal(renderer.autoClear,true);
 }finally{view.dispose();}
 });

test('close equipment adds bounded real structure across firearms, thrown blades, staves, books and lamps',()=>{
 const view=new FirstPersonView(new T.PerspectiveCamera(60,16/9,.1,100));
 try{for(const id of['rifle','shotgun','shuriken','boomerang','fire','dark','grimoire','sporelantern','miasmalantern']){
  const gun=weapon(id),sourceMaterials=new Map();gun.traverse(n=>{if(n.isMesh&&n.material.color)sourceMaterials.set(n.material,[n.material.color.getHex(),n.material.roughness,n.material.metalness,n.material.emissive?.getHex(),n.material.emissiveIntensity]);});
  view.setHero(hero(gun),id);view.update(1,.016,{visible:true});
  const changed=view.parts.filter(([source,clone])=>source.isMesh&&source.geometry!==clone.geometry),names=view.ownedGeometry.map(g=>g.name).join(' ');
  if(['rifle','shotgun'].includes(id)){
   assert(changed.length>=5,'old firearm fittings were left as cuboids');assert.match(names,/shaped-firearm/);
   const stock=view.parts.find(([s])=>s.name==='SM_Firearm_LeafwoodStock_'+id);assert(stock&&stock[0].geometry===stock[1].geometry);assert(stock[0].geometry.attributes.position.count>24,'shared stock has no tapered structure');
   const wood=stock[1].material,metal=view.parts.find(([s])=>s.material?.color?.getHex()===0x88948d)[1].material;
   assert(wood.roughness>metal.roughness+.25);assert(metal.metalness>wood.metalness+.5);
  }else if(id==='shuriken'){const blades=view.parts.filter(([s])=>s.name.startsWith('SM_Shuriken_MoonBlade_'));assert.equal(blades.length,4);for(const [s,n]of blades){assert.equal(n.geometry,s.geometry);assert(n.geometry.attributes.position.count>60,'moon blade is still a plain cone');}}
  else if(id==='boomerang'){assert(view.model.getObjectByName('SM_Slingshot_WoodHandle'));assert.equal(view.model.userData.bands.length,2);}
  else if(['fire','dark'].includes(id)){assert.match(names,/wrapped-staff-inlay/);assert.equal(view.charged.length,1);}
  else if(id==='grimoire'){
   const pages=view.parts.filter(([s])=>s.name.startsWith('SM_Grimoire_AshenPages_'));assert.equal(pages.length,2);for(const [source,node]of pages){assert.equal(node.geometry,source.geometry);assert.equal(source.geometry.name,'SM_Grimoire_BoundPageLayers');assert(source.geometry.attributes.position.count>200,'book lost its real page layers');}assert.match(names,/turning-page/);assert.match(names,/book-corners-and-script/);
   const ink=changed.filter(([,n])=>n.geometry.name==='First_person_fine-incantation');assert.equal(ink.length,6);
   for(const [source,node]of ink){
    assert.equal(source.material.color.getHex(),SHADOW_PALETTE.lining,'third-person ink lost its shadow colour');assert(node.material.color.equals(source.material.color),'first-person ink overrides the real weapon palette');assert(Math.max(...node.material.color.toArray())<.15,'page ink is still a bright glow');assert.equal(node.material.toneMapped,true);
    node.geometry.computeBoundingBox();assert(node.geometry.boundingBox.max.y-node.geometry.boundingBox.min.y<1e-6,'ink floats in a raised tube above the page');assert(node.geometry.index.count<=18);
   }
  }else{assert.match(names,/lantern-rivets/);assert.match(names,/lantern-core-filaments/);const core=view.parts.find(([s])=>s===gun.userData.heart)[1];assert(view.details.some(mesh=>mesh.parent===core),'core detail lost the real heart animation');}
  let detailTriangles=0;
  for(const mesh of view.details){
   assert.equal(mesh.layers.mask,2);assert.equal(mesh.material.transparent,false);assert(mesh.material.depthTest&&mesh.material.depthWrite);assert.equal(mesh.castShadow,false);
   const g=mesh.geometry;detailTriangles+=(g.index?.count||g.attributes.position.count)/3;assert([...g.attributes.position.array,...g.attributes.normal.array].every(Number.isFinite));
  }
  assert(detailTriangles<=1300,id+' adds excessive detail geometry');assert(view.details.length<=2);
  for(const [m,values]of sourceMaterials)assert.deepEqual([m.color.getHex(),m.roughness,m.metalness,m.emissive?.getHex(),m.emissiveIntensity],values,id+' mutated the third-person material');
 }}finally{view.dispose();}
});

test('crystals and lantern filaments charge with existing gesture timing, freeze and recover without a new light',()=>{
 const view=new FirstPersonView(new T.PerspectiveCamera(60,16/9,.1,100));
 try{for(const id of['fire','dark','sporelantern','miasmalantern']){
  const gun=weapon(id),actor=hero(gun);Object.assign(actor.userData,{attackAge:10,reloadDuration:1,reloadPhase:1});view.setHero(actor,id);view.update(1,.016,{visible:true});
  const idle=view.charged.map(c=>c.material.emissiveIntensity);Object.assign(actor.userData,{attackAge:.10,reloadPhase:.10});view.update(1.1,.016,{visible:true});
  const active=view.charged.map(c=>c.material.emissiveIntensity);assert(active.some((v,i)=>v>idle[i]+.1),id+' core does not respond');assert(active.every(v=>v<=1.45));
  view.update(1.1,0,{visible:true});assert.deepEqual(view.charged.map(c=>c.material.emissiveIntensity),active);
  let lights=0;view.root.traverse(n=>{if(n.isLight)lights++;});assert.equal(lights,0);
  Object.assign(actor.userData,{attackAge:10,reloadPhase:1});view.update(3,.016,{visible:true});assert.deepEqual(view.charged.map(c=>c.material.emissiveIntensity),idle);
 }}finally{view.dispose();}
});

test('each category frees all exclusive detail resources once while retaining shared weapon assets',()=>{
 const view=new FirstPersonView(new T.PerspectiveCamera(60,16/9,.1,100));let sharedDisposed=0;
 try{for(const id of['rifle','shotgun','shuriken','boomerang','fire','dark','grimoire','sporelantern','miasmalantern']){
  const gun=weapon(id),shared=new Set();gun.traverse(n=>{if(n.isMesh){shared.add(n.geometry);shared.add(n.material);}});for(const resource of shared)resource.addEventListener('dispose',()=>sharedDisposed++);
  view.setHero(hero(gun),id);const own=new Set([...view.ownedGeometry,...view.materials.values()]),counts=new Map();for(const resource of own){counts.set(resource,0);resource.addEventListener('dispose',()=>counts.set(resource,counts.get(resource)+1));}
  view.clear();assert.equal(view.details.length,0);assert.equal(view.charged.length,0);assert([...counts.values()].every(v=>v===1),id+' leaked or disposed an owned resource twice');assert.equal(sharedDisposed,0);
 }}finally{view.dispose();}
});

test('both views share the shaped crossbow with curved limbs, a separate slide, trigger and loaded bolt',()=>{
 const camera=new T.PerspectiveCamera(60,1.6,.1,100),view=new FirstPersonView(camera),gun=weapon('crossbow');
 try{
  view.setHero(hero(gun),'crossbow');view.update(1,.016,{visible:true});camera.updateMatrixWorld(true);
  const names=['SM_Crossbow_WoodStock_A','SM_Crossbow_Grip_A','SM_Crossbow_RecurvedLimb_L','SM_Crossbow_RecurvedLimb_R','SM_Crossbow_TriggerGuard_A','SM_Crossbow_Trigger_A','SM_Crossbow_Latch_A','SM_Crossbow_BoltShaft_A','SM_Crossbow_BoltHead_A'];
  for(const name of names){const source=gun.getObjectByName(name),pair=view.parts.find(([n])=>n===source);assert(source&&pair,name);assert.equal(pair[1].geometry,source.geometry,'different first/third-person shape');assert(source.castShadow&&source.receiveShadow);}
  const limbs=names.filter(n=>n.includes('Recurved')).map(n=>gun.getObjectByName(n));
  for(const limb of limbs){const p=limb.geometry.attributes.position;assert(p.count>80);assert([...p.array,...limb.geometry.attributes.normal.array].every(Number.isFinite));assert(limb.material.metalness>.5);}
  const stock=gun.getObjectByName('SM_Crossbow_WoodStock_A');assert.equal(stock.material.metalness,0);assert(stock.material.roughness>.65);
  const guard=gun.getObjectByName('SM_Crossbow_TriggerGuard_A');assert.equal(guard.geometry.type,'TubeGeometry');
  const projected=view.hands.map(hand=>hand.getWorldPosition(new T.Vector3()).project(camera));assert(projected.every(p=>p.y> -1.16),'hands hidden completely below the frame');
 }finally{view.dispose();}
});

test('crossbow strings and slide lock behind the loaded bolt while the support hand returns to the stock',()=>{
 const camera=new T.PerspectiveCamera(60,16/9,.1,100),view=new FirstPersonView(camera),gun=weapon('crossbow'),actor=hero(gun);
 try{
  view.setHero(actor,'crossbow');
  for(const phase of[0,.10,.22,.38,.60,.74,.90,1]){
   poseCrossbow(gun,phase);Object.assign(actor.userData,{attackAge:phase,reloadDuration:1,reloadPhase:phase});view.update(phase,1/60,{visible:true});camera.updateMatrixWorld(true);
   for(const [source,clone]of view.bowStrings){const b=new T.Vector3(0,.5,0).applyMatrix4(clone.matrix);assert(Math.abs(b.z-(.29-gun.userData.stringPull))<1e-6);assert(clone.position.equals(source.position));}
   const source=gun.userData.crossbowLatch,clone=view.parts.find(([s])=>s===source)[1];assert.equal(clone.position.z,-gun.userData.stringPull);
   assert.equal(gun.userData.crossbowBolt.visible,phase>.72);
   const bladeSource=gun.userData.crossbowBolt;assert.equal(view.parts.find(([s])=>s===bladeSource)[1].visible,phase>.72);
  }
  assert.equal(gun.userData.stringPull,.30,'string springs forward before the next shot');
  const shaft=gun.getObjectByName('SM_Crossbow_BoltShaft_A');gun.updateMatrixWorld(true);const nock=shaft.localToWorld(new T.Vector3(0,-.265,0)),stringEnd=gun.userData.crossbowStrings[0].localToWorld(new T.Vector3(0,.5,0));assert(nock.distanceTo(stringEnd)<1e-6,'loaded bolt is disconnected from the cocked string');
  const palm=view.hands[1].localToWorld(new T.Vector3(0,.045,-.023)),foregrip=view.model.localToWorld(new T.Vector3(0,-.05,.18));assert(palm.distanceTo(foregrip)<1e-8,'support hand stays on charging handle');
  const frozen=view.weapon.matrix.clone();view.update(5,0,{visible:true});assert.deepEqual(view.weapon.matrix.elements,frozen.elements);
 }finally{view.dispose();}
});

test('shared scythe metal has a raised forged spine, thin edge and real leather bindings within a small geometry budget',()=>{
 const gun=weapon('shadowblade'),blade=gun.getObjectByName('SM_Scythe_ForgedBlade_A');assert(blade);
 const p=blade.geometry.attributes.position;let low=Infinity,high=-Infinity,triangles=0;
 for(let i=0;i<p.count;i++){low=Math.min(low,p.getZ(i));high=Math.max(high,p.getZ(i));}
 assert(high-low>.05,'blade is still a flat slab');assert(blade.material.vertexColors&&blade.material.metalness>.6);assert.equal(blade.material.emissiveIntensity,1);assert.equal(blade.material.emissive.getHex(),0);
 const normal=blade.geometry.attributes.normal,faceRows=p.count/2;for(let i=6;i<faceRows-6;i++){assert(normal.getZ(i)<0,'back blade face points inward');assert(normal.getZ(i+faceRows)>0,'front blade face points inward');}
 assert(gun.getObjectByName('SM_Scythe_SocketBrace_A'));assert(gun.getObjectByName('SM_Scythe_LeatherBinding_0'));assert(gun.getObjectByName('SM_Scythe_LeatherBinding_1'));
 gun.traverse(n=>{if(n.isMesh){triangles+=(n.geometry.index?.count||n.geometry.attributes.position.count)/3;assert([...n.geometry.attributes.position.array,...n.geometry.attributes.normal.array].every(Number.isFinite));}});
 assert(triangles<4500,'held scythe exceeds the near-view mesh budget');
});


test('projectile outlets are attached to the visible weapon in landscape and portrait',()=>{
 const camera=new T.PerspectiveCamera(70,16/9,.1,200),view=new FirstPersonView(camera);
 try{for(const aspect of[16/9,390/844])for(const id of['rifle','shotgun','crossbow','fire','dark','shade','shuriken','boomerang','miasmalantern']){
  camera.aspect=aspect;camera.updateProjectionMatrix();camera.position.set(7,2,-5);camera.rotation.set(-.3,.8,0);const actor=hero(weapon(id));view.setHero(actor,id);view.update(0,.016,{visible:true,moving:0,attack:0});
  const p=view.launchPoint();assert(p&&p.toArray().every(Number.isFinite),id);const local=camera.worldToLocal(p.clone());assert(local.x>0,id+' outlet lost its right-hand position');assert(local.z<0,id+' outlet behind camera');assert(p.distanceTo(camera.position)<2,id+' outlet disconnected');
 }}finally{view.dispose();}
});


test('scythe cutting edge meets committed contact during all three swings without releasing its grip',()=>{
 const camera=new T.PerspectiveCamera(70,16/9,.1,100),view=new FirstPersonView(camera),actor=hero(weapon('shadowblade'));
 try{view.setHero(actor,'shadowblade');for(const aspect of[16/9,390/844])for(const combo of[0,1,2]){
  camera.aspect=aspect;camera.updateProjectionMatrix();const target=camera.localToWorld(new T.Vector3(.12,-.25,-2.5));
  Object.assign(actor.userData,{attackAge:.56*.44,reloadDuration:1,reloadPhase:.56*.44,scytheCombo:combo,scytheTarget:target});view.update(1,.016,{visible:true});camera.updateMatrixWorld(true);
  const edge=view.model.localToWorld(new T.Vector3(.78,.54,.045)).project(camera),hit=target.clone().project(camera);assert(Math.hypot(edge.x-hit.x,edge.y-hit.y)<1e-6,'visible blade misses committed contact');assert.equal(view.hands[0].morphTargetInfluences[0],0,'scythe hand opens during cut');
  const pose=view.weapon.matrix.clone();view.update(1,0,{visible:true});assert.deepEqual(view.weapon.matrix.elements,pose.elements);
 }}finally{view.dispose();}
});


test('both first-person scythe hands close on fixed shaft grips through windup, cut and recovery',()=>{
 const camera=new T.PerspectiveCamera(70,16/9,.1,100),view=new FirstPersonView(camera),actor=hero(weapon('shadowblade'));
 try{view.setHero(actor,'shadowblade');for(const aspect of[16/9,390/844])for(const combo of[0,1,2])for(let frame=0;frame<=42;frame++){
  camera.aspect=aspect;camera.updateProjectionMatrix();Object.assign(actor.userData,{attackAge:frame/60,reloadDuration:1,reloadPhase:frame/60,scytheCombo:combo});view.update(frame/60,1/60,{visible:true,moving:1});camera.updateMatrixWorld(true);
  for(const[i,point]of [[0,[0,-.035,.02]],[1,[.008,.345,.02]]]){
   const palm=view.hands[i].localToWorld(new T.Vector3(0,.045,-.023)),shaft=view.model.localToWorld(new T.Vector3(...point));
   assert(palm.distanceTo(shaft)<1e-8,`hand ${i} detaches in combo ${combo}`);assert.equal(view.hands[i].morphTargetInfluences[0],0);
  }
 }}finally{view.dispose();}
});

test('scythe contact calibration preserves the cutting arc instead of pinning the edge on target',()=>{
 const camera=new T.PerspectiveCamera(70,16/9,.1,100),view=new FirstPersonView(camera),actor=hero(weapon('shadowblade'));
 try{view.setHero(actor,'shadowblade');for(const combo of[0,1,2]){
  const target=new T.Vector3(.12,-.25,-2.5),samples=[];
  for(const phase of[.40,.44,.48]){
   Object.assign(actor.userData,{attackAge:.56*phase,reloadDuration:1,reloadPhase:.56*phase,scytheCombo:combo,scytheTarget:target});view.update(1,1/60,{visible:true});camera.updateMatrixWorld(true);
   samples.push(view.model.localToWorld(new T.Vector3(.78,.54,.045)).project(camera));
  }
  assert(samples[0].distanceTo(samples[1])>.015);assert(samples[1].distanceTo(samples[2])>.015,'blade pinned to contact after hit');
  assert(samples[0].clone().sub(samples[1]).dot(samples[2].clone().sub(samples[1]))<0,'blade reverses on contact instead of following through');
 }}finally{view.dispose();}
});

test('first two scythe cuts cross the screen in opposite directions, with and without a target',()=>{
 const camera=new T.PerspectiveCamera(70,16/9,.1,100),view=new FirstPersonView(camera),actor=hero(weapon('shadowblade'));
 try{view.setHero(actor,'shadowblade');for(const aspect of[16/9,844/390,390/844])for(const target of[null,new T.Vector3(.12,-.25,-2.5)])for(const combo of[0,1]){
  camera.aspect=aspect;camera.updateProjectionMatrix();const samples=[],hands=[];let previousRotation=null,turn=0;
  for(let n=0;n<=24;n++){
   const phase=.24+.38*n/24;Object.assign(actor.userData,{attackAge:.56*phase,reloadDuration:1,scytheCombo:combo,scytheTarget:target});view.update(1,1/60,{visible:true});camera.updateMatrixWorld(true);
   samples.push(view.model.localToWorld(new T.Vector3(.78,.54,.045)).project(camera).x);hands.push(view.hands[0].getWorldPosition(new T.Vector3()).project(camera).x);
   if(previousRotation)turn+=previousRotation.angleTo(view.weapon.quaternion);previousRotation=view.weapon.quaternion.clone();
  }
  const direction=combo===0?-1:1;
  for(let n=1;n<samples.length;n++)assert((samples[n]-samples[n-1])*direction>0,`combo ${combo} reverses instead of sweeping`);
  assert((samples.at(-1)-samples[0])*direction>.30,'cut is too small to read');assert((hands.at(-1)-hands[0])*direction>.30,'blade spins while grip stays still');
  assert(turn<1,'side cut twists the shaft through a large rotation');
 }}finally{view.dispose();}
});
