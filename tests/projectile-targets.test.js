import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {segmentHitsBody,segmentBodyEntry,bodyContact,launchVelocity} from '../adventure-combat.js';
import {segmentDistance,crossbowImpact,registerShadowHit} from '../rules.js';
import {shotgunVolley,shotgunHit,SHOTGUN_PUSH} from '../gun-handling.js';

// Execute the production projectile/meteor/spell phase, replacing only its
// render/audio/world adapters. The reference changes target-list construction
// back to the previous query-per-use behavior; damage/order code is identical.
const main=readFileSync(new URL('../main.js',import.meta.url),'utf8');
const start=main.indexOf(' const projectileTargets='),end=main.indexOf(' updateShadowSpells(dt);',start);
assert(start>0&&end>start,'main projectile phase boundary changed');
const phase=main.slice(start,end),snapshot='const projectileTargets=boss?.alive?[...enemies,boss]:enemies;';
assert(phase.includes(snapshot),'snapshot instrumentation needs updating');
const current=phase.replace(snapshot,'const projectileTargets=boss?.alive?(listCopies++,[...enemies,boss]):enemies;inspectTargets(projectileTargets);').replace('?[...projectileTargets]:projectileTargets','?(listCopies++,[...projectileTargets]):projectileTargets');
const reference=phase.replace(snapshot,'const targets=()=>{listCopies++;return [...enemies,...(boss?.alive?[boss]:[])];};')
 .replace("b.kind==='crossbow'&&b.pathId==='crossbow_pierce'?[...projectileTargets]:projectileTargets",'targets()')
 .replaceAll('projectileTargets','targets()');
const runCurrent=new Function('context','with(context){'+current+'}'),runReference=new Function('context','with(context){'+reference+'}');
const noop=()=>{},effects=()=>new Proxy({},{get:()=>noop});
const enemy=(id,z,extra={})=>({id,kind:'golem',alive:true,x:0,y:0,z,height:2,size:.5,hp:1000,mesh:{position:{set:noop}},...extra});
const bullet=(id,extra={})=>({id,kind:'rifle',x:0,z:0,height:1,vx:0,vy:0,vz:100,speed:100,life:1,elapsed:0,spatial:true,damage:1,pierce:1,bounces:0,hitRadius:.09,waterContact:true,hits:new Set(),visualHits:new Set(),mesh:{position:{set:noop},rotation:{x:0,y:0}},...extra});
function context(enemies,bullets,boss=null){
 const c={enemies,bullets,boss,zones:[],dt:.1,time:1,state:'playing',listCopies:0,hits:[],snapshots:[],currentBullet:null,
  player:{x:0,y:0,z:0,weaponId:'crossbow',upgrades:{},spell:{fire:0,ice:0,storm:0}},world:{obstacles:[],overhead:{firstHit:()=>null},groundHeightAt:()=>0},
  vfx:effects(),sound:effects(),scene:effects(),environmentImpacts:effects(),heroSkills:effects(),mirage:{hidden:false},companion:null,ENEMY_VOICES:{},
  segmentHitsBody,segmentBodyEntry,bodyContact,launchVelocity,segmentDistance,crossbowImpact,registerShadowHit,shotgunHit,SHOTGUN_PUSH,
  closeContact:x=>x,segmentGroundEntry:()=>null,mapHalf:()=>100,clearAt:()=>true,groundAt:()=>0,visibleWeaponRange:(_,range)=>range,weaponRouteEffect:noop,inflictStatus:noop,
  updateCompanion:noop,disposeCue:noop,addGravity:noop,moveActor:noop,lightning:noop,burst:noop,terrainHit:noop,bossZoneEffect:noop,
  enemySound:noop,hitPlayer:noop,attackReachesPlayer:()=>false,addZone:noop
 };
 c.vfx=new Proxy({flight:b=>{c.currentBullet=b.id;}},{get:(o,key)=>o[key]||noop});
 c.inspectTargets=list=>c.snapshots.push(list);
 c.hurtEnemy=(e,damage)=>{if(!e.alive)return;c.hits.push([c.currentBullet,e.id??'boss',damage]);e.hp-=damage;if(e.hp<=0)e.alive=false;};
 return c;
}
function equivalent(factory){const before=factory(),after=factory();runReference(before);runCurrent(after);assert.deepEqual(after.hits,before.hits);assert.deepEqual(after.enemies.map(e=>[e.id,e.hp,e.alive,e.x,e.z]),before.enemies.map(e=>[e.id,e.hp,e.alive,e.x,e.z]));assert.equal(after.boss?.hp,before.boss?.hp);return after;}
function meteor(z,r=.3){return{x:0,z,r,kind:'meteor',damage:7,delay:0,life:1,mist:0,mesh:{visible:true,material:{opacity:0,color:{set:noop}}}};}

