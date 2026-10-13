// Progress comes only from completed loading/preparation work. There are no
// timers, fake percentage increments or extra rendering contexts in this UI.
export function createLoadingScreen(root=document.querySelector('#asset-loading')){
 const find=id=>root.querySelector('#'+id),title=find('asset-loading-title'),stage=find('asset-loading-stage'),detail=find('asset-loading-detail'),meter=find('asset-loading-meter'),percent=find('asset-loading-percent'),retry=find('asset-retry');
 let previousFocus=null;
 function setLoadingProgress(label,value,note){
  if(label!==undefined)stage.textContent=label;
  if(note!==undefined)detail.textContent=note;
  const known=Number.isFinite(value),progress=known?Math.round(Math.max(0,Math.min(100,value))):null;
  meter.dataset.indeterminate=String(!known);percent.textContent=known?progress+'%':'准备中';
  meter.style.setProperty('--loading-progress',known?progress+'%':'0%');
  if(known)meter.setAttribute('aria-valuenow',String(progress));else meter.removeAttribute('aria-valuenow');
  meter.setAttribute('aria-valuetext',stage.textContent+(known?'，'+progress+'%':'，进度待确认'));
 }
 function show({title:heading='循光而行',stage:label='正在准备远征…',detail:note='',progress=0}={}){
  const active=root.ownerDocument.activeElement;if(!root.contains(active)&&active!==root.ownerDocument.body)previousFocus=active;
  root.hidden=false;root.inert=false;root.dataset.state='loading';root.setAttribute('aria-busy','true');
  title.textContent=heading;stage.setAttribute('role','status');stage.setAttribute('aria-live','polite');retry.hidden=true;retry.disabled=false;retry.onclick=null;
  setLoadingProgress(label,progress,note);root.focus({preventScroll:true});
 }
 function hide(){
  const active=root.ownerDocument.activeElement;
  root.hidden=true;root.inert=true;root.dataset.state='hidden';root.setAttribute('aria-busy','false');retry.hidden=true;retry.disabled=true;retry.onclick=null;
  if(root.contains(active)){
   if(previousFocus?.isConnected&&!previousFocus.disabled&&!previousFocus.closest('[inert]')&&previousFocus.getClientRects().length)previousFocus.focus({preventScroll:true});
   else active?.blur();
  }
  previousFocus=null;
 }
 function fail(message,onRetry){
  if(root.hidden)show();root.dataset.state='error';root.setAttribute('aria-busy','false');stage.setAttribute('role','alert');stage.setAttribute('aria-live','assertive');stage.textContent=message;
  meter.setAttribute('aria-valuetext',message);retry.hidden=typeof onRetry!=='function';retry.disabled=false;
  retry.onclick=retry.hidden?null:async()=>{
   if(retry.disabled||root.hidden||root.dataset.state!=='error')return;retry.disabled=true;
   show({title:title.textContent,stage:'正在重新尝试…',progress:null});
   try{await onRetry();}catch{fail('重试未完成，请再试一次。',onRetry);}
  };
  if(!retry.hidden)retry.focus({preventScroll:true});
 }
 // Keep keyboard focus on the active loader/retry button; main owns the menu's
 // inert state and the paused game simulation during preparation.
 root.onkeydown=event=>{if(event.key!=='Tab'||root.hidden)return;event.preventDefault();(retry.hidden||retry.disabled?root:retry).focus({preventScroll:true});};
 return{show,setLoadingProgress,hide,fail};
}
