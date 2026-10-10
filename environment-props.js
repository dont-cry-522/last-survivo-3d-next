import * as T from './vendor/three.module.js';
import{finishRock,installGroundSurface}from'./biome-scenery.js?v=125';
import{surfaceUniforms}from'./surface-textures.js?v=120';

// Shared rounded edges catch side light without adding meshes or changing collision footprints.
const block=new T.BoxGeometry(1,1,1,3,3,3),p=block.attributes.position,colors=[],v=new T.Vector3(),core=new T.Vector3();
for(let i=0;i<p.count;i++){
 v.fromBufferAttribute(p,i);core.copy(v).clampScalar(-.455,.455);v.sub(core).normalize().multiplyScalar(.045).add(core);p.setXYZ(i,v.x,v.y,v.z);
 const wear=.95+.035*Math.sin(v.x*12+v.y*7-v.z*9);colors.push(wear,wear,wear);
}
block.setAttribute('color',new T.Float32BufferAttribute(colors,3));block.computeVertexNormals();
// Eroded corners and an uneven crown stay inside the original solid footprint.
export const wornStoneBlock=block.clone();
const stonePosition=wornStoneBlock.attributes.position,stoneColor=wornStoneBlock.attributes.color;
for(let i=0;i<stonePosition.count;i++){
 const x=stonePosition.getX(i),y=stonePosition.getY(i),z=stonePosition.getZ(i),edge=Math.max(Math.abs(x),Math.abs(z)),chip=Math.max(0,x+z+.18),wear=.94+.035*Math.sin(x*13+z*7-y*5);
 stonePosition.setXYZ(i,x*(.97-.13*Math.max(0,z+.1)),y-(y+.5)*(.014+chip*.12),z*(.96-.10*Math.max(0,-x+.1)));
 const shade=wear-Math.max(0,edge-.3)*.22;stoneColor.setXYZ(i,shade*1.015,shade,shade*.98);
}
wornStoneBlock.computeVertexNormals();
const wornColumns=new Map();
function stoneColumn(source){
 if(wornColumns.has(source))return wornColumns.get(source);
 const geometry=source.clone(),p=geometry.attributes.position,h=source.parameters.height;
 for(let i=0;i<p.count;i++){
  const x=p.getX(i),y=p.getY(i),z=p.getZ(i),a=Math.atan2(z,x),t=y/h+.5,inset=.976-.017*Math.sin(a*3+t*2)-.007*Math.cos(a*7-t*3);
  p.setXYZ(i,x*inset,y-t*h*(.020+.011*Math.sin(a*2+.4)+.007*Math.cos(a*5)),z*inset);
 }
 geometry.computeVertexNormals();wornColumns.set(source,geometry);return geometry;
}
const materials=new Map();
// Explicit scene palettes keep bronze, cloth, crystals and gameplay cues out of
// the wood/stone finish. Original biome colors remain the base of every surface.
const woodTones=new Set([0x624c3d,0x68503c,0x76614c,0x99724c,0xd6b571,0x806e54,0x998267,0x887454,0x766c55,0x76624e,0x9e8b70,0x746b57,0x8a7a60]);
const stoneTones=new Set([0x68796b,0x8d9b88,0xabb398,0x9fada3,0x708c97,0x718c89,0xa2b0a1,0xa49173,0xd2bc94,0xb5a183,0xc6b798,0xa6977c,0xc2b89b,0xbcb092,0x847f6b,0x9d8a6b,0xa2987b,0x796253]);
function surfaceMaterial(source,kind,axis='y',vertexColors=true){
 const key=kind==='wood'?'wood-'+axis:kind,variant=key+(vertexColors?':colored':':plain');
 if(source.userData.propSurface===key&&source.vertexColors===vertexColors)return source;
 if(!materials.has(source))materials.set(source,new Map());const cached=materials.get(source);
 if(cached.has(variant))return cached.get(variant);
 const m=source.clone();m.flatShading=false;m.vertexColors=vertexColors;m.roughness=kind==='wood'?.89:kind==='plain'?.91:.95;
 if(kind!=='plain'){
  m.metalness=0;m.userData.propSurface=key;
  const before=source.onBeforeCompile,baseKey=source.customProgramCacheKey();
  m.onBeforeCompile=(shader,renderer)=>{
   before.call(m,shader,renderer);
   shader.vertexShader='varying vec3 propPoint,propNormal;\n'+shader.vertexShader;
   shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\npropPoint=position;propNormal=normal;');
   shader.fragmentShader='varying vec3 propPoint,propNormal;\n'+shader.fragmentShader;
   if(kind==='stone'){
    Object.assign(shader.uniforms,{rockColor:surfaceUniforms.rockColor,rockHeight:surfaceUniforms.rockHeight,rockReady:surfaceUniforms.rockReady});
    shader.fragmentShader='uniform sampler2D rockColor,rockHeight; uniform float rockReady;\n'+shader.fragmentShader;
   }
   const along=axis==='x'?'x':axis==='z'?'z':'y',across=axis==='x'?'yz':axis==='z'?'xy':'xz';
   shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
    float propPixel=max(length(dFdx(propPoint)),length(dFdy(propPoint)));
    float propDetail=1.0-smoothstep(.025,.12,propPixel);
    float propPatch=.5+.25*sin(dot(propPoint,vec3(4.2,2.6,3.1)))+.25*sin(dot(propPoint,vec3(-2.5,3.4,4.8)));
    ${kind==='wood'?`vec2 propAcross=propPoint.${across};
     float propGrain=.5+.5*sin(propAcross.x*39.0+propAcross.y*17.0+sin(propPoint.${along}*3.0+propAcross.y*9.0)*.7);
     diffuseColor.rgb*=.94+propPatch*.07-(1.0-propGrain)*(1.0-propGrain)*.12*propDetail;`
    :`float propDamp=1.0-smoothstep(-.5,.3,propPoint.y);
     diffuseColor.rgb*=.92+propPatch*.14-propDamp*.035;
     // Triplanar samples avoid stretched poles on boulders and seams on ruin blocks.
     vec3 propWeights=pow(abs(normalize(propNormal)),vec3(4.));
     propWeights/=max(.0001,propWeights.x+propWeights.y+propWeights.z);
     vec3 stoneAlbedo=texture2D(rockColor,propPoint.yz*.78).rgb*propWeights.x+texture2D(rockColor,propPoint.xz*.78).rgb*propWeights.y+texture2D(rockColor,propPoint.xy*.78).rgb*propWeights.z;
     float stoneHeight=texture2D(rockHeight,propPoint.yz*.78).r*propWeights.x+texture2D(rockHeight,propPoint.xz*.78).r*propWeights.y+texture2D(rockHeight,propPoint.xy*.78).r*propWeights.z;
     diffuseColor.rgb*=mix(vec3(1.),clamp(stoneAlbedo*3.0,vec3(.43),vec3(1.48)),rockReady*.77);
     float stoneRelief=(stoneHeight-.5)*.012*rockReady*propDetail;`}
   `);
   if(kind==='stone')shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
    vec3 stoneDx=dFdx(-vViewPosition),stoneDy=dFdy(-vViewPosition);
    vec3 stoneRx=cross(stoneDy,normal),stoneRy=cross(normal,stoneDx);
    float stoneDet=dot(stoneDx,stoneRx);
    normal=normalize(abs(stoneDet)*normal-sign(stoneDet)*(dFdx(stoneRelief)*stoneRx+dFdy(stoneRelief)*stoneRy));
   `);
   shader.fragmentShader=shader.fragmentShader.replace('#include <roughnessmap_fragment>',`#include <roughnessmap_fragment>\nroughnessFactor=clamp(roughnessFactor+(propPatch-.5)*.06,.76,1.0);`);
  };
  m.customProgramCacheKey=()=>baseKey+'|prop-surface-'+variant;
 }
 cached.set(variant,m);return m;
}
export function polishEnvironmentModels(world){
 if(world.regions)installGroundSurface(world.ground,'confluence');
 world.group.traverse(o=>{
  if(!o.isMesh||o.isInstancedMesh||!o.material?.isMeshStandardMaterial||o.material.emissiveIntensity>0||o.userData.environmentFinish)return;
  const kind=woodTones.has(o.material.color.getHex())?'wood':stoneTones.has(o.material.color.getHex())?'stone':'plain';
  if(o.geometry.type==='BoxGeometry'){
   const size=o.geometry.parameters,source=o.material;
   o.geometry=kind==='stone'?wornStoneBlock:block;o.scale.multiply(new T.Vector3(size.width,size.height,size.depth));
   const dims=o.scale,axis=dims.x>dims.y&&dims.x>dims.z?'x':dims.z>dims.y?'z':'y';
   o.material=surfaceMaterial(source,kind,axis);o.userData.environmentFinish=true;
  }else if(o.geometry.type==='CylinderGeometry'&&kind!=='plain'){
   if(kind==='stone')o.geometry=stoneColumn(o.geometry);
   // Bare cylinders have no color attribute; enabling it reads black in the shader.
   o.material=surfaceMaterial(o.material,kind,'y',!!o.geometry.attributes.color);o.userData.environmentFinish=true;
  }
 });
 // Only obstacle stones, never relic crystals or enemy models, receive the worn rock silhouette.
 for(const obstacle of world.obstacles)obstacle.mesh.traverse(o=>{
  if(o.isMesh&&o.geometry.type==='DodecahedronGeometry'&&o.material?.emissiveIntensity===0){finishRock(o);o.material=surfaceMaterial(o.material,'stone');}
 });
}
