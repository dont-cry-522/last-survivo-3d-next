import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import vm from 'node:vm';
const template=readFileSync(new URL('../scripts/offline-worker.txt',import.meta.url),'utf8');
function harness({fail=false}={}){
 const handlers={},stores=new Map(),fetched=[],scope='https://example.test/game/',timeouts=[];let broken=fail,navigation='online';
 const cacheApi={async open(name){if(!stores.has(name))stores.set(name,new Map());const data=stores.get(name);return {
  async keys(){return [...data.keys()].map(url=>({url}));},async match(url){return data.get(String(url))?.clone();},async put(url,response){data.set(String(url),response.clone());}
 };},async keys(){return [...stores.keys()];},async delete(name){return stores.delete(name);}};
 const sandbox={URL,Response,AbortController,setTimeout:(fn,ms)=>{timeouts.push(ms);return setTimeout(fn,ms===3500?5:ms);},clearTimeout,caches:cacheApi,
  fetch:async(input,options)=>{
   const url=input.url||String(input);fetched.push(url);
   if(input.mode==='navigate'){
    if(navigation==='offline')throw Error('disconnected');
    if(navigation==='slow')return new Promise((resolve,reject)=>options.signal.addEventListener('abort',()=>reject(Error('timeout'))));
    return new Response('new online page',{status:navigation==='error'?503:200,headers:{'content-type':'text/html'}});
   }
   if(broken&&url.includes('main.js'))throw Error('interrupted');return new Response('resource',{status:200,headers:{'content-type':/\/(?:index|play)\.html$/.test(url)?'text/html':'text/javascript'}});
  },
  self:{location:{href:scope+'sw.js'},clients:{async matchAll(){return [];},async claim(){}},async skipWaiting(){sandbox.activated=true;},addEventListener(type,fn){handlers[type]=fn;}}
 };
 vm.runInNewContext(template.replace('__VERSION__','"77"').replace('__BUILD__','"77-test"').replace('__FILES__','["index.html","play.html","main.js","assets/model.bin"] ').replace('__BYTES__','123'),sandbox);
 return {handlers,stores,fetched,scope,timeouts,network(value){navigation=value;},fix(){broken=false;},async install(){let promise;handlers.install({waitUntil:p=>promise=p});await promise;},async status(){let promise,result;handlers.message({data:{type:'STATUS'},ports:[{postMessage:r=>result=r}],waitUntil:p=>promise=p});await promise;return result;},async request(path,mode){let response;handlers.fetch({request:{url:scope+path,method:'GET',mode},respondWith:r=>response=r});return response&&await response;}};
}
test('offline resource list is reproducible and includes compressed and fallback character assets',()=>{
 const result=spawnSync(process.execPath,['scripts/build-offline.mjs','--check'],{cwd:new URL('../',import.meta.url),encoding:'utf8'});assert.equal(result.status,0,result.stderr);
 const sw=readFileSync(new URL('../sw.js',import.meta.url),'utf8');assert(sw.includes('tide-outfit.bin'));assert(sw.includes('motion-e416bf7efde8.json'));assert(sw.includes('assets/bestiary/tidecrab.png'));assert(sw.includes('offline.js'));assert(!sw.includes('undefined/'));
 assert(sw.includes('play.html'));assert.equal(readFileSync(new URL('../play.html',import.meta.url),'utf8').replace(/\r\n/g,'\n'),readFileSync(new URL('../index.html',import.meta.url),'utf8').replace(/\r\n/g,'\n'));
 const manifest=JSON.parse(readFileSync(new URL('../manifest.webmanifest',import.meta.url)));assert.equal(manifest.scope,'./');assert.equal(manifest.start_url,'./');assert.equal(manifest.display,'standalone');
});
test('incomplete installation cannot report ready or replace an existing offline release',async()=>{
 const h=harness({fail:true});h.stores.set('forest3d-offline:/game/:76-old',new Map());h.stores.set('other-game',new Map());
 await assert.rejects(h.install());assert(h.stores.has('forest3d-offline:/game/:76-old'));assert(h.stores.has('other-game'));assert(!h.stores.has('forest3d-offline:/game/:77-test'));
 assert.equal((await h.status()).ready,false);h.fix();await h.install();assert.equal((await h.status()).ready,true);
});
test('online navigation prefers the current page, while current modules stay cached and future modules never get stale code',async()=>{
 const h=harness();await h.install();h.fetched.length=0;
 for(const path of ['?v=999','index.html','play.html?v=999'])assert.equal(await (await h.request(path,'navigate')).text(),'new online page');
 assert.equal(h.fetched.length,3);h.fetched.length=0;assert.equal(await (await h.request('main.js?v=77','cors')).text(),'resource');assert.equal(h.fetched.length,0);
 assert.equal(await h.request('main.js?v=78','cors'),undefined);assert.equal(await h.request('unknown','navigate'),undefined);
 assert.equal(await h.request('assets/model.bin?offline-export=78-test','cors'),undefined,'disk export must reach the requested release instead of an old cached asset');
 assert.equal(await (await h.request('assets/model.bin?v=42','cors')).text(),'resource');assert.equal(h.fetched.length,0);
 const data=h.stores.get('forest3d-offline:/game/:77-test');data.delete(h.scope+'assets/model.bin');assert.equal((await h.status()).ready,false);
});

