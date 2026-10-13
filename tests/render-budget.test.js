import{test}from'node:test';
import assert from'node:assert/strict';
import{renderPixelRatio,RenderBudget}from'../render-budget.js';
test('render budget caps large and high-density displays without enlarging low-density screens',()=>{
 for(const [w,h,dpr,mobile]of [[2560,1440,1.5,false],[3840,2160,2,false],[844,390,3,true],[390,844,3,true]]){
  const ratio=renderPixelRatio(w,h,dpr,mobile);assert(w*h*ratio*ratio<=(mobile?1800000:3200000)+1);assert(ratio<=dpr);
 }
 assert.equal(renderPixelRatio(1280,720,1,false),1);
 assert(renderPixelRatio(3840,2160,1,false)<1);
});
test('quality responds to sustained slow frames, ignores stalls and recovers cautiously',()=>{
 const budget=new RenderBudget();for(let i=0;i<180;i++)budget.sample(1/60);assert.equal(budget.quality,1);
 budget.sample(.8);assert.equal(budget.quality,1);
 for(let i=0;i<360;i++)budget.sample(1/30);assert(budget.quality<1&&budget.quality>=.65);
 const reduced=budget.quality;for(let i=0;i<120;i++)budget.sample(1/60);assert(budget.quality<=reduced&&budget.quality>=.65);
 for(let i=0;i<1800;i++)budget.sample(1/60);assert(budget.quality>reduced&&budget.quality<=1);
});
test('sustained very slow frames still reduce quality while an isolated suspension does not',()=>{
 for(const fps of[8,5,2]){
  const budget=new RenderBudget();for(let i=0;i<fps*8;i++)budget.sample(1/fps);
  assert(budget.quality<1&&budget.quality>=.65,`${fps} FPS must trigger adaptation`);
  for(let i=0;i<fps*40;i++)budget.sample(1/fps);assert.equal(budget.quality,.65);
 }
 for(const gap of[.12,.8,20]){
  const budget=new RenderBudget();for(let i=0;i<180;i++)budget.sample(1/60);
  budget.sample(gap);for(let i=0;i<240;i++)budget.sample(1/60);assert.equal(budget.quality,1);
 }
});

test('mobile keeps a stable 30 FPS image while desktop responds to sustained 45–48 FPS',()=>{
 const mobile=new RenderBudget({mobile:true});for(let i=0;i<1200;i++)mobile.sample(1/30);assert.equal(mobile.quality,1,'30 FPS meets the mobile target');
 for(const fps of[45,48]){const desktop=new RenderBudget();for(let i=0;i<fps*8;i++)desktop.sample(1/fps);assert(desktop.quality<1,`${fps} FPS was ignored by the old 24 ms threshold`);}
 for(const fps of[50,60]){const desktop=new RenderBudget();for(let i=0;i<fps*15;i++)desktop.sample(1/fps);assert.equal(desktop.quality,1,'near-target jitter must not repeatedly lower resolution');}
 for(let i=0;i<20*12;i++)mobile.sample(1/20);assert(mobile.quality<1,'genuinely slow phones still adapt');
 for(let i=0;i<30*150;i++)mobile.sample(1/30);assert.equal(mobile.quality,1,'30 FPS must permit a cautious mobile recovery');
});

test('paused sampling preserves quality and clears timing evidence before play resumes',()=>{
 const budget=new RenderBudget();for(let i=0;i<60*8;i++)budget.sample(1/45);const quality=budget.quality;assert(quality<1);
 for(let i=0;i<600;i++)assert.equal(budget.sample(1/30,false),false);
 assert.equal(budget.quality,quality);assert.equal(budget.frames,0);assert.equal(budget.elapsed,0);assert.equal(budget.slow,0);assert.equal(budget.fast,0);
 for(let i=0;i<60*3;i++)budget.sample(1/60);assert.equal(budget.quality,quality,'pause must not create a premature recovery or downgrade');
 for(let i=0;i<60*30;i++)budget.sample(1/60);assert(budget.quality>quality);
});
