import test from 'node:test';
import assert from 'node:assert/strict';
import {CinematicRenderer} from '../cinematic-renderer.js';

function renderer(float=true){
 return{extensions:{has:()=>float},capabilities:{maxSamples:4},info:{autoReset:true,reset(){}},width:1800,height:1000,target:null,passes:[],
  getDrawingBufferSize(v){return v.set(this.width,this.height);},getRenderTarget(){return this.target;},setRenderTarget(target){this.target=target;},render(scene){this.passes.push({target:this.target,scene});}};
}

test('cinematic targets stay within the drawing budget and are reused across frames and quality changes',()=>{
 const r=renderer(),cinema=new CinematicRenderer(r),targets=[cinema.sceneTarget,cinema.glowA,cinema.glowB];let sceneDraws=0;
 const draw=()=>{sceneDraws++;assert.equal(r.target,cinema.sceneTarget);};
 try{
  cinema.render(draw);assert.equal(sceneDraws,1);assert.equal(r.passes.length,3);assert.equal(r.target,null);
  assert.equal(cinema.sceneTarget.width*cinema.sceneTarget.height,1800000);
  for(const target of targets.slice(1))assert(target.width*target.height<=1800000/16);
  cinema.render(draw);assert.deepEqual([cinema.sceneTarget,cinema.glowA,cinema.glowB],targets);
  r.width=844;r.height=390;r.passes=[];cinema.render(()=>{sceneDraws++;assert.equal(r.target,null);},.7);
  assert.equal(r.passes.length,0);for(const target of targets)assert.equal(target.width*target.height,1);cinema.render(draw);
  assert.equal(cinema.sceneTarget.width,844);assert.equal(cinema.sceneTarget.height,390);assert.equal(r.passes.length,3);
 }finally{cinema.dispose();}
});

test('color-only postprocess preserves MSAA and scene depth testing without resolving unused depth',()=>{
 const r=renderer(),cinema=new CinematicRenderer(r),target=cinema.sceneTarget;
 try{
  const color=target.texture,draw=()=>{assert.equal(r.target,target);assert.equal(target.depthBuffer,true);assert.equal(target.samples,2);assert.equal(target.resolveDepthBuffer,false);};
  cinema.render(draw);assert.equal(target.depthTexture,null);assert.equal(cinema.finish.uniforms.sceneColor.value,color);
  r.width=2560;r.height=1440;cinema.render(draw);
  assert.equal(target.texture,color);assert.equal(target.width,2560);assert.equal(target.height,1440);
  assert.equal(cinema.blur.uniforms.source.value,cinema.glowA.texture);assert.equal(cinema.finish.uniforms.glowColor.value,cinema.glowB.texture);
  cinema.render(()=>{assert.equal(r.target,null);},.7);cinema.render(draw);
  assert.equal(target.texture,color);assert.equal(r.target,null);
 }finally{cinema.dispose();}
});

test('fallback and exceptions preserve the destination and every owned GPU resource is released once',()=>{
 const plain=renderer(false),fallback=new CinematicRenderer(plain);let normal=0;fallback.render(()=>normal++);assert.equal(normal,1);assert.equal(fallback.sceneTarget,undefined);fallback.dispose();assert.equal(plain.info.autoReset,true);
 const r=renderer(),cinema=new CinematicRenderer(r),previous={name:'caller target'};r.target=previous;
 assert.throws(()=>cinema.render(()=>{throw Error('scene failure');}),/scene failure/);assert.equal(r.target,previous);
 let disposed=0;for(const resource of [cinema.sceneTarget,cinema.glowA,cinema.glowB,cinema.blur,cinema.finish,cinema.quad.geometry])resource.addEventListener('dispose',()=>disposed++);
 cinema.dispose();cinema.dispose();assert.equal(disposed,6);assert.equal(r.info.autoReset,true);
});

test('mobile uses no multisample target and a restrained highlight contribution',()=>{
 const r=renderer(),cinema=new CinematicRenderer(r,{mobile:true});
 try{cinema.render(()=>{});assert.equal(cinema.sceneTarget.samples,0);assert(cinema.finish.uniforms.glowStrength.value<=.14);}finally{cinema.dispose();}
});
