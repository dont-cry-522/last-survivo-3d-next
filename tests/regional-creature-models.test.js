import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../vendor/three.module.js';
import {readFileSync} from 'node:fs';
const clockImport=readFileSync(new URL('../main.js',import.meta.url),'utf8').match(/from'(.\/creature-forms\.js[^']*)'/)[1];
const {surface,tube,setCreatureTime,gait}=await import(new URL('../'+clockImport,import.meta.url));
for(const name of ['coast-models.js','expansion-models.js'])assert(readFileSync(new URL('../'+name,import.meta.url),'utf8').includes("'"+clockImport+"'"),'creature clock must use the same module URL as main');
import {makeSandEnemy,animateSandEnemy} from '../expansion-models.js';
import {makeCoastEnemy,animateCoastEnemy} from '../coast-models.js';
import {actor,animateActor} from '../world.js';
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
 assert(calls<=137,`${calls} draws exceeds old 137`);assert(triangles<=40172,`${triangles} triangles exceeds old 40172`);assert.equal(finishes.size,3);assert.equal([...finishes].filter(m=>m.transparent).length,1);
});

test('shared bends use one game clock with geometry amplitudes, unaffected by actor order or disposal',()=>{
 const worm=make('sandworm'),jelly=make('jellyseer'),star=make('tidestar'),normal={uniforms:{},vertexShader:T.ShaderLib.standard.vertexShader,fragmentShader:T.ShaderLib.standard.fragmentShader},depth={uniforms:{},vertexShader:T.ShaderLib.depth.vertexShader,fragmentShader:T.ShaderLib.depth.fragmentShader};
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

test('actual coastal water poses keep both fixed leg links joined through entry, paddling, pause and exit',()=>{
 const end=new T.Vector3(),anchor=new T.Vector3();
 for(const kind of ['tidecrab','reefturtle'])for(const fps of [30,60,120]){
  const m=actor(kind),d=m.userData;let deepest=0;m.position.set(3,.2,-2);m.rotation.y=.7;
  for(const l of d.legs){assert.equal(l.upper.parent,l.joint);assert.equal(l.knee.parent,l.joint);assert.equal(l.paw.parent,l.joint);}
  for(let i=0;i<fps*6;i++){
   const time=i/fps,speed=time<4?2.5:0,attack=time%1.5<.6?.6-time%1.5:0;
   d.waterDepth=time>=.5&&time<3?.9:0;animateActor(m,time,speed,attack);m.updateMatrixWorld(true);deepest=Math.max(deepest,d.waterBlend||0);
   for(const l of d.legs){
    end.set(0,-l.upperLength,0).applyMatrix4(l.upper.matrixWorld);l.knee.getWorldPosition(anchor);assert(end.distanceTo(anchor)<1e-6,`${kind}/${fps}: upper link disconnected at ${time}`);
    end.set(0,-l.lowerLength,0).applyMatrix4(l.knee.matrixWorld);l.paw.getWorldPosition(anchor);assert(end.distanceTo(anchor)<1e-6,`${kind}/${fps}: lower link disconnected at ${time}`);
   }
   if(i%15===0){const before=pose(m);animateActor(m,time,speed,attack);assert.deepEqual(pose(m),before,`${kind}/${fps}: paused water pose drifted`);}
  }
  assert(deepest>.89,'never reached deep-water pose');assert.equal(d.waterBlend,0,'water pose did not clear after leaving');assert.deepEqual(m.position.toArray(),[3,.2,-2]);assert(pose(m).every(Number.isFinite));
 }
});

test('translated sand and coast walkers plant support feet and settle without walking through a blockage',()=>{
 const cases=[['tidecrab',3.7],['reefturtle',1.5],['clawbeetle',3.7],['sandguard',1.6],['sandspitter',2.1],['duneoracle',1.9]],point=new T.Vector3(),hip=new T.Vector3();
 for(const [kind,normalSpeed]of cases)for(const fps of[30,60,120])for(const speed of[normalSpeed,.45]){
  const m=make(kind),d=m.userData,previous=[];m.rotation.y=.67;let contacts=0,threeFeet=0;
  for(let i=0;i<fps*3;i++){
   const t=i/fps;m.position.set(Math.sin(.67)*speed*t,0,Math.cos(.67)*speed*t);animate(m,t,speed,0,1/fps);m.updateMatrixWorld(true);
   if(d.legs.filter(l=>l.planted).length===3)threeFeet++;
   d.legs.forEach((l,n)=>{
    l.paw.getWorldPosition(point);if(i>fps&&l.planted&&previous[n].planted){assert(Math.hypot(point.x-previous[n].x,point.z-previous[n].z)<1e-5,`${kind}/${fps}: planted foot slid with the translating body`);contacts++;}
    previous[n]={x:point.x,z:point.z,planted:l.planted};hip.set(l.hip.x,l.hip.y,l.hip.z);assert(l.joint.position.distanceTo(hip)<.055,`${kind}: hip pulled out of the body`);
   });
  }
  assert(contacts>fps,kind+' never established support');if(kind==='reefturtle')assert(threeFeet>fps*.2,'turtle still lifts both diagonal pairs together');
  const phase=d.phase;for(let i=0;i<fps;i++)animate(m,3+i/fps,0,0,1/fps);assert.equal(d.phase,phase,'blocked actor keeps taking steps');assert(d.walkStride<1e-5,'stopping did not settle the legs');
  const frozen=pose(m);animate(m,4-1/fps,0,0,0);assert.deepEqual(pose(m),frozen,'paused settled walker drifts');
 }
});

test('distance-matched coastal and sand steps reach the same complete pose at each supported frame rate',()=>{
 for(const kind of ['tidecrab','reefturtle','clawbeetle','sandguard','sandspitter','duneoracle']){
  const samples=[];for(const fps of [30,60,120]){const m=make(kind);for(let i=1;i<=fps*2;i++)animate(m,i/fps,1.5,0,1/fps);samples.push(pose(m));}
  for(const sample of samples.slice(1))assert(Math.max(...sample.map((v,i)=>Math.abs(v-samples[0][i])))<1e-8,kind+' stepping depends on rendering frequency');
 }
});

test('sandworm mouth has real depth and the crab and beetle retain different shell proportions',()=>{
 const worm=make('sandworm');worm.updateMatrixWorld(true);const hits=new T.Raycaster(new T.Vector3(0,.25,1),new T.Vector3(0,0,-1)).intersectObject(worm,true);
 assert(hits.length);assert(hits[0].point.z<.23,'a flat front cap plugs the open throat');assert(hits[0].point.z>.10,'throat has an unsealed hole through the body');
 const crab=new T.Box3().setFromObject(make('tidecrab').userData.body).getSize(new T.Vector3()),beetle=new T.Box3().setFromObject(make('clawbeetle').userData.body).getSize(new T.Vector3());
 assert(crab.x/crab.z>1.1,'crab should have a broad lateral carapace');assert(beetle.x/beetle.z<.85,'beetle should have a long divided wing case');assert(crab.y/crab.x<.4&&beetle.y/beetle.z<.4,'shells became round upright bodies');
});

test('only the jelly outer umbrella uses a single transparent draw and its inner anatomy is opaque',()=>{
 for(const kind of Object.keys(heights)){
  const m=make(kind),transparent=meshes(m).filter(o=>o.material.transparent);assert.equal(transparent.length,kind==='jellyseer'?1:0,kind);
  if(kind==='jellyseer'){assert.equal(transparent[0],m.userData.body);assert.equal(transparent[0].material.depthWrite,false);assert(m.userData.inner&&!m.userData.inner.material.transparent);assert(!m.userData.head,'jelly still has an anthropomorphic face rig');}
  if(kind==='foamling'){assert(m.userData.crest);assert(!m.userData.head,'rolling surf still has a face rig');}
 }
});

test('small coastal eye motions stay attached, bounded and independent between creatures',()=>{
 for(const kind of ['tidecrab','reefturtle'])for(const fps of [30,60,120]){
  const a=make(kind),b=make(kind),rest=pose(b),d=a.userData;let motion=0,minimumLid=1;
  assert.equal(d.eyes.length,2);const origin=d.eyes.map(e=>e.position.clone());
  for(let i=0;i<fps*6;i++){
   const t=i/fps,attack=t%1.5<.6?.6-t%1.5:0;animate(a,t,0,attack,1/fps);
   d.eyes.forEach((eye,n)=>{assert.equal(eye.parent,kind==='tidecrab'?d.rig:d.head);assert(eye.position.distanceTo(origin[n])<1e-9,'eye separated from its anchor');assert(Math.abs(eye.rotation.x)<.3&&Math.abs(eye.rotation.y)<.3);assert(eye.scale.y>=.02&&eye.scale.y<=1);motion=Math.max(motion,Math.abs(eye.rotation.y));minimumLid=Math.min(minimumLid,eye.scale.y);});
   const frozen=pose(a);animate(a,t,0,attack,0);assert.deepEqual(pose(a),frozen,'small expressions advanced while paused');
  }
  if(kind==='tidecrab')assert(motion>.08,'stalks never scan or brace');else assert(minimumLid<.15,'turtle never closes its eyelids');
  assert.deepEqual(pose(b),rest,'one creature animated another instance');
 }
});

test('jelly bell contracts briefly, refills slowly and keeps opaque canals within its membrane',()=>{
 const m=make('jellyseer'),d=m.userData;let minimum=1,atMinimum=0;
 for(let i=0;i<=Math.floor(60/.36);i++){
  const t=i/60;animate(m,t,0,0,1/60);if(d.body.scale.x<minimum){minimum=d.body.scale.x;atMinimum=t;}
  assert(d.body.scale.x>.95&&d.body.scale.x<1.04);assert(d.inner.scale.x>.97&&d.inner.scale.x<1.02);assert(Math.abs(d.body.position.y)<.03&&Math.abs(d.inner.position.y)<.03);assert(Math.abs(d.tentacles.position.y)<.015);
 }
 assert(atMinimum>.5&&atMinimum<.75,'contraction should precede the long refill');assert(minimum<.96);assert(d.body.scale.x>1.01,'bell did not refill');
 const second=make('jellyseer');assert.equal(d.body.material,second.userData.body.material);assert.equal(meshes(m).filter(o=>o.material.transparent).length,1,'internal canals added another transparent pass');
});
