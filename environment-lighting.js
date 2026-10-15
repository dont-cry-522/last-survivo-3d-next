import{installHarborHorizon,harborBayLayout,harborBayCut}from'./harbor-horizon.js?v=211';
import{installForestBackdrop}from'./tree-scenery.js?v=211';
import{environmentDetailTexture}from'./biome-scenery.js?v=211';
import * as T from './vendor/three.module.js';

// The same three lights serve every climate; transitions do not allocate lights or shadow maps.
export const CLIMATE_LIGHT={
 forest:{sky:0x91b6cd,bounce:0x657560,sun:0xffdfa8,rim:0x99b8c0,fog:0x8fa99d,ambient:1.12,key:3.25,edge:.58,density:.0078,exposure:1.02,ridge:0x385249,height:20},
 snow:{sky:0xb4d4ed,bounce:0x7891a1,sun:0xffe9d0,rim:0xb4d7ef,fog:0xb4cedd,ambient:1.22,key:3.10,edge:.82,density:.0105,exposure:1.02,ridge:0x678797,height:23},
 ash:{sky:0x8d98ad,bounce:0x3d302b,sun:0xffb77f,rim:0xc5a08a,fog:0x716966,ambient:.96,key:3.4,edge:.82,density:.0125,exposure:1.08,ridge:0x493e3a,height:17},
 sand:{sky:0xa9c6df,bounce:0x9a805c,sun:0xffd39e,rim:0xc3cbd0,fog:0xc5b08e,ambient:1.10,key:3.9,edge:.65,density:.0078,exposure:1.04,ridge:0x9f7d51,height:12},
 coast:{sky:0x8cb4d0,bounce:0x486b7b,sun:0xffe0b9,rim:0xa1c4d6,fog:0x84a6b2,ambient:1.18,key:3.50,edge:.92,density:.0092,exposure:1.06,ridge:0x3e6072,height:10}
};
const colorKeys=['sky','bounce','sun','rim','fog'],scalarKeys=['ambient','key','edge','density','exposure'];
const tones=Object.fromEntries(Object.entries(CLIMATE_LIGHT).map(([id,p])=>[id,Object.fromEntries(colorKeys.map(k=>[k,new T.Color(p[k])]))]));
export const FOREST_CYCLE={seconds:720,startAngle:.90,night:{sky:0x8eafc2,bounce:0x4b665d,sun:0xc3d9ef,rim:0x92afc6,fog:0x3e5962,ambient:1.10,key:.95,edge:.55,density:.0105,exposure:1.08}};
const nightTones=Object.fromEntries(colorKeys.map(k=>[k,new T.Color(FOREST_CYCLE.night[k])])),evening=new T.Color(0xffbe82);
export const DEFAULT_SUN_DIRECTION=new T.Vector3(-18,30,14).normalize();
// Game-time only: a paused frame and a resumed tab cannot advance the sun.
export function sampleForestDay(time,out={direction:new T.Vector3()}){
 const angle=((Number.isFinite(time)?time:0)%FOREST_CYCLE.seconds)/FOREST_CYCLE.seconds*Math.PI*2+FOREST_CYCLE.startAngle;
 const height=Math.sin(angle),moon=height<0,sign=moon?-1:1;
 out.day=T.MathUtils.smoothstep(height,-.16,.22);
 out.horizon=T.MathUtils.smoothstep(Math.abs(height),.025,.23);
 out.dusk=(1-T.MathUtils.smoothstep(Math.abs(height),.10,.55))*out.day;
 out.direction.set(-Math.cos(angle)*sign,Math.max(.08,Math.abs(height)),.46*sign).normalize();
 return out;
}
export class EnvironmentLighting{
 constructor(scene,renderer,hemi,sun,rim){
  Object.assign(this,{scene,renderer,hemi,sun,rim});
  // A little transmitted light retains foliage and ground detail inside cast shadows.
  this.sun.shadow.intensity=.90;
  this.colors=Object.fromEntries(colorKeys.map(k=>[k,new T.Color()]));this.values={};
  this.direction=DEFAULT_SUN_DIRECTION.clone();this.cycle=sampleForestDay(0);this.cycleColor=new T.Color();this.timeOffset=0;this.shaftStrength=1;this.day=1;
 }
 update(id,weights=null,dt=0,gameTime=null){
  const a=dt>0?1-Math.exp(-dt*1.4):1;
  for(const k of colorKeys)this.colors[k].setRGB(0,0,0);
  for(const k of scalarKeys)this.values[k]=0;
  for(const [biome,p]of Object.entries(CLIMATE_LIGHT)){
   const weight=weights?.[biome]??(biome===(id==='confluence'?'forest':id)?1:0);if(!weight)continue;
   for(const k of colorKeys){const c=this.colors[k],s=tones[biome][k];c.r+=s.r*weight;c.g+=s.g*weight;c.b+=s.b*weight;}
   for(const k of scalarKeys)this.values[k]+=p[k]*weight;
  }
  const forest=weights?.forest??(id==='forest'||id==='confluence'?1:0),cycling=Number.isFinite(gameTime)&&forest>0;
  this.direction.copy(DEFAULT_SUN_DIRECTION);this.shaftStrength=1;this.day=1;
  if(cycling){
   const cycle=sampleForestDay(gameTime+this.timeOffset,this.cycle),night=FOREST_CYCLE.night;
   // Replace only the forest contribution; neighboring biomes keep their own palette.
   for(const k of colorKeys){
    this.cycleColor.copy(nightTones[k]).lerp(tones.forest[k],cycle.day);
    if(k==='sun')this.cycleColor.lerp(evening,cycle.dusk*.55);
    this.colors[k].r+=(this.cycleColor.r-tones.forest[k].r)*forest;
    this.colors[k].g+=(this.cycleColor.g-tones.forest[k].g)*forest;
    this.colors[k].b+=(this.cycleColor.b-tones.forest[k].b)*forest;
   }
   for(const k of scalarKeys){let value=T.MathUtils.lerp(night[k],CLIMATE_LIGHT.forest[k],cycle.day);if(k==='key')value*=cycle.horizon;this.values[k]+=(value-CLIMATE_LIGHT.forest[k])*forest;}
   this.direction.lerp(cycle.direction,forest*cycle.horizon).normalize();this.day=1-forest+forest*cycle.day;
   this.shaftStrength=1-forest+forest*cycle.horizon*T.MathUtils.lerp(.10,1,cycle.day);
  }
  this.hemi.color.lerp(this.colors.sky,a);this.hemi.groundColor.lerp(this.colors.bounce,a);
  this.sun.color.lerp(this.colors.sun,a);this.rim.color.lerp(this.colors.rim,a);
  this.hemi.intensity=T.MathUtils.lerp(this.hemi.intensity,this.values.ambient,a);
  this.sun.intensity=T.MathUtils.lerp(this.sun.intensity,this.values.key,a);
  this.rim.intensity=T.MathUtils.lerp(this.rim.intensity,this.values.edge,a);
  this.scene.fog.color.lerp(this.colors.fog,a);this.scene.fog.density=T.MathUtils.lerp(this.scene.fog.density,this.values.density,a);
  this.scene.background.copy(this.scene.fog.color);
  this.renderer.toneMappingExposure=T.MathUtils.lerp(this.renderer.toneMappingExposure,this.values.exposure,a);
 }
}

