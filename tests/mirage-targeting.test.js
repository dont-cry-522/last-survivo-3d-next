import{test}from'node:test';import assert from'node:assert/strict';
import{observePlayer,playerHidden}from'../target-awareness.js';
import{tickBoss,BOSS_STYLES}from'../boss-combat.js';
import{readJournal,recordVictory,writeJournal}from'../expedition.js';
const player=()=>({heroId:'mirage',x:0,z:0,mirageHidden:false});
const decoy=()=>({id:7,alive:true,x:2,z:1,hp:40});
test('mirage enemies target the stationary decoy before and after reappearance, then reacquire',()=>{
 const p=player(),e={x:0,z:6},d=decoy();observePlayer(e,p);p.mirageHidden=true;p.x=20;
 assert(playerHidden(p));assert.equal(observePlayer(e,p,.1,d),d);assert(!e.targetLost);
 assert.deepEqual(e.lastSeenPlayer,{x:2,z:1,vx:0,vz:0});p.mirageHidden=false;
 assert.equal(observePlayer(e,p,.1,d),d);d.alive=false;
 assert.equal(observePlayer(e,p,.1,d),p);assert(e.reacquired);assert(!e.targetLost);
});
test('broken decoy cannot expose concealed player, including enemies spawned during concealment',()=>{
 const p=player(),e={x:0,z:6},d=decoy();p.mirageHidden=true;observePlayer(e,p,.1,d);d.alive=false;p.x=40;
 assert.equal(observePlayer(e,p,.1,d).x,2);assert(e.targetLost);
 const newborn={x:5,z:8};assert.deepEqual(observePlayer(newborn,p,.1,d),{x:5,z:8,vx:0,vz:0});
});
function boss(kind){return{kind,x:0,z:6,hp:100,maxHp:100,phase:1,stage:'walk',cool:0,angle:0,mesh:{userData:{},rotation:{y:0},position:{set(){}}}};}
test('every boss commits a decoy attack, completes it after decoy removal, and resumes targeting',()=>{
 for(const kind of Object.keys(BOSS_STYLES)){
  const b=boss(kind),p=player(),d=decoy(),zones=[];p.mirageHidden=true;p.x=30;
  const io={decoy:d,visible:()=>true,move:(e,x,z)=>{e.x+=x;e.z+=z;},landing:q=>({...q}),zone:z=>zones.push(z),sound(){},notice(){}};
  tickBoss(b,p,1/60,io);assert.equal(b.stage,'wind',kind);assert(b.target.x<3,kind+' aimed at hidden player');
  const locked={...b.target},count=zones.length;d.alive=false;p.x=60;
  for(let i=0;i<360;i++)tickBoss(b,p,1/60,io);
  assert.deepEqual(b.target,locked);assert.equal(zones.length,count);assert.equal(b.stage,'walk');
  p.mirageHidden=false;tickBoss(b,p,.01,io);assert(b.reacquired);assert(!b.targetLost);
  for(let i=0;i<45;i++)tickBoss(b,p,1/60,io);assert.equal(zones.length,count,'out-of-range boss attacks empty ground');
  for(let i=0;i<60*35&&zones.length===count;i++)tickBoss(b,p,1/60,io);assert(zones.length>count,kind+' never closed distance after reacquiring');
 }
});
test('new hero victory journal preserves old weapon history and survives reload',()=>{
 let text=JSON.stringify({wins:['forest:sporelantern','snow:crossbow'],relics:['blood']});const storage={getItem:()=>text,setItem:(k,v)=>{text=v;}};
 const j=readJournal(storage);assert(recordVictory(j,'forest','miasmalantern'));assert(!recordVictory(j,'forest','miasmalantern'));
 writeJournal(storage,j);assert.deepEqual(readJournal(storage).wins,['forest:sporelantern','snow:crossbow','forest:miasmalantern']);
});
