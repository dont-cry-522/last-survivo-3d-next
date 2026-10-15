import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import * as T from '../vendor/three.module.js';
import {buildWorld} from '../world.js';
import {installForestVista} from '../forest-vista.js';
import {installForestHabitats} from '../forest-habitats.js';
import {installExplorationRoutes} from '../exploration-routes.js';
import {polishEnvironmentModels} from '../environment-props.js';
import {installBiomePlaces} from '../biome-places.js?v=202';
import {installEnvironmentClusters} from '../environment-clusters.js?v=202';
import {installEnvironmentGrounding} from '../environment-grounding.js';
import {installAdventureGroundDetail,installHabitatDetail} from '../adventure-ground-detail.js';

globalThis.document={createElement:()=>({getContext:()=>({fillRect(){}})})};
const cleanup=w=>w.group.traverse(o=>{if(o.isInstancedMesh)o.dispose();if(o.userData.ownedGeometry)o.geometry.dispose();});
const channel=(state,c)=>state.texture.image.data.filter((_,i)=>i%4===c);
const sample=(state,world,x,z,c)=>{
 const extent=world.half+8,u=Math.floor((x+extent)/(extent*2)*512),v=Math.floor((z+extent)/(extent*2)*512);
 return state.texture.image.data[(v*512+u)*4+c];
};
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
  const {image}=state.texture,red=channel(state,0);assert.equal(image.width,512);assert.equal(image.height,512);assert.equal(image.data.byteLength,1048576);assert.equal(state.texture.format,T.RGBAFormat);assert(state.texture.generateMipmaps);assert(red.some(v=>v>200));assert(red.some(v=>v>0&&v<80));assert(red.filter(v=>v>0).length/red.length<.10,'contact shading grew into a scene-wide dark carpet');assert(channel(state,1).every(v=>v===0));
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

