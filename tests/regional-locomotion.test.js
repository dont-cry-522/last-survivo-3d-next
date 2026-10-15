import test from 'node:test';
import assert from 'node:assert/strict';
import {actor,animateActor} from '../world.js';
import {animateRegionalAppearance} from '../regional-enemy-appearance.js';
import {animateBossAppearance,BOSS_COMBAT_HEIGHTS} from '../boss-appearance.js';
import {Vector3,Box3} from '../vendor/three.module.js';
import {ENEMY_MOTION} from '../enemy-motion.js';

test('regional bipeds transfer weight onto the planted foot and counter-swing their arms',()=>{
 for(const kind of ['emberling','lavabrute']){
  const d=actor(kind).userData;
  for(const side of [-1,1]){
   const phase=Math.PI*.64+(side>0?Math.PI:0);
   animateRegionalAppearance(d,0,1,phase,0,0,0);
   const planted=d.legs.filter(l=>l.planted);
   assert.equal(planted.length,1,kind+' lost single support');
   assert.equal(Math.sign(planted[0].restX),side);
   assert(d.rig.position.x*side>.01,kind+' shifts weight over the lifted foot');
   assert(d.rig.rotation.z*side<0,kind+' leans away from its supporting foot');
  }
  animateRegionalAppearance(d,0,1,0,0,0,0);const forward=d.arms[0].rotation.x;
  animateRegionalAppearance(d,0,1,Math.PI,0,0,0);
  assert(forward-d.arms[0].rotation.x>.15,kind+' arm fails to counter the same-side leg');
 }
});

test('regional walking bodies settle smoothly through foot exchanges',()=>{
 const epsilon=1e-4;
 for(const kind of ['emberling','frostwolf','ashstalker','yeti','lavabrute']){
  const d=actor(kind).userData;
  for(const phase of [0,Math.PI,Math.PI*2]){
   const heights=[-epsilon,0,epsilon].map(offset=>{
    animateRegionalAppearance(d,0,1,phase+offset,0,0,0);return d.rig.position.y;
   });
   const before=(heights[1]-heights[0])/epsilon,after=(heights[2]-heights[1])/epsilon;
   assert(Math.abs(before-after)<.0001,kind+' vertical velocity snaps at a foot exchange');
  }
 }
});

test('old bosses slow their cadence as well as their stride, and settle without stepping in place',()=>{
 for(const kind of Object.keys(BOSS_COMBAT_HEIGHTS)){
  const phases=[];
  for(const speed of [.3,1.2]){
   const g=actor(kind),d=g.userData;d.bossStage='walk';
   for(let i=1;i<=120;i++)animateBossAppearance(g,i/60,speed,1/60);
   phases.push(d.phase);const phase=d.phase;
   for(let i=1;i<=90;i++)animateBossAppearance(g,2+i/60,0,1/60);
   assert.equal(d.phase,phase,kind+' keeps stepping after stopping');
   assert(d.walkStride<1e-5,kind+' fails to settle after stopping');
  }
  assert(phases[1]>phases[0]*1.7,kind+' uses the same cadence for slow and fast walking');
  assert(phases[1]<phases[0]*2.5,kind+' only accelerates a tiny shuffle');
 }
});

test('boss locomotion retains quiet multi-leg support and opposing biped arm movement',()=>{
 for(const kind of ['boss','dunescorpion','wreckwarden']){
  const g=actor(kind),d=g.userData;d.walkStride=1;d.bossStage='walk';
  for(let i=0;i<64;i++){
   d.phase=i/64*Math.PI*2;animateBossAppearance(g,0,1,0);
   assert(d.rig.position.y<=.01,kind+' bounces despite broad multi-leg support');
   assert(Math.abs(d.rig.rotation.z)<=.008,kind+' rocks like a two-legged walker');
  }
 }
 for(const kind of ['frostking','cinderlord']){
  const g=actor(kind),d=g.userData;d.walkStride=1;d.bossStage='walk';d.phase=0;
  animateBossAppearance(g,0,1,0);const forward=d.arms[0].rotation.x;
  d.phase=Math.PI;animateBossAppearance(g,0,1,0);
  assert(forward-d.arms[0].rotation.x>.15,kind+' keeps rigid or mistimed arms during a step');
 }
});

test('sand, coast and additional grounded bosses share speed-sensitive and scale-correct foot clocks',()=>{
 const kinds=['tidecrab','reefturtle','clawbeetle','sandguard','sandspitter','duneoracle','thornstag','rimefang','moltenrhino','webmatriarch'];
 for(const kind of kinds)for(const fps of [30,60,120]){
  const phases=[];
  for(const [speed,scale]of [[.2,1],[.8,1],[.8,2]]){
   const g=actor(kind),d=g.userData;g.scale.multiplyScalar(scale);d.bossStage='walk';animateActor(g,0,0);
   for(let i=1;i<=fps*2;i++){g.position.z=speed*i/fps;animateActor(g,i/fps,speed);}
   phases.push(d.phase);
   const phase=d.phase;
   for(let i=1;i<=fps;i++)animateActor(g,2+i/fps,0);
   assert.equal(d.phase,phase,kind+' keeps stepping at a blockage');
   assert(d.walkStride<.0001,kind+' never settles after stopping');
  }
  assert(phases[1]>phases[0]*1.8&&phases[1]<phases[0]*2.2,kind+' does not slow cadence along with its stroke');
  assert(Math.abs(phases[2]*2-phases[1])<1e-8,kind+' foot clock ignores the scaled anatomy');
 }
});

