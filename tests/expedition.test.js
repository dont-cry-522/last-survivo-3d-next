import{test}from'node:test';
import assert from'node:assert/strict';
import{RELICS,relicChoices,equipRelic,relicEvent,incomingRelicDamage,readJournal,writeJournal,recordDiscovery,recordVictory}from'../expedition.js';
const player=id=>{const p={hp:90,maxHp:100};equipRelic(p,id);return p;};
test('relic offers contain three different choices; one relic per expedition',()=>{
 const discovered=new Set();for(let i=0;i<100;i++){const choices=relicChoices(()=>i/100);assert.equal(new Set(choices).size,3);for(const id of choices){assert(RELICS[id]);discovered.add(id);}}
 assert.equal(discovered.size,6);const p=player('wind');assert.equal(equipRelic(p,'glass'),false);assert.equal(equipRelic({},'__proto__'),false);
});
test('wind rewards the next three attacks after dodge, expires, and refreshes without stacking',()=>{
 const p=player('wind');assert.equal(relicEvent(p,'shot',0),null);relicEvent(p,'dodge',1);
 for(let i=0;i<3;i++)assert.equal(relicEvent(p,'shot',2).multiplier,1.45);assert.equal(relicEvent(p,'shot',2),null);
 relicEvent(p,'dodge',3);assert.equal(relicEvent(p,'shot',7),null);relicEvent(p,'dodge',8);relicEvent(p,'dodge',9);assert.equal(p.relic.charges,3);
});
test('storm counts volleys not projectiles; healing and blast need kills; prism has a cost',()=>{
 const p=player('storm');for(let i=1;i<=15;i++)assert.equal(relicEvent(p,'shot',i)?.kind,i%5===0?'storm':undefined);
 const b=player('blood');for(let i=0;i<9;i++)relicEvent(b,'kill',0);assert.equal(b.hp,100);
 const e=player('ember');for(let i=1;i<=10;i++)assert.equal(relicEvent(e,'kill',0)?.kind,i%5===0?'ember':undefined);
 assert.equal(relicEvent(player('frost'),'dodge',0).slow,2.2);
 assert.equal(relicEvent(player('glass'),'shot',0).multiplier,1.3);assert.equal(incomingRelicDamage(player('glass'),20),25);assert.equal(incomingRelicDamage(player('blood'),20),20);
});
test('journal tolerates blocked/corrupt storage, filters untrusted entries, and records firsts once',()=>{
 let raw='bad';const storage={getItem:()=>raw,setItem:(_,v)=>raw=v};let j=readJournal(storage);assert.deepEqual(j,{relics:[],wins:[]});
 assert.equal(recordDiscovery(j,'wind'),true);assert.equal(recordDiscovery(j,'wind'),false);assert.equal(recordDiscovery(j,'__proto__'),false);
 assert.equal(recordVictory(j,'forest','crossbow'),true);assert.equal(recordVictory(j,'forest','crossbow'),false);assert.equal(recordVictory(j,'invalid','crossbow'),false);
 assert.equal(writeJournal(storage,j),true);assert.deepEqual(readJournal(storage),j);
 raw=JSON.stringify({relics:['wind','wind','bad','__proto__'],wins:['forest:crossbow','bad','forest:crossbow']});assert.deepEqual(readJournal(storage),j);
 assert.equal(writeJournal(undefined,j),false);assert.deepEqual(readJournal(undefined),{relics:[],wins:[]});
});
test('NEXT journals stay independent from the original game on the same browser origin',()=>{
 const old=JSON.stringify({relics:['wind'],wins:['forest:rifle']});
 const data=new Map([['forest-echoes-expedition-v1',old]]);
 const storage={getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v)};
 const journal=readJournal(storage);assert.deepEqual(journal,{relics:[],wins:[]});
 assert(recordVictory(journal,'forest','crossbow'));assert(writeJournal(storage,journal));
 assert.deepEqual(readJournal(storage),journal);assert.equal(data.get('forest-echoes-expedition-v1'),old);
 assert.equal(data.size,2);
});
test('spore lantern victories persist on every map without discarding retired weapon records',()=>{
 let raw=JSON.stringify({relics:['wind'],wins:['forest:hammer','snow:crossbow','coast:harpoon','confluence:boomerang']});
 const storage={getItem:()=>raw,setItem:(_,v)=>raw=v},journal=readJournal(storage),old=[...journal.wins];
 for(const map of['forest','snow','ash','sand','coast','confluence']){assert(recordVictory(journal,map,'sporelantern'));assert(!recordVictory(journal,map,'sporelantern'));}
 assert(writeJournal(storage,journal));const restored=readJournal(storage);assert.deepEqual(restored,journal);for(const win of old)assert(restored.wins.includes(win));assert.equal(restored.wins.length,10);assert(!recordVictory(restored,'bad-map','sporelantern'));
});
