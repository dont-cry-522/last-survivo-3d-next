import{test}from'node:test';
import assert from'node:assert/strict';
import{readFile,writeFile,mkdir,mkdtemp,rm}from'node:fs/promises';
import{tmpdir}from'node:os';
import{join,dirname,basename}from'node:path';
import{pathToFileURL}from'node:url';

const root=new URL('../',import.meta.url),read=path=>readFile(new URL(path,root),'utf8');
test('offline build aligns static/lazy module and HTML versions before hashing; check never writes',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'forest-offline-'));
 const files={
  'package.json':'{"type":"module"}',
  'index.html':'<link href="style.css?v=9"><script src="main.js?v=182"></script><script src="./offline.js?v=7"></script>',
  'style.css':'body{}','manifest.webmanifest':'{}','THIRD_PARTY_ASSETS.md':'test',
  'START_OFFLINE.cmd':'test','start-offline.py':'test','start-offline.mjs':'test','OFFLINE_README.txt':'test',
  'character-assets.js':'export const CHARACTER_ASSETS={textures:[],models:{},motion:{file:"motion.json"},motionFallback:{file:"motion.json"}};',
  'main.js':"import './dep.js?v=9';export const later=()=>import('./lazy.js?v=77&mode=test');const external='https://example.test/file.js?v=4';",
  'dep.js':"export{value}from'./lazy.js?v=31';",'lazy.js':'export const value=1;',
  'offline.js':"const RELEASE=new URL(import.meta.url).searchParams.get('v');import('./lazy.js?v='+RELEASE);",
  'assets/characters/motion.json':'{}',
  'scripts/build-offline.mjs':await read('scripts/build-offline.mjs'),
  'scripts/offline-worker.txt':await read('scripts/offline-worker.txt')
 };
 const run=async(check=false)=>{const args=process.argv;process.argv=[process.execPath,'build-offline.mjs',...(check?['--check']:[])];try{await import(pathToFileURL(join(dir,'scripts/build-offline.mjs')).href+'?run='+Math.random());}finally{process.argv=args;}};
 try{
  for(const folder of['vendor','assets/bestiary','assets/icons','assets/audio','assets/environment'])await mkdir(join(dir,folder),{recursive:true});
  for(const[path,text]of Object.entries(files)){await mkdir(dirname(join(dir,path)),{recursive:true});await writeFile(join(dir,path),text);}
  await assert.rejects(run(true),/Runtime resource version is stale: index.html/);
  assert.equal(await readFile(join(dir,'index.html'),'utf8'),files['index.html']);
  await run();
  const main=await readFile(join(dir,'main.js'),'utf8');assert(main.includes('./dep.js?v=182'));assert(main.includes('./lazy.js?v=182&mode=test'));assert(main.includes('https://example.test/file.js?v=4'));
  assert.equal(await readFile(join(dir,'offline.js'),'utf8'),files['offline.js'],'dynamic current-release import changed');
  assert.equal(await readFile(join(dir,'play.html'),'utf8'),await readFile(join(dir,'index.html'),'utf8'));
  await run(true);
  await writeFile(join(dir,'dep.js'),files['dep.js']);
  const before=await readFile(join(dir,'sw.js'),'utf8');
  await assert.rejects(run(true),/Runtime resource version is stale: dep.js/);
  assert.equal(await readFile(join(dir,'dep.js'),'utf8'),files['dep.js']);assert.equal(await readFile(join(dir,'sw.js'),'utf8'),before,'check rewrote the installed release');
 }finally{
  assert.equal(dirname(dir),tmpdir());assert(basename(dir).startsWith('forest-offline-'));await rm(dir,{recursive:true,force:true});
 }
});

test('all current local runtime dependency URLs match the strict current worker cache',async()=>{
 const source=await read('sw.js'),version=JSON.parse(source.match(/const VERSION=("[^"]+")/)[1]),files=JSON.parse(source.match(/FILES=(\[[^;]+?\]),BYTES=/)[1]),cached=new Set(files),base=new URL('https://example.test/game/');let checked=0;
 function check(specifier,owner){
  const url=new URL(specifier,new URL(owner,base));if(url.origin!==base.origin)return;
  const path=url.pathname.slice(base.pathname.length);assert(cached.has(path),owner+' references uncached '+specifier);
  if(/\.(?:js|css)$/.test(url.pathname)&&url.searchParams.has('v'))assert.equal(url.searchParams.get('v'),version,owner+' bypasses the strict worker: '+specifier);
  checked++;
 }
 for(const file of files.filter(f=>f.endsWith('.js'))){
  const text=await read(file);
  for(const match of text.matchAll(/(?:\bfrom\s*|\bimport\s*(?:\(\s*)?)["']([^"']+)["']/g)){
   if(!match[1].startsWith('.'))continue;
   // offline.js resolves its sole dynamic query from its own current release.
   const specifier=match[1].endsWith('?v=')?match[1]+version:match[1];check(specifier,file);
  }
 }
 for(const file of['index.html','play.html'])for(const match of(await read(file)).matchAll(/\b(?:src|href)=["']([^"']+\.(?:js|css)(?:\?[^"']*)?)["']/g))check(match[1],file);
 assert(checked>100,'runtime dependency traversal was unexpectedly empty');
});
