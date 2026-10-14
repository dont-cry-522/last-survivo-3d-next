import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../vendor/three.module.js';
import {readFileSync} from 'node:fs';
const clockImport=readFileSync(new URL('../main.js',import.meta.url),'utf8').match(/from'(.\/creature-forms\.js[^']*)'/)[1];
const {surface,tube,setCreatureTime,gait}=await import(new URL('../'+clockImport,import.meta.url));
for(const name of ['coast-models.js','expansion-models.js'])assert(readFileSync(new URL('../'+name,import.meta.url),'utf8').includes("'"+clockImport+"'"),'creature clock must use the same module URL as main');
import {makeSandEnemy,animateSandEnemy} from '../expansion-models.js';
import {makeCoastEnemy,animateCoastEnemy} from '../coast-models.js';
const heights={sandworm:.53,clawbeetle:.86,sandguard:1.85,sandspitter:2,duneoracle:2,foamling:1.16,tidecrab:.97,reefturtle:1.2,jellyseer:1.42,tidestar:.7};
const coastal=new Set(['foamling','tidecrab','reefturtle','jellyseer','tidestar']);
const make=k=>coastal.has(k)?makeCoastEnemy(k):makeSandEnemy(k);
const animate=(m,...args)=>(coastal.has(m.userData.kind)?animateCoastEnemy:animateSandEnemy)(m,...args);
const meshes=m=>{const a=[];m.traverse(o=>{if(o.isMesh)a.push(o);});return a;};
const pose=m=>{const a=[];m.traverse(o=>a.push(...o.position.toArray(),...o.quaternion.toArray(),...o.scale.toArray()));return a;};

test('Y and Z lofts face outward with ascending or descending sections, including caps',()=>{
 for(const axis of ['y','z'])for(const descending of [false,true]){
  const rings=[[0,1,1],[1,1,1],[2,1,1]];if(descending)rings.reverse();const g=surface(0xffffff,rings,{axis}),m=new T.Mesh(g,new T.MeshBasicMaterial()),p=g.attributes.position,n=g.attributes.normal;
  for(let i=0;i<16*3;i++){const dot=p.getX(i)*n.getX(i)+(axis==='y'?p.getZ(i)*n.getZ(i):p.getY(i)*n.getY(i));assert(dot>.7,`${axis}/${descending} inward normal`);}
  m.updateMatrixWorld(true);const ray=new T.Raycaster(new T.Vector3(3,axis==='y'?1:0,axis==='z'?1:0),new T.Vector3(-1,0,0)),hits=ray.intersectObject(m);assert(hits.length&&Math.abs(hits[0].point.x-1)<1e-6);
  for(const end of[0,2]){const origin=new T.Vector3(0,0,0),direction=new T.Vector3(0,0,0);origin[axis]=end===0?-1:3;direction[axis]=end===0?1:-1;const cap=new T.Raycaster(origin,direction).intersectObject(m);assert(cap.length&&Math.abs(cap[0].point[axis]-end)<1e-6,'unsealed/reversed cap');}
  g.dispose();m.material.dispose();
 }
});

test('curved limbs are sealed at both ends without DoubleSide materials',()=>{
 const g=tube(0xffffff,[[0,0,0],[0,1,0]],[.1,.1]),m=new T.Mesh(g,new T.MeshBasicMaterial());m.updateMatrixWorld(true);
 for(const [y,dy]of[[-1,1],[2,-1]]){const hits=new T.Raycaster(new T.Vector3(.005,y,0),new T.Vector3(0,dy,0)).intersectObject(m);assert(hits.length&&Math.abs(hits[0].point.y-(dy>0?0:1))<1e-6);}
 g.dispose();m.material.dispose();
});

test('ten organic creatures keep legacy combat heights and reuse bounded shared resources',()=>{
 let calls=0,triangles=0;const finishes=new Set();
 for(const [kind,height]of Object.entries(heights)){
  const a=make(kind),b=make(kind),am=meshes(a),bm=meshes(b);assert.equal(a.userData.combatHeight,height,kind);assert.equal(am.length,bm.length);
  am.forEach((m,i)=>{assert.equal(m.geometry,bm[i].geometry);assert.equal(m.material,bm[i].material);assert.equal(m.material.side,T.FrontSide);assert(!Object.hasOwn(m,'onBeforeRender'));assert(!Object.hasOwn(m,'onBeforeShadow'));assert(m.geometry.attributes.position.array.every(Number.isFinite));assert.equal(m.geometry.attributes.creatureBend.count,m.geometry.attributes.position.count);finishes.add(m.material);calls++;triangles+=m.geometry.attributes.position.count/3;});
 }
 assert(calls<=137,`${calls} draws exceeds old 137`);assert(triangles<=40172,`${triangles} triangles exceeds old 40172`);assert.equal(finishes.size,2);
});

