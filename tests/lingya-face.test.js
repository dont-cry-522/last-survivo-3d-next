import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {CHARACTER_ASSETS} from '../character-assets.js';
import {lingyaHeadY} from '../lingya-face.js';

test('head lowering keeps the collar anchored and the entire head transform continuous',()=>{
 assert.equal(lingyaHeadY(1.4),1.4);assert(Math.abs(lingyaHeadY(1.7)-1.671)<1e-8);
 let prev=-Infinity;for(let y=1.35;y<1.8;y+=.001){const out=lingyaHeadY(y);assert(out>prev);assert(out<=y);prev=out;}
});

test('delivered Lingya head matches its fallback and retains eye materials and eyelid morphs',async()=>{
 const base=new URL('../assets/characters/',import.meta.url),model=CHARACTER_ASSETS.models['lingya-face'];
 const json=JSON.parse(await readFile(new URL('lingya-face.gltf',base),'utf8')),bin=await readFile(new URL(json.buffers[0].uri,base));
 const glb=gunzipSync(await readFile(new URL(model.file,base))),size=glb.readUInt32LE(12),packed=JSON.parse(glb.subarray(20,20+size).toString());
 delete json.buffers[0].uri;assert.deepEqual(packed,json);assert(glb.subarray(28+size,28+size+bin.length).equals(bin));
 const eyes=json.meshes.find(m=>m.name.includes('eyes_viewport')),head=json.meshes.find(m=>m.name.includes('head'));
 assert.equal(eyes.primitives.length,1,'native eye uses its existing brown iris texture');
 assert.equal(json.materials[eyes.primitives[0].material].name,'Lingya_eye_brown');
 assert(json.asset.generator.includes('independent woodland head'),'old Rain source returned');
 assert(json.accessors[head.primitives[0].attributes.POSITION].count<10000,'compact subdivided head includes the body');
 assert(head.primitives[0].attributes.COLOR_0!==undefined,'face tint was dropped');
 for(const m of json.meshes.filter(m=>/head|eyes_viewport/.test(m.name))){
  assert.deepEqual(m.extras.targetNames,['Blink']);
  for(const p of m.primitives){assert(p.targets[0].NORMAL!==undefined,'Blink must update real surface normals, not keep the open socket shading');const a=json.accessors[p.targets[0].POSITION],values=a.sparse?.values||a,view=json.bufferViews[values.bufferView],start=(view.byteOffset||0)+(values.byteOffset||0),count=a.sparse?.count||a.count;let maximum=0;
   for(let i=0;i<count*3;i++){const n=bin.readFloatLE(start+i*4);assert(Number.isFinite(n));maximum=Math.max(maximum,Math.abs(n));}
   assert(maximum>.004&&maximum<.08,'blink must move actual eyelids without deforming the whole head');
  }
 }
});
