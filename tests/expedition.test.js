import{test}from'node:test';
import assert from'node:assert/strict';
import{RELICS,relicChoices,equipRelic,relicEvent,incomingRelicDamage,readJournal,writeJournal,recordDiscovery,recordVictory,FIELD_SUPPLIES,equipFieldSupply,fieldSupplyEvent,fieldSupplyLabel}from'../expedition.js';
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
test('all five preparations consume only their relevant committed actions and stop at their stated limit',()=>{
 const names=new Set();for(const [id,info]of Object.entries(FIELD_SUPPLIES)){
  const p={hp:80,maxHp:100};assert(equipFieldSupply(p,id));names.add(info.name);assert.equal(p.fieldSupply.charges,info.charges);
  for(const event of['shot','dodge','kill','wait','paused'].filter(event=>event!==info.event))assert.equal(fieldSupplyEvent(p,event),null);
  assert.equal(p.fieldSupply.charges,info.charges);assert.match(fieldSupplyLabel(p),new RegExp(info.name));
  for(let i=0;i<info.charges;i++){const effect=fieldSupplyEvent(p,info.event);assert.equal(effect.kind,info.effect.kind);assert.notStrictEqual(effect,info.effect);}
  assert.equal(p.fieldSupply,null);assert.equal(fieldSupplyLabel(p),'');assert.equal(fieldSupplyEvent(p,info.event),null);
  if(id==='forest')assert.equal(p.hp,92);
 }assert.equal(names.size,5);
});
test('a fresh preparation replaces remaining charges without touching a relic, its counters or the journal',()=>{
 const p=player('storm'),journal={relics:['storm'],wins:['forest:crossbow']};relicEvent(p,'shot',1);relicEvent(p,'shot',2);const before=JSON.stringify(p.relic),record=JSON.stringify(journal);
 equipFieldSupply(p,'sand');fieldSupplyEvent(p,'shot');assert.equal(p.fieldSupply.charges,2);equipFieldSupply(p,'coast');assert.deepEqual(p.fieldSupply,{id:'coast',charges:2});
 assert.equal(fieldSupplyEvent(p,'shot').kind,'storm');assert.equal(JSON.stringify(p.relic),before);assert.equal(JSON.stringify(journal),record);
 assert(!equipFieldSupply(p,'__proto__'));assert(!equipFieldSupply(p,'unknown'));assert.deepEqual(p.fieldSupply,{id:'coast',charges:1});
 const fresh=player('wind');assert.equal(fieldSupplyEvent(fresh,'shot'),null);assert.equal(fieldSupplyLabel(fresh),'');assert.equal(fresh.fieldSupply,undefined);
 const healed={hp:99,maxHp:100};equipFieldSupply(healed,'forest');assert.equal(fieldSupplyEvent(healed,'kill').amount,1);assert.equal(fieldSupplyEvent(healed,'kill'),null);assert.equal(healed.fieldSupply.charges,2);assert.equal(healed.hp,100);
});

test('carried recovery survives full-health kills and is spent only when it can restore health',()=>{
 const p={hp:100,maxHp:100};equipFieldSupply(p,'forest');const before=JSON.stringify(p.fieldSupply);
 for(let i=0;i<20;i++)assert.equal(fieldSupplyEvent(p,'kill'),null);
 assert.equal(JSON.stringify(p.fieldSupply),before);assert.match(fieldSupplyLabel(p),/满血保留/);
 p.hp=99;assert.equal(fieldSupplyEvent(p,'kill').amount,1);assert.equal(p.hp,100);assert.equal(p.fieldSupply.charges,2);
 assert.equal(fieldSupplyEvent(p,'kill'),null);p.hp=90;
 assert.equal(fieldSupplyEvent(p,'kill').amount,4);assert.equal(fieldSupplyEvent(p,'kill').amount,4);assert.equal(p.hp,98);assert.equal(p.fieldSupply,null);
});

test('new tide and keeper weapons persist victories without replacing old records',()=>{
 const journal={relics:[],wins:['forest:harpoon','snow:boomerang']};
 for(const weapon of ['arcstaff','briarpot'])for(const map of ['forest','snow','ash','sand','coast','confluence']){assert(recordVictory(journal,map,weapon));assert(!recordVictory(journal,map,weapon));}
 const storage={getItem:()=>JSON.stringify(journal)};assert.deepEqual(readJournal(storage),journal);
});
