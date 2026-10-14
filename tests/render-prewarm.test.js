import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../vendor/three.module.js';
import {warmScene} from '../render-prewarm.js';

function fixture(){
 const scene=new T.Scene(),camera=new T.PerspectiveCamera();camera.layers.set(4);camera.layers.enable(7);
 const textures=Array.from({length:18},()=>new T.Texture()),material=new T.MeshStandardMaterial({map:textures[0],normalMap:textures[1]});
 const cycle={};cycle.self=cycle;cycle.samplers=textures.slice(2,16);
 const shader=new T.ShaderMaterial({uniforms:{direct:{value:textures[0]},nested:{value:[cycle,{sample:textures[1]}]},data:{value:new Float32Array(100)}}});
 scene.add(new T.Mesh(new T.BoxGeometry(),[material,shader]),new T.Mesh(new T.BoxGeometry(),material));
 scene.background=textures[16];scene.environment=textures[17];
 return{scene,camera,textures,material,shader};
}

test('prewarm uploads each shared material/uniform/background texture once, yielding every eight',async()=>{
 const {scene,camera,textures,material,shader}=fixture(),uploads=[],yields=[],progress=[],compiled=[],draws=[];
 const mask=camera.layers.mask,children=[...scene.children],target={},renderer={
  initTexture(texture){uploads.push(texture);},
  async compileAsync(s,c){assert.equal(s,scene);compiled.push(c.layers.mask);},
  setRenderTarget(){assert.fail('target belongs to caller');},target
 };
 let disposed=0;for(const resource of [...textures,material,shader])resource.addEventListener('dispose',()=>disposed++);
 await warmScene({renderer,scene,camera,report:(...args)=>progress.push(args),yieldWork:async()=>{yields.push(uploads.length);assert.equal(camera.layers.mask,mask);},render:pass=>{draws.push(pass);assert.equal(camera.layers.mask,mask);assert.equal(compiled.length,2);}});
 assert.deepEqual(uploads,textures);assert.deepEqual(yields.slice(0,3),[8,16,18]);assert.deepEqual(compiled,[1,2]);assert.deepEqual(draws,[0,1]);
 assert.deepEqual(progress.filter(p=>p[0]==='textures'),Array.from({length:19},(_,i)=>['textures',i,18]));
 assert.deepEqual(progress.filter(p=>p[0]==='compile'),[['compile',0,2],['compile',1,2],['compile',2,2]]);
 assert.deepEqual(progress.filter(p=>p[0]==='render'),[['render',0,2],['render',1,2],['render',2,2]]);
 assert.equal(camera.layers.mask,mask);assert.equal(disposed,0);assert.equal(renderer.target,target);assert.deepEqual(scene.children,children);
});

test('prewarm awaits compilation, then real draws in order, with task yields between draws',async()=>{
 const scene=new T.Scene(),camera=new T.PerspectiveCamera(),events=[];camera.layers.set(5);
 await warmScene({scene,camera,renderer:{initTexture(){assert.fail('empty scene');},async compileAsync(s,c){events.push(`compile:${c.layers.mask}`);await Promise.resolve();events.push(`ready:${c.layers.mask}`);}},
  report:(stage,done,total)=>events.push(`${stage}:${done}/${total}`),yieldWork:async()=>events.push('yield'),render:async pass=>{assert.equal(camera.layers.mask,32);events.push(`draw:${pass}`);await Promise.resolve();events.push(`drawn:${pass}`);}});
 assert.deepEqual(events,['textures:0/0','compile:0/2','yield','compile:1','ready:1','compile:1/2','yield','compile:2','ready:2','compile:2/2','yield','render:0/2','draw:0','drawn:0','render:1/2','yield','draw:1','drawn:1','render:2/2','yield']);
});

test('compile failure restores the exact original layer mask and never reports completion or draws',async()=>{
 for(const failedLayer of [0,1]){
  const {scene,camera}=fixture(),mask=camera.layers.mask,error=new Error(`compile ${failedLayer}`),progress=[];let compileCount=0;
  await assert.rejects(warmScene({scene,camera,renderer:{initTexture(){},async compileAsync(s,c){assert.equal(c.layers.mask,1<<compileCount);if(compileCount++===failedLayer)throw error;}},
   report:(...args)=>progress.push(args),yieldWork:async()=>{},render(){assert.fail('cannot draw after compilation failed');}}),e=>e===error);
  assert.equal(camera.layers.mask,mask);assert.equal(compileCount,failedLayer+1);assert(!progress.some(p=>p[0]==='render'||p[0]==='compile'&&p[1]>failedLayer));
 }
});

test('upload, yield, report and real draw failures propagate without claiming readiness or retaining camera changes',async()=>{
 for(const failure of ['upload','yield','report','draw']){
  const {scene,camera}=fixture(),mask=camera.layers.mask,error=new Error(failure),progress=[];let draws=0;
  await assert.rejects(warmScene({scene,camera,renderer:{initTexture(){if(failure==='upload')throw error;},async compileAsync(){}},
   report:(...args)=>{if(failure==='report')throw error;progress.push(args);},yieldWork:async()=>{if(failure==='yield')throw error;},
   render:pass=>{draws++;camera.layers.set(6);if(failure==='draw'&&pass===1)throw error;}}),e=>e===error);
  assert.equal(camera.layers.mask,mask);assert(!progress.some(p=>p[0]==='render'&&p[1]===2));assert.equal(draws,failure==='draw'?2:0);
 }
});

test('default yielding uses task timers and works without requestAnimationFrame',async()=>{
 const scene=new T.Scene(),camera=new T.PerspectiveCamera(),oldTimer=globalThis.setTimeout,raf=Object.getOwnPropertyDescriptor(globalThis,'requestAnimationFrame');let tasks=0,draws=0;
 globalThis.setTimeout=(fn,delay)=>{assert.equal(delay,0);tasks++;return oldTimer(fn,delay);};
 globalThis.requestAnimationFrame=()=>assert.fail('prewarm cannot rely on game RAF');
 try{
  await warmScene({scene,camera,renderer:{initTexture(){},async compileAsync(){}},render:()=>draws++});
  assert(tasks>=2);assert.equal(draws,2);
 }finally{globalThis.setTimeout=oldTimer;if(raf)Object.defineProperty(globalThis,'requestAnimationFrame',raf);else delete globalThis.requestAnimationFrame;}
});

test('a lobby prewarm uses its framed camera/light setup once without compiling absent first-person equipment',async()=>{
 const scene=new T.Scene(),camera=new T.PerspectiveCamera(),events=[];camera.layers.set(4);
 await warmScene({scene,camera,passes:1,renderer:{initTexture(){},compileAsync(){assert.fail('must use actual preview setup');}},
  compile:async()=>events.push('preview compile'),yieldWork:async()=>{},render:pass=>events.push(pass)});
 assert.deepEqual(events,['preview compile',0]);assert.equal(camera.layers.mask,16);
});
