import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../vendor/three.module.js';
import {actor,animateActor} from '../world.js';
import {polishEnemyAppearance} from '../enemy-appearance.js';

const kinds=['mushroom','wolf','golem','spitter','shaman'];
const surfaces=g=>{const parts=[];g.traverse(o=>{if(o.isMesh)parts.push(o);});return parts;};
test('forest models preserve their encounter footprint, share finite assets and batch small details',()=>{
 let oldCalls=0,newCalls=0;
 for(const kind of kinds){
  const base=actor(kind,undefined,false),size=new T.Box3().setFromObject(base).getSize(new T.Vector3());
  oldCalls+=surfaces(base).length;
  const g=polishEnemyAppearance(base),other=polishEnemyAppearance(actor(kind,undefined,false)),parts=surfaces(g),copy=surfaces(other);
  const next=new T.Box3().setFromObject(g).getSize(new T.Vector3());
  for(const axis of['x','y','z'])assert.ok(next[axis]<=size[axis]*1.15,`${kind} ${axis} exceeds existing silhouette`);
  assert.ok(next.y>=size.y*.85,`${kind} became too small`);
  assert.equal(parts.length,copy.length);newCalls+=parts.length;
  parts.forEach((part,i)=>{
   assert.equal(part.geometry,copy[i].geometry,`${kind} duplicate geometry`);
   assert.equal(part.material,copy[i].material,`${kind} duplicate material`);
   assert.ok(part.geometry.boundingSphere.radius>0);
   assert.equal(part.geometry.attributes.color.count,part.geometry.attributes.position.count);
   assert.ok(Array.from(part.geometry.attributes.position.array).every(Number.isFinite));
  });
  const nodes=[...g.userData.rig.children];polishEnemyAppearance(g);assert.deepEqual(g.userData.rig.children,nodes,'polish is idempotent');
 }
 assert.ok(newCalls<=oldCalls,`forest set ${newCalls} mesh batches exceeds old ${oldCalls}`);
});

test('new moving parts belong to the live rig and remain finite through attack and water poses',()=>{
 for(const kind of kinds){
  const g=polishEnemyAppearance(actor(kind)),d=g.userData,live=new Set();g.traverse(o=>live.add(o));
  for(const p of[d.head,d.cap,d.jaw,d.tail,d.tailTip,d.hatTip,d.hem,d.staff,d.focus,...d.arms,...(d.feet||[]),...(d.ears||[])])if(p)assert.ok(live.has(p),`${kind} detached pose target`);
  if(kind==='wolf')for(const leg of d.legs){assert.equal(leg.knee.parent,leg.joint);assert.equal(leg.paw.parent,leg.knee);assert.equal(leg.upperLength,.24);assert.equal(leg.lowerLength,.24);}
  for(let i=0;i<240;i++){d.waterDepth=i>120?.6:0;animateActor(g,i/60,i<120?2.5:0,i%60<25?.5-i%60*.02:0);}
  g.updateMatrixWorld(true);g.traverse(o=>assert.ok(o.matrixWorld.elements.every(Number.isFinite),`${kind}: invalid transform`));
 }
});

test('snow and ash species retain their existing role rebuild and materials',()=>{
 for(const kind of['snowhare','frostwolf','yeti','icewitch','snowtotem','emberling','ashstalker','lavabrute','cinderwisp','ashseer']){
  const g=actor(kind),parts=surfaces(g),geometry=parts.map(p=>p.geometry),materials=parts.map(p=>p.material);
  polishEnemyAppearance(g);assert.equal(g.userData.appearance,undefined,kind);
  assert.deepEqual(surfaces(g),parts);assert.deepEqual(parts.map(p=>p.geometry),geometry);assert.deepEqual(parts.map(p=>p.material),materials);
  animateActor(g,.1,2,.4);assert.ok(new T.Box3().setFromObject(g).getSize(new T.Vector3()).y>0);
 }
});

test('caster two-bone sleeves follow the grip through walking, windup and release without stretching',()=>{
 for(const kind of['spitter','shaman']){
  const g=polishEnemyAppearance(actor(kind)),d=g.userData,{upper,forearm,upperLength,lowerLength}=d.castingArm;
  let elbowTravel=0,last=forearm.position.clone();
  for(let i=0;i<360;i++){
   animateActor(g,i/60,i<240?2.5:0,i%90<48?.8-i%90/60:0);
   const elbow=new T.Vector3(0,-upperLength,0).applyQuaternion(upper.quaternion).add(upper.position);
   const wrist=new T.Vector3(0,-lowerLength,0).applyQuaternion(forearm.quaternion).add(forearm.position);
   const grip=new T.Vector3(-.015,.20,.02).applyMatrix4(d.staff.matrix);
   assert.ok(elbow.distanceTo(forearm.position)<1e-7,`${kind}: elbow disconnected`);
   assert.ok(wrist.distanceTo(grip)<1e-7,`${kind}: wrist missed staff`);
   assert.deepEqual(upper.scale.toArray(),[1,1,1]);assert.deepEqual(forearm.scale.toArray(),[1,1,1]);
   elbowTravel+=forearm.position.distanceTo(last);last.copy(forearm.position);
  }
  assert.ok(elbowTravel>.1,`${kind}: arm pose never followed staff`);
 }
});

