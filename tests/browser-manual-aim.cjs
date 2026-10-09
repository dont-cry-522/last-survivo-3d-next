// Shared real-game fixture covers both camera modes, 13 weapons, mouse chords,
// pause cleanup and three mobile sizes. It can also be run by opening its HTML.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.BROWSER_EXECUTABLE||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
 try{
  const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  const url=new URL('tests/adventure-check.html',process.env.TEST_URL||'http://127.0.0.1:8897/');
  await page.goto(url.href);await page.locator('#run').click({timeout:60000});
  await page.waitForFunction(()=>!document.querySelector('#run').disabled,{},{timeout:120000});
  const result=JSON.parse(await page.locator('#report').innerText());
  assert(result.results.length>=27);assert(result.results.every(r=>r.pass),JSON.stringify(result.results.filter(r=>!r.pass)));assert.deepEqual(errors,[]);assert.deepEqual(result.errors,[]);
  console.log('PASS',result.results.length,'dual-view and input checks (mobile simulation)');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