test('shared bends use one game clock with geometry amplitudes, unaffected by actor order or disposal',()=>{
 const worm=make('sandworm'),jelly=make('jellyseer'),star=make('tidestar'),normal={uniforms:{},vertexShader:'#include <begin_vertex>'},depth={uniforms:{},vertexShader:'#include <begin_vertex>'};
 worm.userData.body.material.onBeforeCompile(normal);jelly.userData.tentacles.customDepthMaterial.onBeforeCompile(depth);assert.equal(normal.uniforms.creatureTime,depth.uniforms.creatureTime);
 setCreatureTime(8.25);for(const [i,m]of[worm,jelly,star].entries())animate(m,150+i,3,0,1/60);assert.equal(normal.uniforms.creatureTime.value,8.25,'actor ID leaked into common clock');
 assert(normal.vertexShader.includes('attribute vec3 creatureBend'));assert(!normal.vertexShader.includes('uniform vec4 creatureBend'));
 const root=new T.Group();root.add(worm,jelly,star);root.remove(jelly);assert.equal(normal.uniforms.creatureTime.value,8.25);setCreatureTime(8.25);assert.equal(depth.uniforms.creatureTime.value,8.25);setCreatureTime(9);assert.equal(depth.uniforms.creatureTime.value,9);
});

test('coastal tops and star arms raycast from outside with outward normals',()=>{
 for(const kind of ['foamling','reefturtle','jellyseer','tidestar']){
  const m=make(kind);m.updateMatrixWorld(true);for(const [x,z]of kind==='tidestar'?[[.03,.03],[0,.68],[.48,.14]]:[[.03,.03]]){const hits=new T.Raycaster(new T.Vector3(x,3,z),new T.Vector3(0,-1,0)).intersectObject(m,true);assert(hits.length,kind+' is open from above');assert(hits[0].face.normal.y>0,kind+' inward top');}
 }
 const worm=make('sandworm'),b=new T.Box3().setFromObject(worm.userData.body).getSize(new T.Vector3());assert(b.z>b.y*2.5,'worm body stood vertically');
});

test('ranged casts have real moving focus nodes inside the model hierarchy',()=>{
 for(const kind of ['sandspitter','duneoracle','jellyseer','tidestar']){const m=make(kind),d=m.userData;assert(d.attackSocket?.isObject3D);let parent=d.attackSocket;while(parent.parent)parent=parent.parent;assert.equal(parent,m);for(let i=0;i<90;i++){animate(m,i/60,0,Math.max(0,.7-i/60),1/60);m.updateMatrixWorld(true);const p=d.attackSocket.getWorldPosition(new T.Vector3());assert(p.toArray().every(Number.isFinite));assert(p.y>.3&&p.y<2.5,kind+' cast socket outside body height');}}
});

test('planted feet stay above ground, swing feet lift and pauses preserve complete poses',()=>{
 for(const kind of ['clawbeetle','sandguard','sandspitter','duneoracle','tidecrab','reefturtle'])for(const fps of [30,60,120]){
  const m=make(kind),d=m.userData;let lift=0;
  for(let i=0;i<fps*2;i++){
   const time=i/fps,attack=i>fps&&i<fps*1.6?.6-(i-fps)/fps:0;animate(m,time,i<fps?3:0,attack,1/fps);m.updateMatrixWorld(true);
   for(const l of d.legs){const bottom=new T.Box3().setFromObject(l.paw,true).min.y;assert(bottom>=.006,`${kind}: foot penetrates ${bottom}`);if(l.planted)assert(bottom<.011,`${kind}: support foot floats ${bottom}`);lift=Math.max(lift,bottom);}
   const before=pose(m);animate(m,time,i<fps?3:0,attack,0);assert.deepEqual(pose(m),before,kind+' pose drifted during pause');
  }
  assert(lift>.035,kind+' lacks swing recovery');assert(pose(m).every(Number.isFinite));
 }
 assert(gait(0,1).support);assert(!gait(Math.PI*1.7,1).support);
});
