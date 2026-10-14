import test from 'node:test';
import assert from 'node:assert/strict';
import {BOSS_STYLES,bossAttackPlan,tickBoss} from '../boss-combat.js';
import {actor,animateActor,buildWorld,clearAt} from '../world.js';
import {createMapEvent,advanceMapEvent} from '../map-events.js';
import {recordVictory,readJournal,writeJournal} from '../expedition.js';
import {weaponStats,takeUpgrade,chooseUpgrades,HERO_LOADOUTS} from '../rules.js';
globalThis.document={createElement:()=>({width:256,height:256,getContext:()=>({fillRect(){}})})};
const transforms=m=>{const a=[];m.traverse(o=>a.push(...o.position.toArray(),o.rotation.x,o.rotation.y,o.rotation.z,...o.scale.toArray()));return a;};
test('fifteen bosses finish every distinct move, lock targets, and expose a recovery window at all frame rates',()=>{
 for(const fps of [30,60,120])for(const[kind,style]of Object.entries(BOSS_STYLES)){
  const b={kind,mesh:actor(kind),x:0,z:0,hp:2000,maxHp:2000,phase:1,turn:0},p={x:1,z:8},zones=[],stages=new Set(),moves=new Set();
  const io={move:(b,x,z)=>{b.x+=x;b.z+=z;},visible:()=>true,landing:p=>({...p}),zone:z=>zones.push({...z}),sound(){},notice(){}};
  let previous=null,maxJump=0;
  for(let i=0;i<fps*32;i++){
   const speed=tickBoss(b,p,1/fps,io);animateActor(b.mesh,i/fps,speed);const pose=transforms(b.mesh);assert(pose.every(Number.isFinite));
   if(previous)maxJump=Math.max(maxJump,...pose.map((v,j)=>Math.abs(v-previous[j])));previous=pose;
   stages.add(b.stage);if(b.move)moves.add(b.move);
   if(b.stage==='wind'){const before=JSON.stringify(zones);p.x+=.002;assert.equal(JSON.stringify(zones),before);}
  }
  assert.deepEqual([...moves].sort(),[...style.moves].sort());for(const stage of ['walk','wind','strike','recover'])assert(stages.has(stage));
  assert(maxJump<.7,`${kind} ${fps} FPS joint jump ${maxJump}`);assert(zones.every(z=>z.delay>=1&&z.damage>0));
 }
});
test('boss threat patterns have guaranteed escape space and different silhouettes',()=>{
 const b={x:0,z:0,phase:1},p={x:0,z:8};
 const furnace=bossAttackPlan('cinderlord','furnace',b,p);assert(furnace.zones.every(z=>Math.abs(z.x)>z.r+.4));
 const shapes=new Set();for(const kind of Object.keys(BOSS_STYLES))shapes.add(transforms(actor(kind)).join(','));assert.equal(shapes.size,15);
 for(const[kind,cfg]of Object.entries(BOSS_STYLES))for(const move of cfg.moves){const plan=bossAttackPlan(kind,move,b,p);assert(plan.duration>0);assert(plan.zones.length<=9);}
});
test('remaining public loadouts and weapon routes are playable without guardian entries',()=>{
 assert.equal(HERO_LOADOUTS.guardian,undefined);assert.equal(Object.keys(HERO_LOADOUTS).length,7);
 const player={heroId:'tide',weaponId:'harpoon',level:8,upgrades:{}};assert(!chooseUpgrades(player).some(s=>['fire','ice','storm','veil'].includes(s.id)));assert(takeUpgrade(player,'path:harpoon_tow'));assert(weaponStats(player).pull>1);assert(!takeUpgrade(player,'path:harpoon_reef'));assert(!takeUpgrade(player,'path:hammer_guard'));
});
test('desert generates dry terrain, visible destructible gate and accessible landmarks',()=>{
 for(let seed=1;seed<21;seed++){const w=buildWorld('sand',seed);assert.equal(w.ponds.length,0);assert.equal(w.sites[0].event,'mechanism');assert.equal(w.sites[0].gates.length,3);assert(clearAt(w,w.spawn.x,w.spawn.z,1));for(const s of w.sites)assert(clearAt(w,s.x,s.z,3));assert(w.weather.particles.every(p=>p.vx>0&&p.y>0));w.group.traverse(o=>{if(o.isInstancedMesh)o.dispose();});}
});
test('ruins choice cannot grant both outcomes or repeat the first wave',()=>{
 const e=createMapEvent('mechanism'),ctx={near:true,guards:0};assert.equal(advanceMapEvent(e,.1,ctx).wave,1);assert(advanceMapEvent(e,.1,ctx).choice);assert(!advanceMapEvent(e,.1,ctx).choice);assert(!e.done);
 e.choice='treasure';assert.equal(advanceMapEvent(e,.1,ctx).wave,2);assert(!advanceMapEvent(e,.1,{...ctx,guards:1}).complete);assert(advanceMapEvent(e,.1,ctx).complete);assert(!advanceMapEvent(e,.1,ctx).complete);
});
test('new victory marks preserve existing journal entries',()=>{
 let raw=JSON.stringify({wins:['forest:crossbow'],relics:['wind']}),storage={getItem:()=>raw,setItem:(_,v)=>raw=v};const j=readJournal(storage);assert(recordVictory(j,'sand','hammer'));assert(writeJournal(storage,j));assert.deepEqual(readJournal(storage).wins,['forest:crossbow','sand:hammer']);
});
