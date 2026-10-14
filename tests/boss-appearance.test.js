import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../vendor/three.module.js';
import {actor,animateActor} from '../world.js';
import {BOSS_COMBAT_HEIGHTS} from '../boss-appearance.js';
import {BOSS_STYLES,bossAttackPlan} from '../boss-combat.js';
import {recordEnemyHit,EnemyDeaths} from '../enemy-feedback.js';
const kinds=Object.keys(BOSS_COMBAT_HEIGHTS),meshes=m=>{const a=[];m.traverse(o=>{if(o.isMesh)a.push(o);});return a;};
const pose=m=>{const values=[];m.traverse(o=>values.push(...o.position.toArray(),...o.quaternion.toArray(),...o.scale.toArray()));return values;};
test('five rebuilt bosses preserve legacy projectile bounds and reuse sealed finite shaded geometry',()=>{
 let calls=0,triangles=0;
 for(const kind of kinds){
  const m=actor(kind),old=actor(kind,undefined,false),copy=actor(kind),parts=meshes(m),other=meshes(copy);
  assert(m.userData.bossAppearance&&m.userData.bossModel);assert(!old.userData.bossAppearance);
  assert(Math.abs(new T.Box3().setFromObject(m).max.y-new T.Box3().setFromObject(old).max.y)<1e-6,kind+' changed projectile height');
  assert.equal(m.userData.combatHeight,BOSS_COMBAT_HEIGHTS[kind]);
  for(const [i,part]of parts.entries()){
   const geo=part.geometry,p=geo.attributes.position;assert.equal(geo,other[i].geometry);assert.equal(part.material,other[i].material);
   for(const [name,a]of Object.entries(geo.attributes)){assert.equal(a.count,p.count,kind+' truncated '+name);assert(a.array.every(Number.isFinite));}
   assert.equal(part.material.side,T.FrontSide);assert(geo.boundingSphere.radius>0);calls++;triangles+=(geo.index?.count||p.count)/3;
  }
 }
 assert(calls<=140,'boss batches unbounded');assert(triangles<70000,'boss geometry budget exceeded');
 assert.equal(actor('dunescorpion').userData.legs.length,8);assert.equal(actor('wreckwarden').userData.legs.length,6);
});
test('each boss move has its own pose and continuous wind / strike / recovery transitions',()=>{
 for(const kind of kinds){
  const m=actor(kind),d=m.userData,signatures=new Set();
  for(const move of BOSS_STYLES[kind].moves){
   d.bossMove=move;d.lift=0;Object.assign(d,{bossStage:'wind',windProgress:1});animateActor(m,1,0);const wind=pose(m);
   Object.assign(d,{bossStage:'strike',strikeProgress:0});animateActor(m,1,0);assert(Math.max(...pose(m).map((v,i)=>Math.abs(v-wind[i])))<1e-7,kind+' snapped at release');
   d.strikeProgress=.55;animateActor(m,1,0);signatures.add(JSON.stringify(pose(m).map(x=>+x.toFixed(3))));
   d.strikeProgress=1;animateActor(m,1,0);const strike=pose(m);
   Object.assign(d,{bossStage:'recover',recoverProgress:0});animateActor(m,1,0);assert(Math.max(...pose(m).map((v,i)=>Math.abs(v-strike[i])))<1e-7,kind+' snapped at recovery');
  }
  assert.equal(signatures.size,BOSS_STYLES[kind].moves.length,kind+' reused the same pose for every move');
 }
});
test('boss legs retain fixed connected bones through every move, pause, leap and burrow',()=>{
 const end=new T.Vector3(),anchor=new T.Vector3();
 for(const kind of kinds)for(const fps of [30,60,120]){
  const m=actor(kind),d=m.userData;let t=0;
  for(const move of BOSS_STYLES[kind].moves){
   const style=BOSS_STYLES[kind],duration=bossAttackPlan(kind,move,{x:0,z:0,phase:1},{x:0,z:4}).duration;d.bossMove=move;
   for(const [stage,length]of [['wind',style.wind],['strike',duration],['recover',style.recovery]])for(let i=0;i<=Math.ceil(length*fps);i++){
    t+=1/fps;const u=Math.min(1,i/fps/length);d.bossStage=stage;d[stage==='wind'?'windProgress':stage==='strike'?'strikeProgress':'recoverProgress']=u;
    d.lift=stage==='strike'&&['leap','burrow'].includes(move)?Math.sin(Math.PI*Math.min(1,i/fps/(move==='leap'?.65:.85)))*(move==='leap'?3.8:-2.5):0;
    animateActor(m,t,0);m.updateMatrixWorld(true);assert(pose(m).every(Number.isFinite));
    for(const l of d.legs){end.set(0,-l.a,0).applyMatrix4(l.upper.matrixWorld);l.knee.getWorldPosition(anchor);assert(end.distanceTo(anchor)<1e-6,kind+' upper link disconnect');end.set(0,-l.b,0).applyMatrix4(l.knee.matrixWorld);l.paw.getWorldPosition(anchor);assert(end.distanceTo(anchor)<1e-6,kind+' lower link disconnect');}
    const before=pose(m);animateActor(m,t,0);assert.deepEqual(pose(m),before,kind+' pause drift');
   }
  }
  const scene=new T.Scene(),deaths=new EnemyDeaths(scene);scene.add(m);recordEnemyHit(m,{damage:20,maxHp:2000,boss:true});animateActor(m,t+.01,0);assert(d.hitReaction);deaths.add({mesh:m,role:kind});deaths.update(.5);assert.equal(scene.children.length,0);assert.equal(deaths.items.length,0);
 }
});
