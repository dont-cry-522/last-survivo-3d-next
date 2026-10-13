import {LoadingManager,AnimationClip,MathUtils} from './vendor/three.module.js';
import {GLTFLoader} from './vendor/GLTFLoader.js';
import {CHARACTER_ASSETS as assets} from './character-assets.js?v=182';

const base=new URL('./assets/characters/',import.meta.url);
export async function loadCharacterData(onProgress=()=>{}){
  let cache;
  try{cache=await globalThis.caches?.open('forest3d-character-assets-v1');}catch{/* Private mode/storage limits must not block play. */}
  const compressed=typeof DecompressionStream==='function',blobs=[],textures=new Map();
  const modelNames=Object.keys(assets.models),total=assets.textures.length+modelNames.length+1;let completed=0;
  async function fetchAsset(file){
    const url=new URL(file,base).href;let response;
    try{response=await cache?.match(url);}catch{}
    if(!response){response=await fetch(url);if(!response.ok)throw Error('资源下载失败：'+file);try{await cache?.put(url,response.clone());}catch{}}
    const data=await response.arrayBuffer();onProgress(++completed,total);return data;
  }
  async function unpack(file){const data=await fetchAsset(file);return new Response(new Blob([data]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();}
  const manager=new LoadingManager();
  manager.setURLModifier(url=>textures.get(url)||url);const loader=new GLTFLoader(manager);
  try{
    const [data,motionData,textureData]=await Promise.all([
      compressed?Promise.all(modelNames.map(n=>unpack(assets.models[n].file))):null,
      compressed?unpack(assets.motion.file):fetchAsset(assets.motionFallback.file),
      Promise.all(assets.textures.map(fetchAsset))
    ]);
    assets.textures.forEach((file,i)=>{const blob=URL.createObjectURL(new Blob([textureData[i]],{type:'image/webp'}));blobs.push(blob);textures.set(new URL(file,base).href,blob);});
    const models=await Promise.all(modelNames.map((n,i)=>compressed?loader.parseAsync(data[i],base.href):loader.loadAsync(new URL(n+'.gltf',base).href)));
    if(!compressed)onProgress(total,total);
    // Packed clips omit UUIDs; without restoring them, the mixer aliases every
    // full-body action to the first clip (Idle), including Roll and aiming.
    const clips=JSON.parse(new TextDecoder().decode(motionData)).map(json=>AnimationClip.parse({...json,uuid:json.uuid||MathUtils.generateUUID()}));
    return{models:Object.fromEntries(modelNames.map((n,i)=>[n,models[i]])),clips};
  }finally{for(const blob of blobs)URL.revokeObjectURL(blob);}
}