test('piercing arrows alone sort a private list; ordinary projectiles keep spawn order and boss last',()=>{
 const result=equivalent(()=>context([enemy(7,7),enemy(3,3),enemy(5,5)],[bullet('arrow',{kind:'crossbow',pathId:'crossbow_pierce',pathRank:1,pierce:4,maxPierce:4}),bullet('rifle',{pierce:4})],enemy(undefined,9,{kind:'boss'})));
 assert.deepEqual(result.hits.filter(hit=>hit[0]==='arrow').map(hit=>hit[1]),[3,5,7,'boss']);
 assert.deepEqual(result.hits.filter(hit=>hit[0]==='rifle').map(hit=>hit[1]),[7,3,5,'boss']);
 assert.deepEqual(result.enemies.map(e=>e.id),[7,3,5]);assert.deepEqual(result.snapshots[0].map(e=>e.id??'boss'),[7,3,5,'boss']);
 assert.equal(result.snapshots[0][0],result.enemies[0]);assert.equal(result.snapshots[0].at(-1),result.boss);
});

test('kills in an earlier projectile remain dead for later hits, splash, meteors and spells',()=>{
 for(const bossState of['absent','dead','alive']){
  const result=equivalent(()=>{
   const c=context([enemy(1,3,{hp:1}),enemy(2,5,{hp:1}),enemy(3,6,{alive:false,hp:0})],[bullet('kill',{pierce:4,damage:50}),bullet('follow',{kind:'fire',radius:8,pierce:4,damage:50})],bossState==='absent'?null:enemy(undefined,7,{kind:'boss',hp:1,alive:bossState==='alive'}));
   c.zones=[meteor(5,10)];c.player.upgrades={ice:1,storm:1};return c;
  });
  assert(result.hits.every(hit=>hit[0]==='kill'));assert.deepEqual(result.hits.map(hit=>hit[1]),bossState==='alive'?[1,2,'boss']:[1,2]);
 }
});

test('companion movement and kills stay visible to the same-frame meteor and spell phase',()=>{
 const result=equivalent(()=>{
  const c=context([enemy(1,20),enemy(2,4),enemy(3,8)],[],enemy(undefined,3,{kind:'boss'}));c.zones=[meteor(2)];c.player.upgrades={ice:1,storm:1};
  c.updateCompanion=()=>{c.currentBullet='after-companion';c.enemies[0].z=2;c.enemies[1].alive=false;c.boss.alive=false;};return c;
 });
 assert.deepEqual(result.hits.map(hit=>[hit[1],hit[2]]),[[1,7],[1,20],[1,27],[3,27]]);
 assert.equal(result.snapshots[0][0].z,2,'snapshot cloned bodies instead of retaining references');
});

test('splash and bounce acquisition retain tie order while observing earlier kills',()=>{
 const result=equivalent(()=>{
  const c=context([enemy(1,3,{hp:1}),enemy(2,5,{hp:1}),enemy(3,7),enemy(4,8,{x:1})],[bullet('blast',{kind:'fire',damage:10,radius:2.5}),bullet('bounce',{bounces:1,pierce:3})],enemy(undefined,8,{x:-1,kind:'boss'}));return c;
 });
 assert.deepEqual(result.hits.map(hit=>hit[1]),[1,2,3]);
 assert(result.bullets.some(b=>b.id==='bounce'&&b.bounces===0&&b.bounceOrigin&&b.vx>0),'equal-distance bounce reordered the enemy and boss');
});

