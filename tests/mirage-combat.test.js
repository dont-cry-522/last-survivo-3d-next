import{test}from'node:test';
import assert from'node:assert/strict';
import{MirageCombat}from'../mirage-combat.js';
import{MIRAGE as C}from'../mirage-config.js';
import{weaponStats}from'../rules.js';
const near=(a,b)=>assert(Math.abs(a-b)<1e-7,`${a} != ${b}`);
function setup(upgrades={}){
 const player={heroId:'mirage',weaponId:'miasmalantern',hp:120,maxHp:120,x:0,z:0,upgrades},enemies=[],hits=[],events=[];let active=true,blocked=false;
 const combat=new MirageCombat({player:()=>player,active:()=>active,foes:()=>enemies,blocked:()=>blocked,fx:q=>events.push(q),damage:(e,n,flash,hit)=>{assert(e.alive,'no repeated death rewards');hits.push({e,n,flash,...hit});e.hp-=n;if(e.hp<=0){e.alive=false;e.kills++;}}});
 const foe=(x=0,z=0,hp=1000)=>{const e={x,z,hp,alive:true,kills:0};enemies.push(e);return e;};
 return{combat,player,enemies,hits,events,foe,weapon:()=>combat.modifyShot(weaponStats(player)),dodge:(x=0,z=0)=>combat.startDodge(x,z,.7,weaponStats(player)),pause:()=>active=false,resume:()=>active=true,block:()=>blocked=true};
}

