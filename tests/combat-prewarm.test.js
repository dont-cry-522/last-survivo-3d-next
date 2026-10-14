import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as T from '../vendor/three.module.js';
import {combatSampleKinds,prepareCombatSamples} from '../combat-prewarm.js';
import {MAP_ROSTERS} from '../map-enemies.js?v=193';
import {BOSS_ROUTES} from '../boss-expedition.js?v=193';
import {AIR_ROSTERS,makeAirborne} from '../airborne-enemies.js?v=193';
import {actor} from '../world.js?v=193';
import {SkillVFX} from '../skill-vfx.js?v=193';

const player=Object.freeze({x:9,y:2,z:-7,angle:.4});
function fixture(){const scene=new T.Scene(),existing=new T.Group(),vfx=new SkillVFX(scene);scene.add(existing);return{scene,existing,vfx,player,yieldWork:async()=>{}};}
function resources(root){const result=new Set();root.traverse(o=>{if(o.isMesh){result.add(o.geometry);for(const m of Array.isArray(o.material)?o.material:[o.material])result.add(m);}});return result;}

test('prewarm covers each local roster, all three expedition bosses and local airborne species',()=>{
 for(const map of Object.keys(MAP_ROSTERS)){
  const list=combatSampleKinds(map);assert.equal(list.length,9);assert.equal(new Set(list).size,9);
  for(const kind of Object.values(MAP_ROSTERS[map]))assert(list.includes(kind),map+' '+kind);
  for(const region of BOSS_ROUTES[map])assert(list.includes(MAP_ROSTERS[region].boss));
  assert(list.includes(AIR_ROSTERS[map]));
 }
 const all=combatSampleKinds('confluence');assert.equal(all.length,35);
 for(const map of Object.keys(MAP_ROSTERS))for(const kind of combatSampleKinds(map))assert(all.includes(kind));
 assert.deepEqual(combatSampleKinds('unknown'),combatSampleKinds('forest'));
});

test('real models and twelve particle variants remain renderable until cleanup, without disposing caches',async()=>{
 const f=fixture(),reports=[],yields=[];f.report=(done,total)=>reports.push([done,total]);f.yieldWork=async()=>yields.push(reports.at(-1)[0]);
 for(const key of ['flameTexture','shadowTexture','vaporTexture','crestTexture','streakTexture'])f.vfx[key]=new T.DataTexture(new Uint8Array([255,255,255,255]),1,1);
 const cleanup=await prepareCombatSamples({...f,mapId:'confluence',yaw:1.2});
 const group=f.scene.getObjectByName('Combat_Prewarm_Samples');assert(group);assert.equal(group.children.length,35);
 assert.equal(f.vfx.active.length,12);assert.equal(reports.length,48);assert.deepEqual(reports,Array.from({length:48},(_,i)=>[i,47]));assert.equal(yields.length,16);
 for(const holder of group.children){assert(new T.Box3().setFromObject(holder).getSize(new T.Vector3()).length()<.57);holder.traverse(o=>{if(o.isMesh)assert.equal(o.frustumCulled,false);});}
 const variants=f.vfx.active.map(p=>p.mesh.material);
 for(const key of ['flameTexture','shadowTexture','vaporTexture','crestTexture','streakTexture'])assert(variants.some(m=>m.map===f.vfx[key]));
 assert(variants.some(m=>m.vertexColors));assert(variants.some(m=>m.blending===T.AdditiveBlending));assert(variants.some(m=>m.blending===T.NormalBlending));
 assert(variants.some(m=>m.forceSinglePass));assert(variants.some(m=>!m.forceSinglePass));
 const cached=new Set([...resources(group),...f.vfx.active.flatMap(p=>[p.mesh.geometry,p.mesh.material])]);let disposed=0;for(const r of cached)r.addEventListener('dispose',()=>disposed++);
 cleanup();cleanup();assert.equal(disposed,0);assert.deepEqual(f.scene.children,[f.existing]);assert.equal(f.vfx.active.length,0);assert.equal(f.vfx.pool.length,12);
 for(const r of resources(makeAirborne('duskbat')))assert(cached.has(r),'airborne geometry and materials should reuse their warmed caches');
 for(const r of resources(actor('frostking')))assert(cached.has(r),'boss geometry and materials should reuse their warmed caches');
});

test('failed preparation cleans its samples and preserves the visual pool for retry',async()=>{
 const f=fixture();let calls=0;
 await assert.rejects(prepareCombatSamples({...f,mapId:'forest',yieldWork:async()=>{if(++calls===4)throw Error('interrupted');}}),/interrupted/);
 assert.deepEqual(f.scene.children,[f.existing]);assert.equal(f.vfx.active.length,0);assert.equal(f.vfx.pool.length,3);
 const cleanup=await prepareCombatSamples({...f,mapId:'forest'});assert.equal(f.vfx.active.length,12);cleanup();assert.equal(f.vfx.pool.length,12);
 await assert.rejects(prepareCombatSamples({...f,mapId:'forest',report(){throw Error('report failed');}}),/report failed/);
 assert.deepEqual(f.scene.children,[f.existing]);
});

test('prewarm refuses live effects and contains no simulation, persistence or sound hooks',async()=>{
 const f=fixture(),live=f.vfx.particle('ember',0xffffff,0,0,0);await assert.rejects(prepareCombatSamples({...f,mapId:'forest'}),/cleared effects/);
 assert.equal(f.vfx.active.length,1);assert.equal(live.parent,f.scene);assert.equal(f.scene.children.length,2);
 const source=readFileSync(new URL('../combat-prewarm.js',import.meta.url),'utf8');
 assert.doesNotMatch(source,/\b(?:spawn|spawnBoss|tickAirborne|animateActor|hurtEnemy|localStorage|sound|setInterval)\s*[.(]/);
 assert.doesNotMatch(source,/Math\.random|\.dispose\s*\(/);
});
