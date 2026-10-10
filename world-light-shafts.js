import * as T from './vendor/three.module.js';

const tones={forest:[0xf4d3a0,1],snow:[0xd9e9ff,.76],coast:[0xdceaf1,.72],sand:[0xe7c294,.50],ash:[0xe8b8a2,.32]};
const direction=new T.Vector3(-18,30,14).normalize(),rotation=new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),direction);
// Broad crossed sheets share one draw; grazing views fade instead of forming bright lines.
const geometry=(()=>{
 const positions=[],uv=[],indices=[];
 for(let plane=0;plane<3;plane++){
  const start=positions.length/3,angle=plane*Math.PI/3;
  for(const [v,side]of [[0,-1],[0,1],[1,-1],[1,1]]){
   const x=side*(v?.34:.5);positions.push(Math.cos(angle)*x,v,Math.sin(angle)*x);uv.push(side<0?0:1,v);
  }
  indices.push(start,start+1,start+2,start+1,start+3,start+2);
 }
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(indices);g.computeVertexNormals();g.computeBoundingSphere();return g;
})();

const vertexShader=`
#include <fog_pars_vertex>
varying vec2 shaftUV;
varying vec3 shaftColor;
varying float shaftPhase;
varying vec3 shaftNormal;
varying vec3 shaftView;
void main(){
 shaftUV=uv;
 shaftColor=instanceColor;
 shaftPhase=dot(instanceMatrix[3].xz,vec2(.17,.11));
 vec4 mvPosition=modelViewMatrix*instanceMatrix*vec4(position,1.0);
 shaftNormal=normalize(normalMatrix*mat3(instanceMatrix)*normal);
 shaftView=-mvPosition.xyz;
 gl_Position=projectionMatrix*mvPosition;
 #include <fog_vertex>
}`;
const fragmentShader=`
#include <fog_pars_fragment>
uniform float shaftTime;
uniform float shaftStrength;
varying vec2 shaftUV;
varying vec3 shaftColor;
varying float shaftPhase;
varying vec3 shaftNormal;
varying vec3 shaftView;
void main(){
 float edge=1.0-abs(shaftUV.x*2.0-1.0);
 edge=edge*edge*(3.0-2.0*edge);
 float ends=smoothstep(.03,.23,shaftUV.y)*(1.0-smoothstep(.58,1.0,shaftUV.y));
 float air=.90+.10*sin(shaftTime*.17+shaftPhase);
 float bands=.93+.07*sin(shaftUV.y*8.0+shaftPhase+shaftTime*.12);
 float facing=abs(dot(normalize(shaftNormal),normalize(shaftView)));
 float viewFade=smoothstep(.16,.55,facing)*smoothstep(.8,3.0,length(shaftView));
 gl_FragColor=vec4(shaftColor,.025*shaftStrength*edge*ends*air*bands*viewFade);
 #include <tonemapping_fragment>
 #include <colorspace_fragment>
 // Additive light fades into the fog rather than adding an opaque fog tint.
 #ifdef USE_FOG
  #ifdef FOG_EXP2
   gl_FragColor.a*=exp(-fogDensity*fogDensity*vFogDepth*vFogDepth);
  #else
   gl_FragColor.a*=1.0-smoothstep(fogNear,fogFar,vFogDepth);
  #endif
 #endif
}`;

function openGround(world,x,z,region){
 const half=world.half??96;
 if(Math.abs(x)>half-7||Math.abs(z)>half-7||region&&!region.contains(x,z))return false;
 if((world.obstacles||[]).some(o=>Math.hypot(x-o.x,z-o.z)<(o.r||0)+1.1))return false;
 if((world.sites||[]).some(s=>Math.hypot(x-s.x,z-s.z)<3.2))return false;
 if((world.patches||[]).some(p=>p.kind==='vent'&&Math.hypot(x-p.x,z-p.z)<p.r+2))return false;
 return !(world.ponds||[]).some(p=>{
  const a=p.angle||0,dx=x-p.x,dz=z-p.z,rx=p.baseRx===undefined?(p.rx||p.r):p.baseRx*1.19,rz=p.baseRz===undefined?(p.rz||p.r):p.baseRz*1.19;
  return Math.hypot((Math.cos(a)*dx-Math.sin(a)*dz)/(rx+1),(Math.sin(a)*dx+Math.cos(a)*dz)/(rz+1))<1.12;
 });
}

