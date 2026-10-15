import * as T from './vendor/three.module.js';
import {flatGround,fitGroundSurface,disposeGroundSurface} from './ground-cues.js?v=207';
import {POISON} from './poison-config.js?v=207';
const UP=new T.Vector3(0,1,0);
const clamp=x=>Math.max(0,Math.min(1,x));
const fogVertex=`varying vec2 fieldUv;varying float fieldAspect;uniform float aspect;
void main(){fieldUv=uv;vec4 p=vec4(position,1.0);fieldAspect=aspect;
#ifdef USE_INSTANCING
fieldAspect=length(instanceMatrix[0].xyz)/max(.001,length(instanceMatrix[1].xyz));p=instanceMatrix*p;
#endif
gl_Position=projectionMatrix*modelViewMatrix*p;}`;
const fogFragment=`uniform float clock;uniform float seed;uniform float opacity;uniform float shape;uniform float mature;uniform float coreRatio;varying vec2 fieldUv;varying float fieldAspect;
void main(){vec2 q=fieldUv*2.0-1.0;float d=length(q);if(shape>.5&&shape<1.5){vec2 p=vec2(q.x*fieldAspect,q.y);d=length(vec2(max(0.0,abs(p.x)-(fieldAspect-1.0)),p.y));}else if(shape>1.5)d=max(abs(q.x),abs(q.y));
float boundary=1.0-smoothstep(.68,1.0,d);float drift=sin(q.x*7.0+q.y*4.0+clock*.53+seed)*sin(q.y*8.0-q.x*3.0-clock*.39);float wisps=.65+.35*sin(q.x*11.0+q.y*7.0+drift*2.0-clock*.7);vec3 color=mix(vec3(.19,.30,.13),vec3(.43,.51,.22),wisps);color=mix(color,vec3(.53,.52,.24),mature*.2);float core=coreRatio>0.0?1.0-smoothstep(coreRatio*.65,coreRatio,length(q)):0.0;color=mix(color,vec3(.63,.59,.24),core*.62);gl_FragColor=vec4(color,boundary*(.56+.44*wisps)*opacity+core*opacity*.65);}`;
function fogMaterial(shape=0){return new T.ShaderMaterial({uniforms:{clock:{value:0},seed:{value:0},opacity:{value:.19},shape:{value:shape},mature:{value:0},coreRatio:{value:0},aspect:{value:1}},vertexShader:fogVertex,fragmentShader:fogFragment,transparent:true,depthWrite:false,side:T.DoubleSide});}
// Fixed pools: three ground fields, two segmented trails, three thrown seed pods.
// Persistent surfaces sit below feet; transient fragments use the existing bounded VFX pool.
export class PoisonVFX{
 constructor(scene,vfx,{groundHeight=vfx?.groundHeight||flatGround}={}){this.groundHeight=groundHeight;this.scene=scene;this.vfx=vfx;this.group=new T.Group();this.group.name='Wuling_poison_effects';scene.add(this.group);this.plane=new T.PlaneGeometry(2,2);this.podGeometry=new T.SphereGeometry(1,10,6);this.leafGeometry=new T.SphereGeometry(1,7,4);this.fog=[];this.dummy=new T.Object3D();this.clouds=[];
  for(let i=0;i<POISON.maxClouds;i++){const m=new T.Mesh(this.plane,fogMaterial());m.rotation.x=-Math.PI/2;m.visible=false;m.frustumCulled=false;m.renderOrder=1;m.userData.poisonField=true;this.group.add(m);this.fog.push(m);}
  this.bands=Array.from({length:POISON.maxBands},()=>{const g=new T.BufferGeometry(),indices=[];g.setAttribute('position',new T.BufferAttribute(new Float32Array(128*2*3),3));g.setAttribute('uv',new T.BufferAttribute(new Float32Array(128*2*2),2));for(let i=0;i<127;i++){const a=i*2;indices.push(a,a+1,a+2,a+1,a+3,a+2);}g.setIndex(indices);g.setDrawRange(0,0);const m=new T.Mesh(g,fogMaterial(1));m.frustumCulled=false;m.renderOrder=1;m.visible=false;this.group.add(m);return m;});
  const make=(geometry,color,count)=>{const material=new T.MeshStandardMaterial({color,roughness:.83,transparent:true,opacity:.85,depthWrite:false}),m=new T.InstancedMesh(geometry,material,count);m.count=0;m.frustumCulled=false;this.group.add(m);return m;};
  this.pods=make(this.podGeometry,0x9c9c62,POISON.maxPods);this.stems=make(this.leafGeometry,0x655b36,POISON.maxPods);this.spores=make(this.leafGeometry,0xc6c58a,30);this.guard=make(this.leafGeometry,0xb2ba83,6);
 }
 set(mesh,i,x,y,z,sx,sy,sz,angle=0,flat=false){const d=this.dummy;d.position.set(x,y,z);d.scale.set(sx,sy,sz);d.rotation.set(0,angle,0);if(flat)d.rotateX(-Math.PI/2);d.updateMatrix();mesh.setMatrixAt(i,d.matrix);}
 update(combat,player){const now=combat?.now||0;this.group.visible=!!combat;if(!combat)return;let spores=0;const clouds=(combat.clouds||[]).filter(c=>!c.carried&&c.expires>now).slice(0,POISON.maxClouds);this.clouds=clouds;
  for(let i=0;i<this.fog.length;i++){const m=this.fog[i],c=clouds[i];m.visible=!!c;if(!c)continue;const mature=c.stillRank>=2?clamp((now-c.settledAt)/POISON.matureTime):0,curtain=now<c.curtainUntil,fade=clamp((c.expires-now)/.5),u=m.material.uniforms;u.clock.value=now;u.seed.value=(Number(c.id)||i)*.79;u.opacity.value=(curtain?.22:.20)*fade;u.shape.value=curtain?2:0;u.mature.value=mature;u.coreRatio.value=!curtain&&c.stillRank>=3&&mature>=1?POISON.coreRadius/c.r:0;m.position.set(c.x,.07+i*.002,c.z);m.rotation.set(-Math.PI/2,0,0);m.rotateOnWorldAxis(UP,c.angle||0);m.scale.set(curtain?POISON.curtainHalfWidth:c.r,curtain?POISON.curtainHalfDepth:c.r,1);fitGroundSurface(m,this.groundHeight);
   const n=curtain?5:6;for(let j=0;j<n&&spores<30;j++){const a=j*2.399+(c.id||0),r=c.r*(.23+.10*(j%4)),x=curtain?Math.cos(c.angle||0)*(j-2)*1.1:Math.sin(a+now*.15)*r,z=curtain?-Math.sin(c.angle||0)*(j-2)*1.1:Math.cos(a+now*.15)*r;this.set(this.spores,spores++,c.x+x,this.groundHeight(c.x+x,c.z+z)+.13+(Math.sin(now*1.6+j)+1)*.07,c.z+z,.035,.07,.025,now*.3+j);}
   if(c.stillRank>=3&&mature>=.99)for(let j=0;j<4&&spores<30;j++){const a=j*Math.PI/2;this.set(this.spores,spores++,c.x+Math.sin(a)*.22,this.groundHeight(c.x,c.z)+.16+Math.sin(now*2)*.015,c.z+Math.cos(a)*.22,.065,.13,.035,a);}
  }this.spores.count=spores;this.spores.instanceMatrix.needsUpdate=true;
  for(let i=0;i<this.bands.length;i++){
   const mesh=this.bands[i],b=(combat.bands||[])[i],points=b?.points||[],count=Math.min(128,points.length);mesh.visible=!!b&&b.expires>now&&count>1;if(!mesh.visible)continue;
   const r=b.r||POISON.bandRadius,cache=mesh.userData.bandFit;
   // Trail points are fixed when emitted; detect edits without allocating geometry each frame.
   let changed=!cache||cache.band!==b||cache.r!==r||cache.count!==count;
   if(!changed)for(let j=0;j<count;j++)if(cache.coords[j*2]!==points[j].x||cache.coords[j*2+1]!==points[j].z){changed=true;break;}
   if(changed){
    const pos=mesh.geometry.attributes.position,uv=mesh.geometry.attributes.uv,distances=[0],coords=new Float64Array(count*2),path=[points[0]],maxSteps=Math.floor(127/(count-1));let total=0;
    // Coarse frame rates can leave long dash segments. Subdivide within the same
    // 128-row allocation; never discard an actual turn or add GPU buffers.
    for(let j=0;j<count;j++){coords[j*2]=points[j].x;coords[j*2+1]=points[j].z;if(!j)continue;const a=points[j-1],b=points[j],steps=Math.min(maxSteps,Math.max(1,Math.ceil(Math.hypot(b.x-a.x,b.z-a.z)/.6)));for(let k=1;k<=steps;k++)path.push({x:T.MathUtils.lerp(a.x,b.x,k/steps),z:T.MathUtils.lerp(a.z,b.z,k/steps)});}
    for(let j=1;j<path.length;j++){total+=Math.hypot(path[j].x-path[j-1].x,path[j].z-path[j-1].z);distances.push(total);}
    for(let j=0;j<path.length;j++){const a=path[Math.max(0,j-1)],p=path[j],end=path[Math.min(path.length-1,j+1)],dx=end.x-a.x,dz=end.z-a.z,len=Math.hypot(dx,dz)||1,tx=dx/len,tz=dz/len,cap=j===0?-r:j===path.length-1?r:0;
     for(let side=0;side<2;side++){const sign=side?1:-1,index=j*2+side,x=p.x+tx*cap-tz*r*sign,z=p.z+tz*cap+tx*r*sign;pos.setXYZ(index,x,this.groundHeight(x,z)+.061,z);uv.setXY(index,(distances[j]+r+cap)/Math.max(.01,total+2*r),side);}
    }
    pos.needsUpdate=uv.needsUpdate=true;mesh.geometry.setDrawRange(0,(path.length-1)*6);mesh.userData.bandFit={band:b,r,count,coords,total};
   }
   const u=mesh.material.uniforms;u.clock.value=now;u.opacity.value=.19*clamp((b.expires-now)/.25);u.aspect.value=(mesh.userData.bandFit.total+2*r)/(2*r);
  }
  let pods=0;for(const p of(combat.pods||[]).slice(0,POISON.maxPods)){if(now<p.releaseAt||now>p.landAt)continue;const t=clamp((now-p.releaseAt)/Math.max(.01,p.landAt-p.releaseAt)),x=T.MathUtils.lerp(p.startX,p.x,t),z=T.MathUtils.lerp(p.startZ,p.z,t),y=(p.startY??(this.groundHeight(p.startX,p.startZ)+.88))*(1-t)+this.groundHeight(p.x,p.z)*t+Math.sin(t*Math.PI)*1.35;this.set(this.pods,pods,x,y,z,.105,.15,.10,now*8);this.set(this.stems,pods,x,y+.14,z,.025,.07,.028,now*8);pods++;}this.pods.count=this.stems.count=pods;this.pods.instanceMatrix.needsUpdate=this.stems.instanceMatrix.needsUpdate=true;
  const shield=!!player&&combat.shield?.amount>0&&combat.shield.until>now;this.guard.count=shield?6:0;if(shield)for(let i=0;i<6;i++){const a=i*Math.PI/3+now*.24;this.set(this.guard,i,player.x+Math.sin(a)*.48,(Number.isFinite(player.y)?player.y:this.groundHeight(player.x,player.z))+.67+Math.cos(a*2)*.06,player.z+Math.cos(a)*.48,.035,.15,.025,-a);}this.guard.instanceMatrix.needsUpdate=true;
 }
 event(e){if(!e||!Number.isFinite(e.x)||!Number.isFinite(e.z))return;const v=this.vfx;if(!v)return;const particle=(shape,color,x,y,z,opts)=>v.groundParticle?v.groundParticle(shape,color,x,y,z,opts,this.groundHeight):v.particle(shape,color,x,y+this.groundHeight(x,z),z,opts);const cloud=(x,z,size,life=.4)=>particle('veil',0x6f8749,x,.11,z,{life,size:[size,size*.75,1],opacity:.23,additive:false,grow:true,priority:1});
  if(e.kind==='poisonLand'){particle('vapor',0x78865e,e.x,.11,e.z,{life:.48,size:[Math.min(1.2,e.r||1),.66,1],opacity:.27,additive:false,grow:true,priority:1});for(let i=0;i<5;i++){const a=i*2.4,leaf=particle('claw',i%2?0x918452:0xb6bb77,e.x,.18,e.z,{life:.34+i*.025,size:[.16,.13,1],velocity:[Math.sin(a)*1.1,.7,Math.cos(a)*1.1],gravity:4,opacity:.68,additive:false,spin:2,roll:i%2?2:-2,endColor:0x596543});if(leaf)leaf.rotation.set(-.65,a,a);}}
  else if(e.kind==='poisonPickup'||e.kind==='poisonMove'){cloud(e.x,e.z,.55,.3);for(let i=0;i<3;i++){const a=(e.angle||0)+(i-1)*.5;particle('smoke',0x809154,e.x,.25,e.z,{life:.35,size:[.15,.11,.24],velocity:[Math.sin(a)*-.7,.2,Math.cos(a)*-.7],opacity:.32,additive:false});}}
  else if(e.kind==='poisonSpread'){if(Number.isFinite(e.x2)&&Number.isFinite(e.z2))for(let i=0;i<4;i++){const t=(i+.5)/4;particle('ember',0xbbc27b,T.MathUtils.lerp(e.x,e.x2,t),.5+Math.sin(t*Math.PI)*.3,T.MathUtils.lerp(e.z,e.z2,t),{life:.3,size:[.035,.05,.025],opacity:.65,additive:false});}}
  else if(e.kind==='poisonGuard')for(let i=0;i<5;i++){const a=i*2.4;particle('crystal',0xbdc889,e.x+Math.sin(a)*.45,.7,e.z+Math.cos(a)*.45,{life:.35,size:[.035,.15,.035],velocity:[0,.4,0],opacity:.65,additive:false});}
  else if(e.kind==='poisonStatus'){const size=Math.max(.25,e.size||.6);particle('smoke',e.variant?0xb6bb78:0x718951,e.x+size*.3,.38,e.z,{life:.33,size:[.08,.17,.08],velocity:[.06,.36,0],opacity:.4,additive:false});}
 }
 clear(){this.clouds=[];for(const m of this.fog){m.visible=false;disposeGroundSurface(m);}for(const m of this.bands){m.visible=false;delete m.userData.bandFit;}for(const m of[this.pods,this.stems,this.spores,this.guard])m.count=0;}
 dispose(){this.clear();this.group.removeFromParent();this.plane.dispose();this.podGeometry.dispose();this.leafGeometry.dispose();for(const m of this.fog)m.material.dispose();for(const m of this.bands){m.geometry.dispose();m.material.dispose();}for(const m of[this.pods,this.stems,this.spores,this.guard]){m.dispose();m.material.dispose();}}
}
