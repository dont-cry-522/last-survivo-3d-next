import test from 'node:test';
import assert from 'node:assert/strict';
import {adventureDodgePose} from '../adventure-dodge.js';

const duration={scout:.52,silver:.24,wraith:.24,tide:2,lingya:.58,wuling:.52,mirage:.52};
test('dodge presentation reads the original seven ability clocks and expires without a second timer',()=>{
 for(const [hero,seconds]of Object.entries(duration)){
  const p={dashTime:seconds*.5,dashAngle:1},before={...p},a=adventureDodgePose(hero,p,1);
  assert(a.weight>0&&a.weight<=1);assert.equal(a.forward,1);assert(Math.abs(a.side)<1e-10);assert.deepEqual(adventureDodgePose(hero,p,1),a);assert.deepEqual(p,before);
  assert.equal(adventureDodgePose(hero,{...p,dashTime:0},1),null);
  assert.equal(adventureDodgePose(hero,{...p,dashTime:-.1},1),null);
 }
});
test('screen-relative banks oppose on left and right and never turn the aiming direction',()=>{
 for(const hero of Object.keys(duration))for(const yaw of [0,1.5,-2.9]){
  const r=adventureDodgePose(hero,{dashTime:duration[hero]*.5,dashAngle:yaw-Math.PI/2},yaw),l=adventureDodgePose(hero,{dashTime:duration[hero]*.5,dashAngle:yaw+Math.PI/2},yaw);
  assert(r.side>.999&&l.side<-.999);assert(r.roll>0&&l.roll<0);assert.equal(r.firstHeight,l.firstHeight);assert(Math.abs(r.roll)<=.028);
 }
});
test('dive enters and exits continuously, blink clears quickly, water rolls stay shallow',()=>{
 assert.equal(adventureDodgePose('tide',{dashTime:2},0).weight,0);
 assert.equal(adventureDodgePose('tide',{dashTime:1.7},0).weight,1);
 assert(adventureDodgePose('tide',{dashTime:.01},0).weight<.01);
 assert(adventureDodgePose('silver',{dashTime:.24},0).concealed);assert(!adventureDodgePose('silver',{dashTime:.13},0).concealed);
 const water=adventureDodgePose('scout',{dashTime:.26,waterDash:true},0);assert.equal(water.kind,'dive');assert(water.firstHeight>=-.12);
});