export function installWorldLightShafts(world,mapId){
 if(world.lightShafts&&!world.lightShafts.userData.disposed)return world.lightShafts;
 if(!tones[mapId]&&mapId!=='confluence')return null;
 const focuses=[{point:world.spawn,biome:mapId==='confluence'?'forest':mapId}];
 if(world.forestVista?.gateCenter)focuses.push({point:world.forestVista.gateCenter,biome:'forest'});
 if(mapId==='confluence'){
  for(const region of world.regions||[])focuses.push({point:(world.sites||[]).find(s=>s.biome===region.id)||region,biome:region.id,region});
 }else for(const site of world.sites||[])focuses.push({point:site,biome:mapId});
 const anchors=[],limit=mapId==='confluence'?6:mapId==='ash'?2:mapId==='sand'?3:4;
 const offsets=[[3.8,2.8],[-3.8,-2.8],[3.8,-3.2],[-3.8,3.2],[5.6,0],[0,-5.6]];
 for(const focus of focuses){
  if(anchors.length>=limit)break;
  if(!focus.point||!tones[focus.biome])continue;
  for(const [dx,dz]of offsets){
   const x=focus.point.x+dx,z=focus.point.z+dz;
   if(!Number.isFinite(x+z)||!openGround(world,x,z,focus.region)||anchors.some(p=>Math.hypot(x-p.x,z-p.z)<8))continue;
   anchors.push({x,z,biome:focus.biome});break;
  }
 }
 if(!anchors.length)return null;
 const clock={value:0},material=new T.ShaderMaterial({vertexShader,fragmentShader,uniforms:T.UniformsUtils.merge([T.UniformsLib.fog,{shaftTime:clock,shaftStrength:{value:1}}]),transparent:true,depthWrite:false,depthTest:true,blending:T.AdditiveBlending,side:T.DoubleSide,forceSinglePass:true,fog:true});
 const shafts=new T.InstancedMesh(geometry,material,anchors.length),matrix=new T.Matrix4();shafts.name='World_soft_light_shafts';shafts.renderOrder=-1;
 for(const [i,p]of anchors.entries()){
  const width=2.7+(i%2)*.35,height=(p.biome==='forest'?10:8.5)+(i%3)*.5;
  matrix.compose(new T.Vector3(p.x,.40,p.z),rotation,new T.Vector3(width,height,width));shafts.setMatrixAt(i,matrix);
  const [color,strength]=tones[p.biome];shafts.setColorAt(i,new T.Color(color).multiplyScalar(strength));
 }
 shafts.instanceMatrix.needsUpdate=true;shafts.instanceColor.needsUpdate=true;shafts.computeBoundingSphere();
 shafts.userData.anchors=anchors;shafts.userData.disposed=false;shafts.userData.direction=direction.clone();
 // Existing world cleanup already disposes InstancedMesh objects. Keep only the static geometry cached.
 shafts.addEventListener('dispose',()=>{if(shafts.userData.disposed)return;shafts.userData.disposed=true;shafts.visible=false;material.dispose();});
 world.group.add(shafts);world.lightShafts=shafts;return shafts;
}

const shaftMatrix=new T.Matrix4(),shaftRotation=new T.Quaternion(),shaftUp=new T.Vector3(0,1,0),shaftPosition=new T.Vector3(),shaftScale=new T.Vector3(),shaftColor=new T.Color();
export function updateWorldLightShafts(world,gameTime,lighting=null){
 const shafts=world.lightShafts;
 if(shafts&&!shafts.userData.disposed&&Number.isFinite(gameTime)){
  shafts.material.uniforms.shaftTime.value=gameTime;
  if(lighting){
   shafts.material.uniforms.shaftStrength.value=lighting.shaftStrength;
   if(shafts.userData.direction.distanceToSquared(lighting.direction)>1e-8){
    shaftRotation.setFromUnitVectors(shaftUp,lighting.direction);
    for(let i=0;i<shafts.count;i++){
     shafts.getMatrixAt(i,shaftMatrix);shaftPosition.setFromMatrixPosition(shaftMatrix);shaftScale.setFromMatrixScale(shaftMatrix);
     shaftMatrix.compose(shaftPosition,shaftRotation,shaftScale);shafts.setMatrixAt(i,shaftMatrix);
    }
    shafts.userData.direction.copy(lighting.direction);shafts.instanceMatrix.needsUpdate=true;shafts.computeBoundingSphere();
   }
   for(const[i,p]of shafts.userData.anchors.entries()){
    const[color,strength]=tones[p.biome];shaftColor.set(color);
    if(p.biome==='forest')shaftColor.copy(lighting.sun.color);
    shafts.setColorAt(i,shaftColor.multiplyScalar(strength));
   }
   shafts.instanceColor.needsUpdate=true;
  }
 }
 const mist=world.forestMist;
 if(mist&&!mist.userData.disposed&&Number.isFinite(gameTime)){
  mist.material.uniforms.mistTime.value=gameTime;
  if(lighting){mist.material.uniforms.mistColor.value.copy(lighting.scene.fog.color);mist.material.uniforms.mistOpacity.value=.055+.025*(1-lighting.day);}
 }
}

