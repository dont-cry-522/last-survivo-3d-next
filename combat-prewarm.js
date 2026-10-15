import * as T from './vendor/three.module.js';
import {actor} from './world.js?v=210';
import {MAP_ROSTERS} from './map-enemies.js?v=210';
import {BOSS_ROUTES} from './boss-expedition.js?v=210';
import {AIR_ROSTERS, AIR_ENEMIES, makeAirborne} from './airborne-enemies.js?v=210';

// Models only: no enemy instances, encounters, random rolls, audio or game clocks.
export function combatSampleKinds(mapId){
 const maps=mapId==='confluence'?Object.keys(MAP_ROSTERS):[Object.hasOwn(MAP_ROSTERS,mapId)?mapId:'forest'];
 return [...new Set(maps.flatMap(map=>[
  ...Object.values(MAP_ROSTERS[map]),
  ...(mapId==='confluence'?[]:BOSS_ROUTES[map]),
  AIR_ROSTERS[map]
 ]))];
}

// Cover the commonly used texture/vertex-color/blending programs with a bounded
// set of real pool checkouts, instead of firing combat effects to warm them up.
const particles=[
 ['flame',false],['flame',true],['veil',false],['vapor',false],
 ['crest',false],['sweep',false],['shard',true],['ember',false],
 ['ray',true],['crystal',true],['stone',false],['droplet',false]
];
const yieldBatch=()=>new Promise(resolve=>setTimeout(resolve,0));

export async function prepareCombatSamples({scene,vfx,mapId,player,yaw=player.angle||0,report=()=>{},yieldWork=yieldBatch}){
 // Entry preparation owns an empty effect pool. Never discard a live battle.
 if(vfx.active.length)throw new Error('Combat prewarm requires cleared effects');
 const kinds=combatSampleKinds(mapId),total=kinds.length+particles.length;
 const samples=new T.Group();samples.name='Combat_Prewarm_Samples';
 samples.position.set(player.x+Math.sin(yaw)*3.5,(player.y||0)+1.3,player.z+Math.cos(yaw)*3.5);
 samples.rotation.y=yaw;scene.add(samples);
 const box=new T.Box3(),center=new T.Vector3(),size=new T.Vector3();let done=0,cleaned=false;
 const cleanup=()=>{if(cleaned)return;cleaned=true;samples.removeFromParent();samples.clear();vfx.clear();};
 const complete=async()=>{report(++done,total);if(done%3===0||done===total)await yieldWork();};
 try{
  report(0,total);
  for(let i=0;i<kinds.length;i++){
   const kind=kinds[i],model=AIR_ENEMIES[kind]?makeAirborne(kind):actor(kind);
   model.name='Combat_Prewarm_'+kind;
   const holder=new T.Group();holder.add(model);samples.add(holder);
   box.setFromObject(model);box.getCenter(center);box.getSize(size);
   const scale=.32/Math.max(size.x,size.y,size.z,.01);
   model.scale.multiplyScalar(scale);model.position.addScaledVector(center,-scale);
   holder.position.set((i%7-3)*.39,(Math.floor(i/7)-Math.floor((kinds.length-1)/7)/2)*.37,0);
   model.traverse(node=>{if(node.isMesh)node.frustumCulled=false;});
   await complete();
  }
  for(let i=0;i<particles.length;i++){
   const [shape,additive]=particles[i],side=(i%6-2.5)*.32;
   const mesh=vfx.particle(shape,0xdacb95,
    samples.position.x+Math.cos(yaw)*side,
    samples.position.y-.9-Math.floor(i/6)*.18,
    samples.position.z-Math.sin(yaw)*side,
    {life:1,size:[.1,.1,.1],additive,opacity:.7});
   if(!mesh)throw new Error('Combat prewarm effect pool is full');
   mesh.name='Combat_Prewarm_VFX_'+shape;
   await complete();
  }
  // Keep these renderable until both cameras have compiled and drawn. The caller
  // must invoke cleanup in finally; shared factory resources and the VFX pool stay.
  return cleanup;
 }catch(error){cleanup();throw error;}
}
