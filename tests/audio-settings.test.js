import test from 'node:test';
import assert from 'node:assert/strict';
import {GameAudio,SFX_STYLES} from '../audio.js';

function storage(t,initial){
  const previous=Object.getOwnPropertyDescriptor(globalThis,'localStorage');
  const data=new Map(initial===undefined?[]:[['forest3d-next-audio',JSON.stringify(initial)]]);
  const writes=[];
  Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{
    getItem:key=>data.get(key)??null,
    setItem(key,value){writes.push(key);data.set(key,String(value));}
  }});
  t.after(()=>{if(previous)Object.defineProperty(globalThis,'localStorage',previous);else delete globalThis.localStorage;});
  return{data,writes};
}

function harness(){
  const node=()=>({connections:[],connect(next){this.connections.push(next);},disconnect(){this.connections=[];}});
  const sources=[],ctx={currentTime:1,state:'running',sampleRate:22050,
    createBuffer:(channels,length,rate)=>({duration:length/rate,copyToChannel(){}}),
    createGain:()=>({...node(),gain:{value:0,setValueAtTime(){},linearRampToValueAtTime(){}}}),
    createStereoPanner:()=>({...node(),pan:{value:0}}),
    createBufferSource(){const source={...node(),playbackRate:{value:1},start(...args){this.startArgs=args;},stop(){this.stops=(this.stops||0)+1;this.onended?.();}};sources.push(source);return source;}
  };
  const audio=new GameAudio(ctx);audio.ready=true;audio.sfx=node();audio.weaponTone=node();
  const atlas={duration:2},cue={buffer:atlas,offset:.2,duration:.15,gain:.8};
  audio.materialEffects={buffer:atlas,get:()=>cue,count:()=>2};
  return{audio,sources,atlas,cue,last:()=>sources.at(-1),gain:()=>sources.at(-1).connections[0].gain.value};
}

test('old volume preferences migrate to the current sound without changing saved progress',t=>{
  const h=storage(t,{muted:true,music:.23,sfx:.57}),audio=new GameAudio();
  h.data.set('forest3d-next-progress','existing progress');h.data.set('forest3d-audio','original game preferences');
  assert.equal(audio.sfxStyle,'standard');assert.equal(audio.muted,true);
  assert.equal(audio.musicVolume,.23);assert.equal(audio.sfxVolume,.57);assert.equal(h.writes.length,0);
  audio.setSfxStyle('legacy');
  assert.deepEqual(JSON.parse(h.data.get('forest3d-next-audio')),{muted:true,music:.23,sfx:.57,sfxStyle:'legacy'});
  assert.equal(h.data.get('forest3d-next-progress'),'existing progress');assert.deepEqual(h.writes,['forest3d-next-audio']);
  assert.equal(h.data.get('forest3d-audio'),'original game preferences');
  const reloaded=new GameAudio();assert.equal(reloaded.sfxStyle,'legacy');assert.equal(reloaded.musicVolume,.23);
  reloaded.setVolume('music',.36);assert.equal(new GameAudio().sfxStyle,'legacy');
});

test('all four sound versions persist, transient auditions do not, and invalid saved values fall back',t=>{
  const h=storage(t);assert.deepEqual(Object.keys(SFX_STYLES).sort(),['legacy','lightAttack','lightImpact','standard'].sort());
  const audio=new GameAudio();
  for(const style of Object.keys(SFX_STYLES)){audio.setSfxStyle(style);assert.equal(new GameAudio().sfxStyle,style);}
  const saved=h.data.get('forest3d-next-audio'),writes=h.writes.length;
  audio.setSfxStyle('legacy',{persist:false});assert.equal(audio.sfxStyle,'legacy');
  assert.equal(h.data.get('forest3d-next-audio'),saved);assert.equal(h.writes.length,writes);
  for(const invalid of ['removed-version','__proto__','constructor',null,7]){
    h.data.set('forest3d-next-audio',JSON.stringify({music:.4,sfx:.6,sfxStyle:invalid}));
    assert.equal(new GameAudio().sfxStyle,'standard');
    audio.setSfxStyle(invalid,{persist:false});assert.equal(audio.sfxStyle,'standard');
  }
});

test('blocked storage and malformed preferences never prevent selecting a sound version',t=>{
  const h=storage(t);h.data.set('forest3d-next-audio','{broken');
  assert.equal(new GameAudio().sfxStyle,'standard');
  globalThis.localStorage.getItem=()=>{throw Error('unavailable');};
  globalThis.localStorage.setItem=()=>{throw Error('quota');};
  const audio=new GameAudio();assert.doesNotThrow(()=>audio.setSfxStyle('legacy'));assert.equal(audio.sfxStyle,'legacy');
});