test('real ruin plinths join only the existing red contact mask, with no changes to other maps or floor channels',()=>{
 for(const id of ['forest','confluence','snow','ash','sand','coast']){
  const world=buildWorld(id,522);polishEnvironmentModels(world);const vista=installForestVista(world,id);
  installForestHabitats(world,id);installBiomePlaces(world,id);installEnvironmentClusters(world,id);installExplorationRoutes(world);
  const anchors=world.obstacles.filter(o=>o.mesh?.userData.forestVistaTrunk),source=world.ground.material,positions=world.ground.geometry.attributes.position.array.slice(),children=world.group.children.length,layout=JSON.stringify(world.obstacles.map(o=>[o.x,o.z,o.r,o.height]));
  const ground=world.ground.clone();ground.geometry=world.ground.geometry.clone();
  const baseline=installEnvironmentGrounding({...world,ground,obstacles:world.obstacles.filter(o=>!anchors.includes(o))}),state=installEnvironmentGrounding(world);
  assert.equal(state.sources,baseline.sources+anchors.length);assert.equal(world.group.children.length,children);assert.equal(JSON.stringify(world.obstacles.map(o=>[o.x,o.z,o.r,o.height])),layout);assert.deepEqual(world.ground.geometry.attributes.position.array,positions);
  for(const c of[1,2,3])assert.deepEqual(channel(state,c),channel(baseline,c),'ruin contact changed plant, road or wet-bank data');
  if(vista){
   assert.equal(anchors.length,vista.anchors.length);assert(anchors.length>=2&&anchors.length<=4);
   for(const a of anchors){assert(sample(state,world,a.x,a.z,0)>150,'permanent ruin plinth has no ground contact');assert(sample(state,world,a.x,a.z,0)>sample(baseline,world,a.x,a.z,0));}
   const pixel=2*(world.half+8)/512;let changed=0;
   for(let i=0;i<512*512;i++)if(state.texture.image.data[i*4]!==baseline.texture.image.data[i*4]){
    const x=(i%512+.5)*pixel-world.half-8,z=(Math.floor(i/512)+.5)*pixel-world.half-8;
    assert(anchors.some(a=>Math.hypot(x-a.x,z-a.z)<=a.r+.72),'new shading escaped the existing contact radius');changed++;
   }assert(changed>0&&changed<256,'ruin contact enlarged the mask across the scene');
  }else{assert.equal(anchors.length,0);assert.deepEqual(state.texture.image.data,baseline.texture.image.data);}
  assert.equal(state.texture.image.data.byteLength,512*512*4);assert.strictEqual(installEnvironmentGrounding(world),state);
  const shader={uniforms:{},vertexShader:T.ShaderLib.standard.vertexShader,fragmentShader:T.ShaderLib.standard.fragmentShader};state.material.onBeforeCompile(shader);
  assert.equal(shader.fragmentShader.match(/texture2D\(sceneryContact/g).length,1);
  let released=0;state.texture.addEventListener('dispose',()=>released++);cleanup(world);ground.geometry.dispose();
  assert(state.disposed&&baseline.disposed);assert.equal(released,1);assert.strictEqual(world.ground.material,source);
 }
});

test('duplicate ruin anchors use max shading while destructible or tactical anchors remain excluded',()=>{
 const make=obstacles=>{const ground=new T.Mesh(new T.PlaneGeometry(48,48),new T.MeshStandardMaterial());ground.userData.ownedGeometry=true;return{half:16,ground,obstacles};};
 const source={x:0,z:0,r:.65,mesh:{userData:{forestVistaTrunk:true}}},a=make([source]),b=make([source,{...source}]),falling=make([source]),tactical=make([{...source,tactic:'timber'}]);falling.breakables=[source];
 const first=installEnvironmentGrounding(a),second=installEnvironmentGrounding(b);assert.deepEqual(first.texture.image.data,second.texture.image.data);
 assert.equal(installEnvironmentGrounding(falling),null);assert.equal(installEnvironmentGrounding(tactical),null);
 for(const w of[a,b,falling,tactical])w.ground.geometry.dispose();
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
 const sample=(state,x,z)=>{const px=Math.floor((x+24)/48*512),py=Math.floor((z+24)/48*512);return state.texture.image.data[(py*512+px)*4+1];};
 assert.equal(sample(first,8,8),0);assert.notEqual(sample(first,.4,.2),sample(first,-.2,.4),'root stain became a rotationally uniform disc');
 for(const w of [a,b,c])w.ground.geometry.dispose();
});

test('all maps reuse one fixed mask and unchanged plant records, with only forest roots in the joined map',()=>{
 for(const id of ['forest','snow','ash','sand','coast','confluence']){
  const world=buildWorld(id,522);polishEnvironmentModels(world);installBiomePlaces(world,id);installEnvironmentClusters(world,id);installAdventureGroundDetail(world,id);installHabitatDetail(world,id);
  const records=[...world.adventureGroundDetail.userData.records,...world.habitatDetail.userData.records],before=JSON.stringify(records),children=world.group.children.length,positions=world.ground.geometry.attributes.position.array.slice();
  const state=installEnvironmentGrounding(world),expected=records.filter(p=>p.biome==='forest'&&['tuft','fern','shrub'].includes(p.kind)).length;
  assert.equal(state.plants,expected);assert.equal(state.texture.image.data.length,512*512*4);assert.equal(world.group.children.length,children);assert.deepEqual(world.ground.geometry.attributes.position.array,positions);assert.equal(JSON.stringify(records),before);
  const green=channel(state,1);assert.equal(green.some(v=>v>0),id==='forest'||id==='confluence');
  assert(green.filter(v=>v>0).length/green.length<.17,'faint forest root transitions spread across the scene');
  assert(green.filter(v=>v>8).length/green.length<.10,'visible forest root transitions became a scene-wide carpet');
  assert.strictEqual(installEnvironmentGrounding(world).texture,state.texture);assert.strictEqual(world.ground.material,state.material);
  if(id==='confluence'){
   const region=world.regions.find(r=>r.id==='forest'),extent=world.half+8,pixel=2*extent/512;
   for(let z=0;z<512;z++)for(let x=0;x<512;x++)if(!region.contains((x+.5)*pixel-extent,(z+.5)*pixel-extent))assert.equal(green[z*512+x],0,'root blur crossed the forest biome boundary');
   for(const p of records.filter(p=>p.biome!=='forest')){
    if(records.some(q=>q.biome==='forest'&&Math.hypot(p.x-q.x,p.z-q.z)<2))continue;
    const x=Math.floor((p.x+world.half+8)/(2*(world.half+8))*512),z=Math.floor((p.z+world.half+8)/(2*(world.half+8))*512);assert.equal(green[z*512+x],0,'non-forest roots acquired a green stain');
   }
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

const floorWorld=()=>{
 const ground=new T.Mesh(new T.PlaneGeometry(48,48),new T.MeshStandardMaterial());ground.userData.ownedGeometry=true;
 return{half:16,ground,obstacles:[],sites:[],forestHabitats:{region:null,relic:null,groves:[],ponds:[]}};
};

test('nearby roots share a feathered bed without changing obstacle, path or shoreline channels',()=>{
 const a=floorWorld(),b=floorWorld(),isolated=floorWorld();
 for(const world of[a,b,isolated]){world.obstacles=[{x:6,z:6,r:1,place:true}];world.road=[{x:-15,z:6},{x:15,z:6}];world.forestHabitats.ponds=[{x:-9,z:-6,rx:3,rz:2,angle:.4}];}
 const roots=[-.8,.8].map(x=>({x,z:0,biome:'forest',kind:'tuft',size:1,angle:0}));
 a.adventureGroundDetail={userData:{records:[...roots,{...roots[0],x:0,z:6}]}};
 isolated.adventureGroundDetail={userData:{records:[roots[0]]}};
 const first=installEnvironmentGrounding(a),bare=installEnvironmentGrounding(b),single=installEnvironmentGrounding(isolated);
 for(const c of[0,2,3])assert.deepEqual(channel(first,c),channel(bare,c),'root-bed filtering modified a non-plant channel');
 assert(sample(first,a,0,0,1)>8,'the gap between nearby roots has no connecting floor transition');
 assert(sample(first,a,0,0,1)>sample(single,isolated,0,0,1),'a neighbour does not contribute to the shared bed');
 assert(sample(first,a,0,.4,1)>0&&sample(first,a,0,.4,1)<sample(first,a,0,0,1),'the shared bed has a hard or flat edge');
 assert.equal(sample(first,a,0,1.4,1),0,'the shared bed has spread beyond its root neighbourhood');
 assert.equal(sample(first,a,0,6,1),0,'plant blur filled the worn centre of the trail');
 assert.equal(sample(first,a,8,-8,1),0);assert(channel(first,1).every(v=>v<=220));
 for(const world of[a,b,isolated])world.ground.geometry.dispose();
});

test('root-bed colour reuses existing fine soil samples and plain materials need no soil shader variables',()=>{
 const plain=floorWorld();plain.adventureGroundDetail={userData:{records:[{x:0,z:0,biome:'forest',kind:'tuft',size:1}]}};
 const plainState=installEnvironmentGrounding(plain),shader={uniforms:{},vertexShader:T.ShaderLib.standard.vertexShader,fragmentShader:T.ShaderLib.standard.fragmentShader};plainState.material.onBeforeCompile(shader);
 assert(shader.fragmentShader.includes('float forestRootGrain=.5;'));assert(!shader.fragmentShader.includes('soilFine'));assert(!shader.fragmentShader.includes('soilPixel'));assert.equal(shader.fragmentShader.match(/texture2D\(sceneryContact/g).length,1);
 const forest=buildWorld('forest',522);installAdventureGroundDetail(forest,'forest');const state=installEnvironmentGrounding(forest),detailed={uniforms:{},vertexShader:T.ShaderLib.standard.vertexShader,fragmentShader:T.ShaderLib.standard.fragmentShader};state.material.onBeforeCompile(detailed);
 assert(detailed.fragmentShader.includes('float forestRootLitter'));assert(detailed.fragmentShader.includes('groundContacts.g*forestRootLitter*.13'));
 assert(detailed.fragmentShader.indexOf('vec4 soilFine')<detailed.fragmentShader.indexOf('float forestRootGrain'));
 assert.equal(detailed.fragmentShader.match(/texture2D\(sceneryContact/g).length,1);assert(!detailed.fragmentShader.includes('undefined'));
 plain.ground.geometry.dispose();cleanup(forest);
});
test('forest floor has continuous dirt shoulders, shaded duff and a narrow damp irregular bank',()=>{
 const world=floorWorld();world.road=[{x:-15,z:5},{x:15,z:5}];
 world.forestHabitats.groves=[{x:9,z:-8}];world.forestHabitats.ponds=[{x:-9,z:-6,rx:3,rz:2,angle:0}];
 const before=JSON.stringify({road:world.road,habitat:world.forestHabitats}),state=installEnvironmentGrounding(world);
 assert(state.forestPixels>0&&state.sources===0&&state.plants===0,'forest-only worlds should use the same mask without props');
 const road=[0,1,2,3,4,5].map(d=>sample(state,world,0,5+d,2));
 assert(road[0]>245&&road.at(-1)===0);assert(road.some(v=>v>30&&v<220));
 for(let i=1;i<road.length;i++)assert(road[i]<=road[i-1],'road has a hard/reversed concentric band');
 assert(sample(state,world,0,5,3)<=130,'road centre should remain clear of the leaf shoulder');
 assert(sample(state,world,0,7,3)>145,'road shoulder has no leaf transition');
 assert(sample(state,world,9,-8,3)>150,'grove floor did not acquire dry brown/green duff');
 assert(sample(state,world,-5.6,-6,3)<95,'actual pond edge did not acquire damp soil');
 assert.equal(sample(state,world,-.5,-6,3)>=128,true,'wetness spread into the broad nine-metre habitat halo');
 assert.equal(sample(state,world,-19,-19,3),128,'neutral ground has become globally tinted');
 assert.equal(JSON.stringify({road:world.road,habitat:world.forestHabitats}),before);
 world.ground.geometry.dispose();assert(state.disposed);
});

test('visible trail masks follow mesh world coordinates and never bake hidden destinations',()=>{
 const world=floorWorld(),parent=new T.Group(),g=new T.BufferGeometry();
 g.setAttribute('position',new T.Float32BufferAttribute([-5,0,-.7,-5,0,-.3,-5,0,.3,-5,0,.7,5,0,-.7,5,0,-.3,5,0,.3,5,0,.7],3));
 const visible=new T.Mesh(g,new T.MeshBasicMaterial()),hidden=new T.Mesh(g.clone(),visible.material);parent.add(visible);parent.position.set(7,0,8);parent.rotation.y=Math.PI/2;hidden.position.set(-7,0,-8);hidden.visible=false;
 world.sites=[{trail:visible},{trail:hidden},{}];const original=g.attributes.position.array.slice(),state=installEnvironmentGrounding(world);
 assert(sample(state,world,7,8,2)>230);assert.equal(sample(state,world,0,0,2),0,'local-space trail leaked onto the world origin');
 assert.equal(sample(state,world,-7,-8,2),0,'unrevealed guide became a permanent floor marking');
 assert.equal(hidden.visible,false);assert.deepEqual(g.attributes.position.array,original);
 world.ground.geometry.dispose();g.dispose();hidden.geometry.dispose();visible.material.dispose();
});

test('neutral floor channels preserve even glossy base roughness without applying a forest clamp',()=>{
 const world=floorWorld();delete world.forestHabitats;world.obstacles=[{x:0,z:0,r:1,place:true}];
 const source=world.ground.material;source.roughness=.12;
 source.onBeforeCompile=shader=>{shader.fragmentShader=shader.fragmentShader.replace('#include <roughnessmap_fragment>','#include <roughnessmap_fragment>\nroughnessFactor=.12;');};
 const state=installEnvironmentGrounding(world),shader={uniforms:{},vertexShader:T.ShaderLib.standard.vertexShader,fragmentShader:T.ShaderLib.standard.fragmentShader};state.material.onBeforeCompile(shader);
 assert.equal(state.material.roughness,.12);assert(channel(state,2).every(v=>v===0));assert(channel(state,3).every(v=>v===128));
 assert(shader.fragmentShader.includes('float forestFloor=(groundContacts.a-(128.0/255.0))*(255.0/127.0);'),'neutral byte must subtract its exact normalized constant');
 assert.match(shader.fragmentShader,/if\(max\(forestTrack,max\(forestDuff,forestDamp\)\)>0\.0\)\{\s*roughnessFactor=clamp\(roughnessFactor\+forestDuff\*\.07-forestTrack\*\.025-forestDamp\*\.21,\.66,1\.0\);\s*\}/,'forest clamp must be guarded, preserving every original roughness at zero forest contribution');
 assert(shader.fragmentShader.indexOf('roughnessFactor=.12;')<shader.fragmentShader.indexOf('if(max(forestTrack'));
 world.ground.geometry.dispose();assert.strictEqual(world.ground.material,source);assert.equal(source.roughness,.12);
});

test('real forest and joined maps add floor transitions only to forest, with one sample and exact old contact channels',()=>{
 for(const id of ['forest','snow','ash','sand','coast','confluence']){
  const world=buildWorld(id,522);polishEnvironmentModels(world);installForestHabitats(world,id);installBiomePlaces(world,id);installEnvironmentClusters(world,id);installExplorationRoutes(world);
  const positions=world.ground.geometry.attributes.position.array.slice(),source=world.ground.material,children=world.group.children.length,layout=JSON.stringify(world.obstacles.map(o=>[o.x,o.z,o.r,o.height]));
  const state=installEnvironmentGrounding(world),b=channel(state,2),a=channel(state,3),forest=id==='forest'||id==='confluence';
  assert.equal(state.forestPixels>0,forest);assert.equal(b.some(v=>v>200),forest);assert.equal(a.some(v=>v<110),forest);assert.equal(a.some(v=>v>150),forest);
  if(!forest){assert(b.every(v=>v===0));assert(a.every(v=>v===128));}
  if(id==='confluence'){
   const region=world.forestHabitats.region,extent=world.half+8,pixel=2*extent/512;
   for(let z=0;z<512;z++)for(let x=0;x<512;x++)if(!region.contains((x+.5)*pixel-extent,(z+.5)*pixel-extent)){
    assert.equal(b[z*512+x],0);assert.equal(a[z*512+x],128,'non-forest region acquired duff or wet mud');
   }
  }
  const shader={uniforms:{},vertexShader:T.ShaderLib.standard.vertexShader,fragmentShader:T.ShaderLib.standard.fragmentShader};state.material.onBeforeCompile(shader);
  assert.equal(shader.fragmentShader.match(/texture2D\(sceneryContact/g).length,1);assert(shader.fragmentShader.includes('forestDamp*.21'));assert(shader.fragmentShader.indexOf('roughnessFactor+forestDuff')>shader.fragmentShader.indexOf('roughnessFactor-soilWet'),'base material overwrote the wet-bank roughness');
  assert.equal(world.group.children.length,children);assert.deepEqual(world.ground.geometry.attributes.position.array,positions);assert.equal(JSON.stringify(world.obstacles.map(o=>[o.x,o.z,o.r,o.height])),layout);
  const first=state.texture.image.data.slice();world.ground.geometry.dispose();assert.strictEqual(world.ground.material,source);
  const next=installEnvironmentGrounding(world);assert.deepEqual(next.texture.image.data,first);assert.notStrictEqual(next.texture,state.texture);cleanup(world);assert(next.disposed);
 }
});
