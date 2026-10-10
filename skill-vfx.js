import{meleeSwing}from'./weapon-performance.js?v=129';
import{boneBoomerang}from'./beast-model.js?v=114';
import * as T from './vendor/three.module.js';
import{shadowCrescentGeometry}from'./shadow-weapons.js?v=114';
import{spellShapes,streakTexture,crestTexture}from'./spell-shapes.js?v=114';

function flameTexture(){
 if(typeof document==='undefined')return null;
 const canvas=document.createElement('canvas');canvas.width=128;canvas.height=256;const c=canvas.getContext('2d');
 const gradient=c.createLinearGradient(0,0,0,256);gradient.addColorStop(0,'rgba(255,255,255,0)');gradient.addColorStop(.25,'rgba(255,255,255,.55)');gradient.addColorStop(.58,'rgba(255,255,255,.95)');gradient.addColorStop(.8,'rgba(255,255,255,.85)');gradient.addColorStop(1,'rgba(255,255,255,0)');
 c.filter='blur(2px)';c.fillStyle=gradient;c.beginPath();c.moveTo(12,245);c.bezierCurveTo(4,191,47,172,24,113);c.bezierCurveTo(65,140,29,151,57,164);c.bezierCurveTo(42,105,94,85,67,9);c.bezierCurveTo(122,76,68,122,91,153);c.bezierCurveTo(116,133,107,106,116,91);c.bezierCurveTo(139,159,104,160,119,215);c.lineTo(108,256);c.closePath();c.fill();return new T.CanvasTexture(canvas);
}
function shadowTexture(){
 if(typeof document==='undefined')return null;
 const canvas=document.createElement('canvas');canvas.width=canvas.height=64;const c=canvas.getContext('2d'),gradient=c.createRadialGradient(32,32,4,32,32,31);
 gradient.addColorStop(0,'rgba(255,255,255,.8)');gradient.addColorStop(.42,'rgba(255,255,255,.62)');gradient.addColorStop(.78,'rgba(255,255,255,.2)');gradient.addColorStop(1,'rgba(255,255,255,0)');
 c.fillStyle=gradient;c.fillRect(0,0,64,64);return new T.CanvasTexture(canvas);
}
function vaporTexture(){
 if(typeof document==='undefined')return null;
 const canvas=document.createElement('canvas');canvas.width=canvas.height=128;const c=canvas.getContext('2d');
 // Uneven overlapping lobes read as drifting material rather than a circular decal.
 for(let i=0;i<7;i++){const a=i*2.39996,d=12+i*2.5,x=64+Math.cos(a)*d,y=64+Math.sin(a)*d*.7,r=23+(i%3)*5,g=c.createRadialGradient(x,y,2,x,y,r);g.addColorStop(0,'rgba(255,255,255,.25)');g.addColorStop(.5,'rgba(255,255,255,.13)');g.addColorStop(1,'rgba(255,255,255,0)');c.fillStyle=g;c.fillRect(0,0,128,128);}
 return new T.CanvasTexture(canvas);
}

// Optional final contact argument: {x,y,z,normal,direction,compact}. Direction
// points into the target; normal points out. Missing fields keep the legacy yaw/height.
function contactFrame(x,z,angle,contact,y){
 const valid=v=>v&&[v.x,v.y,v.z].every(Number.isFinite),a=Number.isFinite(angle)?angle:0;
 const forward=new T.Vector3(Math.sin(a),0,Math.cos(a));
 if(valid(contact?.direction)&&Math.hypot(contact.direction.x,contact.direction.y,contact.direction.z)>1e-6)forward.copy(contact.direction).normalize();
 const normal=forward.clone().negate();
 if(valid(contact?.normal)&&Math.hypot(contact.normal.x,contact.normal.y,contact.normal.z)>1e-6)normal.copy(contact.normal).normalize();
 const side=new T.Vector3().crossVectors(new T.Vector3(0,1,0),normal);
 if(side.lengthSq()<1e-6)side.set(Math.cos(a),0,-Math.sin(a));side.normalize();
 const up=new T.Vector3().crossVectors(normal,side).normalize(),scale=contact?.compact?.62:1;
 const center=new T.Vector3(Number.isFinite(contact?.x)?contact.x:x,Number.isFinite(contact?.y)?contact.y:y,Number.isFinite(contact?.z)?contact.z:z);
 if(contact)center.addScaledVector(normal,.018);
 return{scale,compact:!!contact?.compact,rotation:new T.Quaternion().setFromRotationMatrix(new T.Matrix4().makeBasis(side,up,normal)),
  at:(s=0,u=0,out=0)=>center.clone().addScaledVector(side,s*scale).addScaledVector(up,u*scale).addScaledVector(normal,out*scale),
  velocity:(s=0,u=0,out=0)=>side.clone().multiplyScalar(s*scale).addScaledVector(up,u*scale).addScaledVector(normal,out*scale).toArray()};
}