test('near-view anatomy has a continuous wolf waist, exposed short teeth and separated claw tips',()=>{
 const wolf=actor('wolf');
 const hit=(name,origin,direction)=>{
  const source=wolf.getObjectByName(name),part=new T.Mesh(source.geometry,source.material);
  part.updateMatrixWorld(true);
  return new T.Raycaster(new T.Vector3(...origin),new T.Vector3(...direction)).intersectObject(part)[0]?.point;
 };
 const waist=hit('creature-body',[1,.71,-.13],[-1,0,0]),chest=hit('creature-body',[1,.71,.15],[-1,0,0]);
 assert.ok(waist&&chest&&waist.x>.17&&waist.x<chest.x*.9,'waist must narrow continuously behind the rib cage');
 for(const z of[-.4,-.3,-.2,-.1,0,.1,.2,.3])assert.ok(hit('creature-body',[1,.71,z],[-1,0,0]),'torso has a side-view gap');
 for(const x of[-.09,.09]){
  const tooth=hit('wolf-head',[x,-.185,.6],[0,0,-1]);
  assert.ok(tooth&&tooth.z>.30&&tooth.z<.36,'short canine must be visible below the upper lip');
 }
 for(const x of[-.043,0,.043]){
  const claw=hit('wolf-lower-leg',[x+.001,-.24,.3],[0,0,-1]);
  assert.ok(claw&&claw.z>.193&&claw.z<.21,'each toe needs a short exposed claw, inside the existing paw footprint');
 }
});

test('thin mushroom gills and stone mottling remain real shared geometry within the forest budget',()=>{
 const budgets={mushroom:2600,wolf:4800,golem:2300,spitter:3650,shaman:3700},materials=new Set();let triangles=0,calls=0;
 for(const kind of kinds){
  const g=actor(kind),parts=surfaces(g);let count=0;
  for(const part of parts){count+=(part.geometry.index?.count||part.geometry.attributes.position.count)/3;materials.add(part.material);assert.ok(Array.from(part.geometry.attributes.normal.array).every(Number.isFinite));}
  assert.ok(count<=budgets[kind],`${kind}: ${count} triangles`);triangles+=count;calls+=parts.length;
 }
 assert.ok(triangles<=16500,`forest set uses ${triangles} triangles`);assert.equal(calls,47);assert.equal(materials.size,2,'surface detail must not add per-creature materials');
 const cap=actor('mushroom').getObjectByName('mushroom-cap').geometry,p=cap.attributes.position,n=cap.attributes.normal;let blades=0;
 for(let i=0;i<p.count;i++)if(p.getY(i)<-.14&&Math.hypot(p.getX(i),p.getZ(i))>.15&&Math.abs(n.getY(i))<.35){assert.ok(Math.hypot(n.getX(i),n.getY(i),n.getZ(i))>.99);blades++;}
 assert.ok(blades>=100,'gills must hang below the cap and retain outward normals on both sides');
 const stone=actor('golem').getObjectByName('creature-body').geometry.attributes.color;
 const tones=new Set(Array.from({length:stone.count},(_,i)=>[stone.getX(i),stone.getY(i),stone.getZ(i)].map(v=>v.toFixed(3)).join(',')));
 assert.ok(tones.size>100,'rock faces should contain baked damp/moss variation rather than one color per stone');
 const skin=actor('wolf').getObjectByName('creature-body').material;
 assert.equal(skin.map,null);assert.equal(skin.emissive.getHex(),0);
 const shader={vertexShader:T.ShaderLib.standard.vertexShader,fragmentShader:T.ShaderLib.standard.fragmentShader,uniforms:{}};
 skin.onBeforeCompile(shader);
 assert.match(shader.vertexShader,/creaturePoint=position/);assert.match(shader.fragmentShader,/dFdx\(creaturePoint\)/);assert.match(shader.fragmentShader,/roughnessFactor=clamp/);
 assert.equal(Object.keys(shader.uniforms).length,0,'no per-creature texture or animation uniform');
});
