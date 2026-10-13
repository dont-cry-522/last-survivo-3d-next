import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createLoadingScreen} from '../loading-screen.js';

function fixture(){
 const document={body:{},activeElement:null},nodes=new Map();
 const element=id=>{
  const attrs=new Map(),styles=new Map(),e={id,ownerDocument:document,hidden:false,inert:false,disabled:false,textContent:'',dataset:{},isConnected:true,
   style:{setProperty:(k,v)=>styles.set(k,v),getPropertyValue:k=>styles.get(k)},setAttribute:(k,v)=>attrs.set(k,v),getAttribute:k=>attrs.get(k),removeAttribute:k=>attrs.delete(k),
   focus(){document.activeElement=e;},blur(){if(document.activeElement===e)document.activeElement=document.body;},closest(){return null;},getClientRects(){return [1];}};
  nodes.set(id,e);return e;
 };
 const root=element('asset-loading');for(const id of ['title','stage','detail','meter','percent'])element('asset-loading-'+id);element('asset-retry');
 root.querySelector=selector=>nodes.get(selector.slice(1));root.contains=e=>e===root||[...nodes.values()].filter(n=>n!==start).includes(e);
 const start=element('start');start.focus();return{root,start,nodes,document,screen:createLoadingScreen(root)};
}

test('the reusable loading layer displays only supplied progress and clears failure state on a new entry',()=>{
 const{root,nodes,screen,document}=fixture(),meter=nodes.get('asset-loading-meter'),percent=nodes.get('asset-loading-percent');
 screen.show({title:'踏入翡翠幽林',stage:'准备地表纹理',progress:12.4,detail:'载入已保存的资源'});
 assert(!root.hidden&&!root.inert);assert.equal(document.activeElement,root);assert.equal(percent.textContent,'12%');assert.equal(meter.getAttribute('aria-valuenow'),'12');
 screen.setLoadingProgress('准备人物',64);assert.equal(percent.textContent,'64%');assert.equal(meter.style.getPropertyValue('--loading-progress'),'64%');
 screen.setLoadingProgress('编译场景',null);assert.equal(percent.textContent,'准备中');assert.equal(meter.getAttribute('aria-valuenow'),undefined);assert.equal(meter.dataset.indeterminate,'true');
 screen.setLoadingProgress('最后检查',200);assert.equal(percent.textContent,'100%');screen.setLoadingProgress('重新准备',-1);assert.equal(percent.textContent,'0%');
 screen.fail('载入中断',()=>{});assert.equal(root.dataset.state,'error');assert.equal(document.activeElement,nodes.get('asset-retry'));
 screen.show({stage:'再次进入',progress:0});assert.equal(root.dataset.state,'loading');assert(nodes.get('asset-retry').hidden);assert.equal(nodes.get('asset-retry').onclick,null);assert.equal(nodes.get('asset-loading-stage').getAttribute('role'),'status');
});

test('hide immediately releases input and focus, and a later entry starts with no stale retry action',()=>{
 const{root,start,nodes,screen,document}=fixture();screen.show();let prevented=0;root.onkeydown({key:'Tab',preventDefault(){prevented++;}});assert.equal(prevented,1);assert.equal(document.activeElement,root);
 screen.fail('准备失败',()=>{});const retry=nodes.get('asset-retry');assert.equal(document.activeElement,retry);screen.hide();
 assert(root.hidden&&root.inert);assert.equal(root.getAttribute('aria-busy'),'false');assert(retry.hidden&&retry.disabled);assert.equal(retry.onclick,null);assert.equal(document.activeElement,start);
 root.onkeydown({key:'Tab',preventDefault(){prevented++;}});assert.equal(prevented,1);
 screen.show({progress:7});assert(!root.hidden&&!root.inert);assert.equal(nodes.get('asset-loading-percent').textContent,'7%');screen.hide();
});

test('retry handles one click, preserves a working failure button after rejection, and leaves success hidden',async()=>{
 const{root,nodes,screen}=fixture(),retry=nodes.get('asset-retry');let attempts=0,finish;
 screen.show();screen.fail('资源没有准备好',()=>{attempts++;return new Promise(resolve=>finish=resolve);});
 const click=retry.onclick,pending=click();await click();assert.equal(attempts,1);assert(retry.hidden);assert.equal(root.dataset.state,'loading');finish();await pending;
 screen.fail('重试失败',async()=>{attempts++;throw Error('network');});await retry.onclick();assert.equal(attempts,2);assert.equal(root.dataset.state,'error');assert(!retry.hidden&&!retry.disabled);assert.equal(typeof retry.onclick,'function');
 screen.fail('再试一次',()=>screen.hide());await retry.onclick();assert(root.hidden&&root.inert);assert.equal(retry.onclick,null);
});

test('the native overlay has accessible progress, touch spacing, reduced motion and a non-intercepting hidden rule',()=>{
 const html=readFileSync(new URL('../index.html',import.meta.url),'utf8'),css=readFileSync(new URL('../style.css',import.meta.url),'utf8'),source=readFileSync(new URL('../loading-screen.js',import.meta.url),'utf8');
 assert.match(html,/id="asset-loading-meter" role="progressbar"[^>]*aria-valuemin="0"[^>]*aria-valuemax="100"/);assert.match(html,/id="asset-loading-stage" role="status" aria-live="polite"/);
 assert.match(css,/#asset-loading\[hidden\]\{display:none!important;pointer-events:none\}/);assert.match(css,/@media\(prefers-reduced-motion:reduce\)\{#asset-loading/);assert.match(css,/#asset-retry\{[^}]*min-height:44px/);
 assert.doesNotMatch(source,/setInterval|setTimeout|requestAnimationFrame|WebGLRenderer/);
});
