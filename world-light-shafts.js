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
 gl_FragColor=vec4(shaftColor,.025*edge*ends*air*bands*viewFade);
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
 const clock={value:0},material=new T.ShaderMaterial({vertexShader,fragmentShader,uniforms:T.UniformsUtils.merge([T.UniformsLib.fog,{shaftTime:clock}]),transparent:true,depthWrite:false,depthTest:true,blending:T.AdditiveBlending,side:T.DoubleSide,forceSinglePass:true,fog:true});
 const shafts=new T.InstancedMesh(geometry,material,anchors.length),matrix=new T.Matrix4();shafts.name='World_soft_light_shafts';shafts.renderOrder=-1;
 for(const [i,p]of anchors.entries()){
  const width=2.7+(i%2)*.35,height=(p.biome==='forest'?10:8.5)+(i%3)*.5;
  matrix.compose(new T.Vector3(p.x,.40,p.z),rotation,new T.Vector3(width,height,width));shafts.setMatrixAt(i,matrix);
  const [color,strength]=tones[p.biome];shafts.setColorAt(i,new T.Color(color).multiplyScalar(strength));
 }
 shafts.instanceMatrix.needsUpdate=true;shafts.instanceColor.needsUpdate=true;shafts.computeBoundingSphere();
 shafts.userData.anchors=anchors;shafts.userData.disposed=false;
 // Existing world cleanup already disposes InstancedMesh objects. Keep only the static geometry cached.
 shafts.addEventListener('dispose',()=>{if(shafts.userData.disposed)return;shafts.userData.disposed=true;shafts.visible=false;material.dispose();});
 world.group.add(shafts);world.lightShafts=shafts;return shafts;
}

export function updateWorldLightShafts(world,gameTime){
 const shafts=world.lightShafts;
 if(shafts&&!shafts.userData.disposed&&Number.isFinite(gameTime))shafts.material.uniforms.shaftTime.value=gameTime;
}
