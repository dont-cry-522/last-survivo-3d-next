const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright'),assert=require('node:assert/strict');
const url=process.env.TEST_URL||'http://127.0.0.1:8899/';
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.BROWSER_EXECUTABLE||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
 try{for(const [width,height]of[[1440,900],[844,390],[390,844]]){
  const page=await browser.newPage({viewport:{width,height},hasTouch:width<1000}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{const raf=requestAnimationFrame;window.requestAnimationFrame=cb=>{window.nextFrame=cb;return raf(t=>{if(!window.freezeGame)cb(t);});};});
  await page.goto(url,{waitUntil:'domcontentloaded',timeout:60000});
  await page.waitForFunction(()=>window.game3d&&!document.querySelector('#start').disabled,null,{polling:100,timeout:60000});
  await page.locator('[data-hero=wuling]').click();
  assert((await page.locator('#weapon-preview').textContent()).includes('毒雾'),'missing lantern explanation');
  await page.locator('[data-attack-mode=manual]').click();await page.locator('#start').click();
  await page.evaluate(()=>freezeGame=true);await page.waitForTimeout(60);
  const report=await page.evaluate(async()=>{
   const g=game3d,{POISON}=await import('./poison-config.js'),{weaponStats,chooseUpgrades,takeUpgrade}=await import('./rules.js'),{HERO_DODGES}=await import('./hero-dodge.js');
   const check=(ok,message)=>{if(!ok)throw Error(message);};
   const advance=seconds=>{for(let n=0;n<Math.ceil(seconds*60);n++){g.step(1/60);g.vfx.update(1/60);}};
   const setup=()=>{
    g.select('wuling','forest',0);g.start();
    Object.assign(g.world,{obstacles:[],patches:[],ponds:[],ice:[],fords:[],bridges:[],sites:[],roaming:[],discoveries:[],breakables:[]});
    g.player.x=g.player.z=0;g.hero.position.set(0,0,0);g.hero.rotation.y=0;g.player.attack=999;g.player.inv=999;g.player.level=8;
    Object.assign(g.controls,{angle:0,hasAim:true,held:false});
    g.camera.position.set(12,20,16);g.camera.lookAt(0,0,0);g.camera.updateMatrixWorld(true);
   };
   const target=(x=0,z=6,hp=1000)=>{const e=g.spawn('golem',x,z);check(e,'target spawn');Object.assign(e,{hp,maxHp:hp,speed:0,cool:999,damage:0});return e;};
   setup();check(g.player.weaponId==='sporelantern'&&g.poison,'wrong loadout or missing combat system');
   const e=target();g.controls.held=true;g.player.attack=0;advance(.05);g.controls.held=false;g.player.attack=999;
   check(e.hp===1000,'lantern damage occurred before release');advance(1);
   check(g.poison.clouds.length>0&&e.hp<1000,'manual attack failed to land a damaging cloud');
   check(g.bullets.length===0,'lantern accidentally fired a generic projectile');
   const before=e.hp;advance(.35);check(e.hp<before,'cloud did not continue dealing damage');
   const frozen={time:g.time,poison:g.poison.now,hp:e.hp};g.pause();g.step(3);
   check(g.time===frozen.time&&g.poison.now===frozen.poison&&e.hp===frozen.hp,'poison continued while paused');g.resume();
   g.player.pending=1;g.grant(0);document.querySelector('#upgrade-ready').click();check(g.state==='upgrade','upgrade pause not entered');
   const upgradeNow=g.poison.now;g.step(2);check(g.poison.now===upgradeNow,'poison advanced during upgrade selection');
   document.querySelector('[data-upgrade]').click();check(g.state==='playing','upgrade could not resume');

   // A friendly cloud must remain separate from enemy poison-zone damage.
   setup();g.player.inv=0;const healthy=g.player.hp;g.poison.addCloud(0,0,weaponStats(g.player));advance(.4);
   check(g.player.hp===healthy&&!g.zones.some(z=>z.kind==='poison'),'own cloud hurt its owner');
   for(let i=0;i<8;i++)g.poison.addCloud(i*.1,4,weaponStats(g.player));
   check(g.poison.clouds.length<=POISON.maxClouds,'cloud count unbounded');

   const routeResults=[];
   for(const path of['sporelantern_still','sporelantern_roam']){
    setup();for(let rank=1;rank<=3;rank++)check(takeUpgrade(g.player,'path:'+path),path+' rank '+rank+' rejected');
    const w=weaponStats(g.player),foe=target();g.poison.addCloud(0,6,w);advance(.4);
    check(foe.hp<1000,path+' cloud dealt no damage');routeResults.push({path,damage:1000-foe.hp});
    for(let i=0;i<20;i++)for(const offer of chooseUpgrades(g.player))check(!['veil','chain','rift'].includes(offer.id),'shadow-only spell offered to poison hero');
   }

   // Exercise the real dodge path, including collision and guard activation.
   setup();g.player.upgrades.poison_guard=1;g.poison.addCloud(0,0,weaponStats(g.player));
   g.player.inv=0;const unguarded=g.player.hp;g.damage(10,3,0);check(g.player.hp===unguarded-10,'standing in cloud incorrectly grants shield');
   g.player.inv=999;g.dash();advance(HERO_DODGES.wuling.duration+.05);
   check(Math.hypot(g.player.x,g.player.z)>3,'dodge has animation but no travel');
   check(g.poison.clouds.some(c=>Math.hypot(c.x-g.player.x,c.z-g.player.z)<2),'dodge failed to carry a nearby cloud');
   g.player.inv=0;g.player.relic={id:'glass'};const guarded=g.player.hp;g.damage(20,g.player.x+3,g.player.z);
   check(Math.abs(g.player.hp-(guarded-(25-POISON.shield[1])))<.01,'guard should absorb after incoming relic multiplier');
   setup();g.world.obstacles=[{x:0,z:2,r:.7}];g.dash();advance(HERO_DODGES.wuling.duration+.1);
   check(g.player.z<1.2,'poison dodge crossed solid obstacle');

   // Poison kills must flow through ordinary XP and victory handling once.
   setup();const victim=target(0,6,1);g.poison.addCloud(0,6,weaponStats(g.player));advance(.25);
   check(!victim.alive&&g.orbs.length===1,'poison kill did not grant one ordinary XP drop');advance(.3);check(g.orbs.length===1,'poison kill duplicated XP');
   setup();for(let round=0;round<2;round++){g.spawnBoss();g.hurtEnemy(g.boss,1e6);}g.player.pending=0;g.spawnBoss();const boss=g.boss;Object.assign(boss,{x:0,z:6,hp:1,cool:999,recover:0,stage:'walk'});boss.mesh.position.set(0,0,6);
   g.poison.addCloud(0,6,weaponStats(g.player));advance(.25);
   check(g.state==='won'&&!boss.alive,'poison boss kill did not finish expedition');
   const journal=JSON.parse(localStorage.getItem('forest-echoes-expedition-v1'));check(journal.wins.includes('forest:sporelantern'),'poison victory was not persisted');

   setup();g.player.upgrades.poison_linger=1;g.poison.addCloud(0,6,weaponStats(g.player));target();advance(.3);g.dash();advance(.1);g.start();
   check(!g.poison.clouds.length&&!g.poison.bands.length&&!g.poison.pods.length&&!g.poison.marks.size,'restart retained poison state');
   g.poison.addCloud(g.player.x,g.player.z,weaponStats(g.player));g.menu();
   check(!g.poison.clouds.length&&!g.poison.bands.length&&!g.poison.pods.length&&!g.poison.marks.size,'menu retained poison state');
   g.select('silver','forest',0);g.start();check(!g.poison.clouds.length&&g.player.weaponId==='crossbow','poison state leaked to old hero');
   return{manualCloudDamage:1000-e.hp,routeResults};
  });
  await page.evaluate(()=>game3d.menu());await page.locator('[data-hero=wuling]').click();await page.locator('[data-attack-mode=auto]').click();await page.locator('#start').click();
  await page.evaluate(()=>{const g=game3d;Object.assign(g.world,{obstacles:[],patches:[],ponds:[],sites:[],roaming:[],discoveries:[]});g.player.inv=999;const e=g.spawn('golem',g.player.x,g.player.z+5);Object.assign(e,{hp:1000,maxHp:1000,speed:0,cool:999});for(let i=0;i<150;i++){g.step(1/60);g.vfx.update(1/60);}if(e.hp>=1000||!g.poison.clouds.length)throw Error('automatic lantern aim/attack failed');});
  if(process.env.OUTPUT_DIR){await page.evaluate(()=>{let t=performance.now();for(let i=0;i<5;i++)nextFrame(t+=20);});await page.screenshot({path:process.env.OUTPUT_DIR+'/wuling-combat-'+width+'.png'});}
  assert.deepEqual(errors,[]);console.log('PASS Wuling manual/auto, delays, clouds, routes, dodge, guard, pause, kills, journal and reset '+width+'x'+height,report);await page.close();
 }}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
