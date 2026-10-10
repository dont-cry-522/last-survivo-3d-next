import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import * as T from '../vendor/three.module.js';
import {SURFACE_FILES,surfaceUniforms,loadSurfaceTextures} from '../surface-textures.js?v=120';
import {installGroundSurface} from '../biome-scenery.js';
import {polishEnvironmentModels} from '../environment-props.js';

test('photographic maps are local, integrity checked and limited to two shared surface pairs',()=>{
 const root=new URL('../assets/environment/',import.meta.url),sources=JSON.parse(readFileSync(new URL('sources.json',root)));
 assert.equal(sources.license,'CC0-1.0');assert.equal(sources.files.length,4);
 assert.deepEqual(Object.values(SURFACE_FILES).sort(),sources.files.map(f=>f.file).sort());
 let size=0;for(const file of sources.files){const data=readFileSync(new URL(file.file,root));size+=data.length;assert.equal(createHash('sha256').update(data).digest('hex'),file.sha256);}
 assert(size<3*1024*1024,'surface download budget exceeded');
});

test('paired loading is shared and partial failure preserves neutral rendering without leaking a successful half',async()=>{
 const original=T.TextureLoader.prototype.loadAsync,created=[],requests=[];
 T.TextureLoader.prototype.loadAsync=async function(url){requests.push(url);if(url.includes('forest_floor_disp'))throw Error('test offline failure');const t=new T.Texture();t.userData.disposed=false;t.addEventListener('dispose',()=>t.userData.disposed=true);created.push(t);return t;};
 try{
  const first=loadSurfaceTextures();assert.strictEqual(loadSurfaceTextures(),first);assert.equal(await first,false);assert.equal(requests.length,4);
  assert(requests.every(url=>url.includes('/assets/environment/')&&!url.includes('polyhaven')));
  assert.equal(surfaceUniforms.soilReady.value,0);assert.equal(surfaceUniforms.rockReady.value,1);
  assert.equal(created.filter(t=>t.userData.disposed).length,1);
  assert.equal(surfaceUniforms.rockColor.value.colorSpace,T.SRGBColorSpace);assert.equal(surfaceUniforms.rockHeight.value.colorSpace,T.NoColorSpace);
  assert.equal(surfaceUniforms.rockColor.value.wrapS,T.RepeatWrapping);assert.equal(surfaceUniforms.rockColor.value.anisotropy,4);
 }finally{T.TextureLoader.prototype.loadAsync=original;}
});

test('ground and stone shaders share maps, keep original geometry, and do not add leaves to snow or sand',()=>{
 const shaders=[];for(const id of['forest','coast','confluence','snow','ash','sand']){
  const ground=new T.Mesh(new T.PlaneGeometry(4,4),new T.MeshStandardMaterial()),positions=Array.from(ground.geometry.attributes.position.array);
  installGroundSurface(ground,id);const shader={uniforms:{},vertexShader:T.ShaderLib.standard.vertexShader,fragmentShader:T.ShaderLib.standard.fragmentShader};ground.material.onBeforeCompile(shader);shaders.push(shader);
  assert.strictEqual(shader.uniforms.soilColor,surfaceUniforms.soilColor);assert.deepEqual(Array.from(ground.geometry.attributes.position.array),positions);
  assert.equal(shader.fragmentShader.includes('vec3 photographedSoil'),['forest','coast','confluence'].includes(id));assert(!shader.fragmentShader.includes('undefined'));
 }
 const group=new T.Group(),source=new T.MeshStandardMaterial({color:0xa49173,emissiveIntensity:0}),stone=new T.Mesh(new T.BoxGeometry(1,2,1),source);group.add(stone);
 polishEnvironmentModels({group,obstacles:[]});const shader={uniforms:{},vertexShader:T.ShaderLib.standard.vertexShader,fragmentShader:T.ShaderLib.standard.fragmentShader};stone.material.onBeforeCompile(shader);
 assert.strictEqual(shader.uniforms.rockColor,surfaceUniforms.rockColor);assert.strictEqual(shader.uniforms.rockHeight,surfaceUniforms.rockHeight);
 assert.equal((shader.fragmentShader.match(/texture2D\(rockColor/g)||[]).length,3);assert(shader.fragmentShader.includes('stoneRelief'));assert(shader.vertexShader.includes('propNormal=normal'));assert(shader.fragmentShader.includes('normalize(propNormal)'));assert(!shader.fragmentShader.includes('cross(dFdx(propPoint)'));assert.equal(source.onBeforeCompile,T.Material.prototype.onBeforeCompile);
});
