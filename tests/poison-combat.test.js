import{test}from'node:test';
import assert from'node:assert/strict';
import{PoisonCombat,cloudEntry,cloudContains}from'../poison-combat.js';
import{POISON as C}from'../poison-config.js';
import{weaponStats}from'../rules.js';
function setup(upgrades={}){
 const player={heroId:'wuling',weaponId:'sporelantern',upgrades},enemies=[],hits=[],events=[];let active=true,blocked=false;
 const combat=new PoisonCombat({player:()=>player,active:()=>active,foes:()=>enemies,blocked:()=>blocked,fx:e=>events.push(e),damage:(e,n,flash,source)=>{if(!e.alive)throw Error('duplicate dead hit');hits.push({e,n,...source});e.hp-=n;if(e.hp<=0){e.alive=false;e.kills++;}}});
 const foe=(x=0,z=0,hp=10000)=>{const e={x,z,hp,alive:true,kills:0};enemies.push(e);return e;};
 return{player,combat,foe,enemies,hits,events,cloud:(x=0,z=0)=>combat.addCloud(x,z,weaponStats(player)),pause:()=>active=false,resume:()=>active=true,block:()=>blocked=true};
}
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-6,`${a} != ${b}`);
test('three main clouds replace the oldest, never refresh surviving expiry',()=>{
 const s=setup(),a=s.cloud();s.combat.update(.2);const b=s.cloud();s.cloud();const expiry=b.expires;s.cloud();assert.equal(s.combat.clouds.length,3);assert.ok(!s.combat.clouds.includes(a));assert.equal(b.expires,expiry);s.combat.update(5);assert.equal(s.combat.clouds.length,0);
});
test('poison game-time ticks are invariant at 30/60/144 Hz and coarse steps',()=>{
 const values=[];for(const fps of[30,60,144,5]){const s=setup(),e=s.foe();s.cloud();for(let i=0;i<fps*5;i++)s.combat.update(1/fps);values.push(10000-e.hp);assert.equal(s.combat.clouds.length,0);}for(const v of values)near(v,22*4.8);
});
test('overlapping clouds, core and trail select the strongest regional damage',()=>{
 const s=setup(),e=s.foe();s.cloud();s.cloud();s.cloud();s.combat.bands.push({points:[{x:-2,z:0},{x:2,z:0}],r:.65,born:0,expires:2,damage:35});s.combat.update(1);near(10000-e.hp,35);
});
test('fixed regions never track enemies and cannot damage through an obstacle',()=>{
 const s=setup(),e=s.foe();const cloud=s.cloud();s.combat.update(.2);const hp=e.hp;e.x=9;s.combat.update(.3);assert.equal(e.hp,hp);assert.equal(cloud.x,0);e.x=0;s.block();s.combat.update(.3);assert.equal(e.hp,hp);
});
test('actual segment intersection chooses the first along travel, not oldest/end overlap',()=>{
 const s=setup(),far=s.cloud(6,0),nearCloud=s.cloud(1,0);s.combat.beginDodge(-4,0);s.combat.moveDodge(-4,0,10,0);assert.equal(s.combat.dodge.cloud,nearCloud);assert.ok(!far.carried);s.combat.endDodge(10,0);assert.equal(s.combat.clouds.length,2);assert.equal(nearCloud.x,10);assert.equal(far.x,6);
});
test('starting inside picks one cloud and idle/empty dodges never grant shield',()=>{
 const s=setup({poison_guard:3}),a=s.cloud();s.cloud();s.combat.beginDodge(0,0);assert.equal(s.combat.dodge.cloud,a);s.combat.moveDodge(0,0,4,0);s.combat.endDodge(4,0);assert.equal(s.combat.shield.amount,20);s.combat.update(2.1);s.combat.beginDodge(20,0);s.combat.endDodge(24,0);assert.equal(s.combat.shield.amount,0);
});
test('pickup removes damage at origin and preserves remaining life at actual endpoint',()=>{
 const s=setup(),e=s.foe(),q=s.cloud();s.combat.update(1);const expires=q.expires,hp=e.hp;s.combat.beginDodge(0,0);s.combat.update(.4);near(e.hp,hp);s.combat.moveDodge(0,0,4,0);assert.ok(s.combat.endDodge(4,0));assert.equal(q.expires,expires);assert.equal(q.settledAt,1.4);assert.equal(s.combat.clouds.length,1);assert.equal(q.x,4);
});
test('a carried cloud expiring during dodge cannot revive or grant guard/trail',()=>{
 const s=setup({poison_guard:3});s.player.weaponPath={id:'sporelantern_roam',rank:3};const q=s.cloud();s.combat.update(q.expires-.2);s.combat.beginDodge(0,0);s.combat.update(.3);s.combat.moveDodge(0,0,4,0);assert.equal(s.combat.endDodge(4,0),false);assert.equal(s.combat.clouds.length,0);assert.equal(s.combat.bands.length,0);assert.equal(s.combat.shield.amount,0);
});
test('first selected expired cloud does not pick a second on the same dodge',()=>{
 const s=setup(),a=s.cloud(0,0),b=s.cloud(5,0);a.expires=.1;s.combat.beginDodge(0,0);s.combat.update(.2);s.combat.moveDodge(0,0,5,0);assert.equal(s.combat.endDodge(5,0),false);assert.equal(b.carried,false);
});
test('sedentary route matures to bounded DPS/core; relocation loses maturity not lifetime',()=>{
 const s=setup();s.player.weaponPath={id:'sporelantern_still',rank:3};const q=s.cloud(),e=s.foe(),edge=s.foe(1.1,0);near(q.r,1.6);near(q.expires,6.8);s.combat.update(3.1);near(s.combat.strongest(e,s.combat.now).damage,22*1.45*1.45);near(s.combat.strongest(edge,s.combat.now).damage,22*1.45);const expires=q.expires;s.combat.beginDodge(0,0);s.combat.moveDodge(0,0,3,0);s.combat.update(.2);s.combat.endDodge(3,0);e.x=3;near(s.combat.strongest(e,s.combat.now).damage,22);assert.equal(q.expires,expires);
});
test('roaming route creates a bounded unmovable bent band and changes the source into a curtain',()=>{
 const s=setup();s.player.weaponPath={id:'sporelantern_roam',rank:3};const q=s.cloud(),expires=q.expires;s.combat.beginDodge(0,0);s.combat.moveDodge(0,0,1,0);s.combat.moveDodge(1,0,1,3);s.combat.endDodge(1,3);assert.equal(s.combat.clouds.length,1);assert.equal(q.expires,expires);assert.equal(s.combat.bands.length,1);assert.equal(s.combat.bands[0].points.length,3);assert.ok(cloudContains(q,1+Math.cos(q.angle)*3,3-Math.sin(q.angle)*3,s.combat.now));assert.ok(!cloudContains(q,1+Math.sin(q.angle)*1.2,3+Math.cos(q.angle)*1.2,s.combat.now));
 const old=q.curtainUntil;for(let i=0;i<4;i++){s.combat.beginDodge(q.x,q.z);s.combat.moveDodge(q.x,q.z,q.x+1,q.z);s.combat.endDodge(q.x+1,q.z);}assert.equal(s.combat.bands.length,2);assert.ok(q.curtainUntil<=expires);assert.equal(q.curtainUntil,old);
 s.combat.clouds=[];s.combat.beginDodge(0,0);assert.equal(s.combat.dodge.cloud,null);
});
test('rotated curtain intersection follows its visible rectangle',()=>{
 const q={x:0,z:0,r:2,angle:Math.PI/2,curtainUntil:2};near(cloudEntry(q,{x:-5,z:2},{x:5,z:2},0),.415);assert.equal(cloudEntry(q,{x:-5,z:4},{x:5,z:4},0),Infinity);
});
test('linger updates a single mark, is suppressed in a region, and expires outside',()=>{
 const s=setup({poison_linger:2}),e=s.foe();s.cloud();s.combat.update(1);near(10000-e.hp,22);assert.equal(s.combat.marks.size,1);e.x=10;s.combat.update(1);near(10000-e.hp,29);e.x=0;s.combat.update(.5);near(10000-e.hp,40);assert.equal(s.combat.marks.size,1);e.x=10;s.combat.update(3);near(10000-e.hp,57.5);assert.equal(s.combat.marks.size,0);
});
test('main cloud kills spread to only one nearby enemy, contagion never chains',()=>{
 const s=setup({poison_spread:3}),dead=s.foe(0,0,1),target=s.foe(3,0,1),third=s.foe(3.8,0,100);s.cloud();s.combat.update(1);assert.equal(dead.kills,1);assert.equal(target.kills,1);assert.equal(third.hp,100);assert.equal(s.events.filter(e=>e.kind==='poisonSpread').length,1);assert.equal(s.hits.filter(h=>h.e===dead).length,1);
});
test('refreshing an existing infection never skips its due tick, regardless of enemy order',()=>{
 for(const reverse of[false,true]){const s=setup({poison_spread:3});s.foe(0,0,1);const target=s.foe(3,0,100);s.combat.marks.set(target,{spreadBorn:-1,spreadUntil:1,spreadDamage:14});if(reverse)s.enemies.reverse();s.cloud();s.combat.update(.1);near(target.hp,98.6);s.combat.update(.1);near(target.hp,97.2);assert.equal(s.combat.marks.get(target).spreadUntil,2.1);}
});
test('pod impact, trail and residual kills never infect; no candidate is harmless',()=>{
 for(const source of['impact','band','linger','none']){const s=setup({poison_spread:3,poison_linger:3}),e=s.foe(0,0,source==='linger'?10:1);if(source!=='none')s.foe(3,0);if(source==='impact'){s.combat.cast(weaponStats(s.player),{x:0,z:-2},0,{x:0,z:0});s.combat.update(.7);}else if(source==='band'){s.combat.bands.push({points:[{x:-1,z:0},{x:1,z:0}],r:.65,born:0,expires:2,damage:22});s.combat.update(.2);}else if(source==='linger'){s.combat.marks.set(e,{lingerDamage:9,lingerUntil:2});s.combat.update(2);}else{s.cloud();s.combat.update(.2);}assert.equal(e.kills,1);assert.equal(s.events.filter(e=>e.kind==='poisonSpread').length,0);}
});
test('overlapping secondary poisons choose one, and area suppresses both without prolonging infection',()=>{
 const s=setup(),e=s.foe();s.combat.marks.set(e,{lingerDamage:9,lingerUntil:2,spreadDamage:14,spreadUntil:2});s.combat.update(1);near(10000-e.hp,14);s.cloud();s.combat.update(1);near(10000-e.hp,36);e.x=8;s.combat.update(1);near(10000-e.hp,36);
});
test('guard has an independent cooldown, absorbs finite damage, and never stacks',()=>{
 const s=setup({poison_guard:3}),q=s.cloud();const transfer=()=>{s.combat.beginDodge(q.x,q.z);s.combat.moveDodge(q.x,q.z,q.x+1,q.z);s.combat.endDodge(q.x+1,q.z);};transfer();assert.equal(s.combat.absorb(12),0);assert.equal(s.combat.shield.amount,8);transfer();assert.equal(s.combat.shield.amount,8);assert.equal(s.combat.absorb(15),7);assert.equal(s.combat.shield.amount,0);s.combat.update(2.1);transfer();assert.equal(s.combat.shield.amount,0);
});
test('pause freezes flight, lifetime and shield; reset drops all owned state',()=>{
 const s=setup({poison_guard:3});s.cloud();s.combat.cast(weaponStats(s.player),{x:0,z:0},0,{x:2,z:0});s.combat.beginDodge(0,0);s.combat.endDodge(2,0);s.combat.cast(weaponStats(s.player),{x:0,z:0},0,{x:2,z:0});s.pause();s.combat.update(10);assert.equal(s.combat.now,0);assert.equal(s.combat.clouds.length,1);assert.equal(s.combat.pods.length,1);assert.equal(s.combat.shield.amount,20);s.combat.reset();assert.equal(s.combat.clouds.length+s.combat.pods.length+s.combat.bands.length+s.combat.marks.size,0);assert.equal(s.combat.shield.amount,0);assert.equal(s.combat.dodge,null);
});
test('dodging cancels a not-yet-released pod but leaves released flight intact',()=>{
 const s=setup(),w=weaponStats(s.player);s.combat.cast(w,{x:0,z:0},0,{x:0,z:5});s.combat.beginDodge(20,20);assert.equal(s.combat.pods.length,0);s.combat.endDodge(21,20);s.combat.cast(w,{x:0,z:0},0,{x:0,z:5});s.combat.update(.3);s.combat.beginDodge(20,20);assert.equal(s.combat.pods.length,1);s.combat.update(1);assert.equal(s.combat.clouds.length,1);
});
test('boss with no adds takes main poison and a finished game halts the tick immediately',()=>{
 const s=setup({poison_spread:3}),boss=s.foe(0,0,1);boss.boss=true;const api=s.combat.api.damage;s.combat.api.damage=(...args)=>{api(...args);if(!boss.alive)s.pause();};s.cloud();s.combat.update(1);assert.equal(boss.kills,1);assert.equal(s.events.filter(e=>e.kind==='poisonSpread').length,0);assert.equal(s.hits.length,1);
});

test('floor poison misses flying bodies, resumes after a low dive and preserves its lifetime',()=>{const s=setup(),e=s.foe();e.y=3;s.cloud();s.combat.update(1);near(e.hp,10000);e.y=.25;s.combat.update(1);assert(e.hp<10000);const hp=e.hp;e.y=3;s.combat.update(1);near(e.hp,hp);near(s.combat.clouds[0].expires,4.8);});
