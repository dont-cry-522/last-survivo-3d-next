import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../vendor/three.module.js';
import {BOSS_ROUTES,ADDITIONAL_BOSSES} from '../boss-roster.js';
import {BOSS_STYLES,bossAttackPlan,tickBoss} from '../boss-combat.js';
import {ENEMY_GUIDE} from '../battle-guide.js';
import {mapBrief} from '../expedition-brief.js';
import {actor,animateActor} from '../world.js';
import {creatureSample,creatureFoleySample} from '../enemy-audio.js';
import {bossZoneEffect} from '../boss-effects.js';
import {SkillVFX} from '../skill-vfx.js';
import {installCreatureEmission} from '../creature-surface.js';

test('fifteen unique local bosses have complete names, guides, map order and audible cues',()=>{
 const ids=Object.values(BOSS_ROUTES).flat();assert.equal(ids.length,15);assert.equal(new Set(ids).size,15);
 for(const [map,route]of Object.entries(BOSS_ROUTES)){
  const brief=mapBrief(map);assert.equal(brief.name,BOSS_STYLES[route[0]].name);
  for(const id of route){const cfg=BOSS_STYLES[id],guide=ENEMY_GUIDE[id];assert.equal(guide.name,cfg.name);assert(brief.goal.includes(cfg.name));assert(guide.traits&&guide.tip&&guide.attack);if(ADDITIONAL_BOSSES[id])assert.equal(guide.map,map);
   for(const event of ['wind','attack','impact','death'])for(const sample of[creatureSample(id,event,8000),creatureFoleySample(id,event,8000)]){assert(sample?.length);assert(sample.every(Number.isFinite));assert(sample.some(v=>Math.abs(v)>.001));}
  }
 }
 assert.equal(mapBrief('confluence').name,'五境守卫');
});
test('new boss anatomy uses distinct connected rigs, cached finishes and bounded geometry',()=>{
 const expected={thornstag:[4,0],webmatriarch:[8,0],rimefang:[4,0],icephoenix:[0,2],moltenrhino:[4,0],cinderdrake:[2,2],dunedevourer:[0,0],obeliskwarden:[0,0],sailreaper:[0,2],abyssmedusa:[0,0]};let total=0;
 for(const [kind,cfg]of Object.entries(ADDITIONAL_BOSSES)){
  const m=actor(kind),copy=actor(kind),d=m.userData,parts=[],copies=[];m.traverse(o=>{if(o.isMesh)parts.push(o);});copy.traverse(o=>{if(o.isMesh)copies.push(o);});
  assert.deepEqual([d.legs.length,d.wings.length],expected[kind]);assert(Math.abs(new T.Box3().setFromObject(m).max.y-cfg.height)<1e-6);
  assert(parts.length<=32);let triangles=0;
  for(const [i,p]of parts.entries()){
   assert.equal(p.geometry,copies[i].geometry);assert.equal(p.material,copies[i].material);assert(p.name.startsWith('SM_'));
   const attrs=p.geometry.attributes;for(const a of Object.values(attrs)){assert.equal(a.count,attrs.position.count);assert(a.array.every(Number.isFinite));}
   triangles+=(p.geometry.index?.count||attrs.position.count)/3;
  }
  assert(triangles<21000,kind+' polygon budget');total+=triangles;
  animateActor(m,1,0);const pose=()=>{const a=[];m.traverse(o=>a.push(...o.matrix.elements));return a;};m.updateMatrixWorld(true);const before=pose();animateActor(m,1,0);m.updateMatrixWorld(true);assert.deepEqual(pose(),before,'pause drift');
  for(const move of cfg.moves){Object.assign(d,{bossStage:'wind',bossMove:move,windProgress:1});animateActor(m,2,0);m.updateMatrixWorld(true);const wind=pose();Object.assign(d,{bossStage:'strike',strikeProgress:0});animateActor(m,2,0);m.updateMatrixWorld(true);assert.deepEqual(pose(),wind,kind+' release snap');}
 }
 assert(total<140000);
});
test('all new plans lock finite ground zones, leave safe lanes and reuse the effect pool',()=>{
 const scene=new T.Scene(),vfx=new SkillVFX(scene);let peak=0;
 for(const [kind,cfg]of Object.entries(ADDITIONAL_BOSSES)){
  const signatures=new Set();for(const move of cfg.moves){const b={x:0,z:0,phase:1},target={x:0,z:7},plan=bossAttackPlan(kind,move,b,target),saved=JSON.stringify(plan);target.x=100;assert.equal(JSON.stringify(plan),saved);
   assert(plan.zones.length<=8);assert(plan.zones.every(z=>[z.x,z.z,z.r,z.delay,z.damage].every(Number.isFinite)&&z.delay>=cfg.wind&&z.damage>0));signatures.add(JSON.stringify(plan.zones));
   for(const z of plan.zones)bossZoneEffect(vfx,z,()=>1.2);assert(vfx.active.length>0);peak=Math.max(peak,vfx.active.length);assert(vfx.active.length<=90);vfx.clear();assert.equal(scene.children.length,0);
  }assert.equal(signatures.size,cfg.moves.length);
 }
 assert(peak<90);
 for(const [id,move]of[['webmatriarch','silkweave'],['cinderdrake','ashwings'],['obeliskwarden','stonepress']])assert(bossAttackPlan(id,move,{x:0,z:0,phase:2},{x:0,z:7}).zones.every(z=>Math.abs(z.x)>z.r+.4));
});
test('new translating attacks use the collision callback and retain locked targets',()=>{
 for(const kind of ['thornstag','rimefang','icephoenix','moltenrhino','dunedevourer','sailreaper']){
  const b={kind,mesh:actor(kind),x:0,z:0,hp:2000,maxHp:2000,phase:1,stage:'walk',cool:0,turn:kind==='icephoenix'||kind==='sailreaper'?1:0},p={x:0,z:7};let blocks=0,zones=[];
  const io={move:(o,x,z)=>{blocks++;},visible:()=>true,landing:p=>({x:p.x+3,z:p.z}),zone:z=>zones.push(z),notice(){},sound(){}};
  tickBoss(b,p,1/60,io);const locked={...b.target};assert.deepEqual(locked,{x:0,z:7},'occupied target must not displace attack warnings');assert(zones.some(z=>Math.hypot(z.x-p.x,z.z-p.z)<z.r),'stationary target was outside every charge impact');p.x=30;
  for(let i=0;i<240;i++){tickBoss(b,p,1/60,io);if(b.stage==='recover')break;}
  assert(blocks>1);assert.equal(b.x,0);assert.equal(b.z,0);assert.deepEqual(b.target,locked);assert(zones.length>0);assert.equal(b.mesh.userData.lift,0);assert.equal(b.stage,'recover');
 }
});
test('pigmented creature emission preserves prior shader hooks and installs only once',()=>{
 const m=new T.MeshStandardMaterial({vertexColors:true});let calls=0;m.onBeforeCompile=()=>calls++;m.customProgramCacheKey=()=> 'base';installCreatureEmission(m);const key=m.customProgramCacheKey();installCreatureEmission(m);assert.equal(m.customProgramCacheKey(),key);
 const shader={fragmentShader:T.ShaderLib.standard.fragmentShader};m.onBeforeCompile(shader);assert.equal(calls,1);assert.equal(shader.fragmentShader.match(/totalEmissiveRadiance \*= vColor.rgb/g).length,1);
});
