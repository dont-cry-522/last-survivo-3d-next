import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../vendor/three.module.js';
import {actor,animateActor} from '../world.js';
import {ENEMIES} from '../rules.js';
import {ENEMY_MOTION} from '../enemy-motion.js';
import {polishRegionalEnemy,animateRegionalAppearance} from '../regional-enemy-appearance.js';

const heights={snowhare:1.5976897430469938,frostwolf:1.3149999970197679,yeti:2.22,icewitch:2.1637617943138174,snowtotem:1.5100000034272671,emberling:1.4945310739053497,ashstalker:1.2609969226002462,lavabrute:2.4829657222321115,cinderwisp:1.4500000029802322,ashseer:2.1637617943138174};
const make=id=>polishRegionalEnemy(actor(id),id),meshes=g=>{const a=[];g.traverse(o=>{if(o.isMesh)a.push(o);});return a;};
test('ten regional templates preserve spawn hit heights and gameplay data while sharing bounded batches',()=>{
 const rules=JSON.stringify(ENEMIES),motion=JSON.stringify(ENEMY_MOTION);let triangles=0,calls=0;const materials=new Set();
 for(const [id,height]of Object.entries(heights)){
  const g=make(id),other=make(id),parts=meshes(g),copies=meshes(other),before=[...g.userData.rig.children];
  assert(g.userData.regionalAppearance);assert.equal(g.userData.species,id);assert.equal(g.userData.appearance,undefined);
  assert(Math.abs(new T.Box3().setFromObject(g).max.y-height)<1e-7,id+' changes projectile hit height');assert(Math.abs(g.userData.combatHeight-height)<1e-7);
  assert.deepEqual(g.position.toArray(),[0,0,0]);assert.deepEqual(g.scale.toArray(),[1,1,1]);
  polishRegionalEnemy(g,id);assert.deepEqual(g.userData.rig.children,before,'polish duplicated the rig');
  parts.forEach((part,i)=>{assert.equal(part.geometry,copies[i].geometry);assert.equal(part.material,copies[i].material);assert(part.name.startsWith('SM_Enemy_'+id+'_'));assert(!part.userData.ownedGeometry);assert.equal(part.material.side,T.FrontSide);assert.equal(part.geometry.attributes.color.count,part.geometry.attributes.position.count);for(const key of ['position','normal','color'])assert(part.geometry.attributes[key].array.every(Number.isFinite),id+' invalid geometry');triangles+=(part.geometry.index?.count||part.geometry.attributes.position.count)/3;materials.add(part.material);});calls+=parts.length;
 }
 // Separate planted paws and hind hocks add moving batches; reduced cross-section
 // tessellation more than offsets them in triangle cost (v190: 37,648 triangles).
 assert(calls<=120,'articulated body batches exceeded budget');assert(triangles<31000,'regional templates exceeded the reduced mesh budget');assert.equal(materials.size,2);assert.equal(JSON.stringify(ENEMIES),rules);assert.equal(JSON.stringify(ENEMY_MOTION),motion);
});

test('warm regional construction reuses species fitting without repeating bounds traversal',()=>{
 for(const id of Object.keys(heights))make(id);
 const original=T.Box3.prototype.setFromObject;let calls=0;
 T.Box3.prototype.setFromObject=function(...args){calls++;return original.apply(this,args);};
 try{for(const id of Object.keys(heights))for(let i=0;i<3;i++){const g=make(id);assert(Math.abs(g.userData.combatHeight-heights[id])<1e-7);}}
 finally{T.Box3.prototype.setFromObject=original;}
 assert.equal(calls,0,'warm spawns traversed old and replacement geometries again');
});

