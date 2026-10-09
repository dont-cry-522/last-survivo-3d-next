import{BIOME_THEMES,instrumentSample,scoreBiome,biomeThreat}from'./biome-music.js?v=114';
import{companionSample}from'./companion-audio.js?v=114';
import{weaponSample,weaponTakeCount}from'./weapon-audio.js?v=114';
import{creatureSample,creatureSpatial,ENEMY_VOICES}from'./enemy-audio.js?v=114';
import{RecordedMusic}from'./recorded-music.js?v=114';
import{RecordedEffects}from'./recorded-effects.js?v=114';
// Local licensed recordings, with the original procedural score as a loading/offline fallback.
const midi=n=>440*2**((n-69)/12);
// Sound preferences only: attack timing, damage and music keep their existing behavior.
export const SFX_STYLES=Object.freeze({
  standard:{label:'当前原版',description:'保留当前的出手、装填与命中声音。',material:true,shot:1,mechanism:1,impact:1,hurt:1},
  lightAttack:{label:'轻出手版',description:'减轻出手与装填声音，保留命中的分量。',material:true,shot:.75,mechanism:.35,impact:1,hurt:1},
  lightImpact:{label:'轻命中版',description:'减轻命中与怪物受击声，突出武器出手。',material:true,shot:1,mechanism:1,impact:.65,hurt:.35},
  legacy:{label:'早期合成版',description:'使用材质录音加入前的合成音效。',material:false,shot:1,mechanism:1,impact:1,hurt:1}
});
const soundStyle=value=>Object.hasOwn(SFX_STYLES,value)?value:'standard';
// Contact belongs to the target on the isometric ground plane, not to the camera.
export function contactSpatial(dx=0,dz=0){return{gain:1/(1+Math.hypot(dx,dz)*.075),pan:Math.max(-.7,Math.min(.7,(dx-dz)/20))};}
// Related abilities retain their hero's material instead of falling back to a shared chirp.
const SKILL_MATERIALS={mineSet:['rifle','mechanism',.65],mineBlast:['spell','fire',.8],volley:['rifle','shot',.75],counter:['rifle','impact',.8],rainAim:['crossbow','mechanism',.65],rain:['crossbow','shot',.7],trailSet:['shuriken','mechanism',.5],pursuit:['crossbow','mechanism',.65],echo:['shade','shot',.75],echoHit:['shade','impact',.7],soul:['dark','mechanism',.65],spikes:['shadowblade','impact',.85],surge:['harpoon','shot',.8],brine:['motion','water',.65],wake:['motion','water',.25],briarSet:['boomerang','mechanism',.55],briar:['boomerang','impact',.7]};
const THEMES={...BIOME_THEMES,
  forest:{bpm:104,root:57,chords:[0,5,3,7],lead:[12,0,19,17,15,0,12,10,12,15,19,0,22,19,17,0,15,0,12,10,7,10,12,0,15,17,19,15,12,10,7,0]},
  snow:{bpm:90,root:62,chords:[0,3,5,7],lead:[19,0,22,0,24,22,19,0,17,0,15,17,19,0,12,0,15,0,19,0,22,19,17,15,12,0,10,12,15,0,17,0]},
  ash:{bpm:116,root:50,chords:[0,0,5,7],lead:[12,7,12,0,15,12,17,15,12,0,10,7,10,12,15,0,19,17,15,12,17,15,12,10,7,10,12,15,12,0,7,0]}
};
export class GameAudio{
  constructor(context=null){
    this.ctx=context;this.ready=false;this.muted=false;this.musicVolume=.65;this.sfxVolume=.8;this.sfxStyle='standard';
    this.musicBuffers=new Map();this.musicSources=new Set();this.musicVoices=new Set();this.beat=0;this.next=0;this.map='forest';this.pressure=0;this.mode='menu';this.cooldowns=new Map();this.nodes=0;this.proceduralSources=new Set();this.weaponBuffers=new Map();this.weaponTakes=new Map();this.weaponSources=new Set();this.creatureBuffers=new Map();this.creatureSources=new Set();
    try{const v=JSON.parse(localStorage.getItem('forest3d-next-audio')||'null');if(v){this.muted=!!v.muted;this.musicVolume=this.clamp(v.music,.65);this.sfxVolume=this.clamp(v.sfx,.8);this.sfxStyle=soundStyle(v.sfxStyle);}}catch{}
  }
  clamp(n,f){return Number.isFinite(n)?Math.max(0,Math.min(1,n)):f;}
  save(){try{localStorage.setItem('forest3d-next-audio',JSON.stringify({muted:this.muted,music:this.musicVolume,sfx:this.sfxVolume,sfxStyle:this.sfxStyle}));}catch{}}
  get effectProfile(){return SFX_STYLES[soundStyle(this.sfxStyle)];}
  materialCue(key,take=0){return this.effectProfile.material?this.materialEffects?.get(key,take):null;}
  setSfxStyle(value,{persist=true}={}){
    const next=soundStyle(value);
    if(next!==this.sfxStyle){this.stopWeapons(true);this.stopCreatures();this.sfxStyle=next;this.weaponTakes.clear();}
    if(persist)this.save();
  }
  setup(){
    if(this.ready)return;const c=this.ctx;
    this.master=c.createGain();this.music=c.createGain();this.scoreMusic=c.createGain();this.sfx=c.createGain();
    const limiter=c.createDynamicsCompressor();limiter.threshold.value=-3;limiter.knee.value=3;limiter.ratio.value=12;limiter.attack.value=.003;limiter.release.value=.15;
    const effects=c.createDynamicsCompressor();effects.threshold.value=-16;effects.knee.value=12;effects.ratio.value=4;effects.attack.value=.003;effects.release.value=.09;
    this.music.connect(this.master);this.sfx.connect(effects);effects.connect(this.master);this.master.connect(limiter);limiter.connect(c.destination);
    const scoreTone=c.createBiquadFilter();scoreTone.type='highshelf';scoreTone.frequency.value=3000;scoreTone.gain.value=-3;this.scoreMusic.connect(scoreTone);scoreTone.connect(this.music);
    this.weaponTone=c.createBiquadFilter();this.weaponTone.type='highshelf';this.weaponTone.frequency.value=3000;this.weaponTone.gain.value=-3;
    const weaponCeiling=c.createBiquadFilter();weaponCeiling.type='lowpass';weaponCeiling.frequency.value=Math.min(8000,c.sampleRate*.45);weaponCeiling.Q.value=.7;
    this.weaponTone.connect(weaponCeiling);weaponCeiling.connect(this.sfx);
    // Offline rendering still exercises the deterministic procedural fallback without fetching recordings.
    if(typeof c.startRendering!=='function')this.recorded=new RecordedMusic(c,this.music,this.scoreMusic);
    this.materialEffects=new RecordedEffects(c);
    // Short, quiet stereo room keeps the score from sounding like isolated beeps.
    this.room=c.createConvolver();const impulse=c.createBuffer(2,c.sampleRate*1.25,c.sampleRate);
    for(let ch=0;ch<2;ch++){const d=impulse.getChannelData(ch);for(let i=0;i<d.length;i++)d[i]=(Math.random()*2-1)*Math.pow(1-i/d.length,3)*.28;}
    this.room.buffer=impulse;const wet=c.createGain();wet.gain.value=.24;this.room.connect(wet);wet.connect(this.scoreMusic);
    this.instrumentRoom=c.createGain();this.instrumentRoom.gain.value=.32;this.instrumentRoom.connect(this.room);
    this.noiseBuffer=c.createBuffer(1,c.sampleRate*2,c.sampleRate);const d=this.noiseBuffer.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1;
    this.ready=true;this.next=c.currentTime+.04;this.applyVolumes(true);
  }
  async init(){try{this.ctx||=new (window.AudioContext||window.webkitAudioContext)();this.setup();if(this.ctx.state==='suspended')await this.ctx.resume();if(!this.materialEffects.buffer&&!this.materialEffects.loading&&!this.materialEffects.error)this.materialEffects.prepare();return this.ctx.state==='running';}catch{return false;}}
  applyVolumes(immediate=false){if(!this.ready)return;const t=this.ctx.currentTime;for(const [bus,v]of [[this.master,this.muted?0:.78],[this.music,this.musicVolume],[this.sfx,this.sfxVolume]]){bus.gain.cancelScheduledValues(t);if(immediate)bus.gain.setValueAtTime(v,t);else bus.gain.setTargetAtTime(v,t,.025);}}
  setVolume(bus,value){if(bus==='music')this.musicVolume=this.clamp(value,.65);else this.sfxVolume=this.clamp(value,.8);this.applyVolumes();this.save();}
  setMuted(value){this.muted=value;this.applyVolumes();this.save();}
  reset(map,keepRecording=false){if(!keepRecording)this.recorded?.reset();this.stopMusic();this.stopWeapons();this.stopCreatures();this.map=map;this.beat=0;this.next=(this.ctx?.currentTime||0)+.04;this.pressure=0;this.cooldowns.clear();this.weaponTakes.clear();}
  available(){return this.ready&&!this.muted&&this.ctx.state==='running'&&this.nodes<100;}
  allow(key,seconds){if(!this.available())return false;const t=this.ctx.currentTime;if((this.cooldowns.get(key)||0)>t)return false;this.cooldowns.set(key,t+seconds);return true;}
  voice(f,d,vol,type='sine',end=null,at=null,bus='sfx',attack=.005,pan=0){
    if(!this.available())return;const c=this.ctx,t=at??c.currentTime,o=c.createOscillator(),g=c.createGain(),p=c.createStereoPanner();
    o.type=type;o.frequency.setValueAtTime(Math.max(20,f),t);if(end)o.frequency.exponentialRampToValueAtTime(Math.max(20,end),t+d);
    g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(Math.max(.0002,vol),t+Math.min(attack,d*.3));
    if(bus==='music')g.gain.linearRampToValueAtTime(vol*(d>.8?.7:.3),t+d*(d>.8?.65:.45));
    g.gain.exponentialRampToValueAtTime(.0001,t+d);
    p.pan.value=pan;o.connect(g);g.connect(p);p.connect(bus==='music'?this.scoreMusic:this[bus]);if(bus==='music')g.connect(this.room);
    this.nodes++;this.proceduralSources.add(o);if(bus==='music'){this.musicVoices.add(o);o.musicEnvelope=g;}o.start(t);o.stop(t+d+.03);o.onended=()=>{o.disconnect();g.disconnect();p.disconnect();this.proceduralSources.delete(o);this.musicVoices.delete(o);this.nodes--;};return o;
  }
  noise(d,vol,frequency=1400,end=frequency,at=null,bus='sfx',type='bandpass'){
    if(!this.available())return;const c=this.ctx,t=at??c.currentTime,s=c.createBufferSource(),filter=c.createBiquadFilter(),g=c.createGain();
    s.buffer=this.noiseBuffer;filter.type=type;filter.Q.value=.8;filter.frequency.setValueAtTime(frequency,t);filter.frequency.exponentialRampToValueAtTime(Math.max(30,end),t+d);
    g.gain.setValueAtTime(.0001,t);g.gain.linearRampToValueAtTime(vol,t+.003);g.gain.exponentialRampToValueAtTime(vol*.3,t+d*.35);g.gain.exponentialRampToValueAtTime(.0001,t+d);s.connect(filter);filter.connect(g);g.connect(bus==='music'?this.scoreMusic:this[bus]);this.nodes++;
    this.proceduralSources.add(s);if(bus==='music'){this.musicVoices.add(s);s.musicEnvelope=g;}s.start(t,Math.random()*.7);s.stop(t+d+.02);s.onended=()=>{s.disconnect();filter.disconnect();g.disconnect();this.proceduralSources.delete(s);this.musicVoices.delete(s);this.nodes--;};
  }
  stopMusic(){const t=this.ctx?.currentTime||0;for(const source of [...this.musicSources,...this.musicVoices]){try{source.musicEnvelope.gain.cancelScheduledValues(t);source.musicEnvelope.gain.setTargetAtTime(.0001,t,.012);source.stop(t+.06);}catch{}}}
  musicNote(kind,note,duration,volume,at,pan=0){
    if(!this.available()||this.musicSources.size>=32)return;const c=this.ctx,key=kind+':'+note;let buffer=this.musicBuffers.get(key);
    if(!buffer){const rate=Math.min(22050,c.sampleRate),data=instrumentSample(kind,note,rate);buffer=c.createBuffer(1,data.length,rate);buffer.copyToChannel(data,0);if(this.musicBuffers.size>=48)this.musicBuffers.delete(this.musicBuffers.keys().next().value);this.musicBuffers.set(key,buffer);}
    const source=c.createBufferSource(),gain=c.createGain(),p=c.createStereoPanner(),end=at+Math.min(1.75,duration);source.buffer=buffer;p.pan.value=pan;
    gain.gain.setValueAtTime(volume,at);gain.gain.setTargetAtTime(.0001,Math.max(at+.01,end-.12),.025);source.connect(gain);gain.connect(p);p.connect(this.scoreMusic);gain.connect(this.instrumentRoom);
    source.musicEnvelope=gain;this.nodes++;this.musicSources.add(source);source.onended=()=>{source.disconnect();gain.disconnect();p.disconnect();this.musicSources.delete(source);this.nodes--;};source.start(at);source.stop(end+.02);
  }
  stopCreatures(){for(const s of this.creatureSources)s.stop();}
  creature(kind,event,dx=0,dz=0){
    if(!ENEMY_VOICES[kind]||!this.available())return false;
    const {gain,pan}=creatureSpatial(event,dx,dz),quiet=event==='step'||event==='hurt',limit=quiet?4:10;
    if(!gain||this.creatureSources.size>=limit||this.nodes>(quiet?65:88))return false;
    const group=quiet?event:event==='wind'?'warning':'action',interval=event==='step'?.18:event==='hurt'?.12:.045;
    const key='creature-'+kind+'-'+event,t=this.ctx.currentTime;
    if((this.cooldowns.get(key)||0)>t||(this.cooldowns.get('creature-'+group)||0)>t)return false;
    const materialKey='material:'+ENEMY_VOICES[kind].texture+':impact',take=this.weaponTakes.get(key)||0;
    const material=['impact','hurt'].includes(event)?this.materialCue(materialKey,take):null;
    const cacheKey=kind+':'+event;let buffer=material?.buffer||this.creatureBuffers.get(cacheKey);
    if(!buffer){const samples=creatureSample(kind,event,this.ctx.sampleRate);if(!samples)return false;buffer=this.ctx.createBuffer(1,samples.length,this.ctx.sampleRate);buffer.copyToChannel(samples,0);this.creatureBuffers.set(cacheKey,buffer);}
    this.cooldowns.set(key,t+(quiet?.3:.14));this.cooldowns.set('creature-'+group,t+interval);
    if(material)this.weaponTakes.set(key,(take+1)%this.materialEffects?.count(materialKey));
    const source=this.ctx.createBufferSource(),volume=this.ctx.createGain(),panner=this.ctx.createStereoPanner();
    source.buffer=buffer;source.playbackRate.value=material?1:.97+Math.random()*.06;volume.gain.value=gain*(event==='step'?.65:event==='hurt'?.38*this.effectProfile.hurt:1)*(material?.gain??1);panner.pan.value=pan;
    source.connect(volume);volume.connect(panner);panner.connect(this.sfx);this.creatureSources.add(source);this.nodes++;
    source.onended=()=>{source.disconnect();volume.disconnect();panner.disconnect();this.creatureSources.delete(source);this.nodes--;};if(material)source.start(0,material.offset,material.duration);else source.start();return true;
  }
  tone(f,d=.12,v=.06,type='sine',end=null){this.voice(f,d,v,type,end);}
  weapon(id,event,variant=0,volume=1,pan=0,maxDuration=null){
    // Contact tails cannot occupy the final slots reserved for a fresh attack.
    const limit=event==='impact'?10:event==='mechanism'?12:16;
    if(!this.available()||this.weaponSources.size>=limit)return false;
    const takeKey=id+':'+event+':'+variant,take=this.weaponTakes.get(takeKey)||0,key=takeKey+':'+take;
    const cueKey=this.materialEffects?.count(takeKey)?takeKey:id+':'+event,material=this.materialCue(cueKey,take);
    let buffer=material?.buffer||this.weaponBuffers.get(key);
    if(!buffer){const samples=id==='companion'?companionSample(event,this.ctx.sampleRate):id==='material:wood'||id==='material:stone'?creatureSample(id==='material:wood'?'shaman':'golem','impact',this.ctx.sampleRate):weaponSample(id,event,this.ctx.sampleRate,variant,take);if(!samples)return false;buffer=this.ctx.createBuffer(1,samples.length,this.ctx.sampleRate);buffer.copyToChannel(samples,0);this.weaponBuffers.set(key,buffer);}
    this.weaponTakes.set(takeKey,(take+1)%(material?this.materialEffects?.count(cueKey):weaponTakeCount(id)));
    const source=this.ctx.createBufferSource(),gain=this.ctx.createGain(),panner=this.ctx.createStereoPanner();source.buffer=buffer;source.playbackRate.value=material?1:.975+Math.random()*.05;gain.gain.value=(event==='impact'&&variant?1.12:1)*volume*(this.effectProfile[event]??1)*(material?.gain??1)*(.97+Math.random()*.06);panner.pan.value=pan;
    const duration=material?Math.min(material.duration,maxDuration??Infinity):Math.min(buffer.duration||Infinity,maxDuration??Infinity);
    if(maxDuration&&Number.isFinite(duration)){const t=this.ctx.currentTime;gain.gain.setValueAtTime(gain.gain.value,t);gain.gain.setValueAtTime(gain.gain.value,t+Math.max(0,duration-.018));gain.gain.linearRampToValueAtTime(0,t+duration);}
    source.connect(gain);gain.connect(panner);panner.connect(material||id==='companion'?this.sfx:this.weaponTone||this.sfx);this.weaponSources.add(source);this.nodes++;source.onended=()=>{source.disconnect();gain.disconnect();panner.disconnect();this.weaponSources.delete(source);this.nodes--;};if(material)source.start(0,material.offset,duration);else{source.start();if(maxDuration)source.stop(this.ctx.currentTime+duration);}return true;
  }
  companion(event,dx=0,dz=0){const quiet=['step','sniff'].includes(event),range=quiet?8:20,d=Math.hypot(dx,dz);if(d>=range||!this.allow('companion-'+event,event==='sniff'?5:event==='step'?.20:.12))return false;
    const volume=({step:.35,sniff:.35,pounce:.85,bite:.85,hurt:.8,down:.85,revive:.8,dodge:.85,dodgeLand:.5,trapSet:.6,trapSnap:.8})[event]||.7;
    return this.weapon('companion',event,0,volume*(1-d/range)**1.2,Math.max(-1,Math.min(1,(dx-dz)/12)));
  }
  stopWeapons(preserveLevel=false){for(const s of new Set([...this.weaponSources,...this.proceduralSources].filter(s=>!this.musicVoices.has(s)&&!(preserveLevel&&s.levelCue))))s.stop();}
  shot(id,variant=0){if(this.allow('shot',.045))this.weapon(id,'shot',variant);}
  mechanism(id,stage=0,period=null){if(this.allow('mechanism',.065))this.weapon(id,'mechanism',stage,1,0,period?Math.max(.035,period*.28):null);}
  impact(id,strong=false,variant=strong?1:0,dx=0,dz=0){if(this.allow('impact-'+id+(strong?'-strong':''),.10)){const p=contactSpatial(dx,dz);this.weapon(id,'impact',variant,p.gain,p.pan);}}
  terrain(texture,dx=0,dz=0,strong=false){if(!this.allow('terrain-'+texture,.18))return;const p=contactSpatial(dx,dz);this.weapon('material:'+texture,'impact',0,p.gain*(strong?.48:.30),p.pan);}
  threat(kind='wave'){if(!this.allow('threat',2))return;const t=this.ctx.currentTime,deep=kind==='boss';if(this.recorded?.active){this.voice(deep?80:105,.32,deep?.13:.08,'sine',42);this.noise(.22,deep?.07:.04,850,160);return;}if(BIOME_THEMES[this.map]){biomeThreat(this,BIOME_THEMES[this.map],this.beat,t,deep);return;}this.voice(deep?58:82,.9,deep?.15:.105,'sawtooth',deep?35:48,t,'music',.04);this.noise(deep?.75:.42,deep?.16:.085,1400,170,t,'music');for(let i=0;i<(deep?4:3);i++)this.voice((deep?147:196)*2**(i/12),.19,.052,'triangle',null,t+i*.105,'music',.008);}
  spell(kind){if(!this.allow('spell-'+kind,.11))return;const t=this.ctx.currentTime;
    if(this.materialCue('spell:'+kind)){this.weapon('spell',kind);return;}
    if(kind==='ice'){this.noise(.36,.24,4800,1400);[2100,3150,4100,2700].forEach((f,i)=>this.voice(f,.18,.035,'sine',f*.85,t+i*.035));}
    else if(kind==='storm'){this.noise(.22,.45,4200,300);this.voice(64,.4,.21,'sine',26);this.noise(.045,.23,6200,1800,t+.07);}
    else if(kind==='fire'){this.noise(.48,.55,1100,100);this.voice(92,.4,.25,'sine',25);}
    else if(['veil','chain','rift'].includes(kind)){this.noise(kind==='rift'?.4:.25,.2,kind==='chain'?2800:900,130);this.voice(kind==='rift'?70:kind==='chain'?130:95,.42,.16,'triangle',35);}
    else if(kind==='heal'){[440,660,880].forEach((f,i)=>this.voice(f,.35,.027,'sine',null,t+i*.045));}
    else{this.noise(.3,.16,1400,200);this.voice(140,.38,.15,'sine',45);this.voice(300,.25,.025,'triangle',620);}
  }
  skill(kind){
    const material=SKILL_MATERIALS[kind];
    if(material&&this.materialCue(material[0]+':'+material[1])){if(this.allow('hero-material-'+kind,kind==='wake'?.7:.16))this.weapon(material[0],material[1],0,material[2]);return;}
    if(['faultPrime','saltWake','snareMark'].includes(kind)){if(!this.allow('pair-'+kind,.45))return;
      if(kind==='faultPrime'){this.noise(.16,.045,620,130);this.voice(145,.25,.045,'triangle',290);}
      else if(kind==='saltWake'){this.noise(.15,.035,3200,1000);this.voice(640,.12,.02,'sine',380);}
      else{this.noise(.12,.035,1800,450);this.voice(240,.14,.025,'triangle',130);}return;}

    if(['fault','landing','reprisal'].includes(kind)){if(!this.allow('stone-skill',.18))return;this.noise(.27,.13,650,90);this.voice(kind==='reprisal'?170:82,.22,.11,'sine',38);return;}
    if(['surge','brine','wake'].includes(kind)){if(!this.allow('tide-skill',kind==='wake'?.7:.18))return;this.noise(.30,kind==='wake'?.035:.10,kind==='brine'?3600:1500,480);this.voice(220,.16,.025,'sine',95);return;}
    if(['briarSet','briar','bond','care'].includes(kind)){if(!this.allow('grove-skill',.2))return;if(kind==='care'){this.voice(520,.26,.035,'sine',780);return;}this.noise(.16,.07,kind==='bond'?900:2300,280);this.voice(170,.1,.035,'triangle',85);return;}

    const cfg={mineSet:[520,180,.09,.07],mineBlast:[105,35,.3,.21],volley:[190,60,.12,.15],counter:[120,42,.22,.18],rainAim:[1300,1900,.18,.04],rain:[1900,700,.15,.07],trailSet:[2600,1400,.12,.025],pursuit:[900,1600,.2,.065],echo:[155,310,.28,.06],echoHit:[260,95,.18,.07],soul:[330,660,.32,.05],spikes:[100,40,.28,.14]}[kind];
    if(!cfg||!this.allow('hero-skill-'+kind,.13))return;const [f,end,duration,volume]=cfg,t=this.ctx.currentTime;
    this.voice(f,duration,volume,kind==='soul'?'sine':'triangle',end);
    if(kind==='soul')this.voice(495,.28,.025,'sine',990,t+.06);
    else this.noise(duration,volume*.9,kind.startsWith('rain')||kind==='trailSet'?4800:kind==='spikes'?1300:2600,kind==='mineBlast'?100:450,t+.012);
  }
  land(kind,wet=false){if(wet){this.water(true);return;}if(!this.allow('hero-land',.15))return;this.noise(.09,.065,kind==='guardian'?450:800,140);this.voice(kind==='guardian'?88:140,.10,.05,'sine',60);}
  water(deep=false){if(!this.allow('water',.24))return;if(this.materialCue('motion:water')){this.weapon('motion','water',0,deep?.65:.38);return;}this.noise(deep?.22:.13,deep?.11:.07,1100,320);this.voice(310+Math.random()*80,.085,.028,'sine',115);}
  dodge(hero){if(!this.allow('dodge',.2))return;const silver=hero===true||hero==='silver'||hero==='wraith',event=hero==='wraith'?'shadowblink':silver?'blink':'roll';if(this.materialCue('motion:'+event)){this.weapon('motion',event,0,.7);return;}this.noise(silver?.32:.2,.24,silver?4000:650,silver?220:140);if(silver)this.voice(440,.25,.065,'sine',110);}
  hurt(){if(!this.allow('hurt',.15))return;this.noise(.15,.3,700,140);this.voice(130,.22,.25,'sine',36);}
  pickup(){if(!this.allow('pickup',.09))return;this.voice(780+(this.beat%4)*110,.075,.035,'sine',1100);}
  level(){if(!this.allow('level',.35))return;[523.25,659.25,783.99,1046.5].forEach((f,i)=>{const source=this.voice(f,.5,.075,'triangle',null,this.ctx.currentTime+i*.085);if(source)source.levelCue=true;});}
  resolve(){if(!this.allow('resolve',2))return;if(this.recorded?.active){this.noise(.3,.045,1100,380);return;}[293.66,369.99,440].forEach((f,i)=>this.voice(f,.65,.055,'triangle',null,this.ctx.currentTime+i*.12,'music',.025));}
  update(dt,{map='forest',mode='playing',boss=false,pressure=0,seamless=false}={}){
    const previousMode=this.mode;this.mode=mode;if(map!==this.map){if(seamless)this.map=map;else this.reset(map,true);}if(!this.ready)return;
    const c=this.ctx,paused=mode==='paused'||mode==='event-choice'||mode==='lost'||mode==='won';
    this.recorded?.update(dt,{map,mode,boss,pressure,seamless});
    this.music.gain.setTargetAtTime(paused?0:this.musicVolume*(mode==='upgrade'?.3:mode==='menu'?.6:1),c.currentTime,.2);
    if(paused){if(!['paused','event-choice','lost','won'].includes(previousMode)){this.stopMusic();this.stopWeapons();this.stopCreatures();}this.next=c.currentTime+.05;return;}
    if(!this.available())return;
    this.pressure+=(Math.max(boss?1:0,pressure)-this.pressure)*Math.min(1,dt*(pressure>this.pressure?.8:.45));
    if(this.recorded?.active&&this.scoreMusic.gain.value<.002){this.next=c.currentTime+.025;return;}
    const theme=THEMES[map]||THEMES.forest,step=60/theme.bpm/2;
    // Schedule against the audio clock, with a bounded lookahead; no frame-rate jitter or catch-up burst.
    if(this.next<c.currentTime-.2)this.next=c.currentTime+.025;
    while(this.next<c.currentTime+.13){this.score(theme,this.beat++,this.next,step,mode==='playing'?this.pressure:0);this.next+=step;}
  }
  score(th,b,t,step,pressure){
    if(th.arrangement){scoreBiome(this,th,b,t,step,pressure);return;}
    const root=th.root,bar=Math.floor(b/8),chord=th.chords[Math.floor(bar/2)%4],n=th.lead[b%th.lead.length];
    if(b%8===0){for(const [i,interval]of [0,3,7].entries())this.voice(midi(root+chord+interval),step*9,.028,'triangle',null,t,'music',.25,(i-1)*.45);}
    if(n){const f=midi(root+n);this.voice(f,step*1.65,.075,th===THEMES.snow?'sine':'triangle',null,t,'music',.025,.12);this.voice(f*2,step*.8,.012,'sine',null,t,'music',.01,-.15);}
    if(b%2===0)this.voice(midi(root-12+chord),step*1.7,.11,'sine',null,t,'music',.012);
    if(b%4===0||pressure>.6&&b%4===3){this.voice(95,.2,.055+pressure*.115,'sine',34,t,'music');this.noise(.06,.015+pressure*.03,1600,350,t,'music');}
    if(b%4===2){this.noise(.13,.022+pressure*.098,1500,700,t,'music');this.voice(165,.12,.04,'triangle',90,t,'music');}
    if(b%4===3||pressure>.25&&b%2===1||pressure>.65)this.noise(.055,.012+pressure*.038,7200,5500,t,'music','highpass');
    if(pressure>.25&&b%2===0)this.voice(midi(root+chord+[0,7,12,7][b%4]),step*.7,.044*pressure,'sawtooth',null,t,'music',.02,-.25);
    if(pressure>.5&&b%4===1){this.voice(midi(root-24),step*.65,.07*pressure,'sawtooth',midi(root-31),t,'music',.008,-.2);this.noise(.075,.045*pressure,2400,320,t,'music');}
  }
}
