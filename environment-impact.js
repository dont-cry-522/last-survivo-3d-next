import * as T from './vendor/three.module.js';
import {waterDepth} from './water.js?v=209';
import {onBridge} from './coast.js?v=209';
import {onIce} from './map-tactics.js?v=209';
import {bodyContact} from './adventure-combat.js?v=209';

// Visual units are metres/seconds; these profiles never apply damage or status.
export const ENVIRONMENT_IMPACTS={
 rifle:{mark:'puncture',color:0x382d21,size:.18,life:5,ripple:.38,splash:.48},
 shotgun:{mark:'puncture',color:0x443629,size:.23,life:5,ripple:.48,splash:.63},
 crossbow:{mark:'pierce',color:0x544432,size:.27,life:6,ripple:.34,splash:.82},
 shuriken:{mark:'slash',color:0x9bafa9,size:.37,life:5,ripple:.58,splash:.35},
 boomerang:{mark:'puncture',color:0x66573d,size:.32,life:4.5,ripple:.72,splash:.85},
 fire:{mark:'scorch',color:0x342419,size:.90,life:6,ripple:1.15,splash:.55,steam:true},
 dark:{mark:'rune',color:0x735388,size:.68,life:4,ripple:.95,splash:.32,shadow:true},
 shade:{mark:'slash',color:0x655d73,size:.48,life:4,ripple:.64,splash:.3,shadow:true},
 grimoire:{mark:'rune',color:0x6d627c,size:1.15,life:4,ripple:1.25,splash:.35,shadow:true},
 sporelantern:{mark:'stain',color:0x9baf52,size:.85,life:5,ripple:.95,splash:.55,poison:true},
 miasmalantern:{mark:'stain',color:0x7f5293,size:.90,life:5,ripple:1.05,splash:.65,poison:true}
};
const up=new T.Vector3(0,1,0),front=new T.Vector3(0,0,1);
export function impactProfile(weapon){
 const base=ENVIRONMENT_IMPACTS[weapon.kind||weapon.id];if(!base)return null;
 // A heavy slug makes one broader impact; a fan still consists of small pellets.
 const scale=weapon.pathId==='shotgun_slug'?1.55:weapon.pathId==='fire_blast'?1.2:1;
 return{...base,size:base.size*scale,ripple:base.ripple*scale,splash:base.splash*scale};
}
export function waterSurfaceAt(world,x,z){
 if(onBridge(world,x,z)||onIce(world,x,z))return null;
 for(const pond of world.ponds||[]){
  if(waterDepth(pond,x,z)<=.06)continue;
  const y=pond.mesh?.position.y??.075;
  if((world.groundHeightAt?.(x,z)||0)>y+.015)continue;
  return{x,y,z};
 }return null;
}
// A surface crossing, not proximity: flying over water does not create splashes.
export function waterCrossing(world,a,b){
 if(a.y<=b.y)return null;let nearest=null;
 for(const pond of world.ponds||[]){const y=pond.mesh?.position.y??.075,t=(a.y-y)/(a.y-b.y);
  if(t<0||t>1||nearest&&t>=nearest.t)continue;
  const x=a.x+(b.x-a.x)*t,z=a.z+(b.z-a.z)*t;
  if(waterDepth(pond,x,z)>.06&&waterSurfaceAt(world,x,z))nearest={x,y,z,t};
 }return nearest;
}
function markTexture(kind){
 if(typeof document==='undefined')return null;
 const canvas=document.createElement('canvas');canvas.width=canvas.height=128;const c=canvas.getContext('2d');
 const blob=(x,y,r,a)=>{const g=c.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,`rgba(255,255,255,${a})`);g.addColorStop(.55,`rgba(255,255,255,${a*.72})`);g.addColorStop(1,'rgba(255,255,255,0)');c.fillStyle=g;c.fillRect(x-r,y-r,r*2,r*2);};
 const stroke=(points,width,alpha)=>{c.strokeStyle=`rgba(255,255,255,${alpha})`;c.lineWidth=width;c.lineCap='round';c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.stroke();};
 if(kind==='puncture'||kind==='pierce'){blob(64,64,kind==='pierce'?13:24,.95);for(let i=0;i<6;i++){const a=i*2.4;stroke([[64,64],[64+Math.cos(a)*22,64+Math.sin(a)*22],[64+Math.cos(a+.1)*36,64+Math.sin(a+.1)*36]],1.8,.6);}if(kind==='pierce')stroke([[62,40],[67,88]],3,.9);}
 else if(kind==='slash'){stroke([[22,100],[53,66],[103,27]],4,.9);stroke([[45,98],[72,69],[106,56]],1.5,.45);}
 else if(kind==='rune'){stroke([[64,12],[38,56],[64,111],[86,61],[64,12]],2,.7);stroke([[22,67],[57,60],[73,76],[107,46]],3,.8);blob(64,64,38,.28);}
 else for(let i=0;i<11;i++){const a=i*2.39996,r=12+i*2.8;blob(64+Math.cos(a)*r,64+Math.sin(a)*r,kind==='scorch'?25:16+i%3*5,.28+i%3*.07);}
 const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;return texture;
}
export class EnvironmentImpacts{
 constructor(scene,vfx,{mobile=false}={}){
  this.scene=scene;this.vfx=vfx;this.limit=mobile?24:48;this.active=[];this.pool=[];this.textures=new Map();this.ray=new T.Raycaster();this.hits=[];this.sinceWater=1;
 }
 particle(...args){const mesh=this.vfx.particle(...args);if(mesh)this.vfx.active.at(-1).environmentImpact=true;return mesh;}
 // Intersect only the already accepted obstacle, never every scenery mesh per frame.
 contact(obstacle,a,b,radius=0){
  const fallback=bodyContact(a.x,a.y,a.z,b.x,b.y,b.z,obstacle,radius),direction=new T.Vector3().subVectors(b,a).normalize();
  if(!obstacle.mesh)return null;obstacle.mesh.updateWorldMatrix(true,true);
  this.ray.set(new T.Vector3(a.x,a.y,a.z),direction);this.ray.near=0;this.ray.far=Math.hypot(b.x-a.x,b.y-a.y,b.z-a.z)+(obstacle.r||1)*2;
  this.hits.length=0;this.ray.intersectObject(obstacle.mesh,true,this.hits);
  const visible=h=>{let n=h.object;while(n&&n!==obstacle.mesh){if(!n.visible)return false;n=n.parent;}return n?.visible&&h.face&&(!h.object.material?.transparent||h.object.material.opacity>.5);};
  let hit=this.hits.find(visible);
  // Collision cylinders intentionally envelop irregular trunks. A grazing bolt
  // can hit that envelope without crossing the narrower mesh: project inward
  // from the accepted body contact instead of leaving a mark floating in air.
  if(!hit){const n=new T.Vector3().copy(fallback.normal);this.ray.set(new T.Vector3(fallback.x,fallback.y,fallback.z).addScaledVector(n,.08),n.negate());this.ray.far=(obstacle.r||1)*2+.16;this.hits.length=0;this.ray.intersectObject(obstacle.mesh,true,this.hits);hit=this.hits.find(visible);}
  if(!hit)return null;const normal=hit.face.normal.clone().transformDirection(hit.object.matrixWorld);if(normal.dot(direction)>0)normal.negate();
  return{...fallback,x:hit.point.x,y:hit.point.y,z:hit.point.z,normal,direction,object:hit.object,obstacle};
 }
 ground(weapon,world,x,z){
  const water=waterSurfaceAt(world,x,z);if(water){this.water(weapon,water);return;}
  this.hit(weapon,{x,y:(world.groundHeightAt?.(x,z)||0)+.015,z,normal:up,direction:{x:0,y:-1,z:0},ground:world.groundHeightAt||(()=>0)});
 }
 hit(weapon,contact){
  const p=impactProfile(weapon);if(!p||!contact)return;
  const {x,y,z}=contact,normal=new T.Vector3().copy(contact.normal||up).normalize(),rotation=new T.Quaternion().setFromUnitVectors(front,normal);
  // Saturated fire leaves a small hot core, then a dark cooled mark.
  const color=weapon.kind==='fire'||weapon.id==='fire'?0xe5a25a:p.color;
  for(let i=0;i<3;i++){const velocity=new T.Vector3((i-1)*.6,.2+i*.25,.8).applyQuaternion(rotation);this.particle(p.poison?'droplet':'crystal',color,x,y,z,{life:.24+i*.05,size:[.025,.055,.025],velocity:velocity.toArray(),gravity:p.poison?2:4,additive:false,opacity:.75});}
  if(this.active.length>=this.limit)this.recycle(this.active.shift());
  const mesh=this.pool.pop()||new T.Mesh(new T.PlaneGeometry(1,1,4,4),new T.MeshBasicMaterial({transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2,side:T.DoubleSide,forceSinglePass:true}));
  if(!this.textures.has(p.mark))this.textures.set(p.mark,markTexture(p.mark));const texture=this.textures.get(p.mark);
  if(mesh.material.map!==texture){mesh.material.map=texture;mesh.material.needsUpdate=true;}mesh.material.color.set(p.mark==='scorch'?0xa85e32:p.color);mesh.material.opacity=.85;
  mesh.name='FX_Environment_'+p.mark;mesh.position.set(x,y,z);mesh.quaternion.identity();mesh.scale.setScalar(1);
  const attr=mesh.geometry.attributes.position,uv=mesh.geometry.attributes.uv,indices=[],valid=[];const point=new T.Vector3();
  for(let i=0;i<attr.count;i++){
   point.set((uv.getX(i)-.5)*p.size,(uv.getY(i)-.5)*p.size,0).applyQuaternion(rotation).add(mesh.position);
   let accepted=true;
   if(contact.ground)point.y=contact.ground(point.x,point.z)+.018;
   else if(contact.object){
    this.ray.set(point.clone().addScaledVector(normal,p.size+.08),normal.clone().negate());this.ray.near=0;this.ray.far=p.size*2+.16;this.hits.length=0;this.ray.intersectObject(contact.object,false,this.hits);
    const h=this.hits[0];accepted=!!h;if(h)point.copy(h.point).addScaledVector(normal,.012);
   }else point.addScaledVector(normal,.015);
   valid.push(accepted);point.sub(mesh.position);attr.setXYZ(i,point.x,point.y,point.z);
  }
  for(let row=0;row<4;row++)for(let col=0;col<4;col++){const a=row*5+col,b=a+1,c=a+5,d=c+1;for(const tri of[[a,c,b],[b,c,d]])if(tri.every(i=>valid[i]))indices.push(...tri);}
  mesh.geometry.index.array.set(indices);mesh.geometry.index.needsUpdate=true;mesh.geometry.setDrawRange(0,indices.length);attr.needsUpdate=true;mesh.geometry.computeBoundingSphere();this.scene.add(mesh);
  this.active.push({mesh,life:p.life,max:p.life,owner:contact.obstacle,object:contact.object,kind:weapon.kind||weapon.id,baseColor:new T.Color(p.color),hot:p.mark==='scorch'?new T.Color(0xa85e32):null});
 }
 water(weapon,point){
  const p=impactProfile(weapon);if(!p)return false;
  // One broad shotgun response per cluster, instead of nine overlapping splashes.
  if(this.lastWater&&this.sinceWater<.045&&Math.hypot(point.x-this.lastWater.x,point.z-this.lastWater.z)<.6)return false;
  this.lastWater={...point};this.sinceWater=0;const {x,y,z}=point,r=p.ripple,shade=p.shadow?0x8e83a5:p.poison?p.color:0xa3d3d4;
  for(let i=0;i<2;i++){const m=this.particle('ripple',i?shade:0xa0c8ca,x,y+.025+i*.008,z,{life:.65+i*.22,delay:i*.10,size:[r*(1+i*.3),r*(1+i*.3),1],opacity:.36-i*.07,additive:false,motion:'ripple',endColor:0x547d80});if(m)m.rotation.z=i*2.5;}
  for(let i=0;i<5;i++){const a=i*2.39996;this.particle('droplet',shade,x,y+.03,z,{life:.24+i*.026+p.splash*.15,size:[.014+i*.002,.025+i%2*.018,.014],velocity:[Math.sin(a)*r,1.1+p.splash*(.9+i%3*.6),Math.cos(a)*r],gravity:9,additive:false,opacity:.8});}
  const crest=this.particle('crest',shade,x,y+.02,z,{life:.32,size:[r*.40,p.splash*.45,r*.32],opacity:.28,additive:false,motion:'erupt'});if(crest)crest.rotation.y=Math.atan2(weapon.vx||0,weapon.vz||1);
  if(p.steam||p.poison||p.shadow){const m=this.particle('vapor',p.steam?0xc2d4d3:shade,x,y+.06,z,{life:p.steam?.9:.7,size:[r*.5,r*.35,1],velocity:[.05,p.steam?.45:.08,.02],opacity:p.steam?.32:.27,additive:false,grow:true});if(m&&p.steam)m.rotation.x=-.65;}
  return true;
 }
 update(dt){if(dt<=0)return;this.sinceWater+=dt;let n=0;for(const mark of this.active){mark.life-=dt;
   if(mark.life<=0||mark.owner&&(mark.owner.state&&mark.owner.state!=='standing'||!mark.owner.mesh?.parent)){this.recycle(mark);continue;}
   mark.mesh.material.opacity=.85*Math.min(1,mark.life/1.5);if(mark.hot)mark.mesh.material.color.copy(mark.baseColor).lerp(mark.hot,Math.max(0,1-(mark.max-mark.life)/.8));this.active[n++]=mark;
  }this.active.length=n;
 }
 recycle(mark){this.scene.remove(mark.mesh);this.pool.push(mark.mesh);}
 clear(){for(const mark of this.active)this.recycle(mark);this.active.length=0;this.lastWater=null;this.sinceWater=1;
  // Reuse the shared pool on victory/death as well as restart. Do not erase other skills.
  if(this.vfx.active){let n=0;for(const p of this.vfx.active){if(p.environmentImpact){this.scene.remove(p.mesh);this.vfx.pool.push(p.mesh);}else this.vfx.active[n++]=p;}this.vfx.active.length=n;}
 }
 dispose(){this.clear();for(const mesh of this.pool){mesh.geometry.dispose();mesh.material.dispose();}this.pool.length=0;for(const texture of this.textures.values())texture?.dispose();this.textures.clear();}
}
