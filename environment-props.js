import * as T from './vendor/three.module.js';
import{finishRock,installGroundSurface,boulderRockGeometry}from'./biome-scenery.js?v=156';
import{surfaceUniforms}from'./surface-textures.js?v=120';
import{groundWindTime}from'./adventure-ground-detail.js?v=157';

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
// Three shared basalt silhouettes replace only tall ash obstacles. Their lower
// bole is untouched and upper vertices move inward, never enlarging a collider.
const ashColumns=[];
function ashColumn(variant){
 if(ashColumns[variant])return ashColumns[variant];
 const geometry=boulderRockGeometry.clone(),p=geometry.attributes.position,c=geometry.attributes.color,phase=variant*1.83;
 geometry.name='SM_Rock_AshColumn_'+['A','B','C'][variant];
 for(let i=0;i<p.count;i++){
  const x=p.getX(i),y=p.getY(i),z=p.getZ(i),a=Math.atan2(z,x),upper=T.MathUtils.smoothstep(y,-.42,.28);
  const seam=(.5+.5*Math.cos(a*(6+variant)+phase+y*.22))**4,inset=1-upper*(.035+seam*.17);
  const cut=[.61,.72,.55][variant]+x*Math.cos(phase)*.16+z*Math.sin(phase)*.19+.025*Math.sin(a*3+phase);
  p.setXYZ(i,x*inset,Math.min(y,cut),z*inset);
  const shade=1-upper*seam*.095;c.setXYZ(i,c.getX(i)*shade,c.getY(i)*shade,c.getZ(i)*shade);
 }
 geometry.computeVertexNormals();geometry.computeBoundingBox();geometry.computeBoundingSphere();ashColumns[variant]=geometry;return geometry;
}
const materials=new Map();
// Preserve a metric frame per authored piece before its placement is baked into
// a batch. Only attributes are added: collision and source positions stay intact.
export function prepareBatchedSurface(geometry,kind,scale={}){
 if(kind!=='wood'&&kind!=='cloth')return geometry;
 if(!geometry.attributes.normal)geometry.computeVertexNormals();
 const p=geometry.attributes.position,n=geometry.attributes.normal,uv=geometry.attributes.uv,params=geometry.parameters||{};
 const metric=new T.Vector3(scale.sx??1,scale.sy??1,scale.sz??1),point=new T.Vector3(),normal=new T.Vector3(),center=new T.Vector3(),size=new T.Vector3(),across=new T.Vector3(),along=new T.Vector3(),depth=new T.Vector3();
 const positions=[],styles=[],tube=geometry.type==='TubeGeometry',cylinder=geometry.type==='CylinderGeometry',torus=geometry.type==='TorusGeometry';
 const style=geometry.userData.bark?4:kind==='cloth'&&(tube||cylinder||torus)||tube&&params.radius<.03?3:kind==='cloth'?2:1;
 geometry.computeBoundingBox();geometry.boundingBox.getCenter(center).multiply(metric);geometry.boundingBox.getSize(size).multiply(metric);
 const axis=size.x>size.y&&size.x>size.z?0:size.z>size.y?2:1,other=axis===0?2:0,last=3-axis-other,centers=[],lengths=[0];
 if(tube||cylinder){
  const sides=params.radialSegments,rows=tube?params.tubularSegments:params.heightSegments;
  for(let row=0;row<=rows;row++){
   const c=new T.Vector3();for(let j=0;j<sides;j++)c.add(point.fromBufferAttribute(p,row*(sides+1)+j).multiply(metric));c.divideScalar(sides);centers.push(c);
   if(row)lengths.push(lengths[row-1]+c.distanceTo(centers[row-1]));
  }
  if(cylinder){center.copy(centers[0]).add(centers.at(-1)).multiplyScalar(.5);along.copy(centers.at(-1)).sub(centers[0]).normalize();across.fromBufferAttribute(p,0).multiply(metric).sub(centers[0]).normalize();depth.crossVectors(across,along).normalize();}
 }
 for(let i=0;i<p.count;i++){
  point.fromBufferAttribute(p,i).multiply(metric);let x,y,z,end=0;
  if(tube){
   const row=Math.floor(i/(params.radialSegments+1)),angle=uv.getY(i)*Math.PI*2,r=point.distanceTo(centers[row]);x=Math.cos(angle)*r;y=lengths[row];z=Math.sin(angle)*r;
  }else if(cylinder){
   point.sub(center);x=point.dot(across);y=point.dot(along);z=point.dot(depth);end=Math.abs(normal.fromBufferAttribute(n,i).divide(metric).normalize().dot(along));
  }else if(torus){
   const angle=uv.getY(i)*Math.PI*2,s=(metric.x+metric.y+metric.z)/3;x=Math.cos(angle)*params.tube*s;y=uv.getX(i)*Math.PI*2*params.radius*s;z=Math.sin(angle)*params.tube*s;
  }else{
   point.sub(center);x=point.getComponent(other);y=point.getComponent(axis);z=point.getComponent(last);end=Math.abs(axis===0?n.getX(i):axis===1?n.getY(i):n.getZ(i));
  }
  positions.push(x,y,z,end);styles.push(style);
 }
 geometry.setAttribute('surfaceCoord',new T.Float32BufferAttribute(positions,4));geometry.setAttribute('surfaceKind',new T.Float32BufferAttribute(styles,1));
 if(kind==='cloth'&&!geometry.attributes.harborFlex)geometry.setAttribute('harborFlex',new T.Float32BufferAttribute(new Float32Array(p.count),1));return geometry;
}
// Explicit scene palettes keep bronze, cloth, crystals and gameplay cues out of
// the wood/stone finish. Original biome colors remain the base of every surface.
const woodTones=new Set([0x624c3d,0x68503c,0x76614c,0x99724c,0xd6b571,0x806e54,0x998267,0x887454,0x766c55,0x76624e,0x9e8b70,0x746b57,0x8a7a60]);
const stoneTones=new Set([0x68796b,0x8d9b88,0xabb398,0x9fada3,0x708c97,0x718c89,0xa2b0a1,0xa49173,0xd2bc94,0xb5a183,0xc6b798,0xa6977c,0xc2b89b,0xbcb092,0x847f6b,0x9d8a6b,0xa2987b,0x796253]);
function surfaceMaterial(source,kind,axis='y',vertexColors=true){
 const batched=axis==='piece',weatheredStone=axis==='placed',key=kind==='wood'?'wood-'+axis:kind+(weatheredStone?'-placed':''),variant=key+(batched?':batch':'')+(vertexColors?':colored':':plain');
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
   if(batched){
    shader.vertexShader='attribute vec4 surfaceCoord; attribute float surfaceKind; varying vec4 propCoord; varying float propStyle;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\npropCoord=surfaceCoord;propStyle=surfaceKind;');
    shader.fragmentShader='varying vec4 propCoord; varying float propStyle;\n'+shader.fragmentShader;
    if(kind==='cloth'){
     shader.uniforms.harborWindTime=groundWindTime;
     shader.vertexShader='attribute float harborFlex; uniform float harborWindTime;\n'+shader.vertexShader;
     shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
      vec4 harborPoint=vec4(position,1.0);
      #ifdef USE_INSTANCING
       harborPoint=instanceMatrix*harborPoint;
      #endif
      harborPoint=modelMatrix*harborPoint;
      float harborPhase=dot(harborPoint.xyz,vec3(.71,.39,.24));
      float harborWave=sin(harborWindTime*.85+harborPhase)*.68+sin(harborWindTime*1.43+harborPhase*1.31+.6)*.32;
      // Canvas breathes along its face; a loose net moves together, not radially
      // along each cord normal. Tied edges and load-bearing lines carry zero flex.
      vec3 harborDirection=surfaceKind>2.5?vec3(0.,0.,1.):normal;
      transformed+=harborDirection*harborWave*harborFlex*.028;
     `);
    }
   }
   if(kind==='stone'){
    Object.assign(shader.uniforms,{rockColor:surfaceUniforms.rockColor,rockHeight:surfaceUniforms.rockHeight,rockReady:surfaceUniforms.rockReady});
    shader.fragmentShader='uniform sampler2D rockColor,rockHeight; uniform float rockReady;\n'+shader.fragmentShader;
   }
   const along=axis==='x'?'x':axis==='z'?'z':'y',across=axis==='x'?'yz':axis==='z'?'xy':'xz';
   shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
    float propPixel=max(length(dFdx(propPoint)),length(dFdy(propPoint)));
    float propDetail=1.0-smoothstep(.025,.12,propPixel);
    float propPatch=.5+.25*sin(dot(propPoint,vec3(4.2,2.6,3.1)))+.25*sin(dot(propPoint,vec3(-2.5,3.4,4.8)));
    ${batched?`// Piece coordinates stay attached through both merge and instance transforms.
     float propFine=1.0-smoothstep(.009,.04,propPixel);
     float propDamp=(1.0-smoothstep(.04,.85,propPoint.y))*(.55+.45*propPatch);
     float woodRelief=0.0;
     if(propStyle>3.5){
      float barkAngle=atan(propCoord.z,propCoord.x+.000001),barkLong=propCoord.y;
      float barkWander=sin(barkLong*1.7+barkAngle*3.0)*.50+sin(barkLong*5.3-barkAngle)*.16;
      float barkCrack=pow(.5+.5*sin(barkAngle*29.0+barkWander),12.0);
      float barkFlake=.5+.5*sin(barkLong*17.0+sin(barkAngle*19.0)*2.0);
      float barkPeel=smoothstep(.72,.93,propPatch)*smoothstep(.25,.8,barkFlake);
      diffuseColor.rgb*=mix(vec3(.79,.82,.79),vec3(1.20,1.08,.86),barkPeel);
      diffuseColor.rgb*=1.0-barkCrack*.42*propDetail+(barkFlake-.5)*.08*propFine;
      woodRelief=(-barkCrack*.012+(barkFlake-.5)*.0016)*propDetail;
     }else if(propStyle<1.5){
      vec2 woodCross=propCoord.xz;float woodLong=propCoord.y;
      float woodDrift=sin(woodLong*2.1+woodCross.y*5.0)*.55+sin(woodLong*5.9+woodCross.x*9.0)*.21;
      float woodRun=.35+.65*smoothstep(-.5,.65,sin(woodLong*2.9+woodCross.x*13.0)+sin(woodLong*.73+woodCross.y*9.0)*.48);
      float woodGrain=.5+.5*sin(woodCross.x*43.0+woodCross.y*27.0+woodDrift);
      float woodRings=.5+.5*sin(length(woodCross*vec2(1.0,.84)+vec2(.05,-.08))*49.0+propPatch*.8);
      float woodEnd=pow(clamp(propCoord.w,0.0,1.0),5.0),woodFibre=mix(woodGrain,woodRings,woodEnd);
      float woodPores=.5+.5*sin(woodCross.x*106.0+woodCross.y*73.0+woodDrift*2.3);
      diffuseColor.rgb*=.95+propPatch*.10-propDamp*.07+(woodFibre-.5)*.055*woodRun*propDetail-(1.0-woodPores)*.010*propFine+woodEnd*.018;
      woodRelief=((woodFibre-.5)*.0013*woodRun+(woodPores-.5)*.00025*propFine)*propDetail;
     }else{
      // Unequal warp/weft strengths suggest fibres without a raised checkerboard.
      float clothWeave=sin((propCoord.x+propCoord.z*.35)*153.0+sin(propCoord.y*2.0)*.3)*.55+sin(propCoord.y*165.0+propCoord.x*.7)*.35;
      float ropeTwist=sin(propCoord.y*72.0+atan(propCoord.z,propCoord.x+.000001)*3.0);
      float weave=mix(clothWeave,ropeTwist,step(2.5,propStyle));
      diffuseColor.rgb*=.96+propPatch*.07-propDamp*.065+weave*.014*propFine;
      woodRelief=weave*mix(.0003,.00045,step(2.5,propStyle))*propFine;
     }`
    :kind==='wood'?`vec2 propAcross=propPoint.${across};
     float propGrain=.5+.5*sin(propAcross.x*39.0+propAcross.y*17.0+sin(propPoint.${along}*3.0+propAcross.y*9.0)*.7);
     float woodEnd=pow(abs(normalize(propNormal).${along}),6.0);
     float woodRings=.5+.5*sin(length(propAcross*vec2(1.0,.85)+vec2(.08,-.035))*56.0+propPatch*.8);
     float woodFibre=mix(propGrain,woodRings,woodEnd);
     diffuseColor.rgb*=.94+propPatch*.07-pow(1.0-woodFibre,2.0)*.12*propDetail;
     float woodRelief=(woodFibre-.5)*.0025*propDetail;`
    :`float propDamp=1.0-smoothstep(-.5,.3,propPoint.y);
     diffuseColor.rgb*=.92+propPatch*.14-propDamp*.035;
     // Triplanar samples avoid stretched poles on boulders and seams on ruin blocks.
     vec3 propWeights=pow(abs(normalize(propNormal)),vec3(4.));
     propWeights/=max(.0001,propWeights.x+propWeights.y+propWeights.z);
     vec3 stoneAlbedo=texture2D(rockColor,propPoint.yz*.78).rgb*propWeights.x+texture2D(rockColor,propPoint.xz*.78).rgb*propWeights.y+texture2D(rockColor,propPoint.xy*.78).rgb*propWeights.z;
     float stoneHeight=texture2D(rockHeight,propPoint.yz*.78).r*propWeights.x+texture2D(rockHeight,propPoint.xz*.78).r*propWeights.y+texture2D(rockHeight,propPoint.xy*.78).r*propWeights.z;
     diffuseColor.rgb*=mix(vec3(1.),clamp(stoneAlbedo*3.0,vec3(.43),vec3(1.48)),rockReady*.77);
     float stoneRelief=(stoneHeight-.5)*.012*rockReady*propDetail;
     ${weatheredStone?`// Broad contact grime and sun-worn upper faces keep the original rock palette.
      float stoneFoot=(1.0-smoothstep(.02,1.1,propPoint.y))*(.55+.45*propPatch);
      float stoneExposure=max(0.0,normalize(propNormal).y);
      diffuseColor.rgb*=vec3(.98+propPatch*.035+stoneExposure*.035-stoneFoot*.065);
      diffuseColor.rgb*=mix(vec3(1.),vec3(1.015,1.005,.98),stoneFoot);`:''}`}
   `);
   shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
    vec3 stoneDx=dFdx(-vViewPosition),stoneDy=dFdy(-vViewPosition);
    vec3 stoneRx=cross(stoneDy,normal),stoneRy=cross(normal,stoneDx);
    float stoneDet=dot(stoneDx,stoneRx);
    normal=normalize(abs(stoneDet)*normal-sign(stoneDet)*(dFdx(${kind==='wood'||batched?'woodRelief':'stoneRelief'})*stoneRx+dFdy(${kind==='wood'||batched?'woodRelief':'stoneRelief'})*stoneRy));
   `);
   shader.fragmentShader=shader.fragmentShader.replace('#include <roughnessmap_fragment>',`#include <roughnessmap_fragment>\nroughnessFactor=clamp(roughnessFactor+(propPatch-.5)*.06${batched?'+propDamp*.035+step(1.5,propStyle)*.045':weatheredStone?'+stoneFoot*.025-stoneExposure*.025':''},.76,1.0);`);
  };
  m.customProgramCacheKey=()=>baseKey+'|prop-surface-'+variant;
 }
 cached.set(variant,m);return m;
}
// Merged ruin batches use the same cached PBR finish as individual stones.
export function stoneSurfaceMaterial(source){return surfaceMaterial(source,'stone');}
export function batchedSurfaceMaterial(source,kind){return kind==='wood'||kind==='cloth'?surfaceMaterial(source,kind,'piece'):kind==='stone'?surfaceMaterial(source,'stone','placed'):source;}
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
  if(o.isMesh&&o.geometry.type==='DodecahedronGeometry'&&o.material?.emissiveIntensity===0){
   const color=o.material.color.getHex(),ash=color===0x66565c||obstacle.biome==='ash'&&color===0x645650;
   finishRock(o);
   if(ash&&o.scale.y>Math.max(o.scale.x,o.scale.z)*1.4)o.geometry=ashColumn(Math.abs(Math.floor(obstacle.x*1.7+obstacle.z*2.3))%3);
   o.material=surfaceMaterial(o.material,'stone');
  }
 });
}
