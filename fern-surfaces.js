import * as T from './vendor/three.module.js';
// A small cutout fallback keeps leaves readable if an offline texture is missing.
// Real 1K scans replace it atomically, once, and are shared across world rebuilds.
export const FERN_FILES={map:'fern_02_diff_1k.jpg',alphaMap:'fern_02_alpha_1k.png',normalMap:'fern_02_nor_gl_1k.jpg'};
const fallbackColor=new T.DataTexture(new Uint8Array([115,140,83,255]),1,1);
fallbackColor.colorSpace=T.SRGBColorSpace;fallbackColor.needsUpdate=true;
const fernFallbackData=new Uint8Array(128*256*4);
for(let y=0;y<256;y++)for(let x=0;x<128;x++){
 const u=x/127,v=y/255;let fill=false;
 for(const [left,right,base,tip] of [[.078,.240,.948,.109],[.307,.458,.786,.021],[.718,.839,.903,.107]]){
  const t=(1-v-base)/(tip-base),side=Math.abs((u-(left+right)*.5)/(right-left));
  if(t>=0&&t<=1&&side<Math.max(.008,Math.sin(t*Math.PI)*(.24+.16*Math.max(0,Math.sin(t*120)))))fill=true;
 }
 const i=(y*128+x)*4;fernFallbackData[i]=fernFallbackData[i+1]=fernFallbackData[i+2]=fill?255:0;fernFallbackData[i+3]=255;
}
const fallbackAlpha=new T.DataTexture(fernFallbackData,128,256);fallbackAlpha.minFilter=T.LinearFilter;fallbackAlpha.magFilter=T.LinearFilter;fallbackAlpha.needsUpdate=true;
const materials=new Set();
let current={map:fallbackColor,alphaMap:fallbackAlpha};
// Both forest plant batches use these same maps. Preserve each caller's wind shader.
export function applyFernSurface(material){
 if(material.userData.fernSurface)return material;
 const before=material.onBeforeCompile,key=material.customProgramCacheKey();
 Object.assign(material,current);material.alphaTest=.42;material.roughness=.88;material.normalScale.set(.32,.32);material.userData.fernSurface=true;
 material.onBeforeCompile=(shader,renderer)=>{
  before.call(material,shader,renderer);
  shader.fragmentShader=shader.fragmentShader.replace('#include <lights_fragment_end>',`#include <lights_fragment_end>
   #if NUM_HEMI_LIGHTS > 0
    reflectedLight.indirectDiffuse+=diffuseColor.rgb*hemisphereLights[0].skyColor*.30;
   #endif
  `);
 };
 material.customProgramCacheKey=()=>key+'|fern-surface';materials.add(material);
 material.addEventListener('dispose',()=>materials.delete(material));return material;
}
let fernLoading;
export function loadFernTextures(){
 if(fernLoading)return fernLoading;
 const loader=new T.TextureLoader();
 fernLoading=Promise.all(Object.entries(FERN_FILES).map(async([key,file])=>{
  try{const texture=await loader.loadAsync(new URL('./assets/environment/'+file,import.meta.url).href);texture.name=file;texture.colorSpace=key==='map'?T.SRGBColorSpace:T.NoColorSpace;texture.anisotropy=4;return[key,texture];}catch{return[key,null];}
 })).then(entries=>{
  if(entries.some(([,texture])=>!texture)){for(const[,texture]of entries)texture?.dispose();return false;}
  current=Object.fromEntries(entries);
  for(const material of materials){Object.assign(material,current);material.needsUpdate=true;}fallbackColor.dispose();fallbackAlpha.dispose();return true;
 });return fernLoading;
}
