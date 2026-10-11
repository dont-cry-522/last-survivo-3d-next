import{installHarborHorizon,harborBayLayout,harborBayCut}from'./harbor-horizon.js?v=157';
import{installForestBackdrop}from'./tree-scenery.js?v=157';
import * as T from './vendor/three.module.js';

// The same three lights serve every climate; transitions do not allocate lights or shadow maps.
export const CLIMATE_LIGHT={
 forest:{sky:0x9bbbd2,bounce:0x71816a,sun:0xffe1ad,rim:0xaac8c6,fog:0x829b91,ambient:1.22,key:3.25,edge:.70,density:.0085,exposure:1.02,ridge:0x39554e,height:20},
 snow:{sky:0xbcd5e8,bounce:0x647c8b,sun:0xffe5c5,rim:0x97c5ed,fog:0x99b8c7,ambient:1.30,key:3.10,edge:1.0,density:.012,exposure:1.02,ridge:0x6e919f,height:23},
 ash:{sky:0xada7bc,bounce:0x36333e,sun:0xffc18b,rim:0xb599c1,fog:0x6f5964,ambient:1.04,key:3.4,edge:1.2,density:.014,exposure:1.08,ridge:0x4a3d49,height:17},
 sand:{sky:0xb8cddc,bounce:0x86735d,sun:0xffdfaf,rim:0xb0c5d5,fog:0xbba789,ambient:1.15,key:3.9,edge:.8,density:.009,exposure:1.04,ridge:0x9c8361,height:12},
 coast:{sky:0x9bbfd0,bounce:0x5a7484,sun:0xffdeb3,rim:0x95bdd5,fog:0x769ba3,ambient:1.28,key:3.50,edge:1.28,density:.011,exposure:1.06,ridge:0x4a6972,height:10}
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
   this.direction.lerp(cycle.direction,forest).normalize();this.day=1-forest+forest*cycle.day;
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
// Opaque foothill silhouettes live beyond the playable square. No new collision or rewards.
export function installDistantLandscape(world,id,biomeAt=()=>id){
 const positions=[],colors=[],indices=[],segments=192,rows=9,half=world.half;
 const bay=harborBayLayout(world,id,biomeAt);
 const stone=new T.Color(0x6c776d),snow=new T.Color(0xb8cbd0),basalt=new T.Color(0x746960),sand=new T.Color(0xb59c78),cliff=new T.Color(0x879188);
 const sample=(biome,angle,ring,t)=>{
  const p=CLIMATE_LIGHT[biome]||CLIMATE_LIGHT.forest,fade=Math.sin(t*Math.PI),phase=ring*1.7;
  let rhythm=ring?.61+.19*Math.sin(angle*5+1.6)+.13*Math.sin(angle*11+.3)+.07*Math.cos(angle*19-1.1):.56+.20*Math.sin(angle*7+.8)+.14*Math.sin(angle*13-1)+.10*Math.cos(angle*23+.4);
  let contour=1,slope=.20*t+.80*t*t,relief=0;
  const fold=Math.sin(angle*17+phase+t*2.8),gully=.5+.5*Math.sin(angle*29+phase-t*3+Math.sin(angle*7)*.65);
  if(biome==='forest'){
   rhythm=ring?.68+.17*Math.sin(angle*4+1.6)+.12*Math.sin(angle*10+.3)+.05*Math.cos(angle*19-1.1):.61+.18*Math.sin(angle*5+.8)+.13*Math.sin(angle*9-1)+.06*Math.cos(angle*16+.4);
   // Broad wooded shoulders broken by wandering drainage folds, not horizontal bands.
   slope+=fade*.035;relief=fade*(.045*fold+.023*Math.sin(angle*31-t*5+phase));
  }else if(biome==='snow'){
   rhythm=.58+.15*Math.sin(angle*(ring?5:4)+phase)+.19*Math.abs(Math.sin(angle*(ring?9:8)+.4))+.07*Math.sin(angle*17+phase);
   contour=.94+.22*(.5+.5*Math.sin(angle*11+ring))**2;slope=.07*t+.93*t**1.35;
   relief=fade*(.065*fold-.060*gully*gully+.023*Math.sin(angle*43+t*4));
  }else if(biome==='ash'){
   rhythm=.62+.18*Math.sin(angle*(ring?5:6)+phase)+.12*Math.sin(angle*11+.5)+.045*Math.cos(angle*25+ring);
   contour=.93+.12*Math.sin(angle*9+ring);slope=.12*t+.88*t**1.7;
   relief=fade*(.07*fold+.032*Math.sin(t*7+angle*5+phase)-.026*gully);
  }else if(biome==='sand'){
   rhythm=.64+.20*Math.sin(angle*(ring?4:3)+phase)+.11*Math.sin(angle*7+.3)+.035*Math.cos(angle*13+ring);
   contour=.83+.17*Math.sin(angle*3+ring*1.8);slope=.3*t+.7*t*t*(3-2*t);
   relief=fade*(.032*Math.sin(angle*11+t*4+phase)+.015*Math.sin(angle*21-t*3));
  }else if(biome==='coast'){
   // Preserve the low quay-bearing shelf; new relief sits on the upper headlands.
   contour=.28+.72*(.5+.5*Math.sin(angle*3+ring))**2;
   const profile=[0,.12,.68,.91,1],q=t*4,k=Math.min(3,Math.floor(q));slope=T.MathUtils.lerp(profile[k],profile[k+1],q-k);
   relief=fade*Math.sin(angle*29+ring*1.3)*.055+T.MathUtils.smoothstep(t,.50,.95)*fade*(.035*fold-.018*gully);
  }
  const top=(ring?1.3:1)*p.height*rhythm*contour,y=t===0?-.13:Math.max(.015,top*(slope+relief)),shade=new T.Color(p.ridge),haze=new T.Color(p.fog);
  if(biome==='forest')shade.lerp(stone,T.MathUtils.smoothstep(t,.40,.98)*(.11+.16*gully)).multiplyScalar(.94+.06*fold);
  if(biome==='snow'){
   const snowline=t+.085*Math.sin(angle*11+phase)-.15*gully*gully+.035*fold;
   shade.lerp(snow,T.MathUtils.smoothstep(snowline,.42,.93)*.85).multiplyScalar(.94+.06*(1-gully));
  }
  if(biome==='ash')shade.lerp(basalt,(.14+.12*(.5+.5*fold))*T.MathUtils.smoothstep(t,.15,.92)).multiplyScalar(.89+.11*(1-gully));
  if(biome==='sand')shade.lerp(sand,.13+.12*(.5+.5*Math.sin(angle*7-t*2+phase))).multiplyScalar(.95+.05*Math.sin(angle*11+t*3));
  if(biome==='coast')shade.lerp(cliff,T.MathUtils.smoothstep(t,.32,.82)*(.22+.08*fold)).multiplyScalar(1-.06*gully*T.MathUtils.smoothstep(t,.35,.9));
  // Keep the second silhouette quieter; the existing scene fog still applies.
  shade.lerp(haze,(ring?.56:.04)+t*.17).multiplyScalar(.90+t*.11);
  return{y,shade};
 };
 for(let ring=0;ring<2;ring++){
  const offset=positions.length/3;
  for(let i=0;i<=segments;i++){
   const angle=i/segments*Math.PI*2,s=Math.sin(angle),c=Math.cos(angle),edge=half/Math.max(Math.abs(s),Math.abs(c));
   const weights=new Map(),base=edge+7+ring*16;
   if(id==='confluence'){
    // Blend a short angular neighborhood at the five-climate boundary, using
    // the real outer square rather than drawing a separate ring around each region.
    for(let j=-2;j<=2;j++){const a=angle+j*.024,ss=Math.sin(a),cc=Math.cos(a),r=half/Math.max(Math.abs(ss),Math.abs(cc)),biome=biomeAt(ss*r,cc*r),weight=(3-Math.abs(j))/9;weights.set(biome,(weights.get(biome)||0)+weight);}
   }else weights.set(id,1);
   for(let row=0;row<rows;row++){
    const t=row/(rows-1),radius=base+t*21,shade=new T.Color(0);let y=0;
    for(const[biome,weight]of weights){const value=sample(biome,angle,ring,t);y+=value.y*weight;shade.r+=value.shade.r*weight;shade.g+=value.shade.g*weight;shade.b+=value.shade.b*weight;}
    if(bay){const cut=harborBayCut(bay,s*radius,c*radius);y=T.MathUtils.lerp(y,-.48,cut);shade.lerp(new T.Color(0x48666a),cut*.7);}
    positions.push(s*radius,y,c*radius);
    colors.push(shade.r,shade.g,shade.b);
   }
   if(i<segments)for(let row=0;row<rows-1;row++){const n=offset+i*rows+row;indices.push(n,n+1,n+rows,n+1,n+rows+1,n+rows);}
  }
 }
 const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));geometry.setAttribute('color',new T.Float32BufferAttribute(colors,3));geometry.setIndex(indices);geometry.computeVertexNormals();
 // The duplicated closing vertices need the same normal as the opening seam.
 const normal=geometry.attributes.normal,seam=new T.Vector3(),last=new T.Vector3();
 for(let ring=0;ring<2;ring++)for(let row=0;row<rows;row++){
  const first=ring*(segments+1)*rows+row,end=first+segments*rows;
  seam.fromBufferAttribute(normal,first).add(last.fromBufferAttribute(normal,end)).normalize();
  normal.setXYZ(first,seam.x,seam.y,seam.z);normal.setXYZ(end,seam.x,seam.y,seam.z);
 }
 const mesh=new T.Mesh(geometry,ridgeMaterial);mesh.name='distant-landscape';mesh.userData.ownedGeometry=true;world.group.add(mesh);installForestBackdrop(world,id,biomeAt);installHarborHorizon(world,id,biomeAt,mesh);return mesh;
}