test('crab and beetle use one low bound at real lunge speed, then settle on the existing recovery clock',()=>{
 const pose=g=>{const values=[];g.traverse(o=>values.push(...o.position.toArray(),...o.quaternion.toArray(),...o.scale.toArray()));return values;};
 const ease=p=>.25*p+1.2/Math.PI*(1-Math.cos(Math.PI*p)),point=new Vector3(),end=new Vector3();
 for(const kind of ['tidecrab','clawbeetle'])for(const fps of [30,60,120])for(const missed of [false,true]){
  const g=actor(kind),d=g.userData,dt=1/fps,cfg=ENEMY_MOTION[kind],recovery=missed?.62:cfg.recover,height=d.combatHeight;
  let t=0;animateActor(g,t,0,cfg.wind);
  for(let i=1;i<=Math.ceil(cfg.wind*fps);i++){t+=dt;animateActor(g,t,0,Math.max(.000001,cfg.wind-i*dt));}
  const phase=d.phase,front=d.legs.reduce((a,b)=>a.hip.z>b.hip.z?a:b);let peak=0,raised=0,early=Infinity,late=-Infinity,remaining=.24;
  const beforeLaunch=pose(g);d.pounce=1;animateActor(g,t,0,0);
  assert(Math.max(...pose(g).map((v,i)=>Math.abs(v-beforeLaunch[i])))<.001,kind+' snaps from wind-up to takeoff');
  while(remaining>0){
   g.updateMatrixWorld(true);const previousBodyY=d.rig.position.y,previousToes=d.legs.map(l=>l.paw.getWorldPosition(new Vector3()).sub(g.position));
   const from=1-remaining/.24,to=Math.min(1,from+dt/.24),step=14*(dt+.24*((ease(to)-ease(from))/ease(1)-(to-from)));
   remaining=Math.max(0,remaining-dt);d.pounce=remaining/.24;d.landRecover=remaining?0:recovery;g.position.z+=step;t+=dt;
   const root=g.position.toArray();animateActor(g,t,step/dt,0);g.updateMatrixWorld(true);
   assert.deepEqual(g.position.toArray(),root,'animation moved the collision actor');assert.equal(d.combatHeight,height);assert.equal(d.phase,phase,kind+' pedals during the bound or its last translating frame');
   peak=Math.max(peak,d.rig.position.y);if(d.legs.every(l=>!l.planted))raised++;
   front.paw.getWorldPosition(point);const reach=point.z-g.position.z;if(d.pounce>.65&&d.pounce<.9)early=Math.min(early,reach);if(d.pounce>.1&&d.pounce<.35)late=Math.max(late,reach);
   for(const l of d.legs){
    assert(new Box3().setFromObject(l.paw,true).min.y>=.006,kind+' drives a foot through the floor');
    end.set(0,-l.upperLength,0).applyMatrix4(l.upper.matrixWorld);assert(end.distanceTo(l.knee.getWorldPosition(point))<1e-6);
    end.set(0,-l.lowerLength,0).applyMatrix4(l.knee.matrixWorld);assert(end.distanceTo(l.paw.getWorldPosition(point))<1e-6);
   }
   if(!remaining){
    assert(Math.abs(d.rig.position.y-previousBodyY)<.03,kind+' body snaps at the final translating frame');
    d.legs.forEach((l,i)=>assert(l.paw.getWorldPosition(point).sub(g.position).distanceTo(previousToes[i])<.04,kind+' feet snap when pounce reaches zero'));
   }
   const paused=pose(g);animateActor(g,t,step/dt,0);assert.deepEqual(pose(g),paused,kind+' bound advances during pause');
  }
  assert(peak>.07&&peak<.15,kind+' bound has no bounded body lift');assert(raised>=fps*.14,kind+' glides with planted feet');assert(late-early>.04,kind+' never reaches forward to land');
  assert(d.legs.every(l=>l.planted),kind+' fails to land at the end of the bound');
  for(let i=1;i<=Math.ceil(recovery*fps)+2;i++){
   d.landRecover=Math.max(0,recovery-i*dt);t+=dt;animateActor(g,t,0,0);assert.equal(d.phase,phase);assert(d.legs.every(l=>l.planted),kind+' resumes pedalling during recovery');
   if(missed&&i===Math.ceil(fps*.1))assert(d.rig.position.y<-.01,kind+' postpones absorption until a long missed recovery is nearly over');
  }
  assert(Math.abs(d.rig.position.y)<.001,kind+' never returns from its landing compression');
  d.landRecover=0;g.position.z+=dt;t+=dt;animateActor(g,t,1,0);assert(d.phase>phase,kind+' cannot resume walking after landing');
 }
});
