import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../vendor/three.module.js';
import {EnvironmentLighting,sampleForestDay,FOREST_CYCLE,CLIMATE_LIGHT} from '../environment-lighting.js';
import {installForestMist,installWorldLightShafts,updateWorldLightShafts} from '../world-light-shafts.js';
import {AdventureAtmosphere} from '../adventure-atmosphere.js';
function rig(){const scene=new T.Scene();scene.fog=new T.FogExp2();scene.background=new T.Color();const sun=new T.DirectionalLight(),hemi=new T.HemisphereLight(),rim=new T.DirectionalLight();scene.add(sun,hemi,rim);return new EnvironmentLighting(scene,{toneMappingExposure:1},hemi,sun,rim);}
test('forest day/night loops on game time, preserves other palettes, and adds no lights',()=>{
 const light=rig(),nightTime=(Math.PI*1.5-FOREST_CYCLE.startAngle)/Math.PI/2*FOREST_CYCLE.seconds;
 light.update('forest',null,0,0);const day=light.sun.intensity,baseline=light.direction.clone();
 light.update('forest',null,0,nightTime);assert(light.sun.intensity<day&&light.sun.intensity>.5);assert(light.hemi.intensity>=.7);assert(light.day===0);
 const state=[...light.direction.toArray(),...light.scene.fog.color.toArray(),light.sun.intensity];light.update('forest',null,0,nightTime);assert.deepEqual([...light.direction.toArray(),...light.scene.fog.color.toArray(),light.sun.intensity],state);
 light.update('forest',null,0,720);assert(light.direction.distanceTo(baseline)<1e-10);
 for(const id of['snow','ash','sand','coast']){light.update(id,null,0,nightTime);assert.equal(light.sun.intensity,CLIMATE_LIGHT[id].key);assert.equal(light.scene.fog.color.getHex(),CLIMATE_LIGHT[id].fog);}
 for(let time=0;time<720;time+=.5){const s=sampleForestDay(time);assert(s.direction.y>0&&Math.abs(s.direction.length()-1)<1e-10);assert(s.day>=0&&s.day<=1&&s.horizon>=0&&s.horizon<=1);light.update('forest',null,0,time);assert(light.sun.intensity>=0&&light.sun.intensity<=3.25);assert(light.renderer.toneMappingExposure<=1.08);}
 assert.equal(light.scene.children.length,3);
});

test('forest night replaces only its share at a five-biome junction and freezes on pause',()=>{
 const light=rig(),forest=rig(),weights={forest:.2,snow:.2,ash:.2,sand:.2,coast:.2},nightTime=(Math.PI*1.5-FOREST_CYCLE.startAngle)/Math.PI/2*FOREST_CYCLE.seconds;
 forest.update('forest',null,0,nightTime);light.update('confluence',weights,0,nightTime);
 for(const[field,actual,night]of[['sky',light.hemi.color,forest.hemi.color],['bounce',light.hemi.groundColor,forest.hemi.groundColor],['sun',light.sun.color,forest.sun.color],['rim',light.rim.color,forest.rim.color],['fog',light.scene.fog.color,forest.scene.fog.color]]){
  const expected=night.clone().multiplyScalar(.2);for(const id of['snow','ash','sand','coast'])expected.add(new T.Color(CLIMATE_LIGHT[id][field]).multiplyScalar(.2));
  assert(Math.hypot(actual.r-expected.r,actual.g-expected.g,actual.b-expected.b)<1e-12,'forest cycle changed the neighboring '+field+' contribution');
 }
 const state=[...light.direction.toArray(),...light.hemi.color.toArray(),...light.sun.color.toArray(),...light.scene.fog.color.toArray(),light.sun.intensity,light.scene.fog.density];
 light.update('confluence',weights,0,nightTime);const paused=[...light.direction.toArray(),...light.hemi.color.toArray(),...light.sun.color.toArray(),...light.scene.fog.color.toArray(),light.sun.intensity,light.scene.fog.density];assert(paused.every((value,i)=>Math.abs(value-state[i])<1e-12),'paused cycle changed the five-biome blend');
 assert.equal(light.scene.children.length,3);
});
test('the current sun, atmosphere and shafts agree, with fixed anchors and disposal',()=>{
 const world={half:96,group:new T.Group(),spawn:{x:0,z:0},sites:[],obstacles:[],patches:[],ponds:[]};
 const shafts=installWorldLightShafts(world,'forest'),mist=installForestMist(world,'forest'),light=rig(),sky=new AdventureAtmosphere(light.scene),camera=new T.PerspectiveCamera();
 assert(mist.count<=6&&mist.count>0);assert.equal(installForestMist(world,'forest'),mist);assert.equal(installForestMist({...world,forestMist:null},'snow'),null);
 const anchors=JSON.stringify(shafts.userData.anchors),mistPositions=Array.from(mist.instanceMatrix.array),matrix=new T.Matrix4();
 for(const time of[0,120,270,430,610,720]){
  light.update('forest',null,0,time);updateWorldLightShafts(world,time,light);sky.update(time,camera,{sunDirection:light.direction,sunStrength:light.shaftStrength});
  assert(sky.mesh.material.uniforms.sunDirection.value.distanceTo(light.direction)<1e-10);
  shafts.getMatrixAt(0,matrix);assert(new T.Vector3().setFromMatrixColumn(matrix,1).normalize().distanceTo(light.direction)<1e-6);
  assert(shafts.material.uniforms.shaftStrength.value>=0&&shafts.material.uniforms.shaftStrength.value<=1);
  assert.equal(JSON.stringify(shafts.userData.anchors),anchors);assert.deepEqual(Array.from(mist.instanceMatrix.array),mistPositions);
 }
 updateWorldLightShafts(world,NaN,light);assert.equal(mist.material.uniforms.mistTime.value,720);
 let disposed=0;mist.material.addEventListener('dispose',()=>disposed++);mist.dispose();mist.dispose();updateWorldLightShafts(world,800,light);assert.equal(disposed,1);assert.equal(mist.material.uniforms.mistTime.value,720);shafts.dispose();sky.dispose();
 const mobile=installForestMist({...world,group:new T.Group(),forestMist:null},'forest',{mobile:true});assert(mobile.count<=3);mobile.dispose();
});