// ponytail: crossed instanced mist volumes, not ray-marched fog. Keep a low opacity
// ceiling; replace with depth-aware volumetrics only when a measured GPU budget permits it.
export function installForestMist(world,mapId,{mobile=false}={}){
 if(world.forestMist&&!world.forestMist.userData.disposed)return world.forestMist;
 if(mapId!=='forest'&&mapId!=='confluence')return null;
 const region=world.regions?.find(r=>r.id==='forest'),focus=region||world.spawn;
 if(!focus)return null;
 const anchors=[];
 for(let i=0;i<24&&anchors.length<(mobile?3:6);i++){
  const angle=i*2.399963,r=11+(i%4)*9,x=focus.x+Math.cos(angle)*r,z=focus.z+Math.sin(angle)*r;
  if(!openGround(world,x,z,region)||anchors.some(p=>Math.hypot(x-p.x,z-p.z)<12))continue;
  // The shader fades close to the camera, preserving nearby combat silhouettes.
  anchors.push({x,z});
 }
 if(!anchors.length)return null;
 const material=new T.ShaderMaterial({transparent:true,depthWrite:false,depthTest:true,side:T.DoubleSide,forceSinglePass:true,
  uniforms:{mistTime:{value:0},mistColor:{value:new T.Color(0x829b91)},mistOpacity:{value:.055}},
  vertexShader:`varying vec2 mistUV;varying float mistPhase;varying float mistDistance;
   void main(){mistUV=uv;mistPhase=dot(instanceMatrix[3].xz,vec2(.19,.13));vec4 p=modelViewMatrix*instanceMatrix*vec4(position,1.);mistDistance=length(p.xyz);gl_Position=projectionMatrix*p;}`,
  fragmentShader:`uniform float mistTime;uniform vec3 mistColor;uniform float mistOpacity;varying vec2 mistUV;varying float mistPhase;varying float mistDistance;
   void main(){vec2 p=mistUV;float edge=pow(max(0.,1.-abs(p.x*2.-1.)),2.);float height=smoothstep(0.,.15,p.y)*(1.-smoothstep(.18,1.,p.y));float drift=.68+.16*sin(p.x*11.+p.y*6.+mistPhase+mistTime*.10)+.12*sin(p.x*23.-p.y*8.-mistTime*.07);float nearFade=smoothstep(2.,7.,mistDistance);float farFade=1.-smoothstep(45.,72.,mistDistance);gl_FragColor=vec4(mistColor,mistOpacity*edge*height*drift*nearFade*farFade);
   #include <colorspace_fragment>
  }`});
 const mist=new T.InstancedMesh(geometry,material,anchors.length);mist.name='FX_Forest_GroundMist_A';mist.renderOrder=-2;
 for(const[i,p]of anchors.entries()){
  shaftRotation.setFromAxisAngle(shaftUp,i*2.4);shaftMatrix.compose(shaftPosition.set(p.x,.08,p.z),shaftRotation,shaftScale.set(14+(i%3)*2,1.8+(i%2)*.4,14+(i%3)*2));mist.setMatrixAt(i,shaftMatrix);
 }
 mist.instanceMatrix.needsUpdate=true;mist.computeBoundingSphere();mist.userData.anchors=anchors;mist.userData.disposed=false;
 mist.addEventListener('dispose',()=>{if(mist.userData.disposed)return;mist.userData.disposed=true;mist.visible=false;material.dispose();});
 world.group.add(mist);world.forestMist=mist;return mist;
}
