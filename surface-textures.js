import * as T from './vendor/three.module.js';

// Four shared 1K CC0 maps. They enrich surfaces without displacing playable terrain.
// Local URLs and neutral fallback keep loading failures/offline repairs non-blocking.
export const SURFACE_FILES={
 soilColor:'forest_floor_diff_1k.jpg',soilHeight:'forest_floor_disp_1k.jpg',
 rockColor:'rock_01_diff_1k.jpg',rockHeight:'rock_01_disp_1k.jpg'
};
const neutral=new T.DataTexture(new Uint8Array([128,128,128,255]),1,1);neutral.needsUpdate=true;
export const surfaceUniforms=Object.fromEntries(Object.keys(SURFACE_FILES).map(key=>[key,{value:neutral}]));
surfaceUniforms.soilReady={value:0};surfaceUniforms.rockReady={value:0};
let loading;
export function loadSurfaceTextures(){
 if(loading)return loading;
 const loader=new T.TextureLoader();
 loading=Promise.all(Object.entries(SURFACE_FILES).map(async([key,file])=>{
  try{const texture=await loader.loadAsync(new URL('./assets/environment/'+file,import.meta.url).href);
   texture.name=file;texture.colorSpace=key.endsWith('Color')?T.SRGBColorSpace:T.NoColorSpace;
   texture.wrapS=texture.wrapT=T.RepeatWrapping;texture.minFilter=T.LinearMipmapLinearFilter;
   texture.magFilter=T.LinearFilter;texture.anisotropy=4;return[key,texture];
  }catch{return[key,null];}
 })).then(entries=>{
  const loaded=Object.fromEntries(entries);
  for(const kind of['soil','rock']){
   const color=loaded[kind+'Color'],height=loaded[kind+'Height'];
   if(color&&height){surfaceUniforms[kind+'Color'].value=color;surfaceUniforms[kind+'Height'].value=height;surfaceUniforms[kind+'Ready'].value=1;}
   else{color?.dispose();height?.dispose();}
  }
  return surfaceUniforms.soilReady.value===1&&surfaceUniforms.rockReady.value===1;
 });return loading;
}
