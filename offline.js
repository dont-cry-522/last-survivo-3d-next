const RELEASE=new URL(import.meta.url).searchParams.get('v'),button=document.querySelector('#offline-download'),status=document.querySelector('#offline-status'),install=document.querySelector('#offline-install');
let registration,busy=false,installed=false,installPrompt,checking=false,exporting=false;
const observed=new WeakSet(),watched=new WeakSet(),summary=document.querySelector('#offline-panel summary');
function message(worker,type,timeout=15000){return new Promise((resolve,reject)=>{
 if(!worker){reject(Error('离线服务尚未就绪'));return;}
 const channel=new MessageChannel(),timer=setTimeout(()=>{channel.port1.close();reject(Error('离线检查超时，请重试'));},timeout);
 channel.port1.onmessage=e=>{clearTimeout(timer);channel.port1.close();resolve(e.data);};worker.postMessage({type,version:RELEASE},[channel.port2]);
});}
function show(text){status.textContent=text;}
function label(text='下载 / 离线'){if(summary)summary.textContent=text;}
function idle(){busy=false;button.disabled=false;button.textContent=installed?'检查更新 / 修复缓存':'保存到本浏览器';}
function networkWait(promise){let timer;return Promise.race([promise,new Promise((resolve,reject)=>{timer=setTimeout(()=>reject(Error('更新检查超时')),12000);})]).finally(()=>clearTimeout(timer));}
async function check(){
 if(registration?.waiting){
  const info=await message(registration.waiting,'STATUS');
  if(info.ready){busy=false;button.disabled=false;button.textContent='启用新版并重新打开';label('下载 / 离线 · 新版 v'+info.version);show('新版 v'+info.version+' 已完整下载。回到大厅后点击启用，游戏记录会保留。');return;}
 }
 if(registration?.installing){busy=true;button.disabled=true;button.textContent='正在准备新版离线资源';label('下载 / 离线 · 更新中');return;}
 label();
 if(registration?.active){
  const info=await message(registration.active,'STATUS');installed=info.ready;
  if(installed){show('离线资源已准备好 · v'+info.version+' · 全部角色、地图、图鉴和声音均可断网使用。');install.hidden=matchMedia('(display-mode: standalone)').matches;registration.active.postMessage({type:'CLEANUP',version:RELEASE});}
  else show('离线资源不完整，请联网下载或修复后再断网。');
 }
 idle();
}
function observe(worker){
 if(!worker||observed.has(worker))return;observed.add(worker);
 worker.addEventListener('statechange',()=>{
  if(worker.state==='activated'||worker.state==='installed')check().catch(error=>{show(error.message);idle();});
  if(worker.state==='redundant'){show('下载未完成，请保持联网后重试。已有离线版本和游戏记录会保留。');label();idle();}
 });
}
function watch(reg){
 registration=reg;if(!reg||watched.has(reg))return;watched.add(reg);
 observe(reg.installing);reg.addEventListener('updatefound',()=>{observe(reg.installing);check().catch(()=>{});});
}
async function checkInstalledUpdate(){
 if(!registration||!navigator.onLine||checking||registration.installing||registration.waiting)return;
 checking=true;
 try{
  await networkWait(registration.update());
  await check();
 }catch{
  if(!registration.installing&&!registration.waiting){show(installed?'更新检查暂未完成，已下载的版本仍可游玩；稍后可在这里重试。':'暂时无法检查更新，请联网后点击下载或修复资源。');idle();}
 }finally{checking=false;}
}
navigator.serviceWorker?.addEventListener('message',event=>{
 const data=event.data;if(data?.type!=='offline-progress')return;
 if(data.error){show(data.error);label();idle();return;}
 show(data.downloaded?'完整资源已下载，正在准备离线启动…':'正在下载离线资源 '+Math.round(data.done/data.total*100)+'% · '+data.done+'/'+data.total+' 项');
});
window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();installPrompt=event;if(installed)install.hidden=false;});
window.addEventListener('appinstalled',()=>{install.hidden=true;show('已添加到桌面。以后可从桌面图标断网启动。');});
install.onclick=async()=>{
 if(installPrompt){await installPrompt.prompt();await installPrompt.userChoice;installPrompt=null;}
 else show('请打开浏览器菜单，选择“安装应用”或“添加到主屏幕”。若没有此项，仍可用当前浏览器打开原网址离线玩。');
};
button.onclick=async()=>{
 if(exporting){show('请先等待离线包保存完成，或取消后再准备浏览器缓存。');return;}
 if(busy)return;
 if(!navigator.onLine&&installed&&!registration?.waiting){show('当前离线，已下载的版本可以直接游玩；需要更新时再联网。');return;}
 if(registration?.waiting){
  if(document.body.classList.contains('playing')){show('新版已准备好。请先结束本局并返回大厅，再启用更新。');return;}
  busy=true;button.disabled=true;
  navigator.serviceWorker.addEventListener('controllerchange',()=>{if(!document.body.classList.contains('playing'))location.reload();else{show('新版已启用。当前对局不会刷新，返回大厅后重新打开即可。');idle();}},{once:true});
  registration.waiting.postMessage({type:'ACTIVATE'});return;
 }
 busy=true;button.disabled=true;show('正在准备完整离线资源，请保持联网…');
 // Persistent storage is best-effort; its denial must not prevent offline play.
 navigator.storage?.persist?.().catch(()=>{});
 try{
  watch(await networkWait(navigator.serviceWorker.register('./sw.js',{scope:'./',updateViaCache:'none'})));
  if(registration.installing)return;
  if(registration.waiting){busy=false;await check();return;}
  await networkWait(registration.update());
  if(registration.installing)return;
  if(registration.active){const result=await message(registration.active,'REPAIR',180000);if(!result.ready)throw Error(result.error||'离线资源未下载完整');}
  await check();
 }catch(error){show('暂未完成离线准备。请检查网络或可用空间后重试。');idle();}
};
if(!('serviceWorker' in navigator)||!isSecureContext){button.disabled=true;show('当前浏览器不支持离线安装，请用支持此功能的浏览器打开 HTTPS 网址。');}
else navigator.serviceWorker.getRegistration('./').then(async reg=>{
 watch(reg);if(reg){await check();await checkInstalledUpdate();}
}).catch(()=>{show('暂时无法读取离线资源，仍可在线游玩；稍后点击下载重试。');});
window.addEventListener('online',()=>{checkInstalledUpdate();});