test('special orbs receive live bodies and their kills are visible to following projectiles',()=>{
 const result=equivalent(()=>{
  const c=context([enemy(1,3),enemy(2,5)],[bullet('orb',{kind:'miasmalantern'}),bullet('rifle')],enemy(undefined,9,{kind:'boss'}));
  c.stepMirageOrb=(orb,dt,foes)=>{assert.equal(foes[0],c.enemies[0]);assert.equal(foes.at(-1),c.boss);c.enemies[0].alive=false;orb.life=0;};return c;
 });
 assert.deepEqual(result.hits.map(hit=>hit[1]),[2]);
});

test('80 projectiles against 60 enemies avoid repeated combined target-list copies',t=>{
 for(const withBoss of[false,true]){
  const factory=()=>context(Array.from({length:60},(_,id)=>enemy(id,4,{x:20})),Array.from({length:80},(_,id)=>bullet(id)),withBoss?enemy(undefined,5,{x:20,kind:'boss'}):null);
  const before=factory(),after=factory();runReference(before);runCurrent(after);
  assert.deepEqual(after.hits,before.hits);assert.equal(before.listCopies,80);assert.equal(after.listCopies,withBoss?1:0);
  if(!withBoss)assert.equal(after.snapshots[0],after.enemies);
  t.diagnostic(`${withBoss?'boss present':'no boss'}: combined target-list copies ${before.listCopies} -> ${after.listCopies}; 80 projectiles / 60 enemies, allocation count only, not FPS`);
 }
});

test('a final boss kill discards queued shotgun pushes but still cleans spent projectiles',()=>{
 const target=enemy(1,2),boss=enemy(undefined,2,{x:5,kind:'boss',boss:true,hp:1});
 const volley=shotgunVolley({id:'shotgun',count:5},{x:0,y:1,z:0});
 const pellets=Array.from({length:3},(_,i)=>bullet(i,{kind:'shotgun',volley}));
 const c=context([target],[...pellets,bullet('finish',{x:5})],boss),hurt=c.hurtEnemy,removed=[];
 c.hurtEnemy=(e,damage)=>{hurt(e,damage);if(e===boss&&!e.alive)c.state='won';};
 c.moveActor=()=>assert.fail('the queued push ran after the final boss died');
 c.scene={remove:mesh=>removed.push(mesh)};
 runCurrent(c);
 assert.equal(volley.hits.get(target),3,'the test never queued a push');
 assert.equal(c.state,'won');assert.equal(target.z,2);assert.equal(target.stagger,undefined);
 assert.equal(c.bullets.length,0);assert.equal(removed.length,4,'ending skipped normal projectile cleanup');
});

test('the production phase retains per-volley counts across frames and moves after all same-frame hits',()=>{
 const target=enemy(1,2),volley=shotgunVolley({id:'shotgun',count:5},{x:0,y:1,z:0}),c=context([target],[]),hurt=c.hurtEnemy,hitPositions=[];
 c.hurtEnemy=(e,damage)=>{hitPositions.push(e.z);hurt(e,damage);};
 c.moveActor=(_,e,dx,dz)=>{e.x+=dx;e.z+=dz;};
 const pellets=count=>Array.from({length:count},(_,i)=>bullet(i,{kind:'shotgun',volley}));
 c.bullets=pellets(2);runCurrent(c);assert.equal(target.z,2);assert.equal(volley.hits.get(target),2);
 c.bullets=pellets(3);runCurrent(c);assert.deepEqual(hitPositions,[2,2,2,2,2]);
 assert(Math.abs(target.z-3.1)<1e-10);assert.equal(target.stagger,.18);
 c.bullets=pellets(2);runCurrent(c);assert.equal(volley.hits.get(target),7);assert(Math.abs(target.z-3.1)<1e-10,'a later frame pushed the same volley again');
});