const ridgeMaterial=new T.MeshStandardMaterial({vertexColors:true,roughness:1,side:T.DoubleSide});
// Reuse the terrain's small noise texture on the existing two mountain layers.
// Broad wooded patches, exposed strata and snow recesses belong to the slope;
// no decal meshes, extra lights or screen-space pass. Far silhouettes stay soft.
ridgeMaterial.onBeforeCompile=shader=>{
 shader.uniforms.ridgeGrain={value:environmentDetailTexture()};
 shader.vertexShader='attribute vec4 ridgeClimate; attribute float ridgeLayer; varying vec4 ridgeWeights; varying vec3 ridgePoint; varying float ridgeNear, ridgeUp;\n'+shader.vertexShader;
 shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nridgePoint=position;ridgeWeights=ridgeClimate;ridgeNear=ridgeLayer;ridgeUp=abs(normal.y);');
 shader.fragmentShader='uniform sampler2D ridgeGrain; varying vec4 ridgeWeights; varying vec3 ridgePoint; varying float ridgeNear, ridgeUp;\n'+shader.fragmentShader;
 shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
  vec3 ridgeField=texture2D(ridgeGrain,ridgePoint.xz*.026).rgb;
  vec3 ridgeFace=texture2D(ridgeGrain,vec2(ridgePoint.x*.028+ridgePoint.z*.019,ridgePoint.y*.09+ridgeField.r*.13)).rgb;
  float ridgeSteep=1.0-smoothstep(.30,.88,ridgeUp);
  float ridgeCoast=max(0.0,1.0-dot(ridgeWeights,vec4(1.0)));
  float ridgePixel=max(length(dFdx(ridgePoint)),length(dFdy(ridgePoint)));
  float ridgeFine=1.0-smoothstep(.8,2.6,ridgePixel);
  float ridgeWood=smoothstep(.22,.77,ridgeField.g+ridgeField.r*.13);
  float ridgeStrata=smoothstep(.25,.73,ridgeFace.g);
  float ridgeCut=(1.0-smoothstep(.26,.52,ridgeFace.r))*(.35+.65*ridgeSteep);
  vec3 ridgeTint=vec3(1.0);
  ridgeTint+=ridgeWeights.x*(mix(vec3(.77,.84,.77),vec3(1.05,1.07,.98),ridgeWood)-1.0);
  ridgeTint+=ridgeWeights.y*(mix(vec3(.73,.82,.91),vec3(1.04,1.04,1.02),ridgeStrata)-1.0);
  ridgeTint+=ridgeWeights.z*(mix(vec3(.73,.75,.74),vec3(1.10,1.06,1.00),ridgeStrata)-1.0);
  ridgeTint+=ridgeWeights.w*(mix(vec3(.82,.78,.71),vec3(1.08,1.055,.99),ridgeStrata)-1.0);
  ridgeTint+=ridgeCoast*(mix(vec3(.75,.81,.82),vec3(1.04,1.065,1.04),ridgeStrata)-1.0);
  diffuseColor.rgb*=mix(vec3(1.0),ridgeTint,ridgeNear);
  diffuseColor.rgb*=1.0-ridgeCut*ridgeNear*.10;
  float ridgeRelief=(ridgeFace.g-.5)*.22+(ridgeField.g-.5)*.16;
  ridgeRelief*=ridgeNear*ridgeFine*(.4+ridgeSteep*.6);
 `);
 shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
  vec3 ridgeSlopeNormal=normal;
  vec3 ridgeDx=dFdx(-vViewPosition),ridgeDy=dFdy(-vViewPosition),ridgeRx=cross(ridgeDy,normal),ridgeRy=cross(normal,ridgeDx);
  float ridgeDet=dot(ridgeDx,ridgeRx);
  normal=normalize(abs(ridgeDet)*normal-sign(ridgeDet)*(dFdx(ridgeRelief)*ridgeRx+dFdy(ridgeRelief)*ridgeRy));
 `);
 // Broad slope shading uses the real sun/moon direction and unperturbed mesh
 // normals. Keep it before normal distance fog and fade it out at the foot.
 shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>',`
  #if NUM_DIR_LIGHTS > 0
   float ridgeFacing=smoothstep(.25,.95,dot(ridgeSlopeNormal,directionalLights[0].direction));
   float ridgeSunStrength=smoothstep(0.0,.8,dot(directionalLights[0].color,vec3(.2126,.7152,.0722)));
   outgoingLight*=mix(1.0,mix(.58,1.04,ridgeFacing),smoothstep(0.0,.24,ridgeNear)*ridgeSunStrength);
  #endif
  #include <opaque_fragment>
 `);
};
ridgeMaterial.customProgramCacheKey=()=> 'landscape-climate-slope-relief';
// This radial mesh already has an exact spatial index: each angular sector is
// contiguous in each ring. Tree roots and harbor footings only cast vertically.
// Keep Three's actual triangle intersection/face data, but avoid scanning the
// other 189 sectors for every support point. Oblique rays retain the full path.
function indexRidgeQueries(mesh,segments,rows){
 const geometry=mesh.geometry,inverse=new T.Matrix4(),localRay=new T.Ray(),raycast=T.Mesh.prototype.raycast,sectorIndices=(rows-1)*6,ringIndices=segments*sectorIndices;
 mesh.raycast=function(raycaster,intersections){
  inverse.copy(this.matrixWorld).invert();localRay.copy(raycaster.ray).applyMatrix4(inverse);
  if(this.geometry!==geometry||Math.abs(localRay.direction.x)>1e-12||Math.abs(localRay.direction.z)>1e-12)return raycast.call(this,raycaster,intersections);
  const angle=(Math.atan2(localRay.origin.x,localRay.origin.z)+Math.PI*2)%(Math.PI*2),sector=Math.min(segments-1,Math.floor(angle*segments/(Math.PI*2))),wrap=sector===0||sector===segments-1;
  const {start,count}=geometry.drawRange,end=start+count;
  try{
   for(let ring=0;ring<2;ring++)for(let part=0;part<(wrap?2:1);part++){
    // Include both neighbors for Float32 boundary/seam precision. Visit in
    // original index order so equal-distance hits keep the same face priority.
    const first=wrap?(part===0?0:sector===0?segments-1:segments-2):sector-1;
    const last=wrap?(part===0?(sector===0?2:1):segments):sector+2;
    const from=Math.max(start,ring*ringIndices+first*sectorIndices),to=Math.min(end,ring*ringIndices+last*sectorIndices);
    if(from>=to)continue;
    geometry.setDrawRange(from,to-from);raycast.call(this,raycaster,intersections);
   }
  }finally{
   // Rendering and later queries always retain the caller's original range.
   geometry.setDrawRange(start,count);
  }
 };
}
// Opaque foothill silhouettes live beyond the playable square. No new collision or rewards.
export function installDistantLandscape(world,id,biomeAt=()=>id){
 const positions=[],colors=[],indices=[],climates=[],layers=[],segments=192,rows=9,half=world.half;
 const bay=harborBayLayout(world,id,biomeAt);
 // Broad shoulders overlap a taller, more distant range. Each climate keeps
 // a low pass instead of wrapping the player in a uniformly high mountain bowl.
 const landforms={forest:{height:[1.3,2.65],width:[34,45],pass:.85},snow:{height:[1.3,2.85],width:[35,46],pass:2.65},ash:{height:[1.4,3.15],width:[33,44],pass:4.5},sand:{height:[1.35,3.0],width:[38,48],pass:5.25},coast:{height:[1,3.2],width:[21,43],pass:1.65}};
 const stone=new T.Color(0x6c776d),snow=new T.Color(0xb8cbd0),basalt=new T.Color(0x746960),sand=new T.Color(0xb59c78),cliff=new T.Color(0x879188);
 const sample=(biome,angle,ring,t)=>{
  const p=CLIMATE_LIGHT[biome]||CLIMATE_LIGHT.forest,form=landforms[biome]||landforms.forest,fade=Math.sin(t*Math.PI),phase=ring*1.7;
  const passAngle=angle-form.pass-ring*.22,pass=1-T.MathUtils.smoothstep(Math.abs(Math.atan2(Math.sin(passAngle),Math.cos(passAngle))),.15,.65);
  const mass=.66+.22*Math.sin(angle*2+phase+.5)+.12*Math.cos(angle*3-phase);
  let rhythm=ring?.61+.19*Math.sin(angle*5+1.6)+.13*Math.sin(angle*11+.3)+.07*Math.cos(angle*19-1.1):.56+.20*Math.sin(angle*7+.8)+.14*Math.sin(angle*13-1)+.10*Math.cos(angle*23+.4);
  let contour=1,slope=.20*t+.80*t*t,relief=0,cut=0,scarp=0;
  const fold=Math.sin(angle*17+phase+t*2.8),gully=.5+.5*Math.sin(angle*29+phase-t*3+Math.sin(angle*7)*.65);
  if(biome==='forest'){
   rhythm=mass+.13*Math.sin(angle*(ring?7:5)+phase)+.035*Math.cos(angle*13+.4);
   // The shoulder rises in front of the skyline, with broad, shallow valleys.
   cut=(.5+.5*Math.sin(angle*11+phase+t*.8))**3;
   slope=.12*t+.88*T.MathUtils.smoothstep(t,0,1);
   relief=fade*(.065*fold-.14*cut);
  }else if(biome==='snow'){
   // Deep drainage cuts run down from the saddles instead of rippling across the slope.
   cut=(.5+.5*Math.sin(angle*17+phase+t*.7+.35*Math.sin(angle*3)))**5;
   rhythm=mass*(.48+.52*Math.abs(Math.sin(angle*(ring?7:5)+.4)))+.06*Math.sin(angle*13+phase);
   contour=.94+.22*(.5+.5*Math.sin(angle*11+ring))**2;
   slope=.07*t+.93*t**1.12;
   relief=fade*(.055*fold-.24*cut)-T.MathUtils.smoothstep(t,.6,1)*.07*cut;
  }else if(biome==='ash'){
   // Three broad cones keep straight flanks and a shallow broken summit rim.
   const cone=.5+.5*Math.sin(angle*3+phase);
   cut=(.5+.5*Math.sin(angle*15+phase+t*.45))**4;
   rhythm=mass*(.34+.86*cone**1.5);
   contour=1-.19*T.MathUtils.smoothstep(cone,.92,1);
   slope=.08*t+.92*t**1.12;
   relief=fade*(.04*fold-.12*cut);
  }else if(biome==='sand'){
   // Low talus, one exposed escarpment, then a broad table. Its height and
   // setback change along the ridge so the ledge is not a horizontal stripe.
   const mesa=T.MathUtils.smoothstep(Math.sin(angle*(ring?4:3)+phase),-.3,.25),setback=.49+.045*Math.sin(angle*5+phase);
   rhythm=.29+.28*mass+.47*mesa;contour=.90+.10*Math.sin(angle*2+phase);
   slope=.16*t+.27*T.MathUtils.smoothstep(t,.05,.46)+.57*T.MathUtils.smoothstep(t,setback,setback+.23);
   cut=(.5+.5*Math.sin(angle*13+phase+t*.5))**4;
   scarp=T.MathUtils.smoothstep(t,setback-.08,setback+.05)*(1-T.MathUtils.smoothstep(t,setback+.17,setback+.30));
   relief=fade*(.018*fold-.045*cut);
  }else if(biome==='coast'){
   // Preserve every vertex of the near quay-bearing shelf. Only the outer
   // islands gain low straits and separate, flat-shouldered headlands.
   if(ring)rhythm=mass*(.20+.95*T.MathUtils.smoothstep(.5+.5*Math.sin(angle*4+phase),.13,.85));
   contour=.28+.72*(.5+.5*Math.sin(angle*3+ring))**2;
   const profile=[0,.12,.68,.91,1],q=t*4,k=Math.min(3,Math.floor(q));slope=T.MathUtils.lerp(profile[k],profile[k+1],q-k);
   relief=fade*Math.sin(angle*29+ring*1.3)*.055+T.MathUtils.smoothstep(t,.50,.95)*fade*(.035*fold-.018*gully);
   if(ring){cut=(.5+.5*Math.sin(angle*13+phase+t*.6))**3;slope=.15*t+.85*T.MathUtils.smoothstep(t,.17,.72);relief=fade*(.05*fold-.12*cut);}
  }
  const opening=biome==='coast'&&!ring?1:1-pass*.82;
  const top=form.height[ring]*p.height*rhythm*contour*opening,y=t===0?-.13:Math.max(.015,top*(slope+relief)),shade=new T.Color(p.ridge),haze=new T.Color(p.fog);
  if(biome==='forest')shade.lerp(stone,T.MathUtils.smoothstep(t,.40,.98)*(.11+.16*gully)).multiplyScalar(.94+.06*fold-.10*cut*fade);
  if(biome==='snow'){
   const snowline=t+.085*Math.sin(angle*11+phase)-.10*gully*gully+.035*fold-.065*cut*fade;
   shade.lerp(snow,T.MathUtils.smoothstep(snowline,.42,.93)*.85).multiplyScalar(.94+.06*(1-gully)-.025*cut*fade);
  }
  if(biome==='ash')shade.lerp(basalt,(.14+.12*(.5+.5*fold))*T.MathUtils.smoothstep(t,.15,.92)).multiplyScalar(.89+.11*(1-gully)-.10*cut*fade);
  if(biome==='sand')shade.lerp(sand,.13+.12*(.5+.5*Math.sin(angle*7-t*2+phase))+scarp*.12).multiplyScalar(.95+.05*Math.sin(angle*11+t*3)-scarp*.12);
  if(biome==='coast')shade.lerp(cliff,T.MathUtils.smoothstep(t,.32,.82)*(.22+.08*fold)).multiplyScalar(1-.06*gully*T.MathUtils.smoothstep(t,.35,.9));
  // Separate the two silhouettes without washing both in the same fog color;
  // distance fog still supplies the continuous atmospheric transition.
  shade.lerp(haze,(ring?.48:.025)+t*(ring?.16:.13)).multiplyScalar(.90+t*.11);
  return{y,shade};
 };
 for(let ring=0;ring<2;ring++){
  const offset=positions.length/3;
  for(let i=0;i<=segments;i++){
   const angle=i/segments*Math.PI*2,s=Math.sin(angle),c=Math.cos(angle),edge=half/Math.max(Math.abs(s),Math.abs(c));
   const weights=new Map();
   if(id==='confluence'){
    // Blend a short angular neighborhood at the five-climate boundary, using
    // the real outer square rather than drawing a separate ring around each region.
    for(let j=-2;j<=2;j++){const a=angle+j*.024,ss=Math.sin(a),cc=Math.cos(a),r=half/Math.max(Math.abs(ss),Math.abs(cc)),biome=biomeAt(ss*r,cc*r),weight=(3-Math.abs(j))/9;weights.set(biome,(weights.get(biome)||0)+weight);}
   }else weights.set(id,1);
   let base=0,width=0;
   for(const[biome,weight]of weights){
    const form=landforms[biome]||landforms.forest;
    // The near coastal shelf retains the original quay and boat footprint.
    base+=(ring?(biome==='coast'?23:28+3*Math.sin(angle*2)**2):7)*weight;
    width+=form.width[ring]*(biome==='coast'&&!ring?1:.94+.06*Math.sin(angle*3+ring)**2)*weight;
   }
   for(let row=0;row<rows;row++){
    const t=row/(rows-1),radius=edge+base+t*width,shade=new T.Color(0);let y=0;
    for(const[biome,weight]of weights){const value=sample(biome,angle,ring,t);y+=value.y*weight;shade.r+=value.shade.r*weight;shade.g+=value.shade.g*weight;shade.b+=value.shade.b*weight;}
    if(bay){
     const delta=Math.abs(Math.atan2(Math.sin(angle-bay.angle),Math.cos(angle-bay.angle)));
     // Continue the water-facing opening through the far range; a new massif
     // must never close the harbor immediately behind its existing sailboats.
     const horizonCut=(1-T.MathUtils.smoothstep(delta,bay.halfAngle*.52,bay.halfAngle*1.4))*T.MathUtils.smoothstep(radius-edge,32,43);
     const cut=Math.max(harborBayCut(bay,s*radius,c*radius),horizonCut);y=T.MathUtils.lerp(y,-.48,cut);shade.lerp(new T.Color(0x48666a),cut*.7);
    }
    positions.push(s*radius,y,c*radius);
    colors.push(shade.r,shade.g,shade.b);
    climates.push(...['forest','snow','ash','sand'].map(key=>weights.get(key)||0));
    layers.push((ring?.28:1)*T.MathUtils.smoothstep(t,0,.22));
   }
   if(i<segments)for(let row=0;row<rows-1;row++){const n=offset+i*rows+row;indices.push(n,n+1,n+rows,n+1,n+rows+1,n+rows);}
  }
 }
 const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));geometry.setAttribute('color',new T.Float32BufferAttribute(colors,3));geometry.setAttribute('ridgeClimate',new T.Float32BufferAttribute(climates,4));geometry.setAttribute('ridgeLayer',new T.Float32BufferAttribute(layers,1));geometry.setIndex(indices);geometry.computeVertexNormals();
 // The duplicated closing vertices need the same normal as the opening seam.
 const normal=geometry.attributes.normal,seam=new T.Vector3(),last=new T.Vector3();
 for(let ring=0;ring<2;ring++)for(let row=0;row<rows;row++){
  const first=ring*(segments+1)*rows+row,end=first+segments*rows;
  seam.fromBufferAttribute(normal,first).add(last.fromBufferAttribute(normal,end)).normalize();
  normal.setXYZ(first,seam.x,seam.y,seam.z);normal.setXYZ(end,seam.x,seam.y,seam.z);
 }
 const mesh=new T.Mesh(geometry,ridgeMaterial);mesh.name='distant-landscape';mesh.userData.ownedGeometry=true;indexRidgeQueries(mesh,segments,rows);world.group.add(mesh);installForestBackdrop(world,id,biomeAt);installHarborHorizon(world,id,biomeAt,mesh);return mesh;
}
