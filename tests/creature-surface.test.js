import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as T from '../vendor/three.module.js';
import {creatureFinish,prepareCreatureSurface,installCreatureSurface} from '../creature-surface.js';
import {actor,animateActor} from '../world.js';
import {makeAirborne,animateAirborne,AIR_ENEMIES} from '../airborne-enemies.js';

const ground=['mushroom','wolf','golem','spitter','shaman','snowhare','frostwolf','yeti','icewitch','snowtotem','emberling','ashstalker','lavabrute','cinderwisp','ashseer','sandworm','clawbeetle','sandguard','sandspitter','duneoracle','foamling','tidecrab','reefturtle','jellyseer','tidestar'];
const meshes=g=>{const a=[];g.traverse(o=>{if(o.isMesh)a.push(o);});return a;};
const shader=()=>({uniforms:{},vertexShader:T.ShaderLib.standard.vertexShader,fragmentShader:T.ShaderLib.standard.fragmentShader});

test('creature surface profiles distinguish anatomy, cloth, membrane and wet noses',()=>{
 const expected=[['wolf','body',1],['yeti','body',1],['golem','body',2],['lavabrute','Forearm',2],['tidecrab','carapace',3],['sunscarab','elytron',3],['ashseer','robe',4],['shaman','body',4],['mushroom','cap',5],['ashstalker','body',6],['sandworm','body',6],['skyray','body',7],['duskbat','wing',7],['frostwing','wing',7],['shaman','head',8],['icewitch','staff',8],['wolf','nose',9],['snowtotem','core',10],['wolf','eyelids',0],['frostwolf','fang',0],['unknown','body',0]];
 for(const [species,part,value]of expected)assert.equal(creatureFinish(species,part),value,species+'/'+part);
 for(const [species,part,value]of [['frostwing','SM_Enemy_frostwing_ContinuousBody',1],['frostwing','SM_Enemy_Wing_Inner',7],['cinderwing','SM_Enemy_cinderwing_ContinuousBody',6],['cinderwing','SM_Enemy_Wing_Inner',7]])assert.equal(creatureFinish(species,part),value,species+'/'+part);
 // Generic mesh names must receive their species during template creation.
 for(const [species,style]of [['wolf',1],['golem',2],['mushroom',5],['spitter',6],['shaman',4]]){
  const a=actor(species).getObjectByName('creature-body').geometry.attributes.creatureFinish;
  assert(a&&a.count>0);for(let i=0;i<a.count;i++)assert.equal(a.getX(i),style,species+' generic body lost its identity');
 }
 for(const [species,bodyStyle]of [['frostwing',1],['cinderwing',6]]){
  const d=makeAirborne(species).userData;
  for(const [mesh,style]of [[d.body,bodyStyle],[d.wings[0].children[0],7],[d.wingTips[0].children[0],7]]){const a=mesh.geometry.attributes.creatureFinish;for(let i=0;i<a.count;i++)assert.equal(a.getX(i),style,mesh.name+' was classified from the species suffix rather than its real part');}
 }
});

test('surface preparation caches one attribute and never changes position, normals or pigment',()=>{
 const g=new T.BoxGeometry(1,1,1),p=g.attributes.position,c=new Float32Array(p.count*3);
 for(let i=0;i<p.count;i++)c.fill(i%2?.5:0,i*3,i*3+3);g.setAttribute('color',new T.Float32BufferAttribute(c,3));
 const references={...g.attributes},values=Object.fromEntries(Object.entries(references).map(([k,a])=>[k,a.array.slice()]));
 assert.equal(prepareCreatureSurface(g,'wolf','body'),g);const attr=g.attributes.creatureFinish;assert.equal(attr.itemSize,2);assert.equal(attr.count,p.count);
 for(let i=0;i<p.count;i++){assert.equal(attr.getX(i),1);assert.equal(attr.getY(i),i%2?Math.fround(.42):0);}
 for(let i=0;i<100;i++)prepareCreatureSurface(g,'golem','body');assert.equal(g.attributes.creatureFinish,attr,'already classified template was allocated or reclassified');assert.equal(attr.version,0);
 for(const [k,a]of Object.entries(references)){assert.equal(g.attributes[k],a);assert.deepEqual(a.array,values[k]);}
 const darkNose=new T.BoxGeometry();darkNose.setAttribute('color',new T.Float32BufferAttribute(new Float32Array(darkNose.attributes.position.count*3),3));prepareCreatureSurface(darkNose,'wolf','nose');assert(darkNose.attributes.creatureFinish.getY(0)>0,'dark nose pigment suppressed its wet finish');g.dispose();darkNose.dispose();
});

