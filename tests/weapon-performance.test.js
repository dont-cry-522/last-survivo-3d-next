import test from 'node:test';
import assert from 'node:assert/strict';
import {WEAPONS} from '../rules.js';
import {weaponSample} from '../weapon-audio.js';
import {weaponGesture,shotStarted,WEAPON_RECOVERY,meleeSwing} from '../weapon-performance.js';

test('all weapons have finite bounded distinct shot and impact textures with smooth ends',()=>{
  for(const event of ['shot','impact']){
    const signatures=new Set();
    for(const id of Object.keys(WEAPONS)){
      const s=weaponSample(id,event,22050);let energy=0,peak=0;
      for(const v of s){assert(Number.isFinite(v));energy+=v*v;peak=Math.max(peak,Math.abs(v));}
      assert(Math.sqrt(energy/s.length)>.01,id+' inaudible');assert(peak<.75,id+' clipping');
      assert(Math.abs(s[0])<.0001);assert(Math.abs(s.at(-1))<.001);
      // Breath/pressure sounds deliberately swell after the first milliseconds.
      signatures.add(Array.from({length:40},(_,i)=>s[Math.floor((i+1)*s.length/41)].toFixed(4)).join(','));
    }
    assert.equal(signatures.size,Object.keys(WEAPONS).length);
  }
});
test('weapon follow-throughs settle, remain continuous and compress with attack speed',()=>{
  for(const id of Object.keys(WEAPONS))for(const period of [.16,.35,1.3]){
    let previous=weaponGesture(id,0,0,period),peak=0;
    for(let i=1;i<4200;i++){
      const t=i/2000,now=weaponGesture(id,t,Math.min(1,t/period),period);peak=Math.max(peak,now.kick);
      for(const k of ['kick','sweep','draw','gather']){assert(now[k]>=0&&now[k]<=1);assert(Math.abs(now[k]-previous[k])<.08,id+' discontinuity');}previous=now;
    }
    assert(peak>.9);assert.equal(previous.kick,0);assert.equal(previous.draw,0);
    assert(WEAPON_RECOVERY[id]>0);
  }
});
test('explicit shot serial detects another fast shot even while the last pose timer is positive',()=>{
  const d={shotSerial:1};assert(shotStarted(d,.12,.12));assert(!shotStarted(d,.11,.12));
  d.shotSerial++;assert(shotStarted(d,.12,.11));assert(!shotStarted(d,.12,.12));
});

test('melee prepares before contact, follows through afterwards, and emits no recovery trail',()=>{
 for(const[id,hit]of[['harpoon',.34],['shadowblade',.44]])for(const period of[.35,1]){
  const duration=Math.min(WEAPON_RECOVERY[id],period*.9),pre=meleeSwing(id,duration*hit*.42,period),contact=meleeSwing(id,duration*hit,period),end=meleeSwing(id,duration*1.1,period);
  assert(pre.gather>.99);assert.equal(contact.gather,0);assert(contact.kick>.99&&contact.trail);assert(end.kick===0&&end.gather===0&&end.cut===0&&!end.trail&&end.weight===0);
 }
});

test('melee weight transfer and curved recovery use the contact clock and settle after haste',()=>{
 for(const id of ['harpoon','shadowblade'])for(const period of [.16,.35,1]){
  const duration=Math.min(WEAPON_RECOVERY[id],Math.max(.12,period*.9)),hit=id==='harpoon'?.34:.44;
  const start=meleeSwing(id,0,period),contact=meleeSwing(id,duration*hit,period),recover=meleeSwing(id,duration*.82,period),end=meleeSwing(id,duration,period);
  assert.equal(start.body,0);assert(contact.body>.99);assert(Math.abs(contact.clipPhase-.42)<1e-9);assert.equal(contact.recover,0);
  assert(recover.recover>.99&&!recover.trail);assert.equal(end.body,0);assert.equal(end.recover,0);assert.equal(end.clipPhase,1);
 }
});