test('disconnected, failing and slow navigation fall back to the intact installed release without caching newer HTML',async()=>{
 const h=harness();await h.install();
 await h.request('play.html?v=999','navigate');
 for(const state of ['offline','error','slow']){
  h.network(state);for(const path of ['','index.html','play.html'])assert.equal(await (await h.request(path,'navigate')).text(),'resource');
 }
 assert(h.timeouts.includes(3500),'navigation has no bounded network deadline');
 h.stores.get('forest3d-offline:/game/:77-test').delete(h.scope+'main.js');h.network('offline');await assert.rejects(h.request('','navigate'),'incomplete cache was treated as a complete release');
});

test('the actual v109 worker pins versioned home URLs but lets the new play entry reach the network',async()=>{
 // Verbatim fetch handler from 92b44491e8056c71798e7bcab069f5e39c05a4f0,
 // scripts/offline-worker.txt. Keep this historical fixture fixed: reading HEAD
 // at test time would silently switch it to the new worker after this release.
 const legacyFetch=String.raw`self.addEventListener('fetch',event=>{
 const request=event.request,url=new URL(request.url);
 if(request.method!=='GET'||url.origin!==BASE.origin||!url.pathname.startsWith(BASE.pathname))return;
 if(request.mode==='navigate'&&(url.pathname===BASE.pathname||url.pathname===BASE.pathname+'index.html')){
  event.respondWith((async()=>{
   const cache=await caches.open(CACHE),saved=await cache.match(new URL('index.html',BASE));
   // Launch directly from the installed version. Updating is an explicit menu action.
   return saved||fetch(request);
  })());return;
 }
 const canonical=new URL(url.pathname,BASE.origin).href;
 if(!allowed.has(canonical)||(/\.(?:js|css)$/.test(url.pathname)&&url.searchParams.has('v')&&url.searchParams.get('v')!==VERSION))return;
 event.respondWith((async()=>{const cache=await caches.open(CACHE);return await cache.match(canonical)||fetch(request);})());
});`;
 const base=new URL('https://example.test/game/');let handler,responds=0,network=0;
 vm.runInNewContext(legacyFetch,{URL,BASE:base,VERSION:'109',CACHE:'installed-v109',allowed:new Set(['index.html','main.js'].map(path=>new URL(path,base).href)),
  caches:{async open(){return{async match(url){return String(url)===new URL('index.html',base).href?new Response('old installed v109 page'):undefined;}};}},
  fetch:async()=>{network++;return new Response('fresh page');},self:{addEventListener(type,callback){assert.equal(type,'fetch');handler=callback;}}
 });
 const request=async path=>{let response;handler({request:{url:new URL(path,base).href,method:'GET',mode:'navigate'},respondWith(value){responds++;response=value;}});return response&&await response;};
 assert.equal(await (await request('?v=114')).text(),'old installed v109 page');assert.equal(responds,1);assert.equal(network,0);
 assert.equal(await request('play.html?v=114'),undefined,'old worker intercepts the fresh entry');assert.equal(responds,1,'play entry called respondWith');assert.equal(network,0,'unhandled navigation should be left to the browser');
});

