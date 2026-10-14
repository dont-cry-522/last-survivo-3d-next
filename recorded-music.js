import{MUSIC_TRACKS}from'./music-tracks.js?v=194';

export const MUSIC_TRANSITIONS=Object.freeze({map:3.2,battle:1.15,recovery:4.2,resume:.45,borderHold:1.2,calmHold:9});
const FADE=MUSIC_TRANSITIONS.map;
export function softenLoopSeam(buffer){
 // Lossy decoding can reintroduce a one-sample step into pre-crossfaded loops.
 // Only repair discontinuous edges, leaving the musical phrase itself intact.
 if(!buffer.getChannelData)return buffer;
 let jump=0;for(let ch=0;ch<buffer.numberOfChannels;ch++){const data=buffer.getChannelData(ch);jump=Math.max(jump,Math.abs(data[0]-data.at(-1)));}
 if(jump<=.008)return buffer;
 const frames=Math.min(Math.floor(buffer.length/8),Math.round(buffer.sampleRate*.006));
 if(frames<2)return buffer;
 for(let ch=0;ch<buffer.numberOfChannels;ch++){
  const data=buffer.getChannelData(ch);for(let i=0;i<frames;i++){const gain=.5-.5*Math.cos(i/(frames-1)*Math.PI);data[i]*=gain;data[data.length-1-i]*=gain;}
 }
 return buffer;
}
const ramp=(param,value,time,duration=FADE,equalPower=false)=>{
 if(param.cancelAndHoldAtTime)param.cancelAndHoldAtTime(time);
 else{const held=param.value;param.cancelScheduledValues(time);param.setValueAtTime(held,time);}
 if(equalPower&&param.setValueCurveAtTime){
  const from=param.value,curve=Float32Array.from({length:33},(_,i)=>value===0?from*Math.cos(i/32*Math.PI/2):from+(value-from)*Math.sin(i/32*Math.PI/2));
  param.setValueCurveAtTime(curve,time,duration);
 }else param.linearRampToValueAtTime(value,time+duration);
};

