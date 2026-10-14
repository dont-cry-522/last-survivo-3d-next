import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
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

test('continuous wolf anatomy and irregular stone contours retain their actor budgets and hit heights',()=>{
 const shells=geometry=>{
  const p=geometry.attributes.position,vertices=new Map(),ids=[],parent=[],edges=new Map(),root=i=>{while(parent[i]!==i)i=parent[i];return i;};
  for(let i=0;i<p.count;i++){const key=[p.getX(i),p.getY(i),p.getZ(i)].map(v=>v.toFixed(5)).join(',');if(!vertices.has(key)){vertices.set(key,vertices.size);parent.push(parent.length);}ids.push(vertices.get(key));}
  for(let i=0;i<ids.length;i+=3){const tri=ids.slice(i,i+3);if(new Set(tri).size<3)continue;for(let j=0;j<3;j++){const a=tri[j],b=tri[(j+1)%3],key=a<b?a+':'+b:b+':'+a;edges.set(key,(edges.get(key)||0)+1);parent[root(a)]=root(b);}}
  return{count:new Set(parent.map((_,i)=>root(i))).size,closed:[...edges.values()].every(n=>n===2)};
 };
 const wolf=actor('wolf'),golem=actor('golem'),body=wolf.getObjectByName('creature-body').geometry;
 assert.deepEqual(shells(body),{count:1,closed:true},'wolf chest and neck returned to overlapping shells');
 for(const [m,height,budget,calls]of[[wolf,1.350000011920929,4588,15],[golem,2.1435913920402525,2100,6]]){
  const parts=surfaces(m);assert.equal(new T.Box3().setFromObject(m).max.y,height,'spawn-derived projectile hit height changed');assert.equal(parts.length,calls);assert(parts.reduce((n,p)=>n+(p.geometry.index?.count??p.geometry.attributes.position.count)/3,0)<=budget);
 }
 const stone=golem.getObjectByName('creature-body').geometry,p=stone.attributes.position,n=stone.attributes.normal,c=stone.attributes.color,at=new Map();let creases=0,moss=0;
 for(let i=0;i<p.count;i++){const key=[p.getX(i),p.getY(i),p.getZ(i)].map(v=>v.toFixed(5)).join(','),normal=new T.Vector3().fromBufferAttribute(n,i);if(at.has(key)&&normal.dot(at.get(key))<.8)creases++;else at.set(key,normal);if(c.getY(i)>c.getX(i)*1.15&&c.getY(i)>c.getZ(i)*1.3)moss++;}
 assert(creases>20,'fracture faces were smoothed into a clay barrel');assert(moss>20,'upper and sheltered stone lost their baked moss patches');
 // The original head, heavy fists and planted feet are reference contours;
 // chest cleanup must not replace them with regular lathed cylinders.
 for(const [name,expected]of Object.entries({'golem-head':'bddf3a8560bdcf1ac4c5b82cbc5e070ed46d0f67ef7a91d62360b656fa42ca7e','golem-arm':'b6e3c85d28a39b7d37296fba85369be1de59e619e43fa4decf98cd860e7caa30','golem-leg':'10249bf9103b58c715e67cf098accd7ac8b392dc64442793816fa73230934145'})){
  const hash=createHash('sha256'),geometry=golem.getObjectByName(name).geometry;for(const attr of['position','normal','color'])hash.update(Buffer.from(geometry.attributes[attr].array.buffer));assert.equal(hash.digest('hex'),expected,name+' lost its original natural stone contour');
 }
});

test('forest identities share the finish and keep combat height while caster silhouettes differ',()=>{
 for(const kind of kinds){const g=actor(kind),surface=kind==='wolf'?1:kind==='golem'?2:0;
  for(const part of surfaces(g)){assert.equal(part.geometry.attributes.creatureSurface.count,part.geometry.attributes.position.count);assert(part.geometry.attributes.creatureSurface.array.every(v=>v===surface));assert(Array.from(part.geometry.attributes.normal.array).every(Number.isFinite));}
  assert(g.userData.combatHeight>1.3&&g.userData.combatHeight<2.2);
 }
 const beast=actor('spitter').getObjectByName('caster-head').geometry,priest=actor('shaman').getObjectByName('caster-head').geometry;
 const a=beast.boundingBox.getSize(new T.Vector3()),b=priest.boundingBox.getSize(new T.Vector3());
 assert(a.x>a.y*1.4,'poison beast must have a wide amphibian muzzle');assert(b.y>b.x*1.3,'priest must retain its long bark mask and forked shoots');
 for(const kind of ['spitter','shaman'])assert.equal(actor(kind).userData.combatHeight,1.8900000041723253,'appearance must not alter projectile hit height');
});