test('changing version releases active effects, keeps music and caches, and survives a new run',t=>{
  storage(t);const h=harness(),{audio}=h;
  assert(audio.weapon('crossbow','shot'));assert(audio.creature('golem','hurt'));
  const active=[...audio.weaponSources,...audio.creatureSources];
  const music={stop(){assert.fail('Changing effects must not stop music');}};
  const level={levelCue:true,stop(){assert.fail('Changing effects must not cut the upgrade cue');}};
  const synth={stop(){this.stopped=true;audio.proceduralSources.delete(this);}};
  audio.musicVoices.add(music);audio.proceduralSources.add(music);audio.proceduralSources.add(synth);audio.proceduralSources.add(level);
  audio.cooldowns.set('shot',2);
  const recorded=audio.recorded={reset(){assert.fail('Changing effects must not reset recorded music');}};
  audio.setSfxStyle('standard',{persist:false});assert(active.every(source=>!source.stops),'Reselecting the current version must not interrupt it');
  audio.setSfxStyle('legacy',{persist:false});
  assert(active.every(source=>source.stops===1));assert(synth.stopped);
  assert.equal(audio.weaponSources.size,0);assert.equal(audio.creatureSources.size,0);assert.equal(audio.nodes,0);
  assert(audio.proceduralSources.has(music)&&audio.proceduralSources.has(level));assert.equal(audio.cooldowns.get('shot'),2);
  assert.equal(audio.recorded,recorded);assert.equal(audio.materialEffects.buffer,h.atlas);
  audio.musicVoices.clear();audio.proceduralSources.clear();audio.recorded=null;
  audio.reset('snow');assert.equal(audio.sfxStyle,'legacy');assert.equal(audio.materialEffects.buffer,h.atlas);
});

test('real weapon and creature source gains implement the mix once without changing pitch or cue',t=>{
  storage(t);t.mock.method(Math,'random',()=>.5);
  const profiles={standard:{shot:1,mechanism:1,impact:1,hurt:1},lightAttack:{shot:.75,mechanism:.35,impact:1,hurt:1},lightImpact:{shot:1,mechanism:1,impact:.65,hurt:.35}};
  const baseline={};
  for(const[style,multipliers]of Object.entries(profiles)){
    const h=harness(),{audio}=h;audio.setSfxStyle(style,{persist:false});
    for(const event of ['shot','mechanism','impact']){
      assert(audio.weapon('crossbow',event));
      assert.equal(h.last().buffer,h.atlas);assert.equal(h.last().playbackRate.value,1);
      assert.deepEqual(h.last().startArgs,[0,h.cue.offset,h.cue.duration]);
      if(style==='standard')baseline[event]=h.gain();
      assert(Math.abs(h.gain()-baseline[event]*multipliers[event])<1e-12,style+' '+event);
      audio.stopWeapons();
    }
    assert(audio.creature('golem','hurt'));if(style==='standard')baseline.hurt=h.gain();
    assert(Math.abs(h.gain()-baseline.hurt*multipliers.hurt)<1e-12,style+' hurt');audio.stopCreatures();
    audio.cooldowns.clear();assert(audio.creature('golem','wind'));if(style==='standard')baseline.warning=h.gain();
    assert.equal(h.gain(),baseline.warning,'Danger warnings must remain unchanged');audio.stopCreatures();
  }
});

test('legacy uses cached procedural weapons and creatures even after the material atlas loads',t=>{
  storage(t);const h=harness(),{audio}=h;
  audio.setSfxStyle('legacy',{persist:false});assert.equal(audio.materialCue('crossbow:shot'),null);
  assert(audio.weapon('crossbow','shot'));assert.notEqual(h.last().buffer,h.atlas);
  assert.deepEqual(h.last().startArgs,[]);assert.equal(h.last().connections[0].connections[0].connections[0],audio.weaponTone);
  assert(audio.creature('golem','hurt'));assert.notEqual(h.last().buffer,h.atlas);assert.deepEqual(h.last().startArgs,[]);
  audio.setSfxStyle('standard',{persist:false});assert.equal(audio.materialCue('crossbow:shot'),h.cue);
  assert(audio.weapon('crossbow','shot'));assert.equal(h.last().buffer,h.atlas);
  audio.stopWeapons();audio.stopCreatures();
});

test('legacy spell, hero skill, water and dodge events take their original procedural branches',t=>{
  storage(t);const h=harness(),{audio}=h,calls=[];
  audio.allow=()=>true;audio.voice=(...args)=>calls.push(['voice',...args]);audio.noise=(...args)=>calls.push(['noise',...args]);
  audio.weapon=(...args)=>calls.push(['weapon',...args]);
  for(const trigger of [()=>audio.spell('ice'),()=>audio.skill('rain'),()=>audio.water(true),()=>audio.dodge('silver')]){
    audio.setSfxStyle('legacy',{persist:false});calls.length=0;trigger();
    assert(calls.length>0);assert(calls.every(call=>call[0]!=='weapon'),'Legacy dispatched a recorded effect');
    audio.setSfxStyle('standard',{persist:false});calls.length=0;trigger();
    assert.equal(calls.length,1);assert.equal(calls[0][0],'weapon');
  }
});
