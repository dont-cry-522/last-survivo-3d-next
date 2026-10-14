import test from 'node:test';
import assert from 'node:assert/strict';
import {GameAudio} from '../audio.js';
import {CREATURE_FOLEY,creatureFoleySample,creatureSample} from '../enemy-audio.js';

const events=['step','wind','attack','impact','hurt','death'];
function harness(){
  const node=()=>({connections:[],connect(next){this.connections.push(next);},disconnect(){this.connections=[];}}),sources=[];
  const ctx={currentTime:1,state:'running',sampleRate:24000,
    createBuffer:(channels,length,rate)=>({duration:length/rate,sampleRate:rate,data:null,copyToChannel(data){this.data=data;}}),
    createGain:()=>({...node(),gain:{value:0}}),createStereoPanner:()=>({...node(),pan:{value:0}}),
    createBufferSource(){const source={...node(),playbackRate:{value:1},start(...args){this.startArgs=args;},stop(){this.onended?.();}};sources.push(source);return source;}};
  const audio=new GameAudio(ctx);audio.ready=true;audio.sfx=node();audio.muted=false;
  const pcm=Float32Array.from({length:24000},(_,i)=>Math.sin(i*.13)*.12),atlas={sampleRate:24000,getChannelData:()=>pcm};
  const cue={buffer:atlas,offset:.1,duration:.25,gain:.7};
  audio.materialEffects={get:()=>null,count:()=>2};
  return{audio,ctx,sources,cue,last:()=>sources.at(-1),end(){audio.stopCreatures();ctx.currentTime+=1;}};
}

test('five bounded creature articulations produce two finite cached takes at phone and desktop rates',()=>{
  for(const kind of Object.keys(CREATURE_FOLEY))for(const event of events)for(const rate of [22050,44100,48000]){
    const a=creatureFoleySample(kind,event,rate,0),b=creatureFoleySample(kind,event,rate,1);let power=0,peak=0;
    for(const sample of a){assert(Number.isFinite(sample),kind);power+=sample*sample;peak=Math.max(peak,Math.abs(sample));}
    assert(Math.sqrt(power/a.length)>.004,`${kind}/${event} inaudible`);assert(peak<.39,`${kind}/${event} clipped`);
    assert(a.length<rate&&a.length>.06*rate);assert(Math.abs(a[0])<.00001&&Math.abs(a.at(-1))<.0001,'click at sample boundary');
    assert.deepEqual(a,creatureFoleySample(kind,event,rate,2),'takes must remain a finite deterministic pair');
    if(event!=='step'||!['wolf','mushroom'].includes(kind))assert.notDeepEqual(a,b,'two identical takes');
  }
  for(const kind of ['wolf','mushroom'])assert.deepEqual(creatureFoleySample(kind,'step',22050),creatureSample(kind,'step',22050),'foot-contact cue changed');
  assert.deepEqual(creatureFoleySample('icewitch','wind',22050),creatureSample('icewitch','wind',22050),'unrelated voice changed');
});

test('recorded contact is mixed into one species buffer, with bounded takes and fallback eviction',()=>{
  const h=harness(),a=h.audio;
  for(let i=0;i<6;i++){assert(a.creature('mushroom','hurt'));h.end();}
  assert.equal(a.creatureBuffers.size,2);
  const generated=h.last().buffer.data;
  a.materialEffects.get=()=>h.cue;
  for(let i=0;i<6;i++){
    const count=h.sources.length;assert(a.creature('mushroom','hurt'));assert.equal(h.sources.length,count+1,'parallel layer bypassed voice cap');
    assert.equal(a.creatureSources.size,1);assert.equal(h.last().startArgs.length,0,'raw shared atlas replaced creature articulation');
    assert.equal(h.last().playbackRate.value,1,'new take gained a pitch-only variant');h.end();
  }
  assert.equal(a.creatureBuffers.size,2,'preload buffers retained after decoded atlas arrived');
  assert([...a.creatureBuffers.keys()].every(k=>k.endsWith(':recorded')));
  assert.notDeepEqual(h.last().buffer.data,generated);assert.equal(a.nodes,0);assert.equal(a.creatureSources.size,0);
  assert(h.sources.every(s=>s.connections.length===0),'sources retained nodes after end');
});

