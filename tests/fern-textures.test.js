import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import * as T from '../vendor/three.module.js';

globalThis.document={createElement:()=>({getContext:()=>({fillRect(){}})})};
let serial=0;
const fresh=()=>import('../adventure-ground-detail.js?fern-texture-test='+ ++serial);
const createWorld=()=>({group:new T.Group(),half:48,seed:522,spawn:{x:0,z:0},obstacles:[],patches:[],sites:[],ponds:[]});
const release=world=>world.group.traverse(o=>{if(o.isInstancedMesh)o.dispose();if(o.userData.ownedGeometry)o.geometry.dispose();});
function habitat(module){const world=createWorld(),group=module.installHabitatDetail(world,'forest');return{world,group,fern:group.children.find(m=>m.name==='habitat-fern'),shrub:group.children.find(m=>m.name==='habitat-shrub')};}
const shaderFor=material=>{const shader={uniforms:{},vertexShader:T.ShaderLib.standard.vertexShader,fragmentShader:T.ShaderLib.standard.fragmentShader};material.onBeforeCompile(shader);return shader;};
function imageDimensions(data,file){
 if(file.endsWith('.png')){assert.equal(data.subarray(0,8).toString('hex'),'89504e470d0a1a0a');assert.equal(data.subarray(12,16).toString(),'IHDR');return[data.readUInt32BE(16),data.readUInt32BE(20)];}
 assert.equal(data.readUInt16BE(0),0xffd8,'missing JPEG signature');
 for(let offset=2;offset+8<data.length;){
  assert.equal(data[offset++],255,'invalid JPEG segment');while(data[offset]===255)offset++;const marker=data[offset++];
  if(marker===0xd9||marker===0xda)break;
  const length=data.readUInt16BE(offset);assert(length>=2&&offset+length<=data.length,'invalid JPEG segment length');
  if([0xc0,0xc1,0xc2].includes(marker))return[data.readUInt16BE(offset+5),data.readUInt16BE(offset+3)];
  offset+=length;
 }
 assert.fail('JPEG has no supported frame dimensions');
}

test('fern assets have a local CC0 manifest, exact hashes, 1K dimensions and a sub-0.85 MB budget',async()=>{
 const module=await fresh(),root=new URL('../assets/environment/',import.meta.url),source=JSON.parse(readFileSync(new URL('fern-sources.json',root)));
 assert.equal(source.license,'CC0-1.0');assert.equal(new URL(source.page).hostname,'polyhaven.com');assert(source.authors.length>0&&source.authors.every(name=>typeof name==='string'&&name.trim()));
 assert.deepEqual(Object.values(module.FERN_FILES).sort(),source.files.map(f=>f.file).sort());assert.equal(new Set(source.files.map(f=>f.file)).size,3);
 let bytes=0;for(const file of source.files){
  assert.match(file.file,/^fern_02_(diff|alpha|nor_gl)_1k\.(jpg|png)$/);const url=new URL(file.source);assert.equal(url.protocol,'https:');assert.equal(url.hostname,'dl.polyhaven.org');assert(url.pathname.endsWith('/'+file.file));
  const data=readFileSync(new URL(file.file,root));assert.equal(data.length,file.bytes);assert.match(file.sha256,/^[a-f0-9]{64}$/);assert.equal(createHash('sha256').update(data).digest('hex'),file.sha256);assert.deepEqual(imageDimensions(data,file.file),[1024,1024]);bytes+=data.length;
 }
 assert(bytes<850000,'fern textures exceed their complete download budget');
});

