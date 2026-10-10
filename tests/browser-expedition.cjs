const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright'),assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch({executablePath:process.env.BROWSER_EXECUTABLE||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});try{
 for(const [width,height,touch]of [[1440,900,false],[844,390,true],[320,568,true]]){
  const page=await browser.newPage({viewport:{width,height},hasTouch:touch}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{const raf=requestAnimationFrame;window.requestAnimationFrame=cb=>{window.nextFrame=cb;return raf(t=>{if(!window.freezeGame)cb(t)})};});
  await page.goto(process.env.TEST_URL||'http://127.0.0.1:8899/');await page.waitForFunction(()=>window.game3d,null,{polling:100,timeout:60000});
  await page.locator('#start').click();await page.evaluate(()=>freezeGame=true);await page.waitForTimeout(80);
  const guarded=await page.evaluate(()=>{const g=game3d,s=g.world.sites.find(s=>s.type==='relic');g.world.obstacles.length=0;g.world.patches.length=0;g.player.inv=999;g.player.x=s.x;g.player.z=s.z;for(let i=0;i<55;i++)g.step(.04);return{s:s.state,guards:s.guards.length,claimed:s.claimed};});
  assert.deepEqual(guarded,{s:'guarded',guards:4,claimed:false});
  await page.evaluate(()=>{const s=game3d.world.sites.find(s=>s.type==='relic');for(const e of s.guards)game3d.hurtEnemy(e,1e6);game3d.player.pending=1;game3d.step(.01)});
  assert.equal(await page.evaluate(()=>game3d.state),'relic');assert.equal(await page.locator('[data-relic]').count(),3);
  const ids=await page.locator('[data-relic]').evaluateAll(bs=>bs.map(b=>b.dataset.relic));assert.equal(new Set(ids).size,3);
  const frozen=await page.evaluate(()=>{const t=game3d.time;game3d.step(3);return t===game3d.time});assert(frozen,'relic choice must pause combat');
  await page.keyboard.press('Escape');assert.equal(await page.evaluate(()=>game3d.state),'relic','escape must not discard reward');
  for(const b of await page.locator('[data-relic]').all()){await b.scrollIntoViewIfNeeded();const r=await b.boundingBox();assert(r.x>=0&&r.x+r.width<=width&&r.height>50,'relic card fits and is reachable');}
  if(process.env.OUTPUT_DIR)await page.screenshot({path:process.env.OUTPUT_DIR+'/expedition-relic-'+width+'.png'});
  await page.locator('[data-relic]').first().click();assert.equal(await page.evaluate(()=>game3d.state),'upgrade');
  await page.locator('[data-upgrade]').first().click();assert.equal(await page.evaluate(()=>game3d.state),'playing');
  assert.equal(await page.evaluate(()=>game3d.player.relic.id),ids[0]);
  await page.evaluate(()=>{game3d.pause();const t=performance.now();for(let i=1;i<=4;i++)nextFrame(t+i*100);game3d.resume();});
  await page.locator('[data-relic-detail]').click();assert.equal(await page.evaluate(()=>game3d.state),'paused');assert((await page.locator('#dialog-content').textContent()).includes('仅本局生效'));await page.getByRole('button',{name:'继续远征',exact:true}).click();
  const stored=await page.evaluate(()=>JSON.parse(localStorage.getItem('forest-echoes-expedition-v1')));assert(stored.relics.includes(ids[0]));
  await page.evaluate(()=>{game3d.player.inv=0;game3d.damage(1e6,0,0)});await page.getByRole('button',{name:'远征手册',exact:true}).click();
  assert(await page.locator('.journal-relics .discovered').count()===1);const back=await page.getByRole('button',{name:'返回',exact:true}).boundingBox();assert(back.y>=0&&back.y+back.height<=height,'journal back button stays visible without scrolling');
  await page.getByRole('button',{name:'返回',exact:true}).click();assert.equal(await page.evaluate(()=>game3d.state),'lost');
  await page.getByRole('button',{name:'再次远征',exact:true}).click();assert.equal(await page.evaluate(()=>game3d.player.relic),undefined);
  await page.evaluate(()=>{for(let i=0;i<3;i++){game3d.spawnBoss();game3d.hurtEnemy(game3d.boss,1e6)}});assert.equal(await page.evaluate(()=>game3d.state),'won');
  await page.getByRole('button',{name:'远征手册',exact:true}).click();assert.equal(await page.locator('.journal-weapons .discovered').count(),1);
  if(process.env.OUTPUT_DIR)await page.screenshot({path:process.env.OUTPUT_DIR+'/expedition-journal-'+width+'.png'});
  await page.locator('[data-expedition-map="ash"][data-expedition-weapon="grimoire"]').click();
  assert.equal(await page.evaluate(()=>game3d.state),'menu');assert.equal(await page.evaluate(()=>game3d.player.weaponId),'grimoire');assert(await page.locator('[data-map=ash]').evaluate(b=>b.classList.contains('selected')));
  await page.reload();await page.waitForFunction(()=>window.game3d,null,{polling:100,timeout:60000});assert((await page.locator('#journal-open').textContent()).includes('1/6'));
  assert((await page.locator('#journal-open').textContent()).includes('1/27'));assert.deepEqual(errors,[]);console.log('PASS guarded relic reward, pause, pending upgrade, defeat persistence, first victory, journal loadout and reload',width+'x'+height);
  await page.close();
 }
 const p=await browser.newPage({viewport:{width:1440,height:900}});const errors=[];p.on('pageerror',e=>errors.push(e.message));await p.addInitScript(()=>{const raf=requestAnimationFrame;window.requestAnimationFrame=cb=>{window.nextFrame=cb;return raf(t=>{if(!window.freezeGame)cb(t)})};});
 await p.goto(process.env.TEST_URL||'http://127.0.0.1:8899/');await p.waitForFunction(()=>window.game3d,null,{polling:100,timeout:60000});await p.locator('#start').click();await p.evaluate(()=>freezeGame=true);await p.waitForTimeout(80);
 const report=await p.evaluate(async()=>{
  const {equipRelic}=await import('./expedition.js?v=35'),g=game3d,out={};
  function setup(id,hero='scout',index=0){g.select(hero,'forest',index);g.start();g.world.obstacles.length=0;g.world.patches.length=0;g.world.sites.length=0;g.player.inv=999;g.controls.angle=0;g.controls.hasAim=true;g.hero.rotation.y=0;equipRelic(g.player,id);}
  function enemy(x=0,z=4,hp=10000){const e=g.spawn('golem',g.player.x+x,g.player.z+z);e.hp=e.maxHp=hp;e.speed=0;e.cool=999;return e;}
  function shot(){g.player.attack=0;g.controls.held=true;g.step(1/60);g.controls.held=false;}
  setup('wind');g.dash();g.player.dashTime=0;shot();out.wind=g.bullets[0]?.damage;
  setup('glass');shot();out.glass=g.bullets[0]?.damage;g.player.inv=0;g.damage(20,0,0);out.glassHurt=120-g.player.hp;
  setup('blood');g.player.hp=50;for(let i=0;i<3;i++)g.hurtEnemy(enemy(),1e6);out.blood=g.player.hp;
  setup('frost');const near=enemy(0,2);g.dash();out.frost={damage:near.maxHp-near.hp,slow:near.slow};
  setup('ember');const victim=enemy(1,4);for(let i=0;i<5;i++)g.hurtEnemy(enemy(),1e6);out.ember=victim.maxHp-victim.hp;
  // Secondary kills must not feed another explosion or overflow the effect budget.
  setup('ember');for(let i=0;i<12;i++)enemy(0,4,1);for(let i=0;i<5;i++)g.hurtEnemy(g.enemies.find(e=>e.alive),1e6);out.emberKills=g.player.relic.kills;out.emberRemaining=g.enemies.filter(e=>e.alive).length;
  setup('storm');const front=enemy(1,5),rear=enemy(0,-5),blocked=enemy(-2,5);g.world.obstacles.push({x:g.player.x-1,z:g.player.z+2.5,r:.5});for(let i=0;i<5;i++)shot();out.storm={front:front.maxHp-front.hp,rear:rear.maxHp-rear.hp,blocked:blocked.maxHp-blocked.hp};
  setup('glass','wraith',2);shot();out.book=g.riftStrikes[0]?.damage;
  g.start();out.reset=g.player.relic===undefined;return out;
 });
 assert(Math.abs(report.wind-17.4)<.001);assert(Math.abs(report.glass-15.6)<.001);assert.equal(report.glassHurt,25);assert.equal(report.blood,55);assert.deepEqual(report.frost,{damage:18,slow:2.2});assert.equal(report.ember,26);assert.equal(report.emberKills,5);assert.equal(report.emberRemaining,0);assert.deepEqual(report.storm,{front:22,rear:0,blocked:0});assert.equal(report.book,44.2);assert(report.reset);assert.deepEqual(errors,[]);console.log('PASS six relic combat hooks, direction and wall restrictions, explosion recursion guard, spell weapons, clean reset',report);await p.close();
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exit(1)});