// A bounded mesh pool keeps spell bursts cheap and reuses both geometry and materials.
export class SkillVFX{
 constructor(scene,{mobile=false}={}){
  this.scene=scene;this.limit=mobile?110:190;this.active=[];this.pool=[];this.materials=new Map();
  this.crestTexture=crestTexture();
  this.flameTexture=flameTexture();this.shadowTexture=shadowTexture();this.vaporTexture=vaporTexture();this.streakTexture=streakTexture();this.geometry={...spellShapes(),ribbon:new T.PlaneGeometry(1,1),droplet:new T.SphereGeometry(1,10,6),stone:new T.DodecahedronGeometry(1,0),waterArc:new T.RingGeometry(.89,1,24,1,Math.PI*.12,Math.PI*.76),ember:new T.IcosahedronGeometry(1,0),crystal:new T.ConeGeometry(1,2,5),flame:new T.PlaneGeometry(2,2),veil:new T.PlaneGeometry(2,2),vapor:new T.PlaneGeometry(2,2),smoke:new T.SphereGeometry(1,7,5),ray:new T.BoxGeometry(1,1,1)};
 }
 particle(shape,color,x,y,z,{life=.4,size=[.1,.1,.1],velocity=[0,0,0],opacity=.9,additive=true,grow=false,gravity=0,spin=0,orbit=null,priority=0,motion='',roll=0,delay=0,endColor=null}={}){
  if(this.active.length>=this.limit){let victim=-1,lowest=priority;for(let i=0;i<this.active.length;i++)if(this.active[i].priority<lowest){victim=i;lowest=this.active[i].priority;if(lowest===0)break;}if(victim<0)return null;const old=this.active.splice(victim,1)[0];this.scene.remove(old.mesh);this.pool.push(old.mesh);}
  const mesh=this.pool.pop()||new T.Mesh(this.geometry.ember,new T.MeshBasicMaterial({transparent:true,depthWrite:false,side:T.DoubleSide}));
  mesh.geometry=this.geometry[shape];mesh.material.color.set(color);mesh.material.opacity=opacity;mesh.material.blending=additive?T.AdditiveBlending:T.NormalBlending;
  // These are open sheets: a second transparent back-face pass cannot add volume.
  // Reset on every checkout, because the same mesh may next become a closed shard.
  mesh.material.forceSinglePass=['flame','veil','vapor','crest','sweep','claw','waterArc','ribbon'].includes(shape);
  const map=shape==='flame'?this.flameTexture:shape==='veil'?this.shadowTexture:shape==='vapor'?this.vaporTexture:shape==='crest'?this.crestTexture:['sweep','claw','ribbon'].includes(shape)?this.streakTexture:null;if(mesh.material.map!==map){mesh.material.map=map;mesh.material.needsUpdate=true;}const vertexColors=shape==='shard';if(mesh.material.vertexColors!==vertexColors){mesh.material.vertexColors=vertexColors;mesh.material.needsUpdate=true;}
  mesh.position.set(x,y,z);mesh.rotation.set(['veil','vapor','waterArc'].includes(shape)?-Math.PI/2:0,shape==='flame'?Math.PI/4:0,0);mesh.scale.set(...size);mesh.visible=delay<=0;mesh.frustumCulled=false;this.scene.add(mesh);
  const p={mesh,shape,life,max:life,size,velocity,opacity,grow,gravity,spin,orbit,priority,motion,roll,delay,fromColor:endColor===null?null:mesh.material.color.clone(),endColor:endColor===null?null:new T.Color(endColor)};this.active.push(p);this.animate(p,0);return mesh;
 }
 animate(p,progress){
  const fade=Math.min(1,(1-progress)*3),scale=p.grow?Math.sin(Math.PI*Math.min(.99,progress+.05)):.9+progress*.25;
  p.mesh.material.opacity=p.opacity*fade;p.mesh.scale.set(p.size[0]*scale,p.size[1]*scale,p.size[2]*scale);
  if(p.endColor)p.mesh.material.color.copy(p.fromColor).lerp(p.endColor,progress*progress);
  if(p.motion==='erupt'){const rise=1-(1-Math.min(1,progress/.22))**3,sink=1-Math.max(0,(progress-.62)/.38);p.mesh.scale.set(p.size[0],p.size[1]*(.04+.96*rise)*sink,p.size[2]);}
  else if(p.motion==='lash'){p.mesh.scale.set(p.size[0]*(.72+progress*.3),p.size[1]*(.65+.35*Math.min(1,progress*7)),p.size[2]);p.mesh.material.opacity=p.opacity*(1-progress)**.6;}
  else if(p.motion==='combust'){const ignite=Math.min(1,.25+progress*8);p.mesh.scale.set(p.size[0]*(.65+.55*Math.sin(Math.PI*progress)),p.size[1]*(.42+progress*.8),p.size[2]);p.mesh.material.opacity=p.opacity*ignite*(1-progress)**.8;}
  else if(p.motion==='discharge'){p.mesh.material.opacity=p.opacity*Math.exp(-progress*3.5)*(.7+.3*Math.cos(progress*18)**2);p.mesh.scale.set(p.size[0]*(1-progress*.45),p.size[1],p.size[2]*(1-progress*.45));}
  else if(p.motion==='implode'){const stretch=Math.sin(Math.PI*Math.min(1,progress*1.25));p.mesh.scale.set(p.size[0]*(1-progress*.7),p.size[1]*(.55+stretch*.6),p.size[2]);p.mesh.material.opacity=p.opacity*Math.sin(Math.PI*Math.min(1,.12+progress*.88));}
 }
 update(dt){
  let n=0;for(const p of this.active){let step=dt;if(p.delay>0){p.delay-=dt;if(p.delay>0){this.active[n++]=p;continue;}step=-p.delay;p.delay=0;p.mesh.visible=true;}p.life-=step;if(p.life<=0){this.scene.remove(p.mesh);this.pool.push(p.mesh);continue;}
   const progress=1-p.life/p.max;this.animate(p,progress);
   if(p.shape==='flame'){p.mesh.rotation.z=Math.sin(progress*9+p.mesh.position.x)*.09;p.mesh.scale.x*=.85+Math.sin(progress*16)*.15;}
   p.velocity[1]-=p.gravity*step;p.mesh.position.x+=p.velocity[0]*step;p.mesh.position.y+=p.velocity[1]*step;p.mesh.position.z+=p.velocity[2]*step;
   if(p.orbit){const dx=p.mesh.position.x-p.orbit[0],dz=p.mesh.position.z-p.orbit[1],a=p.orbit[2]*step,c=Math.cos(a),s=Math.sin(a);p.mesh.position.x=p.orbit[0]+dx*c-dz*s;p.mesh.position.z=p.orbit[1]+dx*s+dz*c;}
   p.mesh.rotation.y+=p.spin*step;p.mesh.rotation.z+=p.roll*step;this.active[n++]=p;
  }this.active.length=n;
 }
 clear(){this.meleeEdge=null;for(const p of this.active){this.scene.remove(p.mesh);this.pool.push(p.mesh);}this.active.length=0;}
 contactStroke(frame,ax,ay,bx,by,color,width=.03,life=.14,opacity=.8){
  const p=frame.at((ax+bx)/2,(ay+by)/2,.015),m=this.particle('ribbon',color,p.x,p.y,p.z,{life,size:[Math.hypot(bx-ax,by-ay)*frame.scale,width*frame.scale,1],opacity,additive:false,priority:1,endColor:0x60777b});
  if(m){m.quaternion.copy(frame.rotation);m.rotateZ(Math.atan2(by-ay,bx-ax));}return m;
 }
 enemyContact(texture,color,x,z,angle,strong=false,contact){
  const f=contactFrame(x,z,angle,contact,.84),hard=['stone','wood','ice'].includes(texture),shape=texture==='stone'?'stone':hard?'crystal':'smoke',count=strong?(f.compact?3:4):2,p=f.at();
  this.contactStroke(f,-.12,-.035,.14,.045,hard?0xe9cba0:0xd8c6a8,strong?.060:.040,.10,.82);
  for(let i=0;i<count;i++){const s=(strong?.048:.036)*f.scale,chip=this.particle(shape,color,p.x,p.y,p.z,{life:hard?.20:.16,size:[s,s*(hard?1.6:1.1),s*.7],velocity:f.velocity((i-(count-1)/2)*.65,hard?.30+i*.12:.18,hard?.85:.35),gravity:hard?4:0,spin:hard?5:0,opacity:hard?.72:.38,additive:false});if(chip&&hard){chip.quaternion.copy(f.rotation);chip.rotateZ(.4+i*.5);}}
 }
 dive(x,z,angle){
  this.particle('veil',0x3e989c,x,.09,z,{life:.22,size:[.85,.66,1],opacity:.55,additive:false});
  const dx=Math.sin(angle),dz=Math.cos(angle);for(const side of[-1,1]){this.segment(new T.Vector3(x+Math.cos(angle)*side*.28,.12,z-Math.sin(angle)*side*.28),new T.Vector3(x-dx*.65+Math.cos(angle)*side*.5,.10,z-dz*.65-Math.sin(angle)*side*.5),0xa1dbd4,.022,.2,false,1,.65);}
 }
 water(x,z,angle=0,strength=1){
  for(const side of [-1,1]){const m=this.particle('waterArc',0xc8f4e5,x,.10,z,{life:.65,size:[.65*strength,.65*strength,1],opacity:.2,additive:false,grow:true,velocity:[Math.sin(angle+side)*.25,0,Math.cos(angle+side)*.25]});if(m)m.rotation.z=-angle+side*1.1;}
  for(let i=0;i<3;i++){const a=angle+i*2.1;this.particle('ember',0xa1e3e0,x,.14,z,{life:.25,size:[.035,.055,.035],velocity:[Math.sin(a)*strength,.9*strength,Math.cos(a)*strength],gravity:5,opacity:.65,additive:false});}
 }
 fire(x,z,r=2,large=false){
  if(large)for(let i=0;i<3;i++){const a=i*Math.PI*2/3;const curl=this.particle('flame',i===1?0xffd796:0xff8934,x+Math.sin(a)*r*.24,.35,z+Math.cos(a)*r*.24,{life:.38+i*.045,size:[r*.23,r*(.32+i*.035),1],velocity:[Math.sin(a)*1.1,1.3,Math.cos(a)*1.1],motion:'combust',endColor:0x70271e,opacity:.8,additive:false,priority:1});if(curl)curl.rotation.set(-.3,a,Math.sin(a)*.45);}
  this.particle('veil',0xf2a44f,x,.08,z,{life:.19,size:[r*.62,r*.55,1],opacity:large?.22:.14,endColor:0xa84624,priority:1});
  // Small hot contact, broad tongues, then floating cinders: brightness does not fill the whole area.
  this.particle('flame',0xfff4d4,x,.45,z,{life:.12,size:[r*.16,r*.27,1],opacity:.9,motion:'combust',endColor:0xff9c3b,priority:1});
  const count=large?12:7;
  for(let i=0;i<count;i++){const a=i/count*Math.PI*2,d=(.18+Math.random()*.48)*r,h=(large?.8:.45)+Math.random()*.6;
   this.particle('flame',i%3?0xff913c:0xffd28b,x+Math.cos(a)*d,.30,z+Math.sin(a)*d,{life:.4+Math.random()*.25,size:[large?.4:.25,h,.3],velocity:[Math.cos(a)*.35,.85,Math.sin(a)*.35],motion:'combust',endColor:i%3?0x8c3024:0xb34a25,additive:false,opacity:.9,delay:d/r*.04});
   if(i%2===0){const speed=r*1.05,vy=1.3+Math.random(),spark=this.particle('crystal',0xffe2a3,x,.35,z,{life:.65,size:[.018,.10,.018],velocity:[Math.cos(a)*speed,vy,Math.sin(a)*speed],gravity:3.8,spin:3,endColor:0x8e281c});if(spark)spark.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),new T.Vector3(Math.cos(a)*speed,vy,Math.sin(a)*speed).normalize());}
  }
  if(large)for(let i=0;i<3;i++){const smoke=this.particle('vapor',0x675750,x+(Math.random()-.5)*r,.45,z+(Math.random()-.5)*r,{life:.67,delay:.10,size:[.72,.55,1],velocity:[.13,.65,-.1],additive:false,opacity:.4,grow:true});if(smoke)smoke.rotation.x=-.6;}
 }
 meteor(x,z){
  for(const a of [0,Math.PI/2]){const tail=this.particle('flame',a?0xff8735:0xffd18a,x-2.75,7.8,z-1.65,{life:.5,size:[.42,1.2,1],velocity:[5,-13,3],opacity:.8,priority:1});if(tail)tail.rotation.set(0,a,.35);}
  const m=this.particle('ember',0xffaa51,x-2.5,7,z-1.5,{life:.5,size:[.38,.62,.38],velocity:[5,-13,3],spin:5});if(m)m.rotation.z=.35;
  for(let i=1;i<=5;i++)this.particle('crystal',i%2?0xff7a28:0xffdca1,x-2.5-i*.12,7+i*.22,z-1.5-i*.08,{life:.5,size:[.22-i*.025,.45,.22-i*.025],velocity:[5,-13,3],opacity:.7});
 }
 ice(x,z,r=5){
  this.particle('veil',0x84cfdc,x,.06,z,{life:.48,size:[r*.82,r*.76,1],opacity:.17,additive:false});
  for(let i=0;i<2;i++)this.particle('vapor',i?0xb9e7ed:0x85c5d5,x+(i?1:-1)*r*.2,.16,z,{life:.70,size:[r*.50,r*.34,1],opacity:.37,velocity:[(i?1:-1)*.45,.07,.1],grow:true,additive:false});
  for(let i=0;i<8;i++){const a=i*Math.PI/4+(Math.random()-.5)*.16,b=a+(Math.random()-.5)*.25,mid=new T.Vector3(x+Math.sin(a)*r*.34,.1,z+Math.cos(a)*r*.34),end=new T.Vector3(x+Math.sin(b)*r*(.58+Math.random()*.25),.1,z+Math.cos(b)*r*(.58+Math.random()*.25));this.segment(new T.Vector3(x,.1,z),mid,0x9dd5e2,.024,.24,false);this.segment(mid,end,0x94dfea,.018,.32,false,0,.7,{delay:.04+i*.004,endColor:0x608ba9});}
  for(let i=0;i<12;i++){const a=i*2.39996+(Math.random()-.5)*.2,d=r*Math.sqrt((i+.5)/12)*.84,h=(.4+Math.random()*.45)*Math.min(1,r/2);
   const px=x+Math.cos(a)*d,pz=z+Math.sin(a)*d,delay=i===0?0:d/r*.11,m=this.particle('shard',i%3?0x5bb9d5:0xc5eeef,px,.06,pz,{life:.64+Math.random()*.15,delay,size:[.16,h,.16],opacity:.87,motion:'erupt',endColor:0x6a9cb9,additive:false,priority:1});if(m){m.rotation.z=-Math.cos(a)*.24;m.rotation.x=Math.sin(a)*.24;}
   if(i%2===0)this.particle('crystal',0xdafaff,px,.3,pz,{life:.38,delay:delay+.16,size:[.028,.13,.028],velocity:[Math.cos(a)*r*.26,1.2,Math.sin(a)*r*.26],gravity:5,spin:6,endColor:0x70b7d2});
   // Only three crystals catch a brief edge highlight. Replace fog sheets, without adding draws.
   if(i%4===0&&m){const tilt=m.rotation,base=new T.Vector3(px,.06,pz),tip=new T.Vector3(0,h*2,0).applyEuler(tilt).add(base);
    for(const side of[-1,1]){const edge=new T.Vector3(side*.16,0,0).applyEuler(tilt).add(base);this.segment(edge,tip,side<0?0xe7fbff:0x8ddfe9,side<0?.012:.009,.13,false,side<0?1:0,.88,{motion:'discharge',delay:delay+.16,endColor:0x7fb4d1});}
   }
  }
 }
 segment(a,b,color,width,life=.15,additive=width<.04,priority=0,opacity=.9,animation={}){const delta=new T.Vector3().subVectors(b,a),mid=new T.Vector3().addVectors(a,b).multiplyScalar(.5),m=this.particle('ray',color,mid.x,mid.y,mid.z,{life,size:[width,delta.length(),width],additive,priority,opacity,...animation});if(m)m.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),delta.normalize());}
 lightning(ax,az,bx,bz,vertical=false){
  this.particle('veil',0x90c8ff,bx,.08,bz,{life:.18,size:[.65,.48,1],opacity:.24,priority:1});
  const start=new T.Vector3(ax,vertical?6:1.1,az),end=new T.Vector3(bx,1,bz);let last=start;
  for(let i=1;i<=7;i++){const t=i/7,next=new T.Vector3().lerpVectors(start,end,t);if(i<7){next.x+=(Math.random()-.5)*.55;next.y+=(Math.random()-.5)*.25;next.z+=(Math.random()-.5)*.55;}
   this.segment(last,next,0x427dff,.085,.20,true,0,.15,{motion:'discharge'});this.segment(last,next,0x679aff,.035,.16,false,1,.83,{motion:'discharge'});this.segment(last,next,0xe1f4ff,.018,.10,true,2,.95,{motion:'discharge'});
   if(i===3||i===5){const side=i===3?1:-1,fork=next.clone().add(new T.Vector3(.42*side,.3,-.3*side));this.segment(next,fork,0xc5e9ff,.017,.14,true,0,.8,{motion:'discharge',delay:.045});this.segment(fork,fork.clone().add(new T.Vector3(.25*side,-.12,.22*side)),0x92bfff,.009,.19,true,0,.7,{motion:'discharge',delay:.065});}last=next;
  }
  for(let i=0;i<3;i++){const a=i*2.1,p=new T.Vector3(bx+Math.sin(a)*.45,.16,bz+Math.cos(a)*.45),q=p.clone().add(new T.Vector3(Math.cos(a)*.4,0,Math.sin(a)*.4));this.segment(new T.Vector3(bx,.2,bz),p,0xb2dfff,.027,.24,true,1);this.segment(p,q,0x609bff,.02,.3,true);}
  for(const side of[-1,1])this.segment(new T.Vector3(bx-side*.16,.77,bz),new T.Vector3(bx+side*.16,1.23,bz),0xe9f8ff,.018,.075,true,1,.9,{motion:'discharge'});
  for(let i=0;i<3;i++)this.particle('ember',0xb5d9ff,bx,1,bz,{life:.2,size:[.045,.025,.045],velocity:[(Math.random()-.5)*3,Math.random()*2,(Math.random()-.5)*3]});
 }
 dark(x,z,r=2,strong=false){
  this.particle('veil',0x292037,x,.07,z,{life:.52,size:[r*.80,r*.72,1],opacity:.46,additive:false});
  if(strong)this.particle('vapor',0x785c91,x,.1,z,{life:.58,size:[r*.68,r*.58,1],opacity:.5,additive:false,priority:1});
  // Narrow folded ribbons pull inward, leaving enemies and danger markings readable.
  for(let i=0;i<2;i++){const a=i*2.8,blade=this.particle('claw',i%2?0xa98bc8:0x715894,x+Math.sin(a)*r*.22,.1,z+Math.cos(a)*r*.22,{life:.43,size:[r*.62,r*.40,1],velocity:[-Math.sin(a)*r*.35,.28,-Math.cos(a)*r*.35],opacity:strong?.68:.46,roll:i?-1.3:1.3,motion:'implode',endColor:0x49345b,additive:false,priority:strong?1:0});if(blade)blade.rotation.set(-.85,a,i?.6:-.6);}
  const count=strong?10:6;for(let i=0;i<count;i++){const a=i*2.39996,d=r*(.45+Math.random()*.35),solid=i%3===0,shape=solid?'crystal':'vapor';this.particle(shape,solid?0xbfa1dd:0x69537d,x+Math.cos(a)*d,.16,z+Math.sin(a)*d,{life:.4+Math.random()*.18,size:solid?[.03,.13,.03]:[.43,.30,1],velocity:[-Math.cos(a)*d*1.7,.25,-Math.sin(a)*d*1.7],spin:solid?3:0,orbit:[x,z,2.2],motion:'implode',endColor:solid?0x73558e:0x35293f,opacity:solid?.78:.5,additive:false});}
 }
 shadowStep(ax,az,bx,bz){
  for(const [x,z]of [[ax,az],[bx,bz]]){this.particle('veil',0x182233,x,.08,z,{life:.32,size:[.70,1.30,1],opacity:.55,additive:false});for(let i=0;i<5;i++){const a=i*Math.PI*2/5;this.particle('crystal',0xc1ccd9,x,.4,z,{life:.28,size:[.055,.28,.055],velocity:[Math.cos(a)*2,1.2,Math.sin(a)*2],gravity:4});}}
  this.segment(new T.Vector3(ax,.8,az),new T.Vector3(bx,.8,bz),0x8190a5,.09,.18,true);
 }
 dust(x,z,r=1){
  for(let i=0;i<6;i++){const a=Math.random()*Math.PI*2;this.particle('veil',0xb8a287,x+Math.cos(a)*r*.3,.12,z+Math.sin(a)*r*.3,{life:.35+Math.random()*.2,size:[r*.3,r*.23,1],velocity:[Math.cos(a)*r,.12,Math.sin(a)*r],opacity:.24,additive:false});}
 }
 rise(x,z,color,r=1){
  this.particle('veil',color,x,.09,z,{life:.55,size:[r*.65,r*.65,1],opacity:.24});
  for(let i=0;i<9;i++){const a=i*2.4,d=Math.sqrt((i+.5)/9)*r*.65;this.particle('ember',color,x+Math.cos(a)*d,.2,z+Math.sin(a)*d,{life:.55+Math.random()*.3,size:[.035,.14,.035],velocity:[0,1.4+Math.random(),0],opacity:.7});}
 }
 mist(x,z,r,color=0x9271b2){
  for(let i=0;i<3;i++){const a=Math.random()*Math.PI*2,d=Math.random()*r*.6;this.particle('veil',color,x+Math.cos(a)*d,.14,z+Math.sin(a)*d,{life:.65,size:[r*.43,r*.35,1],velocity:[Math.cos(a)*.15,.12,Math.sin(a)*.15],opacity:.25,additive:false});}
 }
 riftCast(x,z,r,angle,release=false){
  const axis=new T.Vector3(Math.cos(angle),0,-Math.sin(angle)),across=new T.Vector3(Math.sin(angle),0,Math.cos(angle));
  // Identical preview/release path: a crooked seam opening beneath the target.
  let last=new T.Vector3(x,.09,z).addScaledVector(axis,-r*.75);
  for(let i=1;i<=6;i++){
   const point=new T.Vector3(x,.09,z).addScaledVector(axis,r*(i/6*1.5-.75)).addScaledVector(across,i===6?0:Math.sin(i*2.4)*r*.10);
   this.segment(last,point,release?0xbdc9d8:0x58677d,release?.045:.025,release?.32:.28,false,1,.72);
   last=point;
  }
  if(!release)return;
  for(let i=-1;i<=1;i++){const off=i*r*.4,height=r*(i===0?.65:.46),m=this.particle('claw',0x101720,x+axis.x*off,.06,z+axis.z*off,{life:.4,size:[.75,height,1],motion:'erupt',opacity:.82,additive:false,priority:1});if(m)m.rotation.y=angle;
   const rim=this.particle('claw',0xe0e9f0,x+axis.x*(off+.06)+across.x*.025,.075,z+axis.z*(off+.06)+across.z*.025,{life:.30,delay:.025,size:[.13,height*.98,1],motion:'erupt',opacity:.86,endColor:0x65738a,priority:1});if(rim)rim.rotation.y=angle;
  }
  this.particle('veil',0x111927,x,.06,z,{life:.5,size:[r,r*.58,1],opacity:.30,additive:false});
  for(let i=-2;i<=2;i++){const off=i*r*.26,px=x+axis.x*off,pz=z+axis.z*off;
   if(Math.abs(i)===2){const plume=this.particle('claw',0x435269,px,.35,pz,{life:.42,size:[.18,.4,1],velocity:[across.x*.25,.7,across.z*.25],grow:true,additive:false,opacity:.45});if(plume)plume.rotation.y=angle;}
   this.particle('ember',0xd4dce5,px,.2,pz,{life:.4,size:[.035,.07,.035],velocity:[0,2,0]});
  }
 }
 bladeImpact(x,z,angle,shadow=false,contact){
  const f=contactFrame(x,z,angle,contact,1),p=f.at();
  for(let i=1;i<=4;i++){
   const u=i/4;
   const roll=contact?.slashRoll,dx=Number.isFinite(roll)?Math.cos(roll)*.60:.54,dy=Number.isFinite(roll)?Math.sin(roll)*.60:.32;
   this.contactStroke(f,((i-1)/4-.5)*dx,((i-1)/4-.5)*dy,(u-.5)*dx,(u-.5)*dy,shadow?0xc5d0df:0xb9dfd5,.030+Math.sin(u*Math.PI)*.025,f.compact?.13:.18,.76);
  }
  const count=f.compact?2:3;for(let i=0;i<count;i++)this.particle('crystal',shadow?0x718299:0x85bbae,p.x,p.y,p.z,{life:.19,size:[.016*f.scale,.064*f.scale,.016*f.scale],velocity:f.velocity((i-(count-1)/2)*.8,.25+i*.15,.8),gravity:3,spin:6,opacity:.65,additive:false});
 }
 shadowMark(x,z,strong=false,contact){
  if(contact){
   const f=contactFrame(x,z,0,contact,.95),base=f.at(0,strong?-.17:-.10),core=this.particle('claw',0x111822,base.x,base.y,base.z,{life:strong?(f.compact?.20:.28):.15,size:[(strong?.30:.17)*f.scale,(strong?.27:.16)*f.scale,1],motion:'implode',opacity:.74,additive:false,priority:1});
   if(core)core.quaternion.copy(f.rotation);
   for(const side of[-1,1])this.contactStroke(f,side*(strong?.12:.07),-.10,-side*.025,strong?.17:.12,0xcad7e3,strong?.055:.035,strong?.19:.14,.78);
   if(strong){const p=f.at(),count=f.compact?3:4;for(let i=0;i<count;i++)this.particle('crystal',i%2?0x67778c:0xc8d4df,p.x,p.y,p.z,{life:.23,size:[.020*f.scale,.074*f.scale,.020*f.scale],velocity:f.velocity((i-(count-1)/2)*.6,.3,.7),gravity:3,spin:4,opacity:.7,additive:false,endColor:0x39485d});}
   return;
  }
  const core=this.particle('claw',0x111822,x,.67,z,{life:strong?.34:.17,size:strong?[.85,.6,1]:[.32,.24,1],motion:'implode',opacity:.8,additive:false,priority:1});if(core)core.rotation.set(-.35,.6,-.2);
  for(const side of[-1,1])this.segment(new T.Vector3(x+side*(strong?.3:.1),strong?.65:.86,z+.025),new T.Vector3(x-side*.05,strong?1.35:1.10,z+.025),0xdde7ef,strong?.025:.015,strong?.18:.11,false,1,.85,{delay:strong?.025:0,endColor:0x71829a});
  if(strong)for(let i=0;i<6;i++){const a=i*Math.PI/3;this.particle('crystal',i%2?0x67778c:0xdde4ee,x,1,z,{life:.31,delay:.035,size:[.032,.18,.032],velocity:[Math.sin(a)*2.6,1.4,Math.cos(a)*2.6],gravity:4,spin:5,endColor:0x39485d});}
 }
 shadowSpell(kind,x,z,targets=[]){
  if(kind==='veil'){
   this.particle('veil',0x182332,x,.09,z,{life:2.4,size:[4.8,4.8,1],opacity:.30,additive:false,priority:1});
   for(let i=0;i<8;i++){const a=i*2.39996,r=Math.sqrt((i+.5)/8)*3.4;
    this.particle('claw',i%2?0x394654:0x687481,x+Math.cos(a)*r,.45,z+Math.sin(a)*r,{life:.65+i*.06,size:[.16,.68,1],velocity:[Math.sin(a)*.45,.3,-Math.cos(a)*.45],opacity:.28,additive:false,grow:true});
   }
  }else if(kind==='chain'){
   for(const e of targets){const a=new T.Vector3(x,.8,z),b=new T.Vector3(e.x,1,e.z),dx=e.x-x,dz=e.z-z,len=Math.hypot(dx,dz)||1;let last=a;
    for(let i=1;i<=5;i++){const u=i/5,bow=Math.sin(u*Math.PI),next=new T.Vector3().lerpVectors(a,b,u);next.x+=dz/len*bow*.35;next.z-=dx/len*bow*.35;next.y+=bow*.28;
     this.segment(last,next,i===5?0xd5dfed:0x69798c,.06*(1-u)+.025,.22+(1-u)*.09,false,1,.72);last=next;
    }this.shadowMark(e.x,e.z);
   }
  }else{this.riftCast(x,z,2.8,.65,true);}
 }
 status(kind,x,z,size=1){
  if(kind==='burn')this.particle('flame',0xff8734,x+(Math.random()-.5)*size,.45,z+(Math.random()-.5)*size,{life:.32,size:[.16,.28,.1],velocity:[0,1,0],grow:true,additive:false});
  else if(kind==='frost')this.particle('crystal',0xa5e8ff,x+(Math.random()-.5)*size,.18,z+(Math.random()-.5)*size,{life:.38,size:[.055,.22,.055],grow:true});
  else this.particle('ember',0xbb9eff,x+(Math.random()-.5)*size,.45,z+(Math.random()-.5)*size,{life:.4,size:[.065,.09,.065],velocity:[0,.6,0]});
 }
 weaponContact(kind,x,z,angle,combo=0,contact){
  const f=contactFrame(x,z,angle,contact,kind==='hammer'?.16:.8),p=f.at(),size=(a,b,c=1)=>[a*f.scale,b*f.scale,c],pose=(m,roll=0)=>{if(m){m.quaternion.copy(f.rotation);m.rotateZ(roll);}return m;};
  if(kind==='harpoon'||kind==='boomerang'){
   const harpoon=kind==='harpoon',sweep=combo===1,color=harpoon?0x9bc7c2:0xd4be90;
   if(harpoon&&!sweep){
    this.contactStroke(f,-.035,-.065,.025,.12,0xd0e6df,.058,.13,.84);for(const side of[-1,1]){const q=f.at(side*.075,-.05,.035);pose(this.particle('sweep',side<0?0x739f9c:0xb7d8d0,q.x,q.y,q.z,{life:.22,size:size(.15,.13),motion:'lash',velocity:f.velocity(side*.35,.18,.3),opacity:.56,additive:false,endColor:0x4a7578}),side*.9);}
    if(combo===2)pose(this.particle('sweep',color,p.x,p.y,p.z,{life:.13,size:size(.16,.075),motion:'lash',opacity:.48,roll:-2,priority:1,additive:false}),.65);
   }else pose(this.particle('sweep',color,p.x,p.y,p.z,{life:f.compact?.12:.16,size:size(harpoon?.30:.24,harpoon?.12:.11),motion:'lash',opacity:.62,roll:sweep?2:-2,priority:1,additive:false}),harpoon?.16:.75);
   const count=f.compact?2:3;for(let i=0;i<count;i++)this.particle(harpoon?'droplet':'crystal',color,p.x,p.y,p.z,{life:harpoon?.28:.19,size:size(harpoon?.024:.016,harpoon?.050:.059,.016*f.scale),velocity:f.velocity((i-(count-1)/2)*(sweep?.85:.38),.35,.85),gravity:4,spin:6,opacity:.70,additive:false});
  }else{
   const shield=kind==='shield';pose(this.particle(shield?'sweep':'claw',shield?0xd6dcc3:0xd7ba87,p.x,p.y,p.z,{life:shield?.13:.18,size:size(.24,shield?.16:.24),motion:'lash',opacity:.68,priority:1,additive:false}),shield?.4:-.8);
   for(let i=0;i<(f.compact?3:4);i++)this.particle(shield?'crystal':'stone',shield?0xbfcab2:0xb9996a,p.x,p.y,p.z,{life:shield?.18:.24,size:size(shield?.02:.048,shield?.07:.07,shield?.02*f.scale:.035*f.scale),velocity:f.velocity((i-1.5)*.5,shield?.3:.8+i*.12,.8),gravity:shield?1:6,spin:7,opacity:.7,additive:false});
   if(!shield&&combo===2&&!contact)this.dust(x,z,.65);
  }
 }
 boltImpact(x,z,strong=false,angle=0,contact){
  const f=contactFrame(x,z,angle,contact,1.05),count=strong?(f.compact?4:6):3,p=f.at();
  this.contactStroke(f,-.065,-.045,.06,.09,0xd9e8eb,strong?.075:.050,.12,.85);
  if(strong)this.contactStroke(f,-.13,.09,.1,-.065,0x91becd,.045,.17,.67);
  for(let i=0;i<count;i++){const a=i/count*Math.PI*2,chip=this.particle('crystal',i%3?0xa7c9d8:0xdce8e7,p.x,p.y,p.z,{life:strong?.26:.20,size:[.018*f.scale,(strong?.10:.066)*f.scale,.018*f.scale],velocity:f.velocity(Math.sin(a)*(strong?1.3:.8),Math.cos(a)*.65,.75+i%2*.2),gravity:3,spin:7,opacity:.75,additive:false});if(chip){chip.quaternion.copy(f.rotation);chip.rotateZ(a);}}
 }
 skill(e){
  const {kind,x,z}=e,point=(x,y,z)=>new T.Vector3(x,y,z);
  if(kind==='faultAim'||kind==='surgeAim'){
   const a=e.angle||0,dx=Math.sin(a),dz=Math.cos(a),stone=kind==='faultAim',color=stone?(e.charged?0xf1cb7f:0xbbaa87):0x91cac7;
   const life=Math.max(.08,e.delay||.13);let last=point(x-dx*.48,.065,z-dz*.48);
   for(let i=1;i<=3;i++){const off=(i%2?.10:-.10),next=point(x+dx*(i/3-.5)+Math.cos(a)*off,.065,z+dz*(i/3-.5)-Math.sin(a)*off);this.segment(last,next,color,.023,life,false,1,.5);last=next;}
  }else if(kind==='faultPrime'){
   for(let i=0;i<5;i++){const a=i*2.4;this.particle('crystal',0xf2ce83,x+Math.sin(a)*.45,.45,z+Math.cos(a)*.45,{life:.6,size:[.045,.18,.045],velocity:[0,.65,0],opacity:.85,priority:1});}
  }else if(kind==='saltWake'||kind==='snareMark'){
   const salt=kind==='saltWake';for(let i=0;i<4;i++){const a=i*Math.PI/2;const m=this.particle('crystal',salt?0xb7e5dd:0xa5c77c,x+Math.sin(a)*.4,.35,z+Math.cos(a)*.4,{life:.5,size:salt?[.035,.16,.035]:[.09,.025,.15],velocity:[0,.8,0],orbit:[x,z,3],additive:false,priority:1});if(m)m.rotation.y=a;}
  }else if(['fault','landing','reprisal'].includes(kind)){
   const radial=kind!=='fault',count=radial?9:5;this.dust(x,z,radial?2.3:1);
   for(let i=0;i<(radial?5:3);i++){const a=radial?i/5*Math.PI*2:(e.angle||0)+Math.PI/2,d=radial?1.35:(i-1)*.65,px=x+Math.sin(a)*d,pz=z+Math.cos(a)*d,h=(e.charged?.65:.4)+(i%2)*.13;
    const rock=this.particle('shard',i%2?0x958364:0x685e51,px,.06,pz,{life:.58,size:[.24,h,.3],motion:'erupt',additive:false,priority:1});if(rock)rock.rotation.y=a+.35;
    this.particle('flame',e.charged?0xffd28c:0xd9b77b,px,.18,pz,{life:.23,size:[.15,h*.65,1],opacity:.7,grow:true});
   }
   for(let i=0;i<count;i++){const a=radial?i/count*Math.PI*2:(e.angle||0)+Math.PI/2,d=radial?1.1+(i%3)*.45:(i-2)*.36,px=x+Math.sin(a)*d,pz=z+Math.cos(a)*d;
    const rock=this.particle('stone',i%2?0x9b865e:0x655d4b,px+Math.sin(i*3)*.13,.12,pz+Math.cos(i*2)*.17,{life:.48,size:[.20,(e.charged?.42:.25)+(i%3)*.10,.23],velocity:[Math.sin(a)*.5,e.charged?2:1.4,Math.cos(a)*.5],gravity:7,spin:2,additive:false});if(rock)rock.rotation.z=(i%2?1:-1)*.25;
    this.segment(point(px,.08,pz),point(px+Math.sin(a)*.5,.07,pz+Math.cos(a)*.5),e.charged?0xffd98d:0xe0c493,e.charged?.055:.035,.25,false,e.charged?1:0,.65);
   }
  }else if(['surge','wake'].includes(kind)){
   const a=e.angle||0,dx=Math.sin(a),dz=Math.cos(a),surge=kind==='surge';
   for(let j=0;j<(surge?2:1);j++){const crest=this.particle('crest',j?0xc6fff2:0x53bdbc,x-dx*j*.18,.07,z-dz*j*.18,{life:surge?.43:.38,size:[surge?1.05:1.5,surge?(j?1.1:.9):.22,1],velocity:[dx*(surge?.5:0),0,dz*(surge?.5:0)],motion:'erupt',opacity:surge?.83:.36,additive:j===1,priority:surge?1:0});if(crest)crest.rotation.y=a;}
   this.particle('veil',0x438f96,x,.055,z,{life:.46,size:surge?[1.1,.75,1]:[2.2,2.05,1],opacity:surge?.25:.18,additive:false});
   let last;for(let i=-3;i<=3;i++){const u=i/3,spread=surge?1:1.65,curve=.4*(1-u*u),px=x+Math.cos(a)*u*spread+dx*curve,pz=z-Math.sin(a)*u*spread+dz*curve,crest=point(px,surge?.13+(1-u*u)*.24:.08,pz);
    if(last)this.segment(last,crest,i%2?0xa0d7cc:0x70b5b5,.026,.32,false,0,.6);last=crest;
    this.particle('veil',0x5eb0ad,px,.10,pz,{life:.42,size:[.45,.35,1],opacity:.22,velocity:[dx*.8,0,dz*.8],additive:false,grow:true});
    if(surge&&i%2===0)this.particle('ember',0xc5e8dd,px,.24,pz,{life:.35,size:[.025,.045,.025],velocity:[dx,.7,dz],gravity:4,additive:false});
   }
  }else if(['brine','brineMark'].includes(kind)){
   const burst=kind==='brine',count=burst?9:Math.min(3,e.count||1);if(burst)this.particle('veil',0xaedbd8,x,.18,z,{life:.3,size:[.8,.65,1],opacity:.28,additive:false,grow:true});for(let i=0;i<count;i++){const a=i*2.4;this.particle('crystal',i%2?0xd0eeeb:0x6db4b9,x+Math.sin(a)*.25,.8,z+Math.cos(a)*.25,{life:burst?.45:.36,size:[.04,burst?.23:.12,.04],velocity:burst?[Math.sin(a)*2,1,Math.cos(a)*2]:[0,.12,0],gravity:burst?4:0,spin:burst?6:0,additive:false});}
  }else if(['briarSet','briarIdle','briar','bond','care'].includes(kind)){
   if(kind==='care'){this.rise(x,z,0xafcb87,.8);for(let i=0;i<4;i++)this.particle('crystal',0xc2d79c,x+Math.sin(i*2.4)*.35,.5,z+Math.cos(i*2.4)*.35,{life:.7,size:[.06,.1,.025],velocity:[0,.5,0],spin:2,additive:false});}
   else if(kind==='bond'){for(let i=-1;i<=1;i++){const claw=this.particle('claw',e.linked?0xd9edb2:0xffdf9e,x+i*.24,.22,z,{life:.3,size:[e.linked?1.35:1,e.linked?.85:.7,1],motion:'lash',roll:-.6,opacity:.95,priority:1});if(claw)claw.rotation.set(-.3,.55,-.45);}if(e.linked)for(let i=0;i<4;i++){const a=i*2.4;this.particle('crystal',0x93b875,x,.65,z,{life:.4,size:[.09,.025,.15],velocity:[Math.sin(a)*1.5,.7,Math.cos(a)*1.5],gravity:3,spin:4,additive:false});}}
   else{const snap=kind==='briar',radius=snap?1.15:.65;for(let i=0;i<4;i++){
    const a=i*2.4,dx=Math.sin(a),dz=Math.cos(a);let last=point(x+dx*radius,.07,z+dz*radius);
    for(let j=1;j<=5;j++){const u=j/5,turn=a+u*1.35,r=radius*(1-u*.7),next=point(x+Math.sin(turn)*r,.07+(snap?Math.sin(u*1.6)*.85:u*.08),z+Math.cos(turn)*r);this.segment(last,next,j%2?0x587d44:0x9abb6d,snap?.065:.028,snap?.45:.44,false,0,.85);if(snap&&j%2===0){const thorn=this.particle('shard',0xc6dba0,next.x,next.y,next.z,{life:.42,size:[.07,.16,.07],motion:'erupt',additive:false});if(thorn)thorn.rotation.z=Math.cos(a)*1.1;}last=next;}
    const leaf=this.particle('crystal',i%2?0x86ac63:0x628a49,last.x,last.y,last.z,{life:.45,size:[.08,.035,.18],velocity:snap?[-dx*.2,.25,-dz*.2]:[0,0,0],additive:false,opacity:.85});if(leaf)leaf.rotation.y=a;
   }}
  }else if(kind==='mine'){
   const c=e.armed?0xe8a55e:0x887c68;this.particle('ember',c,x,.13,z,{life:.42,size:[.16,.06,.16],additive:false,opacity:.9});
   for(const a of [-.65,.65])this.segment(point(x-.27,.11,z+a*.2),point(x+.27,.11,z-a*.2),c,.035,.42,false);
  }else if(kind==='mineBlast'){this.fire(x,z,2.5,true);for(let i=0;i<5;i++)this.particle('crystal',0xd6b07d,x,.3,z,{life:.35,size:[.08,.12,.08],velocity:[Math.sin(i*2.4)*4,2,Math.cos(i*2.4)*4],gravity:8,additive:false});}
  else if(kind==='counter'){
   for(let i=-2;i<=2;i++){const a=e.angle+i*.28,dx=Math.sin(a),dz=Math.cos(a);this.segment(point(x+dx*.7,.7,z+dz*.7),point(x+dx*3.4,.9,z+dz*3.4),0xf1c884,.065,.2,false);}
   this.dust(x,z,1.1);
  }else if(kind==='slug'){this.segment(point(x,1.1,z),point(e.x2,1.1,e.z2),0xffd899,.045,.09,false,1);}
  else if(kind==='slugHit'){this.particle('ember',0xffdaa0,x,1,z,{life:.16,size:[.09,.06,.09],grow:true});}
  else if(kind==='volley'){for(let i=0;i<3;i++)this.particle('ember',0xf6ce82,x,.9,z,{life:.16,size:[.04,.04,.12],velocity:[Math.sin(e.angle+i*.1)*4,.2,Math.cos(e.angle+i*.1)*4]});}
  else if(kind==='rainAim'){
   this.particle('veil',0x7bc6cf,x,.07,z,{life:.55,size:[2.4,2.1,1],opacity:.19,additive:false,priority:1});
   for(let i=0;i<4;i++){const a=i*2.4,d=.5+i*.35;this.segment(point(x+Math.cos(a)*d,.1,z+Math.sin(a)*d-.2),point(x+Math.cos(a)*d,.1,z+Math.sin(a)*d+.2),0x99e3e6,.03,.55,false);}
  }else if(kind==='rain'){
   for(let i=0;i<2;i++){const sweep=this.particle('sweep',0x90e5ee,x,.12,z,{life:.34,size:[1.55,1.4,1],opacity:.38,motion:'lash',roll:1.5});if(sweep)sweep.rotation.set(-Math.PI/2,0,i*Math.PI);}
   for(let i=0;i<7;i++){const a=i*2.4,d=Math.sqrt(i/7)*2,px=x+Math.cos(a)*d,pz=z+Math.sin(a)*d;this.segment(point(px-.18,1.7,pz-.12),point(px,.12,pz),0xbde9e6,.035,.16,false,1);this.particle('crystal',0x8bd5d6,px,.15,pz,{life:.3,size:[.035,.12,.035],velocity:[0,.6,0],gravity:4});}
  }else if(kind==='trail'){
   for(let i=0;i<5;i++){const u=i/4,px=x+(e.x2-x)*u,pz=z+(e.z2-z)*u;this.particle('veil',0x8ac2cb,px,.055,pz,{life:.39,size:[.48,.3,1],opacity:.16,additive:false});this.particle('crystal',0xa6d7e2,px+.12*Math.sin(i*3),.12,pz,{life:.38,size:[.035,.12,.035],additive:false,opacity:.7});}
  }else if(kind==='pursuit'){
   for(const off of [-.22,0,.22])this.segment(point(x+off-.12,.65,z),point(x+off+.12,1.4,z),0xaff2e9,.035,.22,false,1);this.boltImpact(x,z);
  }else if(kind==='echo'){
   this.particle('veil',0x152030,x,.07,z,{life:.85,size:[.6,.5,1],opacity:.5,additive:false});this.particle('claw',0x536277,x,.65,z,{life:.85,size:[.3,.55,1],opacity:.45,additive:false});
   for(const off of [-.08,0,.08])this.segment(point(x+off,.85,z+.05),point(x+off,.98,z+.05),0xb6c5d7,.02,.75,false);
  }else if(kind==='echoHit'){this.shadowSpell('chain',x,z,[{x:e.x2,z:e.z2}]);}
  else if(kind==='soul'){
   const dx=e.x2-x,dz=e.z2-z;for(let i=0;i<3;i++)this.particle('ember',0xc0cbd9,x,.55+i*.13,z,{life:.4,size:[.05,.08,.05],velocity:[dx*2.5,.1,dz*2.5],opacity:.8});this.rise(e.x2,e.z2,0x91a3b9,.45);
  }else if(kind==='spikeAim')this.riftCast(x,z,1.2,e.angle,false);
  else if(kind==='spikes'){this.riftCast(x,z,1.2,e.angle,true);for(let i=-1;i<=1;i++){const m=this.particle('crystal',0x344252,x+i*.3,.35,z,{life:.4,size:[.15,.75-Math.abs(i)*.2,.13],grow:true,additive:false,priority:1});if(m)m.rotation.z=i*.17;}}
 }
 trackMelee(model,id,serial,age,period){
  if(!model||!['harpoon','shadowblade'].includes(id)||!meleeSwing(id,age,period).trail){this.meleeEdge=null;return;}
  model.updateWorldMatrix(true,false);
  const edge=(id==='harpoon'?[[0,0,1.75],[.13,0,1.57]]:[[1.075,.25,.045],[.50,.71,.045]]).map(p=>model.localToWorld(new T.Vector3(...p))),last=this.meleeEdge;
  if(last?.model===model&&last.serial===serial)for(let i=0;i<2;i++){
   const distance=edge[i].distanceTo(last.edge[i]);if(distance>.004&&distance<2)this.segment(last.edge[i],edge[i],id==='harpoon'?0xa1ccc9:0xc0cddd,i?.008:.017,.075,false,i?0:1,i?.22:.48);
  }
  this.meleeEdge={model,serial,edge};
 }
 muzzle(w,x,z,angle,height=1.15,exact=false){
  const dx=Math.sin(angle),dz=Math.cos(angle),px=x+dx*(exact?0:.65),pz=z+dz*(exact?0:.65),path=w.pathId,rank=w.pathRank||0;
  if(w.id==='miasmalantern'){
   const p=this.particle('sweep',0x9676b5,px,height-.05,pz,{life:.25,size:[.31,.28,1],opacity:.43,additive:false,motion:'lash',roll:-1.2,velocity:[dx*.4,.05,dz*.4]});if(p)p.rotation.set(-.7,angle,.4);
  }else if(w.id==='rifle'||w.id==='shotgun'){
   const scatter=w.id==='shotgun'&&w.count!==1,length=scatter?.22:path==='rifle_pierce'?.19+rank*.015:.16;
   const core=this.particle('crystal',0xffedbd,px+dx*.12,height,pz+dz*.12,{life:.065,size:[scatter?.075:.045,length,scatter?.075:.045],opacity:.95,additive:false,priority:1});if(core)core.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),new T.Vector3(dx,0,dz));
   for(const side of [-1,1]){const a=angle+side*(scatter?.55:.35),spark=this.particle('crystal',0xeab36e,px,height,pz,{life:.10,size:[.017,scatter?.11:.075,.017],velocity:[Math.sin(a)*3,side*.35,Math.cos(a)*3],opacity:.8,additive:false});if(spark)spark.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),new T.Vector3(Math.sin(a),0,Math.cos(a)));}
  }else if(w.id==='crossbow'){
   for(const side of [-1,1])this.segment(new T.Vector3(px+dz*side*.16-dx*.12,height,pz-dx*side*.16-dz*.12),new T.Vector3(px+dx*.24,height,pz+dz*.24),path==='crossbow_pierce'?0xd4e1da:0x9cc5d5,.014,.10,false,0,.55);
  }else if(['shuriken','shadowblade','boomerang'].includes(w.id)){
   const swipe=this.particle('sweep',w.id==='shuriken'?0xb9eedd:w.id==='boomerang'?0xe1cb97:0xb5c4d7,px,height-.1,pz,{life:.14,size:[.28,.21,1],motion:'lash',roll:-4,opacity:.55});if(swipe)swipe.rotation.set(-Math.PI/2,0,-angle);
  }else if(w.id==='fire'){
   this.particle('flame',path==='fire_blast'?0xffd999:0xffa054,px,height,pz,{life:.16,size:[.14,.23,1],velocity:[dx*2,.2,dz*2],opacity:.75});
   this.particle('ember',0xffde9e,px,height,pz,{life:.12,size:[.035,.06,.035],velocity:[dx*3,.4,dz*3],additive:false});
  }else if(['dark','shade'].includes(w.id)){
   const curl=this.particle('sweep',w.id==='dark'?0xa486c9:0x344152,px,height-.05,pz,{life:.18,size:[.24,.19,1],velocity:[dx*.6,.1,dz*.6],motion:'lash',roll:-4,opacity:.55,additive:false});if(curl)curl.rotation.set(-.8,angle,.4);
   this.particle('ember',w.id==='dark'?0xd3b4ed:0xccd5e2,px,height,pz,{life:.12,size:[.035,.05,.035],velocity:[dx*2,0,dz*2],opacity:.8});
  }
 }
 flight(b,dt){
  b.trail=(b.trail||0)-dt;
  if(b.mesh.userData.aura){const aura=b.mesh.userData.aura,elapsed=b.elapsed||0,wave=1+Math.sin(elapsed*(b.kind==='miasmalantern'?7:18))*(b.kind==='miasmalantern'?.04:.07);aura.scale.setScalar(wave);if(b.kind==='dark')aura.rotation.z=b.pathId==='dark_seek'?Math.sin(elapsed*8)*.14:elapsed*(b.pathId==='dark_gravity'?-5:2);if(b.kind==='miasmalantern')aura.rotation.z=Math.sin(elapsed*3)*.25;}
  if(b.trail>0)return;b.trail=['fire','dark'].includes(b.kind)?.075:.095;
  const len=Math.hypot(b.vx,b.vz)||1,dx=b.vx/len,dz=b.vz/len,y=b.height??1.15,path=b.pathId;
  if(['boomerang','shuriken','shadowblade'].includes(b.kind)){
   const bone=b.kind==='boomerang',shadow=b.kind==='shadowblade',color=bone?(b.returning?0xa9c995:0xe3cf9f):shadow?0x8496b0:0x9bdace;
   const arc=this.particle('sweep',color,b.x-dx*.12,bone?(b.height??.82):y,b.z-dz*.12,{life:.13,size:[bone?.28:.23,bone?.20:.17,1],opacity:b.returning?.5:.34,motion:'lash',roll:b.returning?-5:5,additive:false});if(arc)arc.rotation.set(-Math.PI/2,0,-b.mesh.rotation.y);
  }else if(b.kind==='fire'){
   this.particle('flame',path==='fire_blast'?0xffba68:0xff762b,b.x-dx*.18,y,b.z-dz*.18,{life:path==='fire_burn'?.27:.21,size:[.16,path==='fire_burn'?.28:.22,1],velocity:[-b.vx*.08,.4,-b.vz*.08],opacity:.65});
   this.particle('ember',0xffd48b,b.x,y,b.z,{life:.14,size:[.035,.045,.035],velocity:[-b.vx*.12,.1,-b.vz*.12],opacity:.75,additive:false});
  }else if(b.kind==='dark'){
   const curl=this.particle('sweep',path==='dark_seek'?0xab92cd:0x775a96,b.x-dx*.17,y,b.z-dz*.17,{life:.23,size:[.20,.16,1],motion:'lash',roll:path==='dark_gravity'?-5:-2,opacity:.45,additive:false,velocity:[-b.vx*.04,.06,-b.vz*.04]});if(curl)curl.rotation.set(-.9,Math.atan2(dx,dz),.5);
  }else if(b.kind==='shade'){
   this.segment(new T.Vector3(b.x-dx*.12,y,b.z-dz*.12),new T.Vector3(b.x-dx*.5,y,b.z-dz*.5),path==='shade_echo'?0xc3d0df:0x93a2b9,.022,.14,false,0,.58);
  }else if(b.kind==='miasmalantern'){
   b.trail=.11;
   this.particle('smoke',0x64447d,b.x-dx*.22,y-.035,b.z-dz*.22,{life:.30,size:[.16,.13,.20],velocity:[-dx*.75,.12,-dz*.75],grow:true,opacity:.23,additive:false});
   const a=(b.elapsed||0)*6,p=this.particle('crystal',0xab8ec7,b.x-dx*.17+dz*Math.sin(a)*.10,y+.08*Math.cos(a),b.z-dz*.17-dx*Math.sin(a)*.10,{life:.30,size:[.025,.07,.010],velocity:[-dx*.55,.07,-dz*.55],spin:1.2,opacity:.45,additive:false});if(p)p.rotation.z=a;
  }else if(['rifle','shotgun','crossbow'].includes(b.kind)){
   if(b.kind==='shotgun'&&path!=='shotgun_slug')return;
   const crossbow=b.kind==='crossbow',pierce=path==='rifle_pierce'||path==='crossbow_pierce',length=pierce?.62:crossbow?.36:.43;
   this.segment(new T.Vector3(b.x-dx*.16,y,b.z-dz*.16),new T.Vector3(b.x-dx*length,y,b.z-dz*length),crossbow?0xa2c7d6:path==='rifle_rapid'?0xdbb886:0xeed5a3,.014,.08,false,0,.42);
  }
 }
 projectile(w){
  const path=w.pathId,rank=w.pathRank||0;
  if(w.id==='boomerang'){const b=boneBoomerang();b.scale.setScalar(.72);return b;}
  const g=new T.Group(),part=(shape,color,scale,z=0)=>{if(!this.materials.has(color))this.materials.set(color,new T.MeshBasicMaterial({color,side:T.DoubleSide}));const m=new T.Mesh(this.geometry[shape],this.materials.get(color));m.scale.set(...scale);m.position.z=z;g.add(m);return m;};
  if(w.id==='miasmalantern'){
   // Soft, round poison body follows the 0.34 m collision silhouette; no needle shaft.
   this.geometry.miasmaOrb||=new T.SphereGeometry(1,16,12);
   const material=(key,color,opacity,map=null)=>{if(!this.materials.has(key))this.materials.set(key,new T.MeshBasicMaterial({color,transparent:true,opacity,depthWrite:false,side:T.DoubleSide,forceSinglePass:key==='miasma-halo',map}));return this.materials.get(key);};
   const core=new T.Mesh(this.geometry.miasmaOrb,material('miasma-core',0x5a3676,.82));core.name='miasma-orb-core';core.scale.set(.29,.28,.34);g.add(core);
   const aura=new T.Group();aura.name='miasma-orb-aura';g.add(aura);g.userData.aura=aura;
   const heart=new T.Mesh(this.geometry.miasmaOrb,material('miasma-heart',0xc1a3db,.35));heart.scale.set(.16,.14,.18);heart.position.set(-.045,.055,.08);aura.add(heart);
   for(const angle of[0,Math.PI/2]){const veil=new T.Mesh(this.geometry.veil,material('miasma-halo',0x9570b9,.32,this.shadowTexture));veil.scale.set(.37,.34,1);veil.rotation.y=angle;aura.add(veil);}
   for(const side of[-1,1]){const wisp=new T.Mesh(this.geometry.miasmaOrb,material('miasma-wisp',0x40244f,.48));wisp.scale.set(.10,.14,.23);wisp.position.set(side*.15,-.04,-.15);wisp.rotation.z=side*.4;g.add(wisp);}
  }else if(w.id==='fire'){
   const blast=path==='fire_blast',burn=path==='fire_burn';part('ember',blast?0xc95328:0xe87935,[.23,.22,.30]);part('crystal',blast?0xffe0a0:0xffcf76,[.11,.25,.11],.12).rotation.x=Math.PI/2;
   const aura=new T.Group();g.add(aura);g.userData.aura=aura;const key='fire-flight';if(!this.materials.has(key))this.materials.set(key,new T.MeshBasicMaterial({map:this.flameTexture,color:0xff8a34,transparent:true,opacity:.68,depthWrite:false,side:T.DoubleSide,forceSinglePass:true,blending:T.AdditiveBlending}));for(const angle of [0,Math.PI/2]){const flame=new T.Mesh(this.geometry.flame,this.materials.get(key));flame.scale.set(.24,burn?.55+rank*.025:.43,1);flame.position.z=burn?-.30:-.23;flame.rotation.set(Math.PI/2,angle,0);aura.add(flame);}
   if(blast)for(const side of [-1,1]){const seam=part('crystal',0xffc36e,[.025,.17,.025]);seam.position.x=side*.16;seam.rotation.x=Math.PI/2;}
  }else if(w.id==='shade'){
   part('ember',0x101925,[.14,.13,.23]);for(const side of [-1,0,1]){const barb=part('crystal',side===0?0xd6dfe8:path==='shade_blight'?0x9eafc6:0x65788f,[side===0?.045:.028,side===0?.28:.20,.035],side===0?.12:-.06);barb.position.x=side*.10;barb.rotation.set(Math.PI/2,0,-side*.23);}
  }else if(w.id==='shadowblade'){
   const blade=part('ember',0x243347,[1,1,1]);blade.geometry=shadowCrescentGeometry;blade.rotation.x=Math.PI/2;
   const edge=part('ember',path==='shadowblade_return'?0xd2dbe7:0x9caec5,[.87,.87,.87]);edge.geometry=shadowCrescentGeometry;edge.rotation.x=Math.PI/2;edge.position.y=.012;
  }else if(w.id==='dark'){
   const seek=path==='dark_seek',gravity=path==='dark_gravity';part('ember',0x352542,seek?[.17,.17,.30]:[.25,.24,.29]);part('crystal',gravity?0xb596d6:0xd2b4ed,[.065,seek?.30:.21,.065],.09).rotation.x=Math.PI/2;
   const aura=new T.Group();g.add(aura);g.userData.aura=aura;
   for(const side of [-1,1]){const wing=part('crystal',gravity?0x9070ad:0xac8ac9,[seek?.065:.055,seek?.23:.14,.035],-.13);wing.position.x=side*(seek?.17:.23);wing.rotation.set(Math.PI/2,0,side*(seek?.48:.7));aura.add(wing);}
  }else if(w.id==='shuriken'){
   for(let i=0;i<3;i++){const a=i*Math.PI*2/3,blade=part('crystal',i?0x82c5b7:0xc0eee0,[.065,.23,.022]);blade.position.set(Math.sin(a)*.09,0,Math.cos(a)*.09);blade.rotation.set(Math.PI/2,0,-a);}
   part('ember',path==='shuriken_return'?0xe1f4cb:0xe1fff3,[.075,.035,.075]);
  }else if(w.id==='crossbow'){
   const pierce=path==='crossbow_pierce';part('ray',0x435363,[.03,.03,pierce?.73:.66]);part('crystal',pierce?0xe0e2ce:0xd9f1ff,[.055,pierce?.19:.14,.045],.35).rotation.x=Math.PI/2;
   for(const side of [-1,1]){const feather=part('crystal',path==='crossbow_hunt'?0x91c9cf:0xa8cee5,[.055,.12,.012],-.25);feather.position.x=side*.065;feather.rotation.set(Math.PI/2,0,side*.65);}
  }else{
   const heavy=w.id==='shotgun'&&w.count===1,scatter=w.id==='shotgun'&&!heavy,pierce=path==='rifle_pierce',length=heavy?.17:scatter?.075:pierce?.31+rank*.015:.23,width=heavy?.07:scatter?.035:.026;
   part('crystal',heavy?0xffd094:0xffedb7,[width,length,width],.04).rotation.x=Math.PI/2;
   part('ray',w.color??0xffdc91,[heavy?.045:.018,heavy?.04:.018,scatter?.09:heavy?.24:.26],scatter?-.08:heavy?-.17:-.22);
  }
  return g;
 }
}
