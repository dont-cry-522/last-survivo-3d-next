import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import * as T from '../vendor/three.module.js';
import {buildWorld} from '../world.js';
import {polishEnvironmentModels} from '../environment-props.js';
import {installBiomePlaces} from '../biome-places.js';
import {installEnvironmentClusters} from '../environment-clusters.js';
import {installEnvironmentGrounding} from '../environment-grounding.js';
import {installAdventureGroundDetail,installHabitatDetail} from '../adventure-ground-detail.js';

globalThis.document={createElement:()=>({getContext:()=>({fillRect(){}})})};
const cleanup=w=>w.group.traverse(o=>{if(o.isInstancedMesh)o.dispose();if(o.userData.ownedGeometry)o.geometry.dispose();});
const channel=(state,c)=>state.texture.image.data.filter((_,i)=>i%2===c);
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
  const {image}=state.texture,red=channel(state,0);assert.equal(image.width,512);assert.equal(image.height,512);assert.equal(image.data.byteLength,524288);assert.equal(state.texture.format,T.RGFormat);assert(state.texture.generateMipmaps);assert(red.some(v=>v>200));assert(red.some(v=>v>0&&v<80));assert(red.filter(v=>v>0).length/red.length<.10,'contact shading grew into a scene-wide dark carpet');assert(channel(state,1).every(v=>v===0));
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

test('plant channel keeps the v153 obstacle mask exact, without darkening duplicate roots or other biomes',()=>{
 const roots=[{x:0,z:0,biome:'forest',kind:'tuft',size:1,angle:.4},{x:3,z:-2,biome:'forest',kind:'fern',width:.9,angle:1.2}];
 const make=plants=>{const ground=new T.Mesh(new T.PlaneGeometry(48,48),new T.MeshStandardMaterial());ground.userData.ownedGeometry=true;return{half:16,ground,obstacles:[{x:0,z:0,r:1,place:true},{x:1.8,z:-.7,r:.5,environmentCluster:true}],habitatDetail:{userData:{records:plants}}};};
 const a=make(roots),b=make([...roots,...roots]),c=make(roots.map(p=>({...p,biome:'coast'}))),original=JSON.stringify(a.habitatDetail.userData.records);
 const first=installEnvironmentGrounding(a),second=installEnvironmentGrounding(b),third=installEnvironmentGrounding(c);
 // Snapshot measured from the committed v153 single-channel mask for these solids.
 assert.equal(createHash('sha256').update(channel(first,0)).digest('hex'),'3e001774b00ce5c12feb797311a6fbde6cebfa4110d459b49b7b05e2ba6c2384');
 assert.deepEqual(channel(first,0),channel(third,0));assert.deepEqual(first.texture.image.data,second.texture.image.data);
 const green=channel(first,1);assert(green.some(v=>v>100));assert(green.some(v=>v>0&&v<30));assert(green.every(v=>v<=220));assert.equal(channel(third,1).some(v=>v>0),false);assert.equal(original,JSON.stringify(a.habitatDetail.userData.records));
 const sample=(state,x,z)=>{const px=Math.floor((x+24)/48*512),py=Math.floor((z+24)/48*512);return state.texture.image.data[(py*512+px)*2+1];};
 assert.equal(sample(first,8,8),0);assert.notEqual(sample(first,.4,.2),sample(first,-.2,.4),'root stain became a rotationally uniform disc');
 for(const w of [a,b,c])w.ground.geometry.dispose();
});

test('all maps reuse one fixed mask and unchanged plant records, with only forest roots in the joined map',()=>{
 for(const id of ['forest','snow','ash','sand','coast','confluence']){
  const world=buildWorld(id,522);polishEnvironmentModels(world);installBiomePlaces(world,id);installEnvironmentClusters(world,id);installAdventureGroundDetail(world,id);installHabitatDetail(world,id);
  const records=[...world.adventureGroundDetail.userData.records,...world.habitatDetail.userData.records],before=JSON.stringify(records),children=world.group.children.length,positions=world.ground.geometry.attributes.position.array.slice();
  const state=installEnvironmentGrounding(world),expected=records.filter(p=>p.biome==='forest'&&['tuft','fern','shrub'].includes(p.kind)).length;
  assert.equal(state.plants,expected);assert.equal(state.texture.image.data.length,512*512*2);assert.equal(world.group.children.length,children);assert.deepEqual(world.ground.geometry.attributes.position.array,positions);assert.equal(JSON.stringify(records),before);
  const green=channel(state,1);assert.equal(green.some(v=>v>0),id==='forest'||id==='confluence');assert(green.filter(v=>v>0).length/green.length<.12,'forest root transitions became a scene-wide carpet');
  assert.strictEqual(installEnvironmentGrounding(world).texture,state.texture);assert.strictEqual(world.ground.material,state.material);
  if(id==='confluence')for(const p of records.filter(p=>p.biome!=='forest')){
   if(records.some(q=>q.biome==='forest'&&Math.hypot(p.x-q.x,p.z-q.z)<2))continue;
   const x=Math.floor((p.x+world.half+8)/(2*(world.half+8))*512),z=Math.floor((p.z+world.half+8)/(2*(world.half+8))*512);assert.equal(green[z*512+x],0,'non-forest roots acquired a green stain');
  }
  let disposed=0;state.texture.addEventListener('dispose',()=>disposed++);cleanup(world);assert.equal(disposed,1);assert(state.disposed);
 }
});

test('plant-only worlds allocate one bounded mask and release it on restart',()=>{
 const ground=new T.Mesh(new T.PlaneGeometry(48,48),new T.MeshStandardMaterial());ground.userData.ownedGeometry=true;
 const plants=Array.from({length:5000},()=>({x:0,z:0,biome:'forest',kind:'shrub',width:1e6}));
 const world={half:16,ground,obstacles:[],adventureGroundDetail:{userData:{records:plants}}},source=ground.material;
 const state=installEnvironmentGrounding(world);assert.equal(state.sources,0);assert.equal(state.plants,4096);assert(channel(state,0).every(v=>v===0));assert(channel(state,1).filter(v=>v>0).length<900,'malformed width escaped the bounded root footprint');
 const saved=state.texture.image.data.slice();let disposed=0;state.texture.addEventListener('dispose',()=>disposed++);ground.geometry.dispose();assert.equal(disposed,1);assert.strictEqual(ground.material,source);
 const next=installEnvironmentGrounding(world);assert.notStrictEqual(next,state);assert.deepEqual(next.texture.image.data,saved);ground.geometry.dispose();assert(next.disposed);
});
