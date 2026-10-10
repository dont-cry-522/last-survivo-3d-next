import{weaponStats,takeUpgrade,HERO_LOADOUTS}from'../rules.js?v=96';
import{MIRAGE}from'../mirage-config.js?v=96';
const output=document.querySelector('#report'),view=document.querySelector('#view');
const check=(ok,msg)=>{if(!ok)throw Error(msg);},log=s=>output.textContent+='\n'+s;
function fireOnce(){g.controls.held=true;g.player.attack=0;advance(.05);g.controls.held=false;g.player.attack=999;}
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const html=await(await fetch('../index.html')).text();
let f,win,g,clock;
function setup(hero='mirage',map='forest'){
 g.select(hero,map,0);g.start();win.document.querySelector('#dialog').close();
 Object.assign(g.world,{obstacles:[],patches:[],ponds:[],ice:[],fords:[],bridges:[],sites:[],roaming:[],discoveries:[],breakables:[]});
 Object.assign(g.player,{x:0,z:0,attack:999,inv:0,pending:0,level:8});g.hero.position.set(0,0,0);g.hero.rotation.y=0;
 Object.assign(g.controls,{angle:0,held:false,hasAim:true});g.camera.position.set(12,20,16);g.camera.lookAt(0,0,0);g.camera.updateMatrixWorld(true);
}
function advance(seconds){for(let left=seconds;left>1e-8;){const dt=Math.min(left,1/60);g.step(dt);g.vfx.update(dt);left-=dt;}}
function target(kind='golem',x=0,z=5,hp=1000){const e=g.spawn(kind,x,z);check(e,'spawn '+kind);Object.assign(e,{hp,maxHp:hp,speed:0,cool:999,damage:10});return e;}
function render(){win.qaFrame(clock+=17);}
function capture(label){const playing=g.state==='playing';if(playing)g.pause();for(let i=0;i<75;i++)render();const figure=document.createElement('figure'),image=document.createElement('img'),caption=document.createElement('figcaption');image.src=g.renderer.domElement.toDataURL();image.style.width='390px';caption.textContent=label;figure.append(image,caption);document.querySelector('#captures').append(figure);if(playing)g.resume();}
async function run(width,height){
 if(f)f.remove();f=document.createElement('iframe');f.width=width;f.height=height;view.append(f);
 const bootstrap=`<base href="../"><script>window.qaErrors=[];addEventListener('error',e=>qaErrors.push(e.message));addEventListener('unhandledrejection',e=>qaErrors.push(String(e.reason)));window.requestAnimationFrame=cb=>{window.qaFrame=cb;return 0};const media=window.matchMedia.bind(window);window.matchMedia=q=>q==='(pointer:coarse)'?{matches:${width<1000},addEventListener(){},removeEventListener(){}}:media(q);const memory=new Map();Object.defineProperty(window,'localStorage',{value:{getItem:k=>memory.get(k)||null,setItem:(k,v)=>memory.set(k,String(v)),removeItem:k=>memory.delete(k)}});<\/script>`;
 f.srcdoc=html.replace('<head>','<head>'+bootstrap);win=f.contentWindow;
 for(let i=0;i<300;i++){if(win.game3d&&!win.document.querySelector('#start')?.disabled)break;await sleep(50);}
 check(win.game3d&&!win.document.querySelector('#start').disabled,'game failed to load');g=win.game3d;clock=win.performance.now();
 check(win.document.querySelector('[data-hero=mirage]')&&win.document.querySelector('[data-hero=wuling]'),'both heroes must remain selectable');
 win.document.querySelector('[data-hero=mirage]').click();win.document.querySelector('[data-attack-mode=manual]').click();win.document.querySelector('#start').click();
 check(g.player.weaponId==='miasmalantern','new hero loadout');setup();
 const e=target(),nearby=target('golem',1.5,4.4),outside=target('golem',3.8,4.4),soundEvents=[],allow=g.audio.allow.bind(g.audio);g.audio.allow=(key,seconds)=>{soundEvents.push(key);return allow(key,seconds);};fireOnce();check(soundEvents.filter(k=>k==='mirage-charge').length===1&&!soundEvents.includes('mirage-shot'),'charge/release sound timing');
 check(e.hp===1000&&nearby.hp===1000,'damage before lantern release');advance(.25);check(g.bullets.some(b=>b.mesh.visible&&b.hitRadius===.34),'large orb never appeared');capture(width+' 深紫毒团飞行');
 const flying=g.bullets[0],position=[flying.x,flying.z],pausedAt=g.mirage.now;g.pause();g.step(4);check(flying.x===position[0]&&flying.z===position[1]&&g.mirage.now===pausedAt,'pause advanced orb');g.resume();
 advance(.3);check(e.hp<968&&e.hp>960&&g.mirage.marks.has(e),'direct target should take32 plus finite poison, not14 splash');
 check(nearby.hp<986&&nearby.hp>978&&g.mirage.marks.has(nearby),'nearby foe missed spread');check(outside.hp===1000,'spread exceeded radius');check(!g.mirage.clouds.length&&!g.bullets.length,'ordinary orb spawned floor fog or remained live');const firstDamage=1000-e.hp;capture(width+' 毒团扩散与群体附毒');advance(.2);
 advance(3);check(Math.abs(e.hp-(1000-32-8*2.6))<.01,'direct target total damage or expiry wrong');check(Math.abs(nearby.hp-(1000-14-8*2.6))<.01,'secondary total damage or expiry wrong');check(!g.mirage.marks.size,'poison failed to expire');check(soundEvents.filter(k=>k==='mirage-shot').length===1&&soundEvents.filter(k=>k==='mirage-hit').length===1,'shot or burst sound missing/duplicated per foe or DOT');g.audio.allow=allow;
 setup();const front=target('golem',1.3,1.7),behind=target('golem',0,4);g.world.obstacles=[{x:0,z:3,r:.7}];fireOnce();advance(1);check(front.hp<1000&&behind.hp===1000,'wall burst did not obey line of sight');check(!g.bullets.length,'wall failed to stop orb');
 setup();fireOnce();advance(.23);const ranged=g.bullets[0];check(ranged&&ranged.mesh.visible,'missing range test projectile');const endX=ranged.x+ranged.vx*ranged.life,endZ=ranged.z+ranged.vz*ranged.life;const atEnd=target('golem',endX+1.6,endZ);advance(1);check(atEnd.hp<1000&&g.mirage.marks.has(atEnd)&&!g.bullets.length,'maximum range burst missing');
 setup();const cancelled=target();fireOnce();g.dash();advance(.7);check(cancelled.hp===1000&&!g.bullets.length&&!g.mirage.marks.size,'cancelled warmup burst or hit');
 setup();const killed=target('golem',0,5,1),survivor=target('golem',1.5,4.4);fireOnce();advance(.8);check(!killed.alive&&survivor.hp<1000&&g.orbs.length===1,'direct kill lost spread or duplicated reward');
 setup();const sustained=target(),serialBefore=g.hero.userData.shotSerial||0;g.controls.held=true;g.player.attack=0;advance(2.35);g.controls.held=false;g.player.attack=999;check(g.hero.userData.shotSerial-serialBefore===2,'base cadence should be two shots in2.35 seconds');
 setup();g.spawnBoss();Object.assign(g.boss,{x:0,z:5,hp:1000,cool:999,stage:'walk'});g.boss.mesh.position.set(0,0,5);fireOnce();advance(.65);check(g.boss.hp<968&&g.mirage.marks.has(g.boss),'boss surface collision lost direct poison');
 // A finishing orb must stop the rest of this frame, even with another live projectile queued.
 setup();for(let round=0;round<2;round++){g.spawnBoss();g.hurtEnemy(g.boss,1e6);}g.player.pending=0;fireOnce();advance(.22);const firstOrb=g.bullets[0];check(firstOrb&&firstOrb.mesh.visible,'finishing test orb not released');g.spawnBoss();Object.assign(g.boss,{x:firstOrb.x,z:firstOrb.z+2.37,hp:1,cool:999,stage:'walk'});g.boss.mesh.position.set(g.boss.x,0,g.boss.z);
 const spared=target('golem',firstOrb.x+5,firstOrb.z+5),second={...firstOrb,mesh:firstOrb.mesh.clone(),x:spared.x,z:spared.z,hits:new Set(),visualHits:new Set()};g.bullets.push(second);advance(.04);check(g.state==='won'&&spared.hp===1000&&!g.bullets.length,'finishing shot allowed a later projectile hit');
 setup();const victim=target('golem',0,1),health=g.player.hp;g.dash();const d=g.mirage.decoy;check(d&&d.hp===health&&g.mirage.hidden,'dodge snapshot / hide');
 g.damage(999,1,0);check(g.player.hp===health,'concealment did not prevent damage');advance(.2);check(victim.decoyTarget===d.id&&!victim.targetLost,'enemy did not choose decoy');
 check(g.mirageVFX.decoy.visible&&g.hero.userData.mirageFade>.8,'in-game decoy/concealment not visible');capture(width+' 遁形与替身');
 const stamp=g.mirage.now,expires=d.expires;g.pause();g.step(3);check(g.mirage.now===stamp&&d.expires===expires&&g.mirage.hidden,'pause advanced concealment');g.resume();advance(.45);g.damage(999,1,0);check(g.player.hp===health,'concealment immune window ended with movement');advance(.25);
 check(!g.mirage.hidden&&!g.player.mirageHidden,'did not reappear');advance(.62);check(!g.mirage.decoy&&g.mirage.clouds.length===1&&victim.hp<1000,'natural decoy did not bloom');advance(.12);capture(width+' 替身自然绽放');
 const cloudNow=g.mirage.now;g.pause();g.step(8);check(g.mirage.now===cloudNow&&g.mirage.clouds.length===1,'pause aged cloud');g.resume();advance(2.1);check(!g.mirage.clouds.length,'cloud lingered past expiry');
 setup();g.player.hp=8;const hitter=target('golem',0,0.5);g.dash();Object.assign(hitter,{wind:.01,damage:40});advance(.03);
 check(!g.mirage.decoy&&!g.mirage.clouds.length,'real golem hit must break decoy without bloom');advance(1.6);check(!g.mirage.clouds.length,'killed decoy exploded later');
 setup();g.player.hp=8;const wolf=target('wolf',0,-.5);g.dash();Object.assign(wolf,{wind:.01,attackAngle:0,damage:40});advance(.10);check(!g.mirage.decoy&&!g.mirage.clouds.length,'pounce failed to hit decoy');
 setup();g.player.hp=8;const mage=target('spitter',0,3);g.dash();Object.assign(mage,{wind:.01,tx:0,tz:0,damage:40});advance(.8);check(!g.mirage.decoy&&!g.mirage.clouds.length,'enemy projectile-zone failed to break decoy');
 setup();g.dash();const first=g.mirage.decoy;g.player.dash=0;g.dash();check(g.mirage.decoy.id!==first.id&&!first.alive&&!g.mirage.clouds.length,'replacement copied or bloomed old decoy');
 setup();g.world.obstacles=[{x:0,z:2,r:.7}];g.dash();advance(.55);check(g.player.z<1.2,'dodge crossed solid obstacle');
 setup();g.player.upgrades.mirage_mantle=3;g.dash();advance(.9);g.player.inv=0;g.player.relic={id:'glass'};const hp=g.player.hp;g.damage(20,4,0);check(Math.abs(g.player.hp-(hp-5))<.01,'shield should absorb after relic multiplier');
 const routeDamage=[];
 for(const id of['miasmalantern_lure','miasmalantern_venom']){
  setup();for(let i=0;i<3;i++)check(takeUpgrade(g.player,'path:'+id),'route rank rejected');const other=id.endsWith('lure')?'miasmalantern_venom':'miasmalantern_lure';check(!takeUpgrade(g.player,'path:'+other),'routes were not exclusive');
  Object.assign(g.player.upgrades,{mirage_residue:3,mirage_burial:3,mirage_mantle:3});const foe=target('golem',0,1);g.dash();advance(2);check(foe.hp<1000,'route decoy dealt no damage');routeDamage.push({id,damage:1000-foe.hp});
  if(id.endsWith('venom'))check(g.mirage.modifyShot(weaponStats(g.player)).rate>weaponStats(g.player).rate,'reappearance attack window missing');
 }
 setup();const doomed=target('golem',0,5,1);g.mirage.attackHit(doomed,weaponStats(g.player));advance(.2);check(!doomed.alive&&g.orbs.length===1,'poison kill reward missing');advance(.3);check(g.orbs.length===1,'duplicate poison reward');
 setup();for(let round=0;round<2;round++){g.spawnBoss();g.hurtEnemy(g.boss,1e6);}g.player.pending=0;g.spawnBoss();Object.assign(g.boss,{x:0,z:5,hp:1,cool:999,stage:'walk'});g.boss.mesh.position.set(0,0,5);g.mirage.attackHit(g.boss,weaponStats(g.player));g.dash();advance(.05);advance(.15);check(g.state==='won'&&!g.mirage.clouds.length&&!g.mirage.decoy,'boss win cleanup failed');check(g.hero.userData.mirageFade===0&&g.hero.userData.mirageSurfaces.every(s=>s.mesh.material.opacity===s.opacity),'win while concealed did not restore appearance');check(!g.bullets.length&&!g.mirageVFX.decoy.visible,'win retained new hero visuals');
 check(JSON.parse(win.localStorage.getItem('forest-echoes-expedition-v1')).wins.includes('forest:miasmalantern'),'new weapon victory not saved');
 setup();g.dash();g.start();check(!g.mirage.decoy&&!g.mirage.hidden&&!g.mirage.marks.size,'restart retained state');g.dash();g.menu();check(!g.mirage.decoy&&!g.mirage.hidden,'menu retained state');
 setup();g.dash();advance(.9);g.player.inv=0;g.damage(999,0,0);check(g.state==='lost'&&!g.mirage.decoy&&!g.mirage.hidden,'death cleanup failed');
 // Actual old hero attack/dodge/upgrade pathways; no changes to their numbers.
 for(const id of Object.keys(HERO_LOADOUTS).filter(id=>id!=='mirage')){
  setup(id);g.player.inv=999;const foe=target('golem',0,id==='tide'?2.8:5);g.controls.held=true;g.player.attack=0;advance(1.5);g.controls.held=false;
  check(foe.hp<1000,id+' cannot attack');g.player.dash=0;g.dash();advance(.6);check(g.player.dash>0,id+' cannot dodge');check(takeUpgrade(g.player,'power'),id+' cannot upgrade');
 }
 g.menu();win.document.querySelector('[data-hero=mirage]').click();win.document.querySelector('[data-attack-mode=auto]').click();g.start();
 Object.assign(g.world,{obstacles:[],patches:[],ponds:[],sites:[],roaming:[],discoveries:[]});g.player.inv=999;const auto=target('golem',g.player.x,g.player.z+5);g.player.attack=0;advance(1.5);check(auto.hp<1000,'automatic aim and attack failed');
 check(win.qaErrors.length===0,'browser errors: '+win.qaErrors.join('\n'));g.menu();win.document.querySelector('[data-hero=mirage]').click();render();
 check(win.document.documentElement.scrollWidth<=width+2,'viewport horizontal overflow');
 log('PASS '+width+'×'+height+' — manual damage '+firstDamage.toFixed(2)+', '+JSON.stringify(routeDamage));
}
try{output.textContent='RUNNING';for(const [w,h]of[[1365,900],[844,390],[390,844]])await run(w,h);log('PASS ALL: 3 viewport simulations, slow orb, spread/obstacles/range/cancel, poison/rewards, both routes, pause/reset/death, all six existing heroes.');}
catch(e){log('FAIL '+e.stack);console.error(e);}