// Browser cache and a user-chosen disk package are separate operations.
const packageButton=document.querySelector('#offline-export'),packageStatus=document.querySelector('#offline-export-status'),packageCancel=document.querySelector('#offline-export-cancel'),packageLink=document.querySelector('#offline-export-link');
let packageController,packageURL;
if(packageButton){
 packageCancel.onclick=()=>packageController?.abort();
 packageButton.onclick=async()=>{
  if(exporting)return;if(busy){packageStatus.textContent='正在保存浏览器资源，请等待完成后再下载 ZIP。';return;}
  exporting=true;packageButton.disabled=true;packageController=new AbortController();packageCancel.hidden=false;packageLink.hidden=true;
  if(packageURL){URL.revokeObjectURL(packageURL);packageURL=null;}
  const filename='forest-echoes-next-v'+RELEASE+'.zip';
  try{
   // Open before import/fetch: a real click's activation is required.
   let handle=null;
   if(typeof window.showSaveFilePicker==='function'){
    packageStatus.textContent='请选择保存 ZIP 的文件夹。';
    try{handle=await window.showSaveFilePicker({suggestedName:filename,types:[{description:'完整离线游戏 ZIP',accept:{'application/zip':['.zip']}}]});}
    catch(error){if(error.name!=='SecurityError')throw error;}
   }
   packageController.signal.throwIfAborted();packageStatus.textContent=handle?'正在读取完整资源，完成后保存到你选择的位置…':'此浏览器不能选择文件夹，将使用浏览器下载；位置由浏览器设置决定。正在准备…';
   const {exportOfflinePackage}=await import('./offline-export.js?v='+RELEASE),blob=await exportOfflinePackage({release:RELEASE,handle,signal:packageController.signal,onProgress:({done,total,bytes,totalBytes})=>{packageStatus.textContent='正在准备 ZIP '+Math.round(bytes/totalBytes*100)+'% · '+done+'/'+total+' 项'+(handle?' · 保存到所选位置':' · 完成后由浏览器下载');}});
   if(blob){packageURL=URL.createObjectURL(blob);packageLink.href=packageURL;packageLink.download=filename;packageLink.hidden=false;packageLink.click();packageStatus.textContent='完整 ZIP 已交给浏览器下载；如果没有弹出下载，请点“保存 ZIP”。保存位置由浏览器设置决定。';}
   else packageStatus.textContent='完整 ZIP 已保存到你选择的位置。解压后双击 START_OFFLINE.cmd；需要本机已装 Python 3 或 Node.js。';
  }catch(error){packageStatus.textContent=error.name==='AbortError'?'已取消或下载超时，离线包未保存完整，可以重试。':'离线包未完成：'+error.message;}
  finally{exporting=false;packageButton.disabled=false;packageCancel.hidden=true;packageController=null;}
 };
 window.addEventListener('beforeunload',()=>{packageController?.abort();if(packageURL)URL.revokeObjectURL(packageURL);});
}

const offlinePanel=document.querySelector('#offline-panel'),audioPanel=document.querySelector('#audio-settings');
if(offlinePanel){
 offlinePanel.addEventListener('toggle',()=>{if(offlinePanel.open&&audioPanel)audioPanel.open=false;});
 audioPanel?.addEventListener('toggle',()=>{if(audioPanel.open)offlinePanel.open=false;});
 document.addEventListener('click',e=>{if(!offlinePanel.contains(e.target))offlinePanel.open=false;});
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&offlinePanel.open){offlinePanel.open=false;offlinePanel.querySelector('summary').focus();e.preventDefault();e.stopImmediatePropagation();}},true);
}
