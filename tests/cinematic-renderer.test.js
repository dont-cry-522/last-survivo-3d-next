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

test('moderate load removes HDR MSAA once, keeps bloom and does not oscillate at partial recovery',()=>{
 const r=renderer(),cinema=new CinematicRenderer(r),target=cinema.sceneTarget,texture=target.texture;let reallocations=0,glowReallocations=0;
 try{
  cinema.render(()=>{});target.addEventListener('dispose',()=>reallocations++);cinema.glowA.addEventListener('dispose',()=>glowReallocations++);
  cinema.render(()=>{},.9);assert.equal(target.samples,0);assert.equal(reallocations,1);assert.equal(glowReallocations,0);assert.equal(cinema.finish.uniforms.glowStrength.value,.19);
  for(let i=0;i<100;i++)cinema.render(()=>{},i%2?.95:.9);
  assert.equal(reallocations,1,'partial recovery must not thrash multisample attachments');assert.equal(target.texture,texture);
  cinema.render(()=>{},1);assert.equal(target.samples,2);assert.equal(reallocations,2);
  r.width=1600;r.height=900;cinema.render(()=>{},.9);assert.equal(reallocations,3,'resize and sample change must share one release');assert.equal(glowReallocations,1);assert.equal(target.samples,0);
  const passes=r.passes.length;cinema.render(()=>{},.9);assert.equal(r.passes.length-passes,3,'bloom and final colour processing must remain present');
 }finally{cinema.dispose();}
});

test('one fullscreen triangle covers every viewport edge with the original texture coordinates',()=>{
 const cinema=new CinematicRenderer(renderer());
 try{
  const g=cinema.quad.geometry,p=g.attributes.position,uv=g.attributes.uv;assert.equal(p.count,3);assert.equal(g.index,null);
  for(const x of[-1,0,1])for(const y of[-1,0,1]){
   const b=(x-p.getX(0))/(p.getX(1)-p.getX(0)),c=(y-p.getY(0))/(p.getY(2)-p.getY(0)),a=1-b-c;
   assert(a>=0&&b>=0&&c>=0,'fullscreen triangle leaves an uncovered viewport corner');
   assert(Math.abs(a*uv.getX(0)+b*uv.getX(1)+c*uv.getX(2)-(x+1)/2)<1e-6);
   assert(Math.abs(a*uv.getY(0)+b*uv.getY(1)+c*uv.getY(2)-(y+1)/2)<1e-6);
  }
 }finally{cinema.dispose();}
});