test('decoy copies current HP only, stays at origin, hides player until game-time reveal',()=>{
 const s=setup();s.player.hp=43;s.dodge(4,5);const d=s.combat.decoy;assert.equal(d.hp,43);assert.equal(d.maxHp,43);assert.equal(d.expires,1.5);assert(s.combat.hidden);assert(s.player.mirageHidden);
 s.player.x=8;s.player.z=9;s.player.hp=120;s.combat.update(.84);assert(s.combat.hidden);assert.equal(d.x,4);assert.equal(d.z,5);assert.equal(d.hp,43);
 s.combat.update(.01);assert(!s.combat.hidden);assert(!s.player.mirageHidden);assert.equal(s.events.filter(q=>q.kind==='mirageReveal').length,1);assert.equal(s.events.find(q=>q.kind==='mirageReveal').x,8);
});
test('only natural expiry blooms once, then leaves one bounded fixed cloud',()=>{
 const s=setup(),e=s.foe();s.dodge();s.combat.update(1.5);assert.equal(s.combat.decoy,null);assert.equal(s.combat.clouds.length,1);near(e.hp,964);assert.equal(s.combat.clouds[0].r,1.55);assert.equal(s.combat.clouds[0].expires,3.5);
 s.combat.update(2);near(e.hp,936);assert.equal(s.combat.clouds.length,0);assert.equal(s.events.filter(q=>q.kind==='mirageBloom').length,1);
});
test('a killed decoy never blooms, generates fog or triggers burial',()=>{
 const s=setup({mirage_burial:3}),e=s.foe();s.dodge();const d=s.combat.decoy;s.combat.damageDecoy(119);assert.equal(d.hp,1);s.combat.damageDecoy(1);assert(!d.alive);assert.equal(s.combat.decoy,null);s.combat.update(5);
 assert.equal(e.hp,1000);assert.equal(s.combat.clouds.length,0);assert.equal(s.combat.marks.size,0);assert.equal(s.events.filter(q=>q.kind==='mirageBloom').length,0);assert.equal(s.events.filter(q=>q.kind==='mirageBreak'&&q.reason==='killed').length,1);
});
test('replacement silently expires the old target without explosion or inherited hits',()=>{
 const s=setup(),e=s.foe();s.dodge();const old=s.combat.decoy;s.combat.update(.7);s.dodge(8,8);const fresh=s.combat.decoy;assert.notEqual(fresh.id,old.id);assert(!old.alive);assert.equal(fresh.hp,120);s.combat.update(.8);assert.equal(s.combat.clouds.length,0);assert.equal(e.hp,1000);s.combat.update(.7);assert.equal(s.combat.clouds.length,1);assert.equal(s.combat.clouds[0].x,8);assert.equal(s.events.filter(q=>q.kind==='mirageBloom').length,1);
});
test('poison damage is identical at 30/60/144Hz and coarse timesteps',()=>{
 const values=[];for(const fps of[30,60,144,2]){const s=setup(),e=s.foe();s.combat.update(.035);s.combat.attackHit(e,s.weapon());s.dodge();for(let i=0;i<fps*5;i++)s.combat.update(1/fps);values.push(1000-e.hp);assert.equal(s.combat.clouds.length,0);}for(const n of values)near(n,values[0]);near(values[0],C.needleDps*1.5+36+14*2);
});
test('repeated needle hits refresh a single status and never multiply independent DOT stacks',()=>{
 const s=setup(),e=s.foe();for(let i=0;i<8;i++)s.combat.attackHit(e,s.weapon());assert.equal(s.combat.marks.size,1);s.combat.update(.5);near(e.hp,1000-C.needleDps*.5);s.combat.attackHit(e,s.weapon());s.combat.update(C.needleDuration);near(e.hp,1000-C.needleDps*(.5+C.needleDuration));assert.equal(s.combat.marks.size,0);assert(s.hits.every(h=>h.secondary&&!h.flash));
});
test('off-grid fog expiration removes the visible area immediately without losing the partial final tick',()=>{
 const s=setup(),e=s.foe();s.combat.update(.035);s.dodge();s.combat.update(3.5);assert.equal(s.combat.clouds.length,0);near(e.hp,1000-36-14*2);
});
test('a re-hit changes poison strength only from its own hit time, including off-grid expiry refreshes',()=>{
 const s=setup(),e=s.foe();s.combat.attackHit(e,s.weapon());s.combat.update(.035);s.combat.attackHit(e,{...s.weapon(),needleDamage:17});s.combat.update(.032);s.combat.attackHit(e,{...s.weapon(),needleDamage:11});s.combat.update(.033);near(e.hp,1000-C.needleDps*.035-17*.032-11*.033);
 const fresh=setup(),f=fresh.foe();fresh.combat.update(.035);fresh.combat.attackHit(f,fresh.weapon());fresh.combat.update(C.needleDuration+.005);fresh.combat.attackHit(f,fresh.weapon());fresh.combat.update(.06);near(f.hp,1000-C.needleDps*(C.needleDuration+.06));
});
test('a poison kill while settling a refresh cannot recreate a dead mark or continue after game end',()=>{
 const s=setup(),e=s.foe(0,0,.15);s.combat.attackHit(e,s.weapon());s.combat.update(.04);const damage=s.combat.api.damage;s.combat.api.damage=(...args)=>{damage(...args);if(!e.alive){s.pause();s.combat.reset();}};
 assert.equal(s.combat.attackHit(e,{...s.weapon(),needleDamage:17}),false);assert.equal(e.kills,1);assert.equal(s.combat.marks.size,0);assert.equal(s.combat.now,0);
});
test('a pending poison kill at natural expiry prevents a post-result bloom from rebuilding effects',()=>{
 const s=setup(),e=s.foe(0,0,C.needleDps*1.5+.01);s.combat.attackHit(e,s.weapon());s.combat.update(.035);s.dodge();const damage=s.combat.api.damage;s.combat.api.damage=(...args)=>{damage(...args);if(!e.alive){s.pause();s.combat.reset();}};
 s.combat.update(1.5);assert.equal(e.kills,1);assert.equal(s.events.filter(q=>q.kind==='mirageBloom').length,0);assert.equal(s.combat.clouds.length,0);assert.equal(s.combat.now,0);assert.equal(s.combat.tickIndex,1);
});
test('overlapping cloud areas take the strongest; area suppresses attached poisons',()=>{
 const s=setup({mirage_residue:3}),e=s.foe();s.combat.clouds.push({id:1,x:0,z:0,r:2,born:0,expires:2,damage:14},{id:2,x:0,z:0,r:2,born:0,expires:2,damage:21});s.combat.attackHit(e,s.weapon());s.combat.update(1);near(e.hp,979);e.x=6;s.combat.update(1);near(e.hp,970);assert.equal(s.combat.marks.size,1);
});
test('residue refreshes without stacking and expires a finite time after leaving fog',()=>{
 const s=setup({mirage_residue:2}),e=s.foe();s.dodge();s.combat.update(2);near(e.hp,957);e.x=8;s.combat.update(2.4);near(e.hp,940.2);assert.equal(s.combat.marks.size,0);s.combat.update(2);near(e.hp,940.2);
});
test('burial only marks surviving bloom targets, applies slow, and does not recurse on death',()=>{
 const s=setup({mirage_burial:3}),dead=s.foe(0,0,1),e=s.foe(1.65,0,40),outside=s.foe(4,0);s.dodge();s.combat.update(1.5);assert.equal(dead.kills,1);assert.equal(s.combat.marks.has(dead),false);assert.equal(s.combat.marks.has(e),true);assert.equal(e.slow,1.25);assert.equal(s.combat.marks.has(outside),false);
 s.combat.update(1);assert.equal(e.kills,1);assert.equal(outside.hp,1000);assert.equal(s.events.filter(q=>q.kind==='mirageBloom').length,1);assert.equal(s.hits.filter(q=>q.e===dead).length,1);
});
test('blocked terrain prevents cloud and bloom damage but already attached poison persists',()=>{
 const s=setup(),e=s.foe();s.combat.attackHit(e,s.weapon());s.block();s.dodge();s.combat.update(3.5);near(e.hp,1000-C.needleDps*C.needleDuration);assert(s.hits.every(q=>q.source==='mirage-needle'));
});
test('phantasm route preserves snapshot HP, reduces decoy intake and rewards surviving timeout',()=>{
 const s=setup();s.player.weaponPath={id:'miasmalantern_lure',rank:3};s.player.hp=40;s.dodge();const d=s.combat.decoy;assert.equal(d.hp,40);assert.equal(d.expires,1.8);s.combat.damageDecoy(25);near(d.hp,20);const e=s.foe(2.2,0),inside=s.foe();s.combat.update(1.8);near(e.hp,1000-46.8);assert.equal(e.slow,.5);assert.equal(s.combat.clouds[0].r,1.95);near(s.combat.clouds[0].damage,22.5);s.combat.update(1);near(inside.hp,1000-46.8-22.5);
});
test('venom route adds poison on post-reveal needles and cadence only at rank three',()=>{
 for(const rank of[1,2,3]){const s=setup();s.player.weaponPath={id:'miasmalantern_venom',rank};const base=s.weapon();s.dodge();assert.equal(s.weapon().rate,base.rate);s.combat.update(.85);const after=s.weapon();near(after.needleDamage,base.needleDamage+(rank>=2?4:0));near(after.rate,base.rate*(rank===3?1.25:1));const e=s.foe(9,9);s.combat.attackHit(e,after);s.combat.update(2.4);assert.equal(s.weapon().rate,base.rate);assert.equal(s.weapon().needleDamage,base.needleDamage);assert.equal(base.miragePursuit,undefined);}
});
test('successful reveal shield has its own cooldown, finite cap and no additional invisibility',()=>{
 const s=setup({mirage_mantle:3});s.dodge();assert.equal(s.combat.shield.amount,0);s.combat.update(.85);assert.equal(s.combat.shield.amount,20);assert(!s.combat.hidden);assert.equal(s.combat.absorb(12),0);assert.equal(s.combat.shield.amount,8);
 s.dodge();s.combat.update(.85);assert.equal(s.combat.shield.amount,8);assert.equal(s.combat.absorb(12),4);assert.equal(s.combat.shield.amount,0);s.combat.update(5);s.dodge();s.combat.update(.85);assert.equal(s.combat.shield.amount,20);s.combat.update(2);assert.equal(s.combat.shield.amount,0);
});
test('rapid unnatural casts still cap live decoys at one and clouds at two',()=>{
 const s=setup();for(let i=0;i<5;i++){s.dodge(i*4,0);s.combat.decoy.expires=s.combat.now+.1;s.combat.update(.1);}assert.equal(s.combat.clouds.length,2);assert.deepEqual(s.combat.clouds.map(q=>q.x),[12,16]);
});
test('pause freezes concealment, decoy time, marks and pending shield; reset clears all state',()=>{
 const s=setup({mirage_residue:3,mirage_mantle:3}),e=s.foe();s.combat.attackHit(e,s.weapon());s.dodge();s.combat.update(.2);const hp=e.hp;s.pause();s.combat.update(99);assert.equal(s.combat.now,.2);assert(s.combat.hidden);assert(s.player.mirageHidden);assert.equal(e.hp,hp);assert(s.combat.decoy.alive);
 const d=s.combat.decoy;s.combat.reset();assert(!d.alive);assert(!s.player.mirageHidden);assert(!s.combat.hidden);assert.equal(s.combat.decoy,null);assert.equal(s.combat.clouds.length,0);assert.equal(s.combat.marks.size,0);assert.equal(s.combat.shield.amount,0);assert.equal(s.combat.revealAt,0);
});
test('boss without adds can receive needle, bloom, cloud and slow without spawn dependencies',()=>{
 const s=setup({mirage_burial:2}),e=s.foe();e.boss=true;s.dodge();s.combat.attackHit(e,s.weapon());s.combat.update(3.5);assert(e.hp<940);assert.equal(e.slow,.95);assert.equal(s.enemies.length,1);assert(s.hits.every(q=>q.secondary));
});
test('game end from poison immediately stops the remaining enemies and a new run is clean',()=>{
 const s=setup(),e=s.foe(0,0,1),untouched=s.foe();s.combat.attackHit(e,s.weapon());s.combat.attackHit(untouched,s.weapon());const damage=s.combat.api.damage;s.combat.api.damage=(...args)=>{damage(...args);if(!e.alive)s.pause();};s.combat.update(1);assert.equal(e.kills,1);near(untouched.hp,1000-C.needleDps*.1);s.combat.reset();s.resume();s.combat.update(1);near(untouched.hp,1000-C.needleDps*.1);
});
test('old heroes never create decoys, acquire mirage poison or have shots altered',()=>{
 for(const heroId of['scout','silver','wraith','tide','lingya','wuling']){const s=setup();s.player.heroId=heroId;const e=s.foe(),w=s.weapon();assert.equal(s.dodge(),false);assert.equal(s.combat.attackHit(e,w),false);s.combat.update(1);assert.equal(s.combat.now,0);assert.equal(s.combat.modifyShot(w),w);assert.equal(s.combat.absorb(12),12);assert.equal(s.combat.decoy,null);assert.equal(e.hp,1000);}
});
test('orb spread excludes the directly hit target from splash but poisons every surviving affected foe',()=>{
 const s=setup(),primary=s.foe(),nearby=s.foe(1.8,0),outside=s.foe(2.21,0),w=s.weapon();
 s.combat.api.damage(primary,w.damage,true,{source:'direct'});assert(s.combat.burst(0,0,w,primary));
 near(primary.hp,1000-32);near(nearby.hp,1000-14);near(outside.hp,1000);assert.equal(s.hits.filter(h=>h.e===primary).length,1);
 assert.equal(s.combat.marks.size,2);assert.equal(s.events.filter(q=>q.kind==='mirageBurst').length,1);assert.equal(s.events.filter(q=>q.kind==='mirageHit').length,0);
 s.combat.update(.5);near(primary.hp,1000-32-8*.5);near(nearby.hp,1000-14-8*.5);assert.equal(s.combat.clouds.length,0);assert.equal(s.combat.decoy,null);
});
test('a direct-killed primary still produces one spread event and cannot be hit or poisoned again',()=>{
 const s=setup(),primary=s.foe(0,0,20),nearby=s.foe(1,0),w=s.weapon();s.combat.api.damage(primary,w.damage,true,{source:'direct'});assert.equal(primary.kills,1);
 assert(s.combat.burst(0,0,w,primary));assert.equal(s.events.filter(q=>q.kind==='mirageBurst').length,1);assert.equal(s.combat.marks.has(primary),false);assert.equal(s.hits.filter(q=>q.e===primary).length,1);near(nearby.hp,986);assert(s.combat.marks.has(nearby));
});
test('spread uses the shot radius and damage snapshot, respects walls and ignores dead or outside targets',()=>{
 const s=setup(),inside=s.foe(.9,0),blocked=s.foe(-.9,0),edge=s.foe(1.2,0),outside=s.foe(1.21,0),dead=s.foe(.5,0);dead.alive=false;
 s.combat.api.blocked=(ax,az,bx)=>bx<0;const w={...s.weapon(),burstRadius:1.2,splashDamage:21,needleDamage:12};s.combat.burst(0,0,w);
 near(inside.hp,979);near(edge.hp,979);for(const e of[blocked,outside,dead])near(e.hp,1000);assert.equal(s.combat.marks.size,2);assert.equal(s.events.find(q=>q.kind==='mirageBurst').r,1.2);s.combat.update(.1);near(inside.hp,977.8);
});
test('multiple impact spreads refresh one finite poison mark without generating floor clouds or extra decoys',()=>{
 const s=setup(),e=s.foe();s.dodge(20,20);const d=s.combat.decoy;s.combat.burst(0,0,s.weapon());s.combat.update(.5);s.combat.burst(0,0,s.weapon());s.combat.update(.5);
 assert.equal(s.combat.marks.size,1);assert.equal(s.combat.clouds.length,0);assert.equal(s.combat.decoy,d);near(e.hp,1000-28-8);
 s.combat.damageDecoy(120);s.combat.update(C.needleDuration);near(e.hp,1000-28-8*(.5+C.needleDuration));assert.equal(s.combat.marks.size,0);assert.equal(s.combat.clouds.length,0);assert.equal(s.events.filter(q=>q.kind==='mirageBloom').length,0);
});
test('spread and its poison deaths use secondary sources, never extra burst events or duplicate rewards',()=>{
 const s=setup(),splashDead=s.foe(0,0,4),poisonDead=s.foe(1,0,15),survivor=s.foe(2,0);s.combat.burst(0,0,s.weapon());s.combat.update(3);
 assert.equal(splashDead.kills,1);assert.equal(poisonDead.kills,1);assert.equal(survivor.kills,0);assert.equal(s.hits.filter(q=>q.e===splashDead).length,1);assert(s.hits.every(q=>q.secondary&&!q.flash));assert(s.hits.some(q=>q.source==='mirage-splash'));assert(s.hits.some(q=>q.source==='mirage-needle'));assert.equal(s.events.filter(q=>q.kind==='mirageBurst').length,1);assert.equal(s.events.filter(q=>q.kind==='mirageHit'||q.kind==='mirageBloom').length,0);
});
test('paused spread is a no-op; reset removes all attached poison and a finishing splash stops further victims',()=>{
 const s=setup(),a=s.foe(),b=s.foe(1,0);s.pause();assert.equal(s.combat.burst(0,0,s.weapon()),false);assert.equal(s.events.length,0);assert.equal(a.hp,1000);s.resume();s.combat.burst(0,0,s.weapon());const hp=a.hp;s.combat.reset();s.combat.update(3);assert.equal(a.hp,hp);assert.equal(s.combat.marks.size,0);
 a.hp=1;const damage=s.combat.api.damage;s.combat.api.damage=(...args)=>{damage(...args);if(!a.alive){s.pause();s.combat.reset();}};const bHp=b.hp;s.combat.burst(0,0,s.weapon());assert.equal(a.kills,1);assert.equal(b.hp,bHp);assert.equal(s.combat.marks.size,0);assert.equal(s.combat.clouds.length,0);
});
test('orb burst remains exclusive to the new hero and does not change old Wuling poison behavior',()=>{
 const s=setup(),e=s.foe(),w=s.weapon();s.player.heroId='wuling';assert.equal(s.combat.burst(0,0,w),false);assert.equal(e.hp,1000);assert.equal(s.events.length,0);assert.equal(s.combat.marks.size,0);
});

test('a direct hit on a large boss surface still applies poison without an extra splash hit',()=>{
 const s=setup(),boss=s.foe(0,2.34),w=s.weapon();boss.size=2;boss.boss=true;
 s.combat.api.damage(boss,w.damage,true,{source:'direct'});s.combat.burst(0,0,w,boss);
 near(boss.hp,968);assert(s.combat.marks.has(boss));s.combat.update(.5);near(boss.hp,964);
});

test('airborne orb splash uses impact height instead of striking floor bodies below',()=>{const s=setup(),high=s.foe(),ground=s.foe();high.y=5;high.height=.6;ground.height=1.8;s.combat.burst(0,0,{...s.weapon(),impactY:5.3},high);assert(s.hits.every(h=>h.e!==ground));assert(s.combat.marks.has(high));});
