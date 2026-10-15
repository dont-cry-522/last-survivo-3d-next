import test from 'node:test';
import assert from 'node:assert/strict';
import {GameAudio,contactSpatial} from '../audio.js';
import {enemySurface,surfaceSample} from '../enemy-surfaces.js';
import {WEAPONS} from '../rules.js';

test('contact follows target distance and isometric side without muting visible far hits',()=>{
  const near=contactSpatial(1,0),far=contactSpatial(16,0);
  assert(near.gain>far.gain&&far.gain>.4);
  assert(contactSpatial(4,-4).pan>0&&contactSpatial(-4,4).pan<0);
  assert.equal(contactSpatial(3,3).pan,0);
  assert.equal(contactSpatial().gain,1);
});
test('contact material, hero dodge identity and haste recovery remain separate events',()=>{
  const audio=new GameAudio(),calls=[];audio.allow=()=>true;audio.weapon=(...args)=>calls.push(args);audio.materialEffects={get:()=>({})};
  audio.terrain('wood',4,0);assert.equal(calls.at(-1)[0],'material:wood');assert(calls.at(-1)[3]<.3);
  audio.impact('crossbow',false,0,4,0);assert.equal(calls.at(-1)[0],'crossbow');assert(calls.at(-1)[4]>0);
  audio.dodge('silver');assert.equal(calls.at(-1)[1],'blink');
  audio.dodge('wraith');assert.equal(calls.at(-1)[1],'shadowblink');
  audio.dodge('scout');assert.equal(calls.at(-1)[1],'roll');
  audio.mechanism('crossbow',1,.16);assert.equal(calls.at(-1)[2],1);assert(calls.at(-1)[5]<.16*.32);
  audio.shot('harpoon',2,.048);assert.deepEqual(calls.at(-1),['harpoon','shot',2,1,0,.048]);
  audio.shot('shadowblade',1,.19);assert.equal(calls.at(-1)[5],.19);
  audio.shot('rifle');assert.equal(calls.at(-1)[5],null);
});
test('wood and stone retain a cached material fallback before recordings load',()=>{
  const node=()=>({connect(){},disconnect(){}}),ctx={currentTime:1,state:'running',sampleRate:22050,
    createBuffer:(channels,length,rate)=>({duration:length/rate,copyToChannel(){}}),
    createGain:()=>({...node(),gain:{value:0}}),createStereoPanner:()=>({...node(),pan:{value:0}}),
    createBufferSource:()=>({...node(),playbackRate:{value:1},start(){},stop(){this.onended?.();}})};
  const audio=new GameAudio(ctx);audio.ready=true;audio.sfx=node();
  audio.terrain('wood');audio.terrain('stone');assert.equal(audio.weaponSources.size,2);
  assert([...audio.weaponBuffers.keys()].every(key=>key.startsWith('material:')));
  audio.stopWeapons();assert.equal(audio.nodes,0);
});

test('five body materials remain distinct, short, finite and quiet across maps',()=>{
 for(const[kind,expected]of Object.entries({mushroom:'flesh',wolf:'fur',frostwolf:'fur',yeti:'fur',lavabrute:'rock',sandguard:'rock',clawbeetle:'shell',tidecrab:'shell',reefturtle:'shell',jellyseer:'flesh',thornstag:'wood'}))assert.equal(enemySurface(kind),expected);
 const signatures=new Set();
 for(const rate of [22050,44100])for(const surface of ['flesh','fur','shell','rock','wood']){
  const data=surfaceSample(surface,rate);assert(data.length<=rate*.18+1);let energy=0;
  for(const value of data){assert(Number.isFinite(value)&&Math.abs(value)<.57);energy+=value*value;}
  assert(Math.sqrt(energy/data.length)>.008);assert.equal(data[0],0);assert(Math.abs(data.at(-1))<.001);
  if(rate===22050)signatures.add(Array.from(data.slice(30,60)).join(','));
 }
 assert.equal(signatures.size,5);assert.equal(surfaceSample('unknown',22050),null);
});

test('direct body contact is shared across thirteen weapons, groups volleys and releases existing audio nodes',()=>{
 const node=()=>({connect(){},disconnect(){}}),ctx={currentTime:1,state:'running',sampleRate:22050,
  createBuffer:(channels,length,rate)=>({duration:length/rate,copyToChannel(){}}),
  createGain:()=>({...node(),gain:{value:0}}),createStereoPanner:()=>({...node(),pan:{value:0}}),
  createBufferSource:()=>({...node(),playbackRate:{value:1},start(){},stop(){this.onended?.();}})};
 const audio=new GameAudio(ctx);audio.ready=true;audio.sfx=node();audio.weaponTone=node();
 // Loaded recordings must not replace every distinct surface with one atlas cue.
 audio.materialEffects={count:()=>1,get:()=>({buffer:{duration:2},offset:0,duration:.2,gain:1})};
 for(const id of Object.keys(WEAPONS))for(const kind of ['mushroom','wolf','tidecrab','golem','shaman']){
  ctx.currentTime+=.2;assert(audio.contact(id,kind,3,0));assert(!audio.contact(id,kind,3,0),'pellets duplicate surface voices');
  assert.equal(audio.weaponSources.size,1);audio.stopWeapons();assert.equal(audio.nodes,0);
 }
 assert.equal(audio.weaponBuffers.size,5,'surface cache scales with weapons or hits');
 ctx.currentTime+=.2;assert.equal(audio.contact('poison','wolf'),false);assert.equal(audio.contact('miragePoison','wolf'),false);assert.equal(audio.weaponSources.size,0);
 for(let n=0;n<12;n++){ctx.currentTime+=.2;audio.contact('rifle','wolf');}assert.equal(audio.weaponSources.size,8);
 assert(audio.weapon('rifle','impact'),'contacts occupied the main impact slot');audio.stopWeapons();assert.equal(audio.nodes,0);
});
