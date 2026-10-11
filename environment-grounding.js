import * as T from './vendor/three.module.js';

// Static contact staining for permanent authored scenery only. A single small
// mask joins the existing ground pass; it is not screen-space or real-time AO.
export function installEnvironmentGrounding(world){
 const ground=world.ground;
 if(!ground?.userData.ownedGeometry||!ground.material?.isMeshStandardMaterial)return null;
 if(world.environmentGrounding&&!world.environmentGrounding.disposed)return world.environmentGrounding;
 const sources=(world.obstacles||[]).filter(o=>(o.place||o.environmentCluster)&&!o.tactic&&Number.isFinite(o.x+o.z+o.r)&&o.r>0);
 if(!sources.length)return null;
 const size=512,extent=world.half+8,pixel=2*extent/size,data=new Uint8Array(size*size);
 for(const o of sources){
  const radius=o.r+.72,inner=o.r*.64;
  const minX=Math.max(0,Math.floor((o.x-radius+extent)/pixel)),maxX=Math.min(size-1,Math.ceil((o.x+radius+extent)/pixel));
  const minZ=Math.max(0,Math.floor((o.z-radius+extent)/pixel)),maxZ=Math.min(size-1,Math.ceil((o.z+radius+extent)/pixel));
  for(let z=minZ;z<=maxZ;z++)for(let x=minX;x<=maxX;x++){
   const wx=(x+.5)*pixel-extent,wz=(z+.5)*pixel-extent,d=Math.hypot(wx-o.x,wz-o.z);
   const fade=1-T.MathUtils.smoothstep(d,inner,radius),grain=.92+.08*Math.sin(wx*2.7+wz*1.8)*Math.sin(wz*3.2-wx*.9);
   const k=z*size+x;data[k]=Math.max(data[k],Math.round(255*fade*fade*grain));
  }
 }
 const texture=new T.DataTexture(data,size,size,T.RedFormat);texture.name='TX_Scenery_GroundContact_A';
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
   float groundContact=texture2D(sceneryContact,sceneryGround/(sceneryExtent*2.0)+.5).r;
   diffuseColor.rgb*=1.0-groundContact*.22;
  `);
  shader.fragmentShader=shader.fragmentShader.replace('#include <aomap_fragment>','#include <aomap_fragment>\nreflectedLight.indirectDiffuse*=1.0-groundContact*.16;');
 };
 material.customProgramCacheKey=()=>baseKey+'|scenery-ground-contact';ground.material=material;
 const state={texture,material,sources:sources.length,disposed:false};world.environmentGrounding=state;
 const release=()=>{if(state.disposed)return;state.disposed=true;texture.dispose();material.dispose();ground.material=source;ground.geometry.removeEventListener('dispose',release);};
 ground.geometry.addEventListener('dispose',release);
 return state;
}