test('all textures commit together once and remain shared across world disposal/rebuilds',async t=>{
 const module=await fresh(),a=habitat(module),b=habitat(module),material=a.fern.material,old={map:material.map,alphaMap:material.alphaMap,normalMap:material.normalMap};
 assert.strictEqual(b.fern.material,material);const fallbackDisposals=new Map([[old.map,0],[old.alphaMap,0]]);
 for(const texture of fallbackDisposals.keys())texture.addEventListener('dispose',()=>fallbackDisposals.set(texture,fallbackDisposals.get(texture)+1));
 const requests=[],textures=[],disposed=new Map();
 t.mock.method(T.TextureLoader.prototype,'loadAsync',url=>new Promise(resolve=>{const texture=new T.Texture();textures.push(texture);disposed.set(texture,0);texture.addEventListener('dispose',()=>disposed.set(texture,disposed.get(texture)+1));requests.push({url,resolve:()=>resolve(texture)});}));
 const pending=module.loadFernTextures();assert.strictEqual(module.loadFernTextures(),pending);assert.equal(requests.length,3);
 for(const {url}of requests){const parsed=new URL(url);assert(parsed.pathname.includes('/assets/environment/'));assert(!parsed.hostname||parsed.hostname==='localhost');}
 requests[0].resolve();requests[1].resolve();await new Promise(setImmediate);
 for(const key of Object.keys(old))assert.strictEqual(material[key],old[key],'partially loaded atlas became visible');assert([...fallbackDisposals.values()].every(n=>n===0));
 requests[2].resolve();assert.equal(await pending,true);assert.strictEqual(module.loadFernTextures(),pending);assert.equal(requests.length,3);assert([...fallbackDisposals.values()].every(n=>n===1));
 for(const[key,file]of Object.entries(module.FERN_FILES)){const texture=material[key];assert(textures.includes(texture));assert.equal(texture.name,file);assert.equal(texture.colorSpace,key==='map'?T.SRGBColorSpace:T.NoColorSpace);assert.equal(texture.anisotropy,4);assert.equal(texture.wrapS,T.ClampToEdgeWrapping);assert.equal(texture.wrapT,T.ClampToEdgeWrapping);assert.equal(texture.generateMipmaps,true);}
 const geometries=[...a.group.children,...b.group.children].map(m=>m.geometry),released=new Map(geometries.map(g=>[g,0]));for(const geometry of geometries)geometry.addEventListener('dispose',()=>released.set(geometry,released.get(geometry)+1));
 release(a.world);assert(a.group.userData.disposed);assert(!b.group.userData.disposed);release(b.world);assert([...released.values()].every(n=>n===1));assert([...disposed.values()].every(n=>n===0),'world cleanup disposed a shared texture');
 const c=habitat(module);assert.strictEqual(c.fern.material,material);assert.strictEqual(c.fern.material.map,textures[0]);assert(!geometries.includes(c.fern.geometry));assert.equal(requests.length,3);release(c.world);assert([...disposed.values()].every(n=>n===0));
});

test('failure of any one atlas file preserves the whole fallback and releases successful siblings',async t=>{
 for(const failedKey of['map','alphaMap','normalMap'])await t.test(failedKey,async sub=>{
  const module=await fresh(),h=habitat(module),material=h.fern.material,before={map:material.map,alphaMap:material.alphaMap,normalMap:material.normalMap};let fallbackDisposed=0;before.map.addEventListener('dispose',()=>fallbackDisposed++);before.alphaMap.addEventListener('dispose',()=>fallbackDisposed++);
  const requests=[],created=[],counts=new Map();
  sub.mock.method(T.TextureLoader.prototype,'loadAsync',url=>new Promise((resolve,reject)=>{const file=new URL(url).pathname.split('/').at(-1);if(file===module.FERN_FILES[failedKey]){requests.push({fail:()=>reject(Error('fixture missing local file'))});return;}const texture=new T.Texture();created.push(texture);counts.set(texture,0);texture.addEventListener('dispose',()=>counts.set(texture,counts.get(texture)+1));requests.push({resolve:()=>resolve(texture)});}));
  const pending=module.loadFernTextures();assert.strictEqual(module.loadFernTextures(),pending);assert.equal(requests.length,3);requests.find(r=>r.fail).fail();await new Promise(setImmediate);
  for(const key of Object.keys(before))assert.strictEqual(material[key],before[key]);
  requests.filter(r=>r.resolve).forEach(r=>r.resolve());assert.equal(await pending,false);assert.equal(created.length,2);assert([...counts.values()].every(n=>n===1),'failed atlas leaked or double-disposed a successful sibling');
  assert.equal(fallbackDisposed,0);for(const key of Object.keys(before))assert.strictEqual(material[key],before[key]);assert.strictEqual(module.loadFernTextures(),pending);assert.equal(requests.length,3);release(h.world);assert.equal(fallbackDisposed,0);assert([...counts.values()].every(n=>n===1));
 });
});