test('legacy stays byte-identical; modern variants keep the existing distance, mute and priority limits',()=>{
  const h=harness(),a=h.audio;a.materialEffects.get=()=>h.cue;
  a.setSfxStyle('legacy',{persist:false});assert(a.creature('golem','hurt'));
  assert.deepEqual(h.last().buffer.data,creatureSample('golem','hurt',h.ctx.sampleRate));assert.equal(h.last().startArgs.length,0);h.end();
  a.setSfxStyle('standard',{persist:false});
  assert.equal(a.creature('wolf','wind',30,0),false);assert.equal(a.creature('wolf','step',8,0),false);
  a.muted=true;assert.equal(a.creature('wolf','attack'),false);a.muted=false;
  h.ctx.state='suspended';assert.equal(a.creature('wolf','attack'),false);h.ctx.state='running';
  assert(a.creature('wolf','step'));assert.equal(a.creature('golem','step'),false,'global contact gate removed');h.end();
  for(let i=0;i<4;i++){assert(a.creature('wolf','attack'));h.ctx.currentTime+=.2;}
  assert.equal(a.creature('golem','hurt'),false);assert(a.creature('golem','wind'),'warnings lost reserved slots');
  for(let i=0;i<5;i++){h.ctx.currentTime+=.2;assert(a.creature('wolf','attack'));}
  h.ctx.currentTime+=1;assert.equal(a.creature('golem','wind'),false,'10-source cap removed');
  a.reset('snow');assert.equal(a.nodes,0);assert.equal(a.creatureSources.size,0);assert.equal(a.cooldowns.size,0);
});

test('hot profile switching reuses separate old/new buffers and does not bring generated fallback back after atlas loading',()=>{
  const h=harness(),a=h.audio,kind='golem',event='hurt';
  for(let i=0;i<2;i++){assert(a.creature(kind,event));h.end();}
  assert.equal(a.creatureBuffers.size,2);
  a.materialEffects.get=()=>h.cue;
  for(let i=0;i<2;i++){assert(a.creature(kind,event));h.end();}
  const modern=a.creatureBuffers.get('foley:golem:hurt:0:recorded');assert(modern);
  assert([...a.creatureBuffers.keys()].every(k=>k.endsWith(':recorded')));
  let legacy;
  for(let turn=0;turn<4;turn++){
    a.setSfxStyle('legacy',{persist:false});assert(a.creature(kind,event));
    const old=h.last();assert.deepEqual(old.buffer.data,creatureSample(kind,event,h.ctx.sampleRate));
    assert.notEqual(old.buffer,modern);assert.equal(old.startArgs.length,0,'legacy unexpectedly played the recorded atlas');
    if(legacy)assert.equal(old.buffer,legacy,'legacy buffer rebuilt on each profile switch');else legacy=old.buffer;
    h.end();a.setSfxStyle('standard',{persist:false});assert(a.creature(kind,event));
    assert.equal(h.last().buffer,modern,'modern take was contaminated by the legacy cache');h.end();
  }
  assert.equal(a.creatureBuffers.size,3,'profile switching retained duplicate or superseded buffers');
  assert.equal(a.nodes,0);assert.equal(a.creatureSources.size,0);
});

test('material contact cannot erase the distinct species voice or introduce an abrupt cut',()=>{
  const h=harness();
  for(const kind of ['mushroom','tidecrab','golem','jellyseer']){
    const plain=creatureFoleySample(kind,'hurt',24000,0),mixed=creatureFoleySample(kind,'hurt',24000,0,h.cue);
    assert.notDeepEqual(plain,mixed);assert.equal(mixed.length,plain.length);
    assert(Math.abs(mixed[0])<.00001&&Math.abs(mixed.at(-1))<.0001);
    assert(mixed.every(v=>Number.isFinite(v)&&Math.abs(v)<.39));
  }
});