test('regional anatomy has outward continuous sides, rounded shoulders and correctly oriented limb caps',()=>{
 const probes=[['frostwolf','Body',[1,.72,.05],[-1,0,0]],['ashstalker','Body',[1,.42,.0],[-1,0,0]],['yeti','Body',[1,1.05,0],[-1,0,0]],['yeti','upper',[1,-.1,0],[-1,0,0]],['lavabrute','UpperArm',[1,-.1,0],[-1,0,0]],['icewitch','CastingUpper',[1,-.1,0],[-1,0,0]]];
 for(const [id,part,origin,direction]of probes){const source=make(id).getObjectByName('SM_Enemy_'+id+'_'+part),mesh=new T.Mesh(source.geometry,source.material);mesh.updateMatrixWorld(true);const hit=new T.Raycaster(new T.Vector3(...origin),new T.Vector3(...direction)).intersectObject(mesh)[0];assert(hit&&hit.point.x>0,id+' '+part+' has an inward or missing near surface');assert(hit.face.normal.x>.15,id+' inward normal');}
 for(const id of ['yeti','lavabrute']){
  const source=make(id).getObjectByName('SM_Enemy_'+id+'_'+(id==='yeti'?'upper':'UpperArm')),mesh=new T.Mesh(source.geometry,source.material);mesh.updateMatrixWorld(true);
  const upper=new T.Raycaster(new T.Vector3(.002,1,0),new T.Vector3(0,-1,0)).intersectObject(mesh)[0],lower=new T.Raycaster(new T.Vector3(.002,-1,0),new T.Vector3(0,1,0)).intersectObject(mesh)[0];assert(upper?.point.y>.14);assert(lower?.point.y<-.49);assert(upper.face.normal.y>0&&lower.face.normal.y<0);
 }
});

test('all regional poses stay attached and finite through walking windup release water and reset',()=>{
 for(const id of Object.keys(heights)){
  const g=make(id),d=g.userData,live=new Set();g.traverse(o=>live.add(o));
  for(const p of [d.cap,d.head,d.jaw,d.smallTail,d.tail,d.tailTip,d.staff,d.focus,d.hem,...d.arms,...d.feet,...d.ears,...(d.cores||[])])if(p)assert(live.has(p),id+' detached animated part');
  for(let i=0;i<240;i++){d.waterDepth=i>160?.65:0;d.pounce=i>70&&i<95?(95-i)/25:0;animateActor(g,i/60,2.5,i%80<48?.8-i%80/60:0,i%43<7?.10:0);g.updateMatrixWorld(true);g.traverse(o=>assert(o.matrixWorld.elements.every(Number.isFinite),id+' invalid transform'));}
  d.previousAttack=.4;const pose=()=>animateRegionalAppearance(d,5,1,3,.6,.4,0);pose();const state=meshes(g).map(o=>{o.updateWorldMatrix(true,false);return [...o.matrixWorld.elements];});pose();assert.deepEqual(meshes(g).map(o=>{o.updateWorldMatrix(true,false);return [...o.matrixWorld.elements];}),state,id+' repeated pose accumulated');
  assert.deepEqual(g.position.toArray(),[0,0,0]);assert.deepEqual(g.scale.toArray(),[1,1,1]);
 }
});

test('four articulated species keep real supporting soles above the floor through a complete walk cycle',()=>{
 const v=new T.Vector3();
 for(const id of ['frostwolf','ashstalker','yeti','lavabrute']){
  const g=make(id),d=g.userData;d.previousAttack=0;
  for(let i=0;i<96;i++){
   const phase=i/96*Math.PI*2;animateRegionalAppearance(d,i/60,1,phase,0,0,0);g.updateMatrixWorld(true);
   for(const leg of d.legs){const mesh=leg.paw.children[0],positions=mesh.geometry.attributes.position;let min=Infinity;for(let p=0;p<positions.count;p++)min=Math.min(min,v.fromBufferAttribute(positions,p).applyMatrix4(mesh.matrixWorld).y);assert(min>-.003,id+' sole sunk '+min);const u=((phase+leg.phase)/(Math.PI*2)%1+1)%1;if(u<.64)assert(min<.017,id+' support foot floats '+min);}
  }
 }
});

