import * as T from './vendor/three.module.js';
import {GRIP_POINTS} from './weapon-grips.js?v=114';

import {mergeGeometries} from './vendor/BufferGeometryUtils.js';
import {weaponGesture,WEAPON_RECOVERY} from './weapon-performance.js?v=114';

// Camera-space equipment assembled from the actual weapon plus a small procedural hand rig.
// This is not a new authored arm-animation asset. Layer 1 gets a small depth-correct overlay pass.
const PALETTES={
 scout:[0x344f3e,0x73543a,0xb29159,0xc39879],silver:[0x25354c,0x202a38,0x91acbf,0xe1c5b1],
 wraith:[0x292c38,0x181c26,0x758699,0x8895a3],tide:[0x305f68,0x293e45,0xafad80,0xbe9f84],
 lingya:[0x6e634f,0x594335,0xc9a279,0xe8bda2],wuling:[0x47334f,0x362639,0xb08b69,0xdbbca7],mirage:[0x30213f,0x231c30,0xa49db8,0xdacade]
};
const PROFILES={
 rifle:{type:'gun',width:.85,height:1,depth:.62,x:.38,y:-.48,pitch:.025,support:[0,-.045,.34]},
 shotgun:{type:'gun',width:.85,height:1,depth:.65,x:.38,y:-.49,pitch:.015,support:[0,-.025,.34]},
 crossbow:{type:'bow',width:.87,height:1,depth:.55,x:.30,y:-.46,pitch:.08,support:[0,-.05,.26]},
 fire:{type:'staff',width:.64,height:1.36,depth:.40,x:.64,y:-.25,pitch:.04},
 dark:{type:'staff',width:.64,height:1.36,depth:.40,x:.64,y:-.25,pitch:.04},
 shuriken:{type:'throw',width:.58,height:.85,depth:.44,x:.56,y:-.57,pitch:.60},
 boomerang:{type:'throw',width:.73,height:1,depth:.48,x:.46,y:-.48,pitch:.72},
 shadowblade:{type:'throw',width:.72,height:1,depth:.47,x:.48,y:-.47,pitch:.50},
 shade:{type:'palm',width:.42,height:.72,depth:.35,x:.42,y:-.48,pitch:.12},
 grimoire:{type:'book',width:.74,height:.66,depth:.44,x:.01,y:-.47,pitch:.42,grip:[-.15,.01,.065],support:[.16,.01,.065]},
 harpoon:{type:'thrust',width:.74,height:1,depth:.70,x:.40,y:-.55,pitch:.10,support:[0,0,.37]},
 sporelantern:{type:'lamp',width:.64,height:1.08,depth:.36,x:.58,y:-.40,pitch:.01},
 miasmalantern:{type:'lamp',width:.62,height:1.08,depth:.36,x:.58,y:-.40,pitch:.01}
};
const CONTACT=new T.Vector3(0,.045,-.023),UP=new T.Vector3(0,1,0);
function colored(geometry,color){const c=new T.Color(color),p=geometry.attributes.position,values=[];for(let i=0;i<p.count;i++)values.push(c.r,c.g,c.b);geometry.setAttribute('color',new T.Float32BufferAttribute(values,3));geometry.deleteAttribute('uv');return geometry;}
function handGeometry(palette,fingerless){
 const make=open=>{
  const parts=[];
  // Palm, heel of thumb and knuckle web overlap into a solid glove instead of five hollow loops.
  for(const [scale,position]of[[[.036,.046,.021],[0,.003,0]],[[.027,.028,.018],[0,.019,-.014]],[[.016,.025,.017],[-.026,0,-.006]],[[.032,.012,.013],[0,.036,-.003]]]){
   const pad=new T.SphereGeometry(1,12,8);pad.scale(...scale);pad.translate(...position);parts.push(colored(pad,palette[1]));
  }
  for(let finger=0;finger<5;finger++){
   let points,radius;
   if(finger===4){points=open?[[-.028,-.015,0],[-.046,.003,-.005],[-.057,.022,-.008],[-.060,.030,-.012]]:[[-.028,-.013,0],[-.038,.008,-.018],[-.026,.026,-.035],[-.013,.023,-.038]];radius=.010;}
   else{
    const x=(-1.5+finger)*.0165,length=[.052,.059,.055,.043][finger],spread=open?(finger-1.5)*.008:0;
    points=open?[[x,.028,0],[x+spread*.4,.028+length*.4,-.002],[x+spread,.028+length*.78,-.005],[x+spread*1.1,.028+length,-.010]]:[[x,.028,0],[x,.049,-.009],[x,.050,-.026],[x,.027,-.034]];radius=finger===3?.008:.009;
   }
   const g=new T.TubeGeometry(new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p))),8,radius,7,false);colored(g,palette[1]);
   if(fingerless){const c=new T.Color(palette[3]),colors=g.attributes.color;for(let i=5*8;i<colors.count;i++)colors.setXYZ(i,c.r,c.g,c.b);}
   parts.push(g);const tip=new T.SphereGeometry(radius,7,5);tip.translate(...points.at(-1));parts.push(colored(tip,fingerless?palette[3]:palette[1]));
  }
  const merged=mergeGeometries(parts,false);parts.forEach(g=>g.dispose());return merged;
 };
 const closed=make(false),open=make(true);closed.morphAttributes.position=[open.attributes.position];closed.morphAttributes.normal=[open.attributes.normal];closed.computeBoundingSphere();open.dispose();return closed;
}
function sleeveGeometry(palette){
 const vertices=[],colors=[],indices=[],color=new T.Color(),rings=8,sides=12;
 for(let i=0;i<=rings;i++){
  const t=i/rings,r=.057*(1-t)+.032*t+.008*Math.sin(t*Math.PI),bend=.018*Math.sin(t*Math.PI);
  color.setHex(i>=7?palette[1]:i===6?palette[2]:palette[0]);
  for(let j=0;j<sides;j++){const a=j/sides*Math.PI*2,crease=1+.035*Math.sin(a*3+t*9);vertices.push(Math.cos(a)*r*crease+bend,t,Math.sin(a)*r*.84*crease);colors.push(color.r,color.g,color.b);}
 }
 for(let i=0;i<rings;i++)for(let j=0;j<sides;j++){const a=i*sides+j,b=i*sides+(j+1)%sides;indices.push(a,a+sides,b,b,a+sides,b+sides);}
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(vertices,3));g.setAttribute('color',new T.Float32BufferAttribute(colors,3));g.setIndex(indices);g.computeVertexNormals();return g;
}
function hullGeometry(rings,directions){
 const p=[],index=[],edge=[[-.35,-.5],[.35,-.5],[.5,-.32],[.5,.32],[.35,.5],[-.35,.5],[-.5,.32],[-.5,-.32]];
 for(let i=0;i<rings.length;i++){const [x,y,z,width,height]=rings[i],axis=directions?.[i];for(const [u,v]of edge)p.push(x+u*width*(axis?.x??1),y+v*height,z+u*width*(axis?.z??0));}
 for(let i=0;i<rings.length-1;i++)for(let j=0;j<8;j++){const a=i*8+j,b=i*8+(j+1)%8;index.push(a,b,a+8,b,b+8,a+8);}
 for(const end of[0,rings.length-1]){const n=p.length/3;p.push(...rings[end].slice(0,3));for(let j=0;j<8;j++){const a=end*8+j,b=end*8+(j+1)%8;index.push(...(end?[n,a,b]:[n,b,a]));}}
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setIndex(index);g.computeVertexNormals();return g;
}
function crossbowDetail(source,gun){
 if(source.geometry.type!=='BoxGeometry')return null;
 let geometry,name;
 if(source.parent===gun&&source.scale.x>.3){
  const side=Math.sign(source.position.x),curve=new T.CatmullRomCurve3([[0,.11,.42],[side*.16,.115,.463],[side*.32,.118,.432],[side*.44,.11,.36]].map(p=>new T.Vector3(...p))),rings=[],directions=[];
  // Curved tapered spring limbs keep their tips on the original animated string anchors.
  for(let i=0;i<=8;i++){const t=i/8,c=curve.getPoint(t),axis=curve.getTangent(t);rings.push([c.x,c.y,c.z,.040-.025*t,.020-.009*t]);directions.push(new T.Vector3(axis.z,0,-axis.x).normalize());}
  geometry=hullGeometry(rings,directions);
  geometry.applyMatrix4(new T.Matrix4().compose(source.position,source.quaternion,source.scale).invert());name='recurved-limb';
 }else if(source.parent===gun&&(source.scale.z>.3||source.scale.y>.15)){
  geometry=hullGeometry([[0,0,-.5,.76,.78],[0,0,-.30,1,1],[0,.035,.27,.87,.87],[0,.045,.5,.59,.62]]);
  if(source.scale.y>.15)geometry.rotateX(Math.PI/2);name=source.scale.y>.15?'shaped-grip':'beveled-receiver';
 }else if(source.parent===gun.userData.crossbowBolt){
  geometry=new T.CylinderGeometry(.5,.5,1,8);geometry.rotateX(Math.PI/2);name='round-bolt';
 }
 if(geometry)geometry.name='First_person_'+name;return geometry;
}
export class FirstPersonView {
 constructor(camera){
  this.camera=camera;this.root=new T.Group();this.root.name='First_person_equipment';this.root.layers.set(1);this.root.visible=false;camera.add(this.root);
  this.materials=new Map();this.parts=[];this.ownedGeometry=[];this.gait=0;this.sway=0;this.disposed=false;this.scratch=new T.Vector3();this.wrist=new T.Vector3();this.elbow=new T.Vector3();
 }
 clear(){
  this.root.clear();for(const material of this.materials.values())material.dispose();for(const geometry of this.ownedGeometry)geometry.dispose();
  this.materials.clear();this.ownedGeometry.length=0;this.parts.length=0;this.weapon=null;this.model=null;this.source=null;this.hero=null;this.hands=[];this.arms=[];this.handPoints=[];this.bowStrings=[];this.root.visible=false;
 }
 material(source){
  if(this.materials.has(source))return this.materials.get(source);
  const m=source.clone();m.onBeforeCompile=source.onBeforeCompile;m.customProgramCacheKey=source.customProgramCacheKey;
  // Preserve the real material's depth/alpha rules inside the isolated equipment layer.
  m.fog=false;m.clippingPlanes=null;m.clipping=false;m.forceSinglePass=true;
  this.materials.set(source,m);return m;
 }
 copyPart(source){
  // Object3D.clone serializes userData; page/pump/heart references then cease to be meshes.
  // Weapons are ordinary Groups/Meshes, so copy only the render graph and keep a pose map.
  const detail=source.isMesh&&this.weaponId==='crossbow'?crossbowDetail(source,this.source):null;if(detail)this.ownedGeometry.push(detail);
  const node=source.isMesh?new T.Mesh(detail||source.geometry,Array.isArray(source.material)?source.material.map(m=>this.material(m)):this.material(source.material)):new T.Group();
  node.name=source.name;node.position.copy(source.position);node.quaternion.copy(source.quaternion);node.scale.copy(source.scale);node.visible=source.visible;
  node.layers.set(1);node.renderOrder=10000;node.frustumCulled=false;node.castShadow=node.receiveShadow=false;this.parts.push([source,node]);
  for(const child of source.children)node.add(this.copyPart(child));return node;
 }
 setHero(hero,weaponId){
  if(this.disposed)return;this.clear();this.hero=hero;this.weaponId=weaponId;this.profile=PROFILES[weaponId]||PROFILES.rifle;this.source=hero?.userData?.gun||hero?.userData?.weapon;
  if(!this.source)return;
  this.weapon=new T.Group();this.weapon.name='First_person_weapon';this.model=new T.Group();this.weapon.add(this.model);
  for(const child of this.source.children)this.model.add(this.copyPart(child));
  this.bowStrings=(this.source.userData.crossbowStrings||[]).map(source=>[source,this.parts.find(([part])=>part===source)?.[1]]);
  this.model.updateMatrixWorld(true);const box=new T.Box3(),partBox=new T.Box3();
  // The bow's unposed string starts as a unit cylinder. Its authored limbs/rail define framing.
  for(const [source,clone]of this.parts)if(clone.isMesh&&!this.source.userData.crossbowStrings?.includes(source)){if(!clone.geometry.boundingBox)clone.geometry.computeBoundingBox();box.union(partBox.copy(clone.geometry.boundingBox).applyMatrix4(clone.matrixWorld));}
  const size=box.getSize(new T.Vector3());
  if(box.isEmpty()){this.clear();return;}
  this.center=box.getCenter(new T.Vector3());this.dimensions=size;this.model.position.copy(this.center).negate();
  this.grip=new T.Vector3(...(this.profile.grip||GRIP_POINTS[weaponId]||[0,0,0])).sub(this.center);this.root.add(this.weapon);
  const inferred=['shade','shadowblade','grimoire'].includes(weaponId)?'wraith':weaponId==='miasmalantern'?'mirage':weaponId==='sporelantern'?'wuling':weaponId==='boomerang'?'lingya':weaponId==='harpoon'?'tide':['crossbow','shuriken','dark'].includes(weaponId)?'silver':'scout';
  this.kind=hero.userData.kind||inferred;const palette=PALETTES[this.kind]||PALETTES.scout;
  const hand=handGeometry(palette,['scout','lingya','tide','wuling'].includes(this.kind)),sleeve=sleeveGeometry(palette);this.ownedGeometry.push(hand,sleeve);
  const cloth=new T.MeshStandardMaterial({vertexColors:true,roughness:.88,fog:false});this.materials.set(cloth,cloth);
  this.hands=[];this.arms=[];this.handPoints=[this.grip,new T.Vector3(...(this.profile.support||[-.20,-.07,.08])).sub(this.center)];
  for(let i=0;i<2;i++){
   const mesh=new T.Mesh(hand,cloth);mesh.name=i?'First_person_support_hand':'First_person_grip_hand';this.root.add(mesh);this.hands.push(mesh);
   const arm=new T.Mesh(sleeve,cloth);arm.name=i?'First_person_left_sleeve':'First_person_right_sleeve';this.root.add(arm);this.arms.push(arm);
   for(const node of[mesh,arm]){node.layers.set(1);node.renderOrder=10000;node.frustumCulled=false;node.castShadow=node.receiveShadow=false;}
  }
  this.gait=0;this.sway=0;this.attackAge=10;this.previousAttack=0;this.update(0,0,{visible:false});
 }
 update(time,dt,{moving=0,attack=0,attackDuration=.18,visible=false}={}){
  if(this.disposed||!this.weapon)return;this.root.visible=!!visible;if(!visible)return;
  const step=Math.max(0,Math.min(.05,Number.isFinite(dt)?dt:0)),speed=T.MathUtils.clamp(Number(moving)||0,0,1);
  this.sway+=(speed-this.sway)*(1-Math.exp(-step*10));this.gait+=step*speed*8;
  for(const [source,node]of this.parts){node.position.copy(source.position);node.quaternion.copy(source.quaternion);node.scale.copy(source.scale);node.visible=source.visible;}
  this.weapon.visible=this.source.visible;
  for(const [source,m]of this.materials){
   if(source===m)continue;m.opacity=source.opacity;
   // Shader strips share geometry but retain independent material/uniform containers.
   if(source.uniforms)for(const [key,uniform]of Object.entries(source.uniforms))if(m.uniforms[key]){const from=uniform.value,to=m.uniforms[key].value;if(to?.copy&&from?.constructor===to.constructor)to.copy(from);else if(typeof from!=='object'||from?.isTexture)m.uniforms[key].value=from;}
  }
  const profile=this.profile,id=this.weaponId,data=this.hero.userData,depth=.82,halfH=Math.tan(T.MathUtils.degToRad(this.camera.fov||50)/2)*depth,halfW=halfH*(this.camera.aspect||1);
  const scale=Math.min(halfW*profile.width/Math.max(.001,this.dimensions.x),halfH*profile.height/Math.max(.001,this.dimensions.y),profile.depth/Math.max(.001,this.dimensions.z),id==='shade'?1.8:2.4);
  const fired=attack>this.previousAttack+.025;this.previousAttack=attack;this.attackAge=fired?0:this.attackAge+step;
  const age=Number.isFinite(data.attackAge)?data.attackAge:this.attackAge,period=data.reloadDuration||WEAPON_RECOVERY[id]||attackDuration,cycle=Number.isFinite(data.reloadPhase)?data.reloadPhase:Math.min(1,age/period),motion=weaponGesture(id,age,cycle,period),kick=motion.kick,sweep=motion.sweep,draw=motion.draw;
  this.motion=motion;
  // Third-person string posing begins only in the aiming layer. Before that, its
  // authored unit cylinders are not a valid bow pose; initialize only the clones.
  for(let i=0;i<this.bowStrings.length;i++){
   const [source,clone]=this.bowStrings[i];
   if(!clone||source.position.lengthSq()>1e-10||Math.abs(source.scale.y-1)>1e-6)continue;
   this.wrist.set(i?.44:-.44,.11,.36);this.scratch.set(0,.12,.29-.34*draw).sub(this.wrist);
   clone.position.copy(this.wrist).addScaledVector(this.scratch,.5);clone.scale.y=this.scratch.length();clone.quaternion.setFromUnitVectors(UP,this.scratch.normalize());
  }
  this.root.position.set(halfW*profile.x*(this.camera.aspect<.8?.88:1)+Math.sin(this.gait)*.009*this.sway,halfH*profile.y+Math.cos(this.gait*2)*.005*this.sway,-depth);
  this.root.rotation.set(0,0,Math.sin(this.gait)*.010*this.sway);
  this.weapon.scale.setScalar(scale);this.weapon.position.set(0,0,0);this.weapon.rotation.set(profile.pitch,Math.PI-.045,0);
  if(profile.type==='gun'||profile.type==='bow'){
   this.weapon.position.z=kick*(id==='shotgun'?.075:.035);this.weapon.rotation.x+=kick*(id==='shotgun'?.17:.075);this.weapon.rotation.z-=draw*.045;
  }else if(profile.type==='thrust'){
   this.weapon.position.z=-.17*kick;this.weapon.position.y=kick*.025;this.weapon.rotation.x-=sweep*.12;
  }else if(profile.type==='throw'){
   this.weapon.position.set(-.11*sweep,.055*kick,-.11*kick);this.weapon.rotation.z=-sweep*.62;this.weapon.rotation.x-=kick*.34;
  }else if(profile.type==='lamp'){
   this.weapon.rotation.z=Math.sin((Number(time)||0)*1.7)*(.035+.025*this.sway)+sweep*.20;this.weapon.position.set(-sweep*.035,kick*.085,-kick*.055);
  }else if(profile.type==='book'){
   this.weapon.rotation.x+=kick*.10;this.weapon.rotation.z=Math.sin((Number(time)||0)*1.8)*.018;this.weapon.position.y=kick*.035;
  }else{
   this.weapon.rotation.x-=kick*.22;this.weapon.rotation.z=sweep*.10;this.weapon.position.z=-kick*.065;
  }
  this.weapon.updateMatrix();
  const handScale=T.MathUtils.clamp(halfW/.29,.66,1.10),support=!!profile.support;
  for(let i=0;i<2;i++){
   const hand=this.hands[i],arm=this.arms[i],point=this.scratch.copy(this.handPoints[i]);
   if(i&&id==='shotgun')point.z+=this.source.userData.pump?.position.z||0;
   if(i&&id==='crossbow')point.lerp(this.wrist.set(.085,.13,.30-.28*draw).sub(this.center),Math.min(1,draw*2.2));
   point.applyMatrix4(this.weapon.matrix);
   if(i&&!support)point.set(-halfW*.48-this.root.position.x,-halfH*.72-this.root.position.y+kick*.045,.11-kick*.06);
   hand.rotation.set(i?(support?-.30:-.45):-.18,i?-.20:.12,i?(support?-.38:.18):-.38);
   if(profile.type==='book')hand.rotation.set(-.75,i?-.20:.20,i?.55:-.55);
   if(profile.type==='lamp'&&!i)hand.rotation.set(-.12,0,-.92);
   if(profile.type==='palm'&&!i)hand.rotation.set(-.52,.10,-.08);
   hand.scale.set(i?-handScale:handScale,handScale,handScale);
   hand.position.copy(point).sub(this.wrist.copy(CONTACT).multiply(hand.scale).applyQuaternion(hand.quaternion));
   hand.morphTargetInfluences[0]=i&&!support?.72+.20*kick:profile.type==='palm'?.78+.18*kick:profile.type==='book'?.48:profile.type==='throw'?Math.max(kick*.90,this.source.visible?0:.88):i&&id==='crossbow'?draw*.40:0;
   // The arms remain after a thrown weapon leaves the hand; only the source weapon is hidden.
   hand.visible=arm.visible=true;
   this.wrist.set(0,-.038,0).multiply(hand.scale).applyQuaternion(hand.quaternion).add(hand.position);
   this.elbow.set(halfW*(i?-.30:.66)-this.root.position.x,-halfH*1.15-this.root.position.y,.35);
   arm.position.copy(this.elbow);this.scratch.copy(this.wrist).sub(this.elbow);const length=this.scratch.length();
   arm.quaternion.setFromUnitVectors(UP,this.scratch.normalize());arm.scale.set(handScale,length,handScale);
  }
 }

 render(renderer,scene){
  if(this.disposed||!this.root.visible||!this.weapon)return;
  const mask=this.camera.layers.mask,background=scene.background,autoClear=renderer.autoClear;
  try{this.camera.layers.set(1);scene.background=null;renderer.autoClear=false;renderer.clearDepth();renderer.render(scene,this.camera);}
  finally{this.camera.layers.mask=mask;scene.background=background;renderer.autoClear=autoClear;}
 }
 dispose(){if(this.disposed)return;this.clear();this.root.removeFromParent();this.disposed=true;}
}
