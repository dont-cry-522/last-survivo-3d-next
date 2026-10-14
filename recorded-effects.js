import{SFX_FILE,SFX_CUES}from'./material-sfx.js?v=193';

export class RecordedEffects{
 constructor(context,{file=SFX_FILE,cues=SFX_CUES,fetcher=(...args)=>globalThis.fetch(...args)}={}){
  this.ctx=context;this.file=file;this.cues=cues;this.fetcher=fetcher;
  this.buffer=null;this.loading=null;this.error=null;
 }
 prepare(){
  if(this.loading)return this.loading;
  if(this.buffer)return Promise.resolve(this.buffer);
  this.error=null;
  const controller=new AbortController();let timer;
  const timeout=new Promise((_,reject)=>{timer=setTimeout(()=>{reject(Error('Sound effects load timed out'));controller.abort();},12000);});
  const load=Promise.resolve().then(async()=>{
   const response=await this.fetcher(new URL(this.file,import.meta.url),{signal:controller.signal});
   if(!response.ok)throw Error('Sound effects load failed');
   return this.ctx.decodeAudioData(await response.arrayBuffer());
  });
  // Only the winning load may cache its result; a decode can outlive the timeout.
  this.loading=Promise.race([load,timeout]).then(buffer=>{
   if(!Number.isFinite(buffer?.duration)||buffer.duration<=0)throw Error('Invalid sound effects buffer');
   this.buffer=buffer;return buffer;
  }).catch(error=>{this.error=error;return null;}).finally(()=>{clearTimeout(timer);this.loading=null;});
  return this.loading;
 }
 count(key){return Object.hasOwn(this.cues,key)&&Array.isArray(this.cues[key])?this.cues[key].length:0;}
 get(key,take=0){
  const count=this.count(key);if(!this.buffer||!count||!Number.isFinite(take))return null;
  const cue=this.cues[key][((Math.trunc(take)%count)+count)%count];if(!cue)return null;
  const{offset,duration,gain=1}=cue;
  if(!Number.isFinite(offset)||offset<0||!Number.isFinite(duration)||duration<=0||
   offset>=this.buffer.duration||duration>this.buffer.duration-offset||!Number.isFinite(gain)||gain<0)return null;
  return{buffer:this.buffer,offset,duration,gain};
 }
}