test('regional casters keep wrists on real staff grips and spell sockets follow moving focuses',()=>{
 for(const id of ['icewitch','ashseer','snowtotem','cinderwisp']){
  const g=make(id),d=g.userData,socket=d.attackSocket;assert(socket&&socket.isObject3D);let travel=0,previous=new T.Vector3();
  for(let i=0;i<120;i++){
   d.previousAttack=.4;animateRegionalAppearance(d,i/60,1,i*.1,(i%60)/60,.3,0);g.updateMatrixWorld(true);const point=socket.getWorldPosition(new T.Vector3());if(i)travel+=point.distanceTo(previous);previous.copy(point);
   if(d.castingArm){const a=d.castingArm,elbow=new T.Vector3(0,-a.upperLength,0).applyQuaternion(a.upper.quaternion).add(a.upper.position),wrist=new T.Vector3(0,-a.lowerLength,0).applyQuaternion(a.forearm.quaternion).add(a.forearm.position),grip=new T.Vector3(-.015,.20,.02).applyMatrix4(d.staff.matrix);assert(elbow.distanceTo(a.forearm.position)<1e-7);assert(wrist.distanceTo(grip)<1e-7);}
  }
  assert(travel>.10,id+' spell socket stayed at a fixed actor center');
 }
});

test('regional rebuilds have different anatomy instead of sharing upright stacked silhouettes',()=>{
 const hare=make('snowhare').userData,wolf=make('frostwolf').userData,ape=make('yeti').userData,lizard=make('ashstalker').userData,lava=make('lavabrute').userData;
 assert.equal(hare.legs.length,4,'hare needs both planted forepaws and folded hind legs');
 assert.equal(hare.arms.length,0,'hare must not retain dangling humanoid arms');
 const hareBody=hare.regionalRoot.getObjectByName('SM_Enemy_snowhare_Body').geometry.boundingBox;
 assert(hareBody.max.z-hareBody.min.z>(hareBody.max.y-hareBody.min.y)*1.4,'hare back stopped being horizontal');
 assert(hare.cap.position.z>.40,'hare head should sit in front of the chest');
 assert.equal(wolf.legs.filter(l=>l.ankle).length,2,'wolf hind legs lost their articulated hocks');
 animateRegionalAppearance(wolf,0,0,0,0,0,0);
 for(const leg of wolf.legs.filter(l=>l.ankle))assert(leg.knee.position.z-leg.ankle.position.z>.15,'wolf thigh/shin straightened into a pole');
 assert.equal(ape.knuckles.length,2);assert(ape.head.position.z>.30,'ape head returned to an upright human neck');
 assert(ape.knuckles.every(l=>l.upperLength+l.lowerLength>1.35),'ape forelimbs lost their supporting reach');
 assert.equal(lava.knuckles.length,0,'furnace reused the ape support rig');
 assert(lizard.legs.every(l=>l.reach>.25),'lizard limbs stopped spreading beside the belly');
 assert.equal(lizard.ears.length,0,'lizard retained the old dog ears');
 for(const id of ['snowtotem','cinderwisp'])assert.equal(make(id).userData.cores.length,1,id+' returned to three stacked cores');
});

test('new limb carriers keep fixed links connected during swimming and unreachable long steps',()=>{
 const end=new T.Vector3(),target=new T.Vector3();
 for(const id of ['snowhare','emberling','frostwolf','ashstalker','yeti','lavabrute']){
  const g=make(id),d=g.userData;
  for(let i=0;i<240;i++){
   d.waterDepth=i>70&&i<150?.72:0;d.pounce=i>35&&i<57?(57-i)/22:0;
   animateActor(g,i/60,2.5,i%90<55?1-i%90/55:0,i%61<5?.1:0);g.updateMatrixWorld(true);
   for(const l of [...d.legs,...(d.knuckles||[])]){
    end.set(0,-l.upperLength,0).applyMatrix4(l.upper.matrixWorld);l.knee.getWorldPosition(target);
    assert(end.distanceTo(target)<1e-6,id+' upper segment detached from knee');
    end.set(0,-l.lowerLength,0).applyMatrix4(l.knee.matrixWorld);
    if(l.ankle)l.ankle.getWorldPosition(target);else target.set(0,.055,0).applyMatrix4(l.paw.matrixWorld);
    assert(end.distanceTo(target)<1e-6,id+' lower segment detached from paw/hock');
    if(l.ankle){end.set(0,-Math.hypot(l.drop,.095),0).applyMatrix4(l.ankle.matrixWorld);target.set(0,.055,0).applyMatrix4(l.paw.matrixWorld);assert(end.distanceTo(target)<1e-6,id+' metatarsal stopped above paw');}
   }
  }
 }
});
