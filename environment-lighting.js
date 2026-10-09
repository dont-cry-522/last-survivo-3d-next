import * as T from './vendor/three.module.js';

// The same three lights serve every climate; transitions do not allocate lights or shadow maps.
export const CLIMATE_LIGHT={
 forest:{sky:0x829cad,bounce:0x5b7382,sun:0xffdfb2,rim:0x9dbacf,fog:0x36545a,ambient:1.19,key:3.70,edge:1.45,density:.0105,exposure:1.08,ridge:0x253c3e,height:14},
 snow:{sky:0xbcd5e8,bounce:0x647c8b,sun:0xffe5c5,rim:0x97c5ed,fog:0x99b8c7,ambient:1.30,key:3.10,edge:1.0,density:.012,exposure:1.02,ridge:0x6e919f,height:23},
 ash:{sky:0xada7bc,bounce:0x36333e,sun:0xffc18b,rim:0xb599c1,fog:0x6f5964,ambient:1.04,key:3.4,edge:1.2,density:.014,exposure:1.08,ridge:0x4a3d49,height:17},
 sand:{sky:0xb8cddc,bounce:0x86735d,sun:0xffdfaf,rim:0xb0c5d5,fog:0xbba789,ambient:1.15,key:3.9,edge:.8,density:.009,exposure:1.04,ridge:0x9c8361,height:12},
 coast:{sky:0x9bbfd0,bounce:0x5a7484,sun:0xffdeb3,rim:0x95bdd5,fog:0x769ba3,ambient:1.28,key:3.50,edge:1.28,density:.011,exposure:1.06,ridge:0x4a6972,height:10}
};
const colorKeys=['sky','bounce','sun','rim','fog'],scalarKeys=['ambient','key','edge','density','exposure'];
const tones=Object.fromEntries(Object.entries(CLIMATE_LIGHT).map(([id,p])=>[id,Object.fromEntries(colorKeys.map(k=>[k,new T.Color(p[k])]))]));
export class EnvironmentLighting{
 constructor(scene,renderer,hemi,sun,rim){
  Object.assign(this,{scene,renderer,hemi,sun,rim});
  // A little transmitted light retains foliage and ground detail inside cast shadows.
  this.sun.shadow.intensity=.90;
  this.colors=Object.fromEntries(colorKeys.map(k=>[k,new T.Color()]));this.values={};
 }
 update(id,weights=null,dt=0){
  const a=dt>0?1-Math.exp(-dt*1.4):1;
  for(const k of colorKeys)this.colors[k].setRGB(0,0,0);
  for(const k of scalarKeys)this.values[k]=0;
  for(const [biome,p]of Object.entries(CLIMATE_LIGHT)){
   const weight=weights?.[biome]??(biome===(id==='confluence'?'forest':id)?1:0);if(!weight)continue;
   for(const k of colorKeys){const c=this.colors[k],s=tones[biome][k];c.r+=s.r*weight;c.g+=s.g*weight;c.b+=s.b*weight;}
   for(const k of scalarKeys)this.values[k]+=p[k]*weight;
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
   const top=(ring?1.3:1)*p.height*rhythm,base=edge+7+ring*16;
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
 const mesh=new T.Mesh(geometry,ridgeMaterial);mesh.name='distant-landscape';mesh.userData.ownedGeometry=true;world.group.add(mesh);return mesh;
}