function pageHarness({registered=true,online=true,waiting=false,updateFailure=false,picker}={}){
 const nodes=new Map(),events={},serviceEvents={},messages=[],calls={register:0,update:0,reload:0},body={playing:false};
 const element=id=>{if(!nodes.has(id))nodes.set(id,{textContent:'',hidden:true,disabled:false,addEventListener(){},contains(){return false;},querySelector(){return element('summary');},focus(){}});return nodes.get(id);};
 const worker=version=>({addEventListener(){},postMessage(data,ports){messages.push(data.type);if(data.type==='STATUS'||data.type==='REPAIR')ports[0].postMessage({ready:true,version});if(data.type==='ACTIVATE')for(const callback of serviceEvents.controllerchange||[])callback();}});
 const reg={active:worker('110'),waiting:waiting?worker('111'):null,installing:null,addEventListener(){},async update(){calls.update++;if(updateFailure)throw Error('offline');}};
 const sandbox={URL,WeakSet,AbortController,setTimeout,clearTimeout,isSecureContext:true,matchMedia:()=>({matches:false}),
  MessageChannel:class{constructor(){this.port1={close(){}};this.port2={postMessage:data=>queueMicrotask(()=>this.port1.onmessage?.({data}))};}},
  document:{querySelector:element,body:{classList:{contains:()=>body.playing}},addEventListener(){}},
  navigator:{onLine:online,storage:{persist:async()=>true},serviceWorker:{async getRegistration(){return registered?reg:undefined;},async register(){calls.register++;return reg;},addEventListener:(type,fn)=>(serviceEvents[type]??=[]).push(fn)}},
  window:{showSaveFilePicker:picker,addEventListener:(type,fn)=>(events[type]??=[]).push(fn)},location:{reload(){calls.reload++;}},
  localStorage:{clear(){throw Error('must never erase player saves');},removeItem(){throw Error('must never erase player saves');}}
 };
 const source=readFileSync(new URL('../offline.js',import.meta.url),'utf8').replaceAll('import.meta.url',JSON.stringify('https://example.test/game/offline.js?v=114'));
 vm.runInNewContext(source,sandbox);
 return{nodes,calls,messages,body,async settle(){for(let i=0;i<5;i++)await new Promise(resolve=>setImmediate(resolve));},online(){sandbox.navigator.onLine=true;for(const callback of events.online||[])callback();},click:()=>element('#offline-download').onclick(),export:()=>element('#offline-export').onclick()};
}

test('only an existing online installation is checked automatically; first download stays manual',async()=>{
 const first=pageHarness({registered:false});await first.settle();first.online();await first.settle();assert.equal(first.calls.update,0);assert.equal(first.calls.register,0);
 await first.click();await first.settle();assert.equal(first.calls.register,1);assert.equal(first.calls.update,1);
 const existing=pageHarness();await existing.settle();assert.equal(existing.calls.update,1);assert.equal(existing.calls.register,0);assert.equal(existing.calls.reload,0);
 const offline=pageHarness({online:false});await offline.settle();assert.equal(offline.calls.update,0);offline.online();await offline.settle();assert.equal(offline.calls.update,1);
 const failed=pageHarness({updateFailure:true});await failed.settle();assert.match(failed.nodes.get('#offline-status').textContent,/仍可游玩/);assert.equal(failed.calls.reload,0);
});

test('a downloaded update is visible in the existing menu and never reloads an ongoing run',async()=>{
 const h=pageHarness({waiting:true});await h.settle();assert.match(h.nodes.get('#offline-panel summary').textContent,/新版 v111/);assert.equal(h.calls.update,0);assert.equal(h.calls.reload,0);
 h.body.playing=true;await h.click();assert(!h.messages.includes('ACTIVATE'));assert.equal(h.calls.reload,0);assert.match(h.nodes.get('#offline-status').textContent,/返回大厅/);
 h.body.playing=false;await h.click();assert(h.messages.includes('ACTIVATE'));assert.equal(h.calls.reload,1);
});

test('canceling the native save picker restores controls without beginning a package download',async()=>{
 let selected=0;const h=pageHarness({registered:false,picker:async()=>{selected++;throw new DOMException('Canceled','AbortError');}});await h.settle();await h.export();assert.equal(selected,1);assert.equal(h.nodes.get('#offline-export').disabled,false);assert.equal(h.nodes.get('#offline-export-cancel').hidden,true);assert.equal(h.nodes.get('#offline-export-link').hidden,true);assert.match(h.nodes.get('#offline-export-status').textContent,/已取消/);assert.equal(h.calls.register,0);
});
