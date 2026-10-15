import {test} from 'node:test';
import assert from 'node:assert/strict';
import {advanceCrossbowHunt,crossbowImpact,forestGrowthChoices,takeUpgrade,weaponStats,seeded} from '../rules.js';
import {nextForestFormation,huntFormation} from '../encounters.js';
import {createMapEvent,advanceMapEvent,acceptForestTrial} from '../map-events.js';
const player=(rank=1,id='crossbow_hunt')=>({heroId:'silver',weaponId:'crossbow',weaponPath:{id,rank},upgrades:{},level:3,dash:2,xp:0,pending:2});

test('walking charge is time/frame independent, does not stack or count blinks/wall pushes',()=>{
 for(const fps of[30,60,144]){const p=player();for(let i=0;i<fps;i++)advanceCrossbowHunt(p,3/fps,1+(i+1)/fps);assert(Math.abs(p.crossbowHunt.until-6)<1e-6);const until=p.crossbowHunt.until;advanceCrossbowHunt(p,30,3);assert.equal(p.crossbowHunt.until,until);assert.equal(p.crossbowHunt.distance,0);}
 const p=player();advanceCrossbowHunt(p,5.5,1,false);advanceCrossbowHunt(p,0,1);assert.equal(p.crossbowHunt.until,0);
 advanceCrossbowHunt(p,3,2);assert.equal(p.crossbowHunt.until,6);advanceCrossbowHunt(p,0,7);assert.equal(p.crossbowHunt.until,6,'expiry cannot refresh itself');
 const other={...player(),weaponId:'rifle'};assert(!advanceCrossbowHunt(other,5,1));assert.equal(other.crossbowHunt,undefined);
});

test('pursuit consumes one charge on the confirmed third hit, slow/refund unlock by rank',()=>{
 for(const rank of[1,2,3]){const p=player(rank),b={...weaponStats(p),maxPierce:1};advanceCrossbowHunt(p,3,0);
  for(let i=0;i<2;i++){const hit=crossbowImpact(p,b,'boss',.5+i*.5);assert(!hit.pursuit);assert.equal(hit.multiplier,1);}
  const hit=crossbowImpact(p,b,'boss',1.5);assert(hit.pursuit&&hit.strong);assert.equal(hit.multiplier,[0,2.2,2.4,2.6][rank]);assert.equal(hit.slow,rank>=2?1.2:0);assert.equal(p.dash,rank===3?1.4:2);assert.equal(p.crossbowHunt.until,0);
  for(let i=0;i<2;i++)crossbowImpact(p,b,'boss',2+i*.3);assert.equal(crossbowImpact(p,b,'boss',3).multiplier,1.35,'no stored second charge');
 }
 const p=player(),b=weaponStats(p);advanceCrossbowHunt(p,3,0);crossbowImpact(p,b,1,1);crossbowImpact(p,b,2,1.5);assert(!crossbowImpact(p,b,1,2).strong);crossbowImpact(p,b,1,2.5);assert(!crossbowImpact(p,b,1,4).pursuit,'expired buff cannot burst');
});

test('penetration rewards the ordered same-arrow target count, not new shots or hunt bolts',()=>{
 const p=player(3,'crossbow_pierce'),w=weaponStats(p);
 for(let i=0;i<4;i++)assert.equal(crossbowImpact(p,{...w,maxPierce:4,pierce:4-i},i,0).multiplier,1+i*.25);
 assert.equal(crossbowImpact(p,{...w,maxPierce:4,pierce:4},99,1).multiplier,1);
 assert.equal(crossbowImpact(player(),{pathId:'crossbow_hunt',pathRank:1,maxPierce:4,pierce:1},1,0).multiplier,1);
});

test('earned forest rewards respect exclusivity, rank gates, caps and leave ordinary drafts intact',()=>{
 const p={...player(),weaponPath:null,upgradeDraft:{shown:['ice'],routeMisses:2},pendingDraft:[{id:'ice'}]},before=JSON.stringify(p);
 const offers=forestGrowthChoices(p,()=>0);assert.deepEqual(offers.filter(x=>x.category==='weapon').map(x=>x.pathId),['crossbow_pierce','crossbow_hunt']);assert.equal(JSON.stringify(p),before);
 assert(takeUpgrade(p,offers[0].id));assert(!takeUpgrade(p,'path:crossbow_hunt'));assert(!forestGrowthChoices(p).some(x=>x.category==='weapon'));
 p.level=5;assert.deepEqual(forestGrowthChoices(p).filter(x=>x.category==='weapon').map(x=>x.id),['path:crossbow_pierce']);
 p.level=2;p.weaponPath=null;assert(forestGrowthChoices(p).every(x=>x.category==='skill'));assert.equal(p.pending,2);
});

test('forest lineups vary without repeats, retain attack slots and a full retreat side',()=>{
 const random=seeded(19),seen=new Set();let previous=-1;
 for(let i=0;i<30;i++){const next=nextForestFormation(previous,random);assert.notEqual(next,previous);seen.add(next);previous=next;const f=huntFormation('forest',i,next);assert.equal(f.squad.length,6);assert.equal(f.squad.filter(s=>s.elite).length,1);assert(Math.max(...f.squad.map(s=>s.offset))-Math.min(...f.squad.map(s=>s.offset))<Math.PI);}
 assert.equal(seen.size,3);assert.notDeepEqual(huntFormation('snow',1,2),huntFormation('snow',1,0));
});

test('purification optional trial sends one additional wave, awaits guards, pauses and cannot repeat',()=>{
 const e=createMapEvent('purify'),c={near:true,atCenter:true,contested:false,guards:0,player:{x:0,z:0}};
 assert(!acceptForestTrial(e));advanceMapEvent(e,.1,c);advanceMapEvent(e,10,c);assert(e.done);assert(acceptForestTrial(e));assert(!acceptForestTrial(e));
 assert.equal(advanceMapEvent(e,0,c).wave,0);assert.equal(advanceMapEvent(e,10,{...c,near:false}).wave,0);assert.equal(advanceMapEvent(e,.1,c).wave,2);
 assert(!advanceMapEvent(e,20,{...c,guards:4}).complete);assert(advanceMapEvent(e,.1,c).complete);assert(!advanceMapEvent(e,.1,c).complete);assert(!acceptForestTrial(e));
});
