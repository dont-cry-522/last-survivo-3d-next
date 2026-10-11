import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../vendor/three.module.js';
import {buildWorld} from '../world.js';
import {polishEnvironmentModels} from '../environment-props.js';
import {installBiomePlaces} from '../biome-places.js';
import {installEnvironmentClusters} from '../environment-clusters.js';
import {installEnvironmentGrounding} from '../environment-grounding.js';

globalThis.document={createElement:()=>({getContext:()=>({fillRect(){}})})};
const cleanup=w=>w.group.traverse(o=>{if(o.isInstancedMesh)o.dispose();if(o.userData.ownedGeometry)o.geometry.dispose();});
test('five maps and confluence keep gameplay, geometry and shared materials intact while grounding permanent scenery',()=>{
 for(const id of ['forest','snow','ash','sand','coast','confluence']){
  const world=buildWorld(id,522);polishEnvironmentModels(world);installBiomePlaces(world,id);installEnvironmentClusters(world,id);
  const source=world.ground.material,geometry=world.ground.geometry,positions=geometry.attributes.position.array.slice(),count=world.group.children.length;
  const layout=JSON.stringify(world.obstacles.map(o=>[o.x,o.z,o.r,o.height])),base={uniforms:{},vertexShader:T.ShaderLib.standard.vertexShader,fragmentShader:T.ShaderLib.standard.fragmentShader};source.onBeforeCompile(base);
  const state=installEnvironmentGrounding(world);assert(state&&state.sources>20);assert.equal(world.group.children.length,count);assert.equal(JSON.stringify(world.obstacles.map(o=>[o.x,o.z,o.r,o.height])),layout);assert.deepEqual(geometry.attributes.position.array,positions);
  assert.notStrictEqual(source,state.material);assert.equal(source.userData.groundSurface,state.material.userData.groundSurface);assert.strictEqual(state.material.map,source.map);assert.strictEqual(installEnvironmentGrounding(world),state);
  const shader={uniforms:{},vertexShader:T.ShaderLib.standard.vertexShader,fragmentShader:T.ShaderLib.standard.fragmentShader};state.material.onBeforeCompile(shader);
  for(const key of Object.keys(base.uniforms))assert.strictEqual(shader.uniforms[key].value,base.uniforms[key].value);
  assert(shader.fragmentShader.includes('soilRelief'));assert(!shader.fragmentShader.includes('undefined'));assert.equal(shader.fragmentShader.match(/texture2D\(sceneryContact/g).length,1);
  assert(shader.fragmentShader.indexOf('float groundContact')<shader.fragmentShader.indexOf('reflectedLight.indirectDiffuse*=1.0-groundContact'));
  const {image}=state.texture;assert.equal(image.width,512);assert.equal(image.height,512);assert.equal(image.data.byteLength,262144);assert(state.texture.generateMipmaps);assert(image.data.some(v=>v>200));assert(image.data.some(v=>v>0&&v<80));assert(image.data.filter(v=>v>0).length/image.data.length<.10,'contact shading grew into a scene-wide dark carpet');
  let materialDisposed=0,textureDisposed=0,sharedDisposed=0;state.material.addEventListener('dispose',()=>materialDisposed++);state.texture.addEventListener('dispose',()=>textureDisposed++);source.addEventListener('dispose',()=>sharedDisposed++);
  cleanup(world);assert(state.disposed);assert.equal(materialDisposed,1);assert.equal(textureDisposed,1);assert.equal(sharedDisposed,0);assert.strictEqual(world.ground.material,source);geometry.dispose();assert.equal(textureDisposed,1);
 }
});
test('overlapping contacts take the strongest stain, transient obstacles are excluded and empty worlds allocate nothing',()=>{
 const make=obstacles=>{const ground=new T.Mesh(new T.PlaneGeometry(48,48),new T.MeshStandardMaterial());ground.userData.ownedGeometry=true;return{half:16,ground,obstacles};};
 const source={x:0,z:0,r:1,place:true},a=make([source]),b=make([source,{...source}]),c=make([{x:4,z:4,r:1,tactic:'timber'}]);
 const first=installEnvironmentGrounding(a),second=installEnvironmentGrounding(b);assert.deepEqual(first.texture.image.data,second.texture.image.data);assert.equal(installEnvironmentGrounding(c),null);
 a.ground.geometry.dispose();b.ground.geometry.dispose();c.ground.geometry.dispose();
});
test('two live worlds never overwrite each other or dispose shared ground resources',()=>{
 const source=new T.MeshStandardMaterial(),make=x=>{const ground=new T.Mesh(new T.PlaneGeometry(48,48),source);ground.userData.ownedGeometry=true;return{half:16,ground,obstacles:[{x,z:0,r:1,environmentCluster:true}]};};
 const a=make(-5),b=make(5),first=installEnvironmentGrounding(a),second=installEnvironmentGrounding(b),saved=second.texture.image.data.slice();
 assert.notStrictEqual(first.material,second.material);assert.notStrictEqual(first.texture,second.texture);assert.notDeepEqual(first.texture.image.data,second.texture.image.data);
 let shared=0,other=0;source.addEventListener('dispose',()=>shared++);second.texture.addEventListener('dispose',()=>other++);
 a.ground.geometry.dispose();assert(first.disposed&&!second.disposed);assert.equal(shared,0);assert.equal(other,0);assert.deepEqual(second.texture.image.data,saved);assert.strictEqual(b.ground.material,second.material);
 b.ground.geometry.dispose();assert.equal(other,1);assert.equal(shared,0);
});
