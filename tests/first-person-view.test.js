import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../vendor/three.module.js';
import {FirstPersonView} from '../first-person-view.js';
import {makeHero} from '../hero-model.js';
import {shadowFocus} from '../shadow-gear.js';
import {createShadowAura,updateShadowAura,disposeShadowAura} from '../shadow-aura.js';
import {miasmaLantern} from '../mirage-appearance.js';
import {sporeLantern} from '../wuling-appearance.js';
import {boneBoomerang} from '../beast-model.js';
import {makeHarpoon} from '../coast-models.js';
import {HERO_LOADOUTS} from '../rules.js';

function weapon(id){return ['shade','shadowblade','grimoire'].includes(id)?shadowFocus(id):id==='miasmalantern'?miasmaLantern():id==='sporelantern'?sporeLantern():id==='boomerang'?boneBoomerang():id==='harpoon'?makeHarpoon():makeHero(id==='crossbow'?'silver':'scout',id).userData.weapon;}
const hero=gun=>({visible:false,userData:{gun}});

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
 const gun=weapon('boomerang');view.setHero(hero(gun),'boomerang');gun.visible=false;view.update(2,.016,{visible:true});assert.equal(view.weapon.visible,false);assert(view.hands.every(h=>h.visible));assert(view.hands[0].morphTargetInfluences[0]>.8,'empty throwing hand should open rather than disappear');
 }finally{view.dispose();}
});

test('an idle unposed bow gets connected viewmodel strings without editing the source or masking later animation',()=>{
 const camera=new T.PerspectiveCamera(60,16/9,.1,100),view=new FirstPersonView(camera),gun=weapon('crossbow');
 try{
  view.setHero(hero(gun),'crossbow');view.update(1,.016,{visible:true});camera.updateMatrixWorld(true);
  for(let i=0;i<2;i++){
   const source=gun.userData.crossbowStrings[i],clone=view.bowStrings[i][1];
   assert.deepEqual(source.position.toArray(),[0,0,0]);assert.equal(source.scale.y,1);
   const a=new T.Vector3(0,-.5,0).applyMatrix4(clone.matrix),b=new T.Vector3(0,.5,0).applyMatrix4(clone.matrix);
   assert(a.distanceTo(new T.Vector3(i?.44:-.44,.11,.36))<1e-6);assert(b.distanceTo(new T.Vector3(0,.12,.29))<1e-6);
   assert(Math.abs(b.y-a.y)<.02,'bow string is still a vertical unit cylinder');
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
   assert(changed.length>=7,'firearm still consists of unchanged cuboids');assert.match(names,/shaped-firearm/);
   const wood=view.parts.find(([s])=>s.material?.color?.getHex()===0x624f3d)[1].material,metal=view.parts.find(([s])=>s.material?.color?.getHex()===0x253440)[1].material;
   assert(wood.roughness>metal.roughness+.25);assert(metal.metalness>wood.metalness+.5);
  }else if(id==='shuriken'){assert.equal(changed.length,4);assert.match(names,/ground-throwing-edge/);}
  else if(id==='boomerang')assert.match(names,/bone-carving/);
  else if(['fire','dark'].includes(id)){assert.match(names,/wrapped-staff-inlay/);assert.equal(view.charged.length,1);}
  else if(id==='grimoire'){
   assert.equal(changed.filter(([,n])=>n.geometry.name==='First_person_layered-pages').length,2);assert.match(names,/turning-page/);assert.match(names,/book-corners-and-script/);
   const ink=changed.filter(([,n])=>n.geometry.name==='First_person_fine-incantation');assert.equal(ink.length,6);
   for(const [source,node]of ink){
    assert.equal(source.material.color.getHex(),0xbac5cc,'third-person rune color changed');assert(Math.max(...node.material.color.toArray())<.15,'page ink is still a bright glow');assert.equal(node.material.toneMapped,true);
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

 test('close-view crossbow has a tapered beveled body and recurved limbs while retaining animated geometry',()=>{
 const camera=new T.PerspectiveCamera(60,1.6,.1,100),view=new FirstPersonView(camera),gun=weapon('crossbow');
 try{
  view.setHero(hero(gun),'crossbow');view.update(1,.016,{visible:true});camera.updateMatrixWorld(true);
  const changed=view.parts.filter(([source,clone])=>source.isMesh&&source.geometry!==clone.geometry);assert.equal(changed.length,6);
  assert.equal(changed.filter(([,clone])=>clone.geometry.name==='First_person_recurved-limb').length,2);
  for(const [source,clone]of changed){assert.equal(source.geometry.type,'BoxGeometry');assert(view.ownedGeometry.includes(clone.geometry));assert(clone.geometry.attributes.position.count>8);assert([...clone.geometry.attributes.normal.array].every(Number.isFinite));}
  for(const [source,clone]of view.bowStrings)assert.equal(source.geometry,clone.geometry,'animated strings were replaced');
  const projected=view.hands.map(hand=>hand.getWorldPosition(new T.Vector3()).project(camera));assert(projected.every(p=>p.y> -1.16),'hands hidden completely below the frame');
 }finally{view.dispose();}
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
