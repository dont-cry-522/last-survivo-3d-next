import test from 'node:test';
import assert from 'node:assert/strict';
import {ENEMY_VOICES,creatureSample,creatureSpatial} from '../enemy-audio.js';
import {ADDITIONAL_BOSSES} from '../boss-roster.js';
import {MAP_ROSTERS} from '../map-enemies.js';

test('every biome creature has audible, finite, bounded and distinct foley for all six events',()=>{
  const kinds=[...Object.values(MAP_ROSTERS).flatMap(Object.values),...Object.keys(ADDITIONAL_BOSSES)];
  assert.deepEqual(Object.keys(ENEMY_VOICES).sort(),kinds.sort());
  for(const event of ['step','wind','attack','impact','hurt','death']){
    const signatures=new Set();
    for(const kind of kinds){
      const data=creatureSample(kind,event,22050);let power=0,peak=0;
      for(const v of data){assert(Number.isFinite(v));power+=v*v;peak=Math.max(peak,Math.abs(v));}
      assert(Math.sqrt(power/data.length)>.001,kind+' '+event+' silent');
      assert(peak<.6&&data.length<22050,kind+' too loud or long');
      assert(Math.abs(data[0])<.001&&Math.abs(data.at(-1))<.001,'no abrupt sample boundary');
      signatures.add(Array.from(data.slice(100,140)).map(v=>v.toFixed(5)).join(','));
    }
    assert.equal(signatures.size,kinds.length,event+' should retain species identity');
  }
});

test('distance fades footsteps before warnings and stereo follows isometric screen direction',()=>{
  assert.equal(creatureSpatial('step',8,0).gain,0);
  assert(creatureSpatial('wind',8,0).gain>0);
  assert.equal(creatureSpatial('wind',30,0).gain,0);
  assert.equal(creatureSpatial('wind',0,0).gain,1);
  assert(creatureSpatial('attack',4,-4).pan>0);
  assert(creatureSpatial('attack',-4,4).pan<0);
  assert.equal(creatureSpatial('death',3,3).pan,0);
});