export class RecordedMusic{
 constructor(context,bus,fallback,{tracks=MUSIC_TRACKS,fetcher=(...args)=>globalThis.fetch(...args)}={}){
  this.ctx=context;this.bus=bus;this.fallback=fallback;this.tracks=tracks;this.fetcher=fetcher;
  this.cache=new Map();this.offsets=new Map();this.failed=new Set();this.fading=new Set();
  this.current=null;this.loading=null;this.desired=null;this.paused=false;this.battle=false;this.hot=0;this.calm=0;
  this.region=null;this.regionCandidate=null;this.regionTime=0;this.resuming=false;
 }
 get active(){return !!this.current;}
 remember(voice){this.offsets.set(voice.key,(voice.offset+Math.max(0,this.ctx.currentTime-voice.started))%voice.buffer.duration);}
 retire(voice,duration=FADE){
  if(!voice)return;
  this.remember(voice);ramp(voice.gain.gain,0,this.ctx.currentTime,duration,true);
  this.fading.add(voice);voice.source.stop(this.ctx.currentTime+duration+.02);
 }
 start(key,buffer){
  if(this.current?.key===key||this.paused||this.desired!==key||this.ctx.state!=='running')return;
  const duration=this.resuming?MUSIC_TRANSITIONS.resume:key==='battle'?MUSIC_TRANSITIONS.battle:this.current?.key==='battle'?MUSIC_TRANSITIONS.recovery:FADE;
  this.resuming=false;
  // Rapid border crossings keep at most one outgoing recording alive.
  for(const voice of this.fading)voice.source.stop();
  this.retire(this.current,duration);
  const source=this.ctx.createBufferSource(),gain=this.ctx.createGain(),t=this.ctx.currentTime,offset=(this.offsets.get(key)||0)%buffer.duration;
  source.buffer=buffer;source.loop=true;source.connect(gain);gain.connect(this.bus);gain.gain.setValueAtTime(0,t);
  const voice={key,buffer,source,gain,offset,started:t};
  source.onended=()=>{source.disconnect();gain.disconnect();this.fading.delete(voice);if(this.current===voice)this.current=null;};
  this.current=voice;source.start(t,offset);ramp(gain.gain,this.tracks[key].gain,t,duration,true);ramp(this.fallback.gain,0,t,duration);
  this.cache.delete(key);this.cache.set(key,buffer);
  while(this.cache.size>2)this.cache.delete(this.cache.keys().next().value);
 }
 prepare(key){
  if(!key||this.failed.has(key)||this.loading?.key===key||this.current?.key===key)return;
  const saved=this.cache.get(key);if(saved){this.start(key,saved);return;}
  const controller=new AbortController(),load={key,controller,stage:'fetch'};this.loading=load;this.lastError=null;
  const timer=setTimeout(()=>{if(this.loading===load){load.timedOut=true;controller.abort();}},20000);
  load.promise=(async()=>{
   try{
    const response=await this.fetcher(new URL(this.tracks[key].file,import.meta.url),{signal:controller.signal});
    if(!response.ok)throw Error('Music load failed');
    load.stage='download';const bytes=await response.arrayBuffer();load.bytes=bytes.byteLength;load.stage='decode';
    const buffer=softenLoopSeam(await this.ctx.decodeAudioData(bytes));
    // Decoding may finish after a map change or pause. Never play that stale request.
    if(this.loading!==load||this.desired!==key)return;
    this.cache.delete(key);this.cache.set(key,buffer);
    while(this.cache.size>2)this.cache.delete(this.cache.keys().next().value);
    this.start(key,buffer);
   }catch(error){
    if(this.loading===load&&(error.name!=='AbortError'||load.timedOut)){
     this.lastError={key,message:load.timedOut?'load timed out':error.message,stage:load.stage};
     this.failed.add(key);this.retire(this.current);this.current=null;ramp(this.fallback.gain,1,this.ctx.currentTime);
    }
   }finally{clearTimeout(timer);if(this.loading===load)this.loading=null;}
  })();
 }
 update(dt,{map,mode,boss=false,pressure=0,seamless=false}){
  const paused=['paused','event-choice','lost','won'].includes(mode);
  if(paused){
   if(!this.paused){for(const voice of this.fading)voice.source.stop(this.ctx.currentTime+.08);this.retire(this.current,.08);this.current=null;}
   this.paused=true;return;
  }
  if(this.paused)this.resuming=true;this.paused=false;
  // Crossing a regional seam for a moment must not repeatedly restart/fetch songs.
  if(!seamless||mode==='menu'||!this.region){this.region=map;this.regionCandidate=null;this.regionTime=0;}
  else if(map!==this.region){
   if(this.regionCandidate!==map){this.regionCandidate=map;this.regionTime=0;}
   if(mode==='playing')this.regionTime+=Math.max(0,dt);
   if(this.regionTime>=MUSIC_TRANSITIONS.borderHold){this.region=map;this.regionCandidate=null;this.regionTime=0;}
  }else{this.regionCandidate=null;this.regionTime=0;}
  if(mode==='playing'){
   this.hot=pressure>.75?this.hot+dt:0;this.calm=!boss&&pressure<.45?this.calm+dt:0;
   if(boss||this.hot>=4)this.battle=true;
   if(this.calm>=MUSIC_TRANSITIONS.calmHold)this.battle=false;
  }else if(mode==='menu'){this.battle=false;this.hot=0;this.calm=0;}
  const key=this.battle?'battle':this.tracks[this.region]?this.region:null;
  if(key!==this.desired){
   this.resuming=false;
   this.desired=key;
   if(this.loading){this.loading.controller.abort();this.loading=null;}
   if(!key||this.failed.has(key)){const duration=this.current?.key==='battle'?MUSIC_TRANSITIONS.recovery:FADE;this.retire(this.current,duration);this.current=null;ramp(this.fallback.gain,1,this.ctx.currentTime,duration);}
  }
  this.prepare(key);
 }
 reset(){
  if(this.loading)this.loading.controller.abort();this.loading=null;this.desired=null;
  for(const voice of this.fading)voice.source.stop();this.fading.clear();
  if(this.current){this.current.source.stop();this.current=null;}
  this.offsets.clear();this.failed.clear();this.paused=false;this.battle=false;this.hot=0;this.calm=0;
  this.region=null;this.regionCandidate=null;this.regionTime=0;this.resuming=false;
  const t=this.ctx.currentTime;this.fallback.gain.cancelScheduledValues(t);this.fallback.gain.setValueAtTime(1,t);
 }
}