test('curved fern cards and folded shrubs keep finite normals, bounded UVs and stationary roots',async()=>{
 const module=await fresh(),h=habitat(module),matrix=new T.Matrix4(),point=new T.Vector3(),center=new T.Vector3(),a=new T.Vector3(),b=new T.Vector3(),c=new T.Vector3();
 for(const [name,mesh,budget]of[['fern',h.fern,132],['shrub',h.shrub,120]]){
  assert(mesh,name+' missing');const geometry=mesh.geometry,{position:p,normal:n,groundFlex:flex,color}=geometry.attributes,index=geometry.index;
  assert(index.count/3<=budget);assert.equal(n.count,p.count);assert.equal(flex.count,p.count);assert.equal(color.count,p.count);
  for(let i=0;i<p.count;i++){
   assert([p.getX(i),p.getY(i),p.getZ(i),color.getX(i),color.getY(i),color.getZ(i)].every(Number.isFinite));assert(Math.abs(Math.hypot(n.getX(i),n.getY(i),n.getZ(i))-1)<1e-5);
   assert(flex.getX(i)>=0&&flex.getX(i)<=1);if(p.getY(i)<-.024)assert.equal(flex.getX(i),0,'buried roots sway');
  }
  assert([...flex.array].some(v=>v>.4),'leaf tips lost wind weights');
  for(let i=0;i<index.count;i+=3){a.fromBufferAttribute(p,index.getX(i));b.fromBufferAttribute(p,index.getX(i+1)).sub(a);c.fromBufferAttribute(p,index.getX(i+2)).sub(a);assert(b.cross(c).lengthSq()>1e-12,'degenerate leaf triangle');}
  for(let i=0;i<mesh.count;i++){mesh.getMatrixAt(i,matrix);center.setFromMatrixPosition(matrix);for(let j=0;j<p.count;j++){point.fromBufferAttribute(p,j).applyMatrix4(matrix);assert(Math.hypot(point.x-center.x,point.z-center.z)+.035<1.15,'wind-swept leaf leaves its reserved footprint');assert(point.y<.7,'leaf obstructs the combat sightline');}}
 }
 const uv=h.fern.geometry.attributes.uv;assert.equal(uv.count,h.fern.geometry.attributes.position.count);assert([...uv.array].every(v=>Number.isFinite(v)&&v>=0&&v<=1));
 // Each triangle remains inside one of the three isolated atlas columns.
 const index=h.fern.geometry.index,regions=[[.078,.240],[.307,.458],[.718,.839]];
 for(let i=0;i<index.count;i+=3){const us=[0,1,2].map(k=>uv.getX(index.getX(i+k)));assert(regions.some(([lo,hi])=>us.every(u=>u>=lo-1e-6&&u<=hi+1e-6)),'triangle crosses transparent atlas gutters');}
 release(h.world);
});

test('fern cutouts use alpha-tested green-channel masks and retain the shared instanced wind shader',async()=>{
 const module=await fresh(),h=habitat(module),material=h.fern.material,alpha=material.alphaMap;
 assert.equal(material.side,T.DoubleSide);assert.equal(material.transparent,false);assert.equal(material.depthWrite,true);assert(material.alphaTest>.3&&material.alphaTest<.6);assert.equal(material.map.colorSpace,T.SRGBColorSpace);assert.equal(alpha.colorSpace,T.NoColorSpace);assert.equal(alpha.flipY,false);assert(material.normalScale.x>0&&material.normalScale.x<=.4);
 const {data,width,height}=alpha.image,green=[];for(let i=1;i<data.length;i+=4)green.push(data[i]);assert(green.some(v=>v===0)&&green.some(v=>v===255),'fallback is an opaque card or entirely invisible');
 const uv=h.fern.geometry.attributes.uv,sample=i=>data[(Math.round(uv.getY(i)*(height-1))*width+Math.round(uv.getX(i)*(width-1)))*4+1];
 for(let frond=0;frond<6;frond++){const middle=frond*19+10;assert(sample(middle)/255>material.alphaTest,'fallback atlas is flipped or missing the frond center');assert(sample(middle-1)/255<material.alphaTest&&sample(middle+1)/255<material.alphaTest,'fallback retains rectangular card sides');}
 const fern=shaderFor(material),shrub=shaderFor(h.shrub.material);assert.strictEqual(fern.uniforms.groundWindTime,module.groundWindTime);assert.strictEqual(shrub.uniforms.groundWindTime,module.groundWindTime);
 for(const token of['#include <map_fragment>','#include <alphamap_fragment>','#include <alphatest_fragment>','#include <normal_fragment_maps>'])assert(fern.fragmentShader.includes(token),'standard texture stage removed: '+token);
 assert(fern.vertexShader.includes('instanceMatrix*grassPoint'));assert(fern.vertexShader.includes('mat3(modelMatrix*instanceMatrix)'));assert(fern.vertexShader.includes('groundFlex*.035'));assert(!fern.vertexShader.includes('undefined'));assert(!fern.fragmentShader.includes('undefined'));
 module.animateAdventureGroundDetail(12);assert.equal(fern.uniforms.groundWindTime.value,12);module.animateAdventureGroundDetail(NaN);module.animateAdventureGroundDetail(Infinity);assert.equal(fern.uniforms.groundWindTime.value,12);module.animateAdventureGroundDetail(0);assert.equal(fern.uniforms.groundWindTime.value,0);release(h.world);
});
