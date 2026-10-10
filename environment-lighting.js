import{installForestBackdrop}from'./tree-scenery.js?v=139';
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
 const positions=[],colors=[],indices=[],segments=144,half=world.half;
 for(let ring=0;ring<2;ring++){
  const offset=positions.length/3;
  for(let i=0;i<=segments;i++){
   const angle=i/segments*Math.PI*2,s=Math.sin(angle),c=Math.cos(angle),edge=half/Math.max(Math.abs(s),Math.abs(c));
   const biome=id==='confluence'?biomeAt(s*edge,c*edge):id,p=CLIMATE_LIGHT[biome]||CLIMATE_LIGHT.forest;
   const rhythm=ring
    ?.61+.19*Math.sin(angle*5+1.6)+.13*Math.sin(angle*11+.3)+.07*Math.cos(angle*19-1.1)
    :.56+.20*Math.sin(angle*7+.8)+.14*Math.sin(angle*13-1)+.10*Math.cos(angle*23+.4);
   // Each horizon has its own geology: broad dunes, split coastal headlands,
   // serrated alpine ridges and lower rolling woodland foothills.
   const contour=biome==='sand'?.78+.22*Math.sin(angle*3+ring*1.8):biome==='coast'?.28+.72*Math.pow(.5+.5*Math.sin(angle*3+ring),2):biome==='snow'?1+Math.abs(Math.sin(angle*17+ring))*.28:biome==='ash'?1+Math.sin(angle*9+ring)*.14:1;
   const top=(ring?1.3:1)*p.height*rhythm*contour,base=edge+7+ring*16;
   const color=new T.Color(p.ridge),haze=new T.Color(p.fog);
   for(let row=0;row<3;row++){
    const radius=base+row*9,y=row===0?-.13:row===1?top*.28:top;
    positions.push(s*radius,y,c*radius);
    const shade=color.clone().lerp(haze,(ring?.42:.04)+row*.10).multiplyScalar(.88+row*.065);
    colors.push(shade.r,shade.g,shade.b);
   }
   if(i<segments)for(let row=0;row<2;row++){const n=offset+i*3+row;indices.push(n,n+3,n+1,n+1,n+3,n+4);}
  }
 }
 const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));geometry.setAttribute('color',new T.Float32BufferAttribute(colors,3));geometry.setIndex(indices);geometry.computeVertexNormals();
 // The duplicated closing vertices need the same normal as the opening seam.
 const normal=geometry.attributes.normal,seam=new T.Vector3(),last=new T.Vector3();
 for(let ring=0;ring<2;ring++)for(let row=0;row<3;row++){
  const first=ring*(segments+1)*3+row,end=first+segments*3;
  seam.fromBufferAttribute(normal,first).add(last.fromBufferAttribute(normal,end)).normalize();
  normal.setXYZ(first,seam.x,seam.y,seam.z);normal.setXYZ(end,seam.x,seam.y,seam.z);
 }
 const mesh=new T.Mesh(geometry,ridgeMaterial);mesh.name='distant-landscape';mesh.userData.ownedGeometry=true;world.group.add(mesh);installForestBackdrop(world,id,biomeAt);return mesh;
}
