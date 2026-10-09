import * as T from './vendor/three.module.js';
import {GRIP_POINTS} from './weapon-grips.js?v=114';

// First pass assembled from the equipped weapon and simple glove/cuff shapes.
// The camera must belong to the world scene. No extra scene pass or lights are used.
export class FirstPersonView {
 constructor(camera){
  this.camera=camera;this.root=new T.Group();this.root.name='First_person_equipment';this.root.visible=false;camera.add(this.root);
  this.materials=new Map();this.parts=[];this.ownedGeometry=[];this.gait=0;this.sway=0;this.disposed=false;
 }
 clear(){
  this.root.clear();for(const material of this.materials.values())material.dispose();for(const geometry of this.ownedGeometry)geometry.dispose();
  this.materials.clear();this.ownedGeometry.length=0;this.parts.length=0;this.weapon=null;this.source=null;this.root.visible=false;
 }
 material(source){
  if(this.materials.has(source))return this.materials.get(source);
  const m=source.clone();m.onBeforeCompile=source.onBeforeCompile;m.customProgramCacheKey=source.customProgramCacheKey;
  // Transparent render list + high order keeps even opaque steel after world mist/water.
  m.transparent=true;m.depthTest=false;m.depthWrite=false;m.fog=false;m.clippingPlanes=null;m.clipping=false;m.forceSinglePass=true;
  this.materials.set(source,m);return m;
 }
 copyPart(source){
  // Object3D.clone serializes userData; page/pump/heart references then cease to be meshes.
  // Weapons are ordinary Groups/Meshes, so copy only the render graph and keep a pose map.
  const node=source.isMesh?new T.Mesh(source.geometry,Array.isArray(source.material)?source.material.map(m=>this.material(m)):this.material(source.material)):new T.Group();
  node.name=source.name;node.position.copy(source.position);node.quaternion.copy(source.quaternion);node.scale.copy(source.scale);node.visible=source.visible;
  node.renderOrder=10000;node.frustumCulled=false;node.castShadow=node.receiveShadow=false;this.parts.push([source,node]);
  for(const child of source.children)node.add(this.copyPart(child));return node;
 }
 setHero(hero,weaponId){
  if(this.disposed)return;this.clear();this.weaponId=weaponId;this.source=hero?.userData?.gun||hero?.userData?.weapon;
  if(!this.source)return;
  this.weapon=new T.Group();this.weapon.name='First_person_weapon';this.model=new T.Group();this.weapon.add(this.model);
  for(const child of this.source.children)this.model.add(this.copyPart(child));
  this.model.updateMatrixWorld(true);const box=new T.Box3().setFromObject(this.model),size=box.getSize(new T.Vector3());
  if(box.isEmpty()){this.clear();return;}
  this.center=box.getCenter(new T.Vector3());this.dimensions=size;this.model.position.copy(this.center).negate();
  this.grip=new T.Vector3(...(GRIP_POINTS[weaponId]||[0,0,0])).sub(this.center);this.weapon.rotation.y=Math.PI;this.root.add(this.weapon);
  const gloveGeometry=new T.SphereGeometry(1,12,8),cuffGeometry=new T.CylinderGeometry(.8,1,2,10);this.ownedGeometry.push(gloveGeometry,cuffGeometry);
  const glove=new T.MeshStandardMaterial({color:0x242a30,roughness:.95,transparent:true,depthTest:false,depthWrite:false,fog:false});this.materials.set(glove,glove);
  this.hands=[];this.handPoints=[this.grip,new T.Vector3(...(weaponId==='grimoire'?[-.16,0,.06]:[0,-.035,weaponId==='harpoon'?.34:.30])).sub(this.center)];
  const support=['rifle','shotgun','crossbow','harpoon','grimoire'].includes(weaponId);
  for(let i=0;i<(support?2:1);i++){
   const hand=new T.Group();hand.name=i?'First_person_support_glove':'First_person_grip_glove';this.root.add(hand);
   const palm=new T.Mesh(gloveGeometry,glove);palm.scale.set(.026,.037,.028);hand.add(palm);
   const thumb=new T.Mesh(gloveGeometry,glove);thumb.position.set(i?-.024:.024,.011,-.009);thumb.scale.set(.011,.021,.014);thumb.rotation.z=i?.35:-.35;hand.add(thumb);
   const cuff=new T.Mesh(cuffGeometry,glove);cuff.scale.set(.030,.053,.032);cuff.rotation.x=Math.PI/2;cuff.position.set(0,-.022,.064);hand.add(cuff);
   hand.traverse(n=>{n.renderOrder=10001;n.castShadow=n.receiveShadow=false;n.frustumCulled=false;});this.hands.push(hand);
  }
  this.gait=0;this.sway=0;this.update(0,0,{visible:false});
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
  const depth=.78,halfH=Math.tan(T.MathUtils.degToRad(this.camera.fov||50)/2)*depth,halfW=halfH*(this.camera.aspect||1);
  const scale=Math.min(halfW*.78/Math.max(.001,this.dimensions.x),halfH*.95/Math.max(.001,this.dimensions.y),.30/Math.max(.001,this.dimensions.z),2.4);
  const phase=T.MathUtils.clamp((Number(attack)||0)/Math.max(.06,attackDuration||.18),0,1),kick=Math.sin(phase*Math.PI),book=this.weaponId==='grimoire',thrust=this.weaponId==='harpoon';
  this.root.position.set(halfW*(book?.02:.38)+Math.sin(this.gait)*.006*this.sway,-halfH*.46+Math.cos(this.gait*2)*.004*this.sway+kick*.008,-depth+(thrust?-.06:.028)*kick);
  this.root.rotation.set(0,0,Math.sin(this.gait)*.012*this.sway);this.weapon.scale.setScalar(scale);this.weapon.rotation.set(kick*(thrust?-.02:.08),Math.PI,book?Math.sin((Number(time)||0)*1.8)*.012:0);
  this.weapon.updateMatrix();
  for(let i=0;i<this.hands.length;i++){
   this.hands[i].position.copy(this.handPoints[i]).applyMatrix4(this.weapon.matrix);this.hands[i].position.y-=.024;this.hands[i].scale.setScalar(Math.min(1,halfW/.24));this.hands[i].visible=this.weapon.visible;
  }
 }
 dispose(){if(this.disposed)return;this.clear();this.root.removeFromParent();this.disposed=true;}
}