test('material installation is idempotent and preserves earlier shader hooks and cache keys',()=>{
 const m=new T.MeshStandardMaterial(),clock={value:3};let calls=0;
 m.onBeforeCompile=function(s){assert.equal(this,m);calls++;s.uniforms.previousClock=clock;s.vertexShader='uniform float previousClock;\n'+s.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\ntransformed.y+=previousClock;');};m.customProgramCacheKey=()=> 'prior-program';
 installCreatureSurface(m);const hook=m.onBeforeCompile,key=m.customProgramCacheKey();installCreatureSurface(m);assert.equal(m.onBeforeCompile,hook);assert.equal(m.customProgramCacheKey(),key);assert(key.startsWith('prior-program|'));
 const s=shader();m.onBeforeCompile(s);assert.equal(calls,1);assert.equal(s.uniforms.previousClock,clock);assert.equal((s.vertexShader.match(/attribute vec2 creatureFinish/g)||[]).length,1);assert.match(s.vertexShader,/transformed.y\+=previousClock/);assert.match(s.fragmentShader,/roughnessFactor=mix/);assert.match(s.fragmentShader,/dFdx\(ch\)/);assert.match(s.fragmentShader,/dot\(ca,cr1\)\s*\*\s*faceDirection/,'double-sided relief must include the same facing correction as Three perturbNormalArb');assert.equal(m.map,null);assert.equal(m.normalMap,null);m.dispose();
});

test('double-sided relief normals mirror through the surface instead of bending both sides the same way',()=>{
 // The shader determinant follows Three's perturbNormalArb. A shared local
 // height gradient must produce opposite outward normals on membrane backs.
 const perturb=side=>{
  const a=new T.Vector3(1,0,0),b=new T.Vector3(0,1,0),normal=new T.Vector3(0,0,side);
  const r1=new T.Vector3().crossVectors(b,normal),r2=new T.Vector3().crossVectors(normal,a),det=a.dot(r1)*side;
  return normal.multiplyScalar(Math.abs(det)).addScaledVector(r1,-Math.sign(det)*.12).addScaledVector(r2,-Math.sign(det)*-.07).normalize();
 };
 const front=perturb(1),back=perturb(-1);assert(front.z>0&&back.z<0);assert(front.clone().add(back).length()<1e-12);
});

test('existing soft bodies retain the same game clock and shadow bending after finish installation',async()=>{
 const clockImport=readFileSync(new URL('../main.js',import.meta.url),'utf8').match(/from'(.\/creature-forms\.js[^']*)'/)[1],{setCreatureTime}=await import(new URL('../'+clockImport,import.meta.url));
 const worm=actor('sandworm'),jelly=actor('jellyseer'),normal=shader(),depth={uniforms:{},vertexShader:T.ShaderLib.depth.vertexShader,fragmentShader:T.ShaderLib.depth.fragmentShader};
 worm.userData.body.material.onBeforeCompile(normal);jelly.userData.tentacles.customDepthMaterial.onBeforeCompile(depth);
 assert.equal(normal.uniforms.creatureTime,depth.uniforms.creatureTime);assert.match(normal.vertexShader,/attribute vec3 creatureBend/);assert.match(normal.vertexShader,/vCreatureFinish=creatureFinish/);assert.match(depth.vertexShader,/creatureWave/);
 setCreatureTime(9.25);assert.equal(normal.uniforms.creatureTime.value,9.25);assert.equal(depth.uniforms.creatureTime.value,9.25);setCreatureTime(9.25);assert.equal(normal.uniforms.creatureTime.value,9.25);setCreatureTime(0);
});

test('every installed ground and flying mesh has valid cached finish data throughout animation',()=>{
 const actors=ground.map(id=>({id,mesh:actor(id)})),air=Object.keys(AIR_ENEMIES).map((kind,i)=>({kind,id:i,mesh:makeAirborne(kind),flight:{stage:'orbit'}}));
 const all=[...actors.map(x=>x.mesh),...air.map(x=>x.mesh)],records=[],uniqueGeometry=new Set(),uniqueMaterial=new Set();let prepared=0;
 for(const g of all)for(const m of meshes(g)){
  const attrs=m.geometry.attributes,finish=attrs.creatureFinish;uniqueGeometry.add(m.geometry);uniqueMaterial.add(m.material);
  if(m.material.userData.creatureSurfaceFinish){assert(finish,m.name+' lacks required shader attribute');assert.equal(finish.itemSize,2);assert.equal(finish.count,attrs.position.count);for(let i=0;i<finish.count;i++){assert(Number.isInteger(finish.getX(i))&&finish.getX(i)>=0&&finish.getX(i)<=10);assert(Number.isFinite(finish.getY(i))&&finish.getY(i)>=0&&finish.getY(i)<=.43);}prepared++;const s=shader();m.material.onBeforeCompile(s);assert.match(s.vertexShader,/vCreatureFinish=creatureFinish/);assert.match(s.fragmentShader,/creatureCoverage/);}
  records.push({mesh:m,geometry:m.geometry,material:m.material,finish,values:finish?.array.slice(),position:attrs.position,positions:attrs.position.array.slice()});
 }
 assert(prepared>200,'roster coverage unexpectedly small');
 for(let frame=0;frame<180;frame++){const t=frame/60;for(const {mesh}of actors)animateActor(mesh,t,frame<60?2.5:0,frame>=60&&frame<95?(95-frame)/60:0);for(const e of air){e.flight.stage=frame<60?'orbit':frame<100?'wind':frame<140?'strike':'recover';animateAirborne(e,t);}}
 for(const r of records){assert.equal(r.mesh.geometry,r.geometry);assert.equal(r.mesh.material,r.material);assert.equal(r.geometry.attributes.position,r.position);assert.deepEqual(r.position.array,r.positions);assert.equal(r.geometry.attributes.creatureFinish,r.finish);if(r.finish)assert.deepEqual(r.finish.array,r.values);}
 const afterGeometries=new Set(),afterMaterials=new Set();for(const g of all)for(const m of meshes(g)){afterGeometries.add(m.geometry);afterMaterials.add(m.material);}assert.deepEqual(afterGeometries,uniqueGeometry);assert.deepEqual(afterMaterials,uniqueMaterial);
});
