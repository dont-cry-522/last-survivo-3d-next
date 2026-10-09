import * as T from './vendor/three.module.js';

// One shared bottom-anchored card, three materials per existing flame texture.
// World cleanup must leave these shared resources (and the borrowed texture) alive.
const geometry=new T.PlaneGeometry(1,1).translate(0,.5,0),materials=new WeakMap();
const widths=[.49,.43,.35],heights=[.72,.62,.50],colors=[0xff9956,0xffc57a,0xffdba0],opacities=[.54,.48,.36];
function flameMaterials(texture){
 if(!materials.has(texture))materials.set(texture,colors.map((color,i)=>new T.MeshBasicMaterial({map:texture,color,transparent:true,opacity:opacities[i],side:T.DoubleSide,forceSinglePass:true,depthWrite:false,depthTest:true,fog:true})));
 return materials.get(texture);
}

export function installAdventureCampfire(world,flameTexture){
 if(!world?.fire||!flameTexture?.isTexture)return null;
 const surfaces=flameMaterials(flameTexture),existing=world.adventureCampfire;
 if(existing?.parent===world.fire){for(let i=0;i<3;i++)existing.children[i].material=surfaces[i];return existing;}
 world.fire.traverse(o=>{
  if(!o.isMesh||o.geometry.type!=='ConeGeometry')return;
  const sources=Array.isArray(o.material)?o.material:[o.material];
  if(sources.some(m=>m.emissive?.getHex()>0&&m.emissiveIntensity>0))o.visible=false;
 });
 const group=new T.Group();group.name='adventure-campfire';group.userData.phase=world.fire.position.x*.13+world.fire.position.z*.19;
 for(let i=0;i<3;i++){
  const flame=new T.Mesh(geometry,surfaces[i]);flame.name='campfire-soft-flame-'+i;flame.castShadow=flame.receiveShadow=false;group.add(flame);
 }
 world.fire.add(group);world.adventureCampfire=group;updateAdventureCampfire(world,0);return group;
}

export function updateAdventureCampfire(world,time){
 const group=world?.adventureCampfire;if(!group||!Number.isFinite(time))return;
 for(let i=0;i<3;i++){
  const flame=group.children[i],phase=group.userData.phase+i*1.77;
  flame.position.set(Math.sin(time*1.8+phase)*.012,-.025,Math.cos(time*1.6+phase)*.012);
  flame.rotation.set(Math.sin(time*2.3+phase)*.025,i*Math.PI/3,Math.sin(time*3.1+phase)*.045,'YXZ');
  flame.scale.set(widths[i]*(1+Math.sin(time*3.7+phase)*.045),heights[i]*(1+Math.sin(time*3.3+phase)*.06+Math.sin(time*8.1+phase)*.025),1);
 }
}
