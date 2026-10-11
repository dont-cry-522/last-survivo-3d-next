import * as T from './vendor/three.module.js';

// Static contact staining joins the existing ground pass. R retains the scenery
// shadow; G softens forest plant roots into moss/soil, without extra decal draws.
// This is a bounded build-time mask, not screen-space or real-time AO.
export function installEnvironmentGrounding(world){
 const ground=world.ground;
 if(!ground?.userData.ownedGeometry||!ground.material?.isMeshStandardMaterial)return null;
 if(world.environmentGrounding&&!world.environmentGrounding.disposed)return world.environmentGrounding;
 const sources=(world.obstacles||[]).filter(o=>(o.place||o.environmentCluster)&&!o.tactic&&Number.isFinite(o.x+o.z+o.r)&&o.r>0);
 const plants=[];
 for(const group of [world.adventureGroundDetail,world.habitatDetail])for(const p of group?.userData.records||[]){
  if(plants.length>=4096)break;
  if(p.biome==='forest'&&['tuft','fern','shrub'].includes(p.kind)&&Number.isFinite(p.x+p.z))plants.push(p);
 }
 if(!sources.length&&!plants.length)return null;
 const size=512,extent=world.half+8,pixel=2*extent/size,data=new Uint8Array(size*size*2);
 for(const o of sources){
  const radius=o.r+.72,inner=o.r*.64;
  const minX=Math.max(0,Math.floor((o.x-radius+extent)/pixel)),maxX=Math.min(size-1,Math.ceil((o.x+radius+extent)/pixel));
  const minZ=Math.max(0,Math.floor((o.z-radius+extent)/pixel)),maxZ=Math.min(size-1,Math.ceil((o.z+radius+extent)/pixel));
  for(let z=minZ;z<=maxZ;z++)for(let x=minX;x<=maxX;x++){
   const wx=(x+.5)*pixel-extent,wz=(z+.5)*pixel-extent,d=Math.hypot(wx-o.x,wz-o.z);
   const fade=1-T.MathUtils.smoothstep(d,inner,radius),grain=.92+.08*Math.sin(wx*2.7+wz*1.8)*Math.sin(wz*3.2-wx*.9);
   const k=(z*size+x)*2;data[k]=Math.max(data[k],Math.round(255*fade*fade*grain));
  }
 }
 for(const p of plants){
  const width=Number.isFinite(p.width??p.size)?p.width??p.size:1;
  const radius=T.MathUtils.clamp((p.kind==='tuft'?.62:.90)*width,.38,1.25);
  const angle=Number.isFinite(p.angle)?p.angle:0,c=Math.cos(angle),s=Math.sin(angle),outer=radius*1.28;
  const minX=Math.max(0,Math.floor((p.x-outer+extent)/pixel)),maxX=Math.min(size-1,Math.ceil((p.x+outer+extent)/pixel));
  const minZ=Math.max(0,Math.floor((p.z-outer+extent)/pixel)),maxZ=Math.min(size-1,Math.ceil((p.z+outer+extent)/pixel));
  for(let z=minZ;z<=maxZ;z++)for(let x=minX;x<=maxX;x++){
   const wx=(x+.5)*pixel-extent,wz=(z+.5)*pixel-extent,dx=wx-p.x,dz=wz-p.z;
   const u=(c*dx-s*dz)/(radius*1.10),v=(s*dx+c*dz)/(radius*.78);
   const edge=1+.12*Math.sin(wx*5.1+wz*2.7)+.07*Math.sin(wz*7.3-wx*3.1);
   const fade=1-T.MathUtils.smoothstep(Math.hypot(u,v)/edge,0,1);
   const grain=.86+.14*Math.sin(wx*3.7+wz*1.9)**2,k=(z*size+x)*2+1;
   // Overlapping roots share the strongest soft stain; dense tufts never add up
   // to a black disc. Slightly elongated, ragged edges avoid isolated circles.
   data[k]=Math.max(data[k],Math.round(220*fade*fade*grain));
  }
 }
 const texture=new T.DataTexture(data,size,size,T.RGFormat);texture.name='TX_Scenery_GroundContact_A';
 texture.magFilter=T.LinearFilter;texture.minFilter=T.LinearMipmapLinearFilter;texture.generateMipmaps=true;texture.needsUpdate=true;
 // Ground materials are shared by the original world builders. Keep their
 // shader and textures intact, but give this run its own mask and material.
 const source=ground.material,material=source.clone(),compile=source.onBeforeCompile,baseKey=source.customProgramCacheKey();
 material.onBeforeCompile=(shader,renderer)=>{
  compile.call(material,shader,renderer);
  shader.uniforms.sceneryContact={value:texture};shader.uniforms.sceneryExtent={value:extent};
  shader.vertexShader='varying vec2 sceneryGround;\n'+shader.vertexShader;
  shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nsceneryGround=(modelMatrix*vec4(position,1.0)).xz;');
  shader.fragmentShader='uniform sampler2D sceneryContact; uniform float sceneryExtent; varying vec2 sceneryGround;\n'+shader.fragmentShader;
  shader.fragmentShader=shader.fragmentShader.replace('#include <roughnessmap_fragment>',`#include <roughnessmap_fragment>
   vec2 groundContacts=texture2D(sceneryContact,sceneryGround/(sceneryExtent*2.0)+.5).rg;
   float groundContact=groundContacts.r;
   diffuseColor.rgb*=1.0-groundContact*.22;
   diffuseColor.rgb*=mix(vec3(1.0),vec3(.78,.94,.74),groundContacts.g*.55);
  `);
  shader.fragmentShader=shader.fragmentShader.replace('#include <aomap_fragment>','#include <aomap_fragment>\nreflectedLight.indirectDiffuse*=1.0-groundContact*.16;\nreflectedLight.indirectDiffuse*=1.0-groundContacts.g*.06;');
 };
 material.customProgramCacheKey=()=>baseKey+'|scenery-ground-contact';ground.material=material;
 const state={texture,material,sources:sources.length,plants:plants.length,disposed:false};world.environmentGrounding=state;
 const release=()=>{if(state.disposed)return;state.disposed=true;texture.dispose();material.dispose();ground.material=source;ground.geometry.removeEventListener('dispose',release);};
 ground.geometry.addEventListener('dispose',release);
 return state;
}
