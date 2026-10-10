const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict');

(async()=>{
 const browser=await chromium.launch({executablePath:process.env.BROWSER_EXECUTABLE||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
 try{
  const page=await browser.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto(process.env.TEST_URL||'http://127.0.0.1:8897/');await page.waitForFunction(()=>window.game3d,{},{timeout:60000});
  const result=await page.evaluate(()=>{
   const g=game3d;g.select('scout','forest',0);g.start();
   g.world.obstacles.length=0;const site=g.world.sites.find(s=>s.type==='supply');g.player.x=site.x;g.player.z=site.z;g.player.hp=g.player.maxHp=100000;
   let spawned=0;for(let i=0;i<60;i++)if(g.spawn('wolf',0,0))spawned++;
   for(let i=0;i<65;i++)g.step(.04);
   const guarded={spawned,claimed:site.claimed,guards:site.guards?.length||0};
   for(const guard of site.guards||[])g.hurtEnemy(guard,100000);
   g.player.hp=50000;g.player.inv=100;g.step(.04);
   guarded.afterKill={claimed:site.claimed,hp:g.player.hp};
   g.start();const x=g.player.x,z=g.player.z,blocked={x,z:z+14,r:2};g.world.obstacles.push(blocked);
   const random=Math.random;Math.random=()=>0;try{g.spawnBoss();}finally{Math.random=random;}
   const bossDistance=Math.hypot(g.boss.x-blocked.x,g.boss.z-blocked.z);
   return {guarded,bossDistance,bossRadius:g.boss.size+blocked.r};
  });
  assert.equal(result.guarded.spawned,60);
  assert.equal(result.guarded.guards,4,'site must still summon four guards at the ordinary enemy cap');
  assert.equal(result.guarded.claimed,false,'site must not be claimed before guards are defeated');
  assert.equal(result.guarded.afterKill.claimed,true,'defeating guards should unlock the supply');
  assert.equal(result.guarded.afterKill.hp,90000,'supply should restore 40% of max health');
  assert(result.bossDistance>=result.bossRadius,'boss must not appear inside an obstacle');
  await page.evaluate(()=>{game3d.hurtEnemy(game3d.boss,100000);for(let i=0;i<2;i++){game3d.spawnBoss();game3d.hurtEnemy(game3d.boss,100000);}});assert.equal(await page.evaluate(()=>game3d.state),'won');
  await page.getByRole('button',{name:'再次远征'}).click();assert.equal(await page.evaluate(()=>game3d.state),'playing');
  assert((await page.evaluate(()=>game3d.time))<1,'restart should reset the timer');
  await page.evaluate(()=>game3d.damage(100000,game3d.player.x,game3d.player.z));assert.equal(await page.evaluate(()=>game3d.state),'lost');
  await page.getByRole('button',{name:'选择角色与地图'}).click();assert.equal(await page.evaluate(()=>game3d.state),'menu');
  assert.deepEqual(errors,[]);console.log('PASS site guards at enemy cap and clear boss spawn');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exit(1);});
