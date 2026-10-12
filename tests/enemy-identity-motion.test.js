import{test}from'node:test';import assert from'node:assert/strict';import{actor,animateActor}from'../world.js';import{ENEMY_MOTION,gaitPace,animateEnemyIdentity,advanceEnemyLocomotion}from'../enemy-motion.js';
import{polishEnemyAppearance}from'../enemy-appearance.js';import{Vector3,Scene,Box3}from'../vendor/three.module.js';import{recordEnemyHit,EnemyDeaths}from'../enemy-feedback.js';
const pose=m=>{const d=m.userData;return[d.rig,...d.arms,...d.legs.flatMap(l=>[l.joint||l,l.knee,l.paw]),d.cap,d.head,d.staff,d.satellites,d.tail,d.tailTip,d.hatTip,d.hem,...(d.ears||[]),...(d.feet||[]),...(d.segments||[])].filter(Boolean).flatMap(o=>[...o.position.toArray(),o.rotation.x,o.rotation.y,o.rotation.z,...o.scale.toArray()]);};
test('all walking species have distinct moving and attack poses with bounded transforms',()=>{for(const attack of [false,true]){const signatures=new Set();for(const[id,cfg]of Object.entries(ENEMY_MOTION)){const m=actor(id);if(m.userData.bossModel)continue;for(let i=0;i<40;i++)animateActor(m,i/60,attack?0:3,attack?cfg.wind*(1-i/50):0,0);const values=pose(m);assert(values.every(Number.isFinite),id);signatures.add(values.map(v=>v.toFixed(3)).join(','));}assert.equal(signatures.size,25);}});
test('release blends from the strike without an arm or staff snap at 30, 60 and 120 FPS',()=>{for(const fps of [30,60,120])for(const[id,cfg]of Object.entries(ENEMY_MOTION)){const m=actor(id),dt=1/fps;if(m.userData.bossModel)continue;let t=0;for(;t<cfg.wind-dt;t+=dt)animateActor(m,t,0,cfg.wind-t,0);animateActor(m,t,0,.001,0);const before=pose(m);animateActor(m,t+dt,0,0,0);const after=pose(m),jump=Math.max(...before.map((v,i)=>Math.abs(v-after[i])));assert(jump<.45,`${id} ${fps} FPS jumps ${jump}`);for(let j=1;j<fps*3;j++)animateActor(m,t+j*dt,0,0,0);assert.equal(m.userData.release,0);}});
test('rabbit and mushroom advance in bounds while emberling scuttles; no gait reverses movement',()=>{for(const kind of Object.keys(ENEMY_MOTION))for(let phase=0;phase<7;phase+=.1)assert(gaitPace(kind,phase)>0);assert(gaitPace('snowhare',Math.PI/2)>gaitPace('snowhare',Math.PI)*4);assert(gaitPace('emberling',Math.PI/2)<gaitPace('emberling',Math.PI)*1.5);});
test('forest secondary motion freezes with game time and recovers after stopping',()=>{for(const kind of ['mushroom','wolf','golem','spitter','shaman']){const m=polishEnemyAppearance(actor(kind));for(let i=0;i<120;i++)animateActor(m,i/60,3,0,0);const before=pose(m);for(let i=0;i<30;i++)animateActor(m,119/60,3,0,0);assert.deepEqual(pose(m),before,kind+' moved while paused');for(let i=120;i<=360;i++)animateActor(m,i/60,0,0,0);assert(m.userData.stride<1e-8,kind+' kept walking after stopping');assert(pose(m).every(Number.isFinite));}});
test('forest gait and delayed follow-through agree at 30, 60 and 120 FPS',()=>{for(const kind of ['mushroom','wolf','golem','spitter','shaman']){const samples=[];for(const fps of [30,60,120]){const m=polishEnemyAppearance(actor(kind));animateActor(m,0,0,0,0);for(let i=1;i<=fps*2;i++){m.userData.walkPhase=i/fps*ENEMY_MOTION[kind].cadence;animateActor(m,i/fps,3,0,0);}samples.push(pose(m));}for(const values of samples.slice(1))assert(Math.max(...values.map((v,i)=>Math.abs(v-samples[0][i])))<1e-8,kind+' gait depended on frame rate');}});
test('wolf paws support low, lift on the return and keep finite joints through repeated lunges',()=>{
 const wolf=polishEnemyAppearance(actor('wolf')),d=wolf.userData,support=[],swing=[];
 for(let i=0;i<100;i++){animateEnemyIdentity(d,0,1,i/100*Math.PI*2,0,0,0);wolf.updateMatrixWorld(true);(i<62?support:swing).push(new Box3().setFromObject(d.legs[0].knee,true).min.y);}
 assert(Math.max(...support)-Math.min(...support)<.05,'supporting paw bobs above the floor');assert(Math.max(...swing)>Math.max(...support)+.05,'swinging paw never lifts');
 for(let i=0;i<600;i++){d.pounce=(i%36)/36;d.walkPhase=i/60*12;animateActor(wolf,i/60,3,i%72<36?(36-i%36)/60:0,0);assert(pose(wolf).every(Number.isFinite));}
 assert.equal(d.legs.length,4);assert(d.legs.every(l=>Math.abs(l.knee.rotation.x)<Math.PI));
});
test('forest swimming, recoil and death combine without moving roots, pause drift or leftover bodies',()=>{
 for(const kind of ['mushroom','wolf','golem','spitter','shaman']){
  const m=actor(kind),control=actor(kind),d=m.userData,scene=new Scene(),deaths=new EnemyDeaths(scene);scene.add(m);
  for(const mesh of[m,control]){mesh.position.set(2,0,3);mesh.userData.waterDepth=1;for(let i=0;i<90;i++)animateActor(mesh,i/60,3,0,0);}
  recordEnemyHit(m,{kind:'hammer',damage:20,maxHp:100,angle:Math.PI/3});animateActor(m,1.5,3,0,0);const paused=pose(m),age=d.hitReaction.age;
  for(let i=0;i<12;i++)animateActor(m,1.5,3,0,0);assert.deepEqual(pose(m),paused,kind+' recoil/swim moved while paused');assert.equal(d.hitReaction.age,age);
  animateActor(control,1.5,3,0,0);
  for(let i=91;i<210;i++){for(const mesh of[m,control]){mesh.userData.waterDepth=i<120?1:0;animateActor(mesh,i/60,i<150?3:0,0,0);}assert.deepEqual(m.position.toArray(),[2,0,3]);}
  assert(!d.hitReaction);assert.equal(d.waterBlend,0);assert.deepEqual(pose(m),pose(control),kind+' retained a recoil or swimming offset');
  d.waterDepth=1;for(let i=210;i<270;i++)animateActor(m,i/60,3,0,0);recordEnemyHit(m,{kind:'hammer',damage:20,maxHp:100,angle:1});animateActor(m,4.5,3,0,0);assert(d.waterBlend>.99&&d.hitReaction);
  deaths.add({mesh:m,role:kind});deaths.update(.18);assert(pose(m).every(Number.isFinite));const dying=pose(m);deaths.update(0);assert.deepEqual(pose(m),dying,kind+' corpse changed while paused');deaths.update(.32);assert.equal(deaths.items.length,0);assert.equal(scene.children.length,0);
 }
});
test('wolf contact masks follow ground distance once per support pair and never fire while blocked, paused or airborne',()=>{
 const d=actor('wolf').userData;d.walkPhase=0;advanceEnemyLocomotion(d,1/60,0,false);const contacts=[];
 for(let i=0;i<160;i++){d.walkPhase=i;const mask=advanceEnemyLocomotion(d,1/60,.025,true);if(mask)contacts.push(mask);}
 assert.deepEqual(contacts,[6,9,6,9,6]);assert(Math.abs(d.visualPhase-18)<1e-10);
 const phase=d.visualPhase;for(let i=0;i<100;i++)assert.equal(advanceEnemyLocomotion(d,1/60,0,true),0);assert.equal(d.visualPhase,phase);
 d.pounce=.5;for(let i=0;i<10;i++)assert.equal(advanceEnemyLocomotion(d,1/60,.15,false),0);assert.equal(d.visualPhase,phase);
 const state=[d.visualPhase,d.contactPhase,d.motionTurn,d.motionLook,d.motionSpeed];d.turnRate=6;d.lookTurn=.7;assert.equal(advanceEnemyLocomotion(d,0,.1,true),0);assert.deepEqual([d.visualPhase,d.contactPhase,d.motionTurn,d.motionLook,d.motionSpeed],state);
});
test('mushroom footfall remains in phase with its existing hop without changing the AI phase',()=>{
 const d=actor('mushroom').userData;let contacts=0;for(let i=0;i<=360;i++){const phase=i/360*Math.PI*6+.03;d.walkPhase=phase;const mask=advanceEnemyLocomotion(d,1/60,.03,true);assert.equal(d.walkPhase,phase);if(mask){assert.equal(mask,3);contacts++;assert(Math.abs(Math.sin(phase))<.07,'contact occurred above the ground');}}
 assert.equal(contacts,3);d.walkPhase+=Math.PI*2;assert.equal(advanceEnemyLocomotion(d,1/60,0,false),0);
});
test('distance gait, turning follow-through and contact count agree across frame rates',()=>{
 const samples=[];for(const fps of[30,60,120]){const m=actor('wolf'),d=m.userData;let contacts=0;d.turnRate=3;d.lookTurn=.5;animateActor(m,0,0,0,0);advanceEnemyLocomotion(d,1/fps,0,false);
  // Initialize the filtered turn at the same game-time origin for all samplers.
  d.motionTurn=d.motionLook=0;
  for(let i=1;i<=fps*2;i++){d.walkPhase=i/fps*12;if(advanceEnemyLocomotion(d,1/fps,2.7/fps,true))contacts++;animateActor(m,i/fps,2.7,0,0);}
  samples.push({pose:pose(m),phase:d.visualPhase,contacts});
 }
 for(const s of samples.slice(1)){assert.equal(s.contacts,samples[0].contacts);assert(Math.abs(s.phase-samples[0].phase)<1e-9);assert(Math.max(...s.pose.map((v,i)=>Math.abs(v-samples[0].pose[i])))<1e-8);}
});
test('regional relatives can turn without accumulating head, cap or tail offsets',()=>{
 for(const kind of['snowhare','emberling','frostwolf','ashstalker']){const m=actor(kind),d=m.userData;d.turnRate=4;d.lookTurn=.65;
  for(let i=0;i<180;i++){d.walkPhase=i/60*ENEMY_MOTION[kind].cadence;advanceEnemyLocomotion(d,1/60,.04,true);animateActor(m,i/60,2.4,0,0);}
  const before=pose(m);for(let i=0;i<30;i++){advanceEnemyLocomotion(d,0,0,false);animateActor(m,179/60,2.4,0,0);}assert.deepEqual(pose(m),before,kind+' turn offsets accumulated during pause');assert(pose(m).every(Number.isFinite));assert(Math.abs(d.cap?.rotation.y||d.head?.rotation.y||0)<.5);
 }
});
test('landing compression folds wolf knees and keeps mushroom feet supported',()=>{
 for(const kind of['wolf','mushroom']){const m=actor(kind),d=m.userData,point=new Vector3(),heights=[];d.pounce=0;d.walkPhase=0;
  for(let i=0;i<=18;i++){d.landRecover=.18-i*.01;animateActor(m,i/100,0,0,0);m.updateMatrixWorld(true);for(const foot of kind==='wolf'?d.legs.map(l=>l.paw):d.feet)heights.push(foot.getWorldPosition(point).y);}
  assert(Math.min(...heights)>(kind==='wolf'?.005:.11),kind+' feet were pushed below their support during landing');assert(Math.max(...heights)-Math.min(...heights)<.025,kind+' feet rose with the landing squash');
 }
});
test('real wolf calf and paw geometry stays above ground across landing phases, prior stride and turns',()=>{
 for(const fps of[30,60,120])for(const phase of[0,1.3,3.5,5.8]){
  const m=actor('wolf'),d=m.userData;d.walkPhase=phase;d.motionTurn=.5;d.motionLook=.3;d.motionSpeed=0;d.pounceMissed=true;
  animateActor(m,0,3,0,0);d.stride=1;d.pounce=.05;animateActor(m,1/fps,12,0,0);d.pounce=0;
  for(let i=0;i<=Math.ceil(fps*.18);i++){
   d.landRecover=Math.max(0,.18-i/fps);animateActor(m,(i+2)/fps,0,0,0);m.updateMatrixWorld(true);
   for(const leg of d.legs){const surface=new Box3().setFromObject(leg.knee,true).min.y;assert(surface>-.002,`${fps} FPS phase ${phase}: real foot sank ${surface}`);assert.equal(leg.knee.position.y,-leg.upperLength);assert.equal(leg.paw.position.y,-leg.lowerLength);assert.deepEqual(leg.joint.scale.toArray(),[1,1,1]);}
  }
 }
});
test('wolf head and mushroom cap trail directional recoil, freeze on pause and settle back',()=>{
 for(const kind of['wolf','mushroom']){const control=actor(kind),left=actor(kind),right=actor(kind),all=[control,left,right];for(const m of all)animateActor(m,0,0,0,0);
  recordEnemyHit(left,{kind:'hammer',angle:Math.PI/2,damage:30,maxHp:100});recordEnemyHit(right,{kind:'hammer',angle:-Math.PI/2,damage:30,maxHp:100});
  for(let i=1;i<=3;i++)for(const m of all)animateActor(m,i/60,0,0,0);
  const joint=m=>kind==='wolf'?m.userData.head:m.userData.cap,l=joint(left).rotation.z-joint(control).rotation.z,r=joint(right).rotation.z-joint(control).rotation.z;
  assert(l>.005&&r<-.005,kind+' did not follow the hit direction');assert(Math.abs(l+r)<1e-9);assert(Math.abs(l)<=.055);
  for(const m of[left,right]){const p=pose(m);for(let i=0;i<12;i++)animateActor(m,3/60,0,0,0);assert.deepEqual(pose(m),p,kind+' secondary recoil drifted while paused');}
  for(let i=4;i<=90;i++)for(const m of all)animateActor(m,i/60,0,0,0);
  assert.deepEqual(pose(left),pose(control));assert.deepEqual(pose(right),pose(control));for(const m of all)assert.equal(m.position.length(),0);
 }
});

test('stone feet plant through weight transfer and the existing slam/recovery at every supported frame rate',()=>{
 const point=new Vector3();
 for(const fps of[30,60,120]){
  const m=actor('golem'),d=m.userData;let t=0,lift=0,armRaise=0;
  m.position.set(4,1.2,-3);animateActor(m,t,0,0,0);
  for(const stage of['walk','wind','recover'])for(let i=1;i<=fps*(stage==='wind'?.95:1.5);i++){
   t+=1/fps;d.walkPhase=t*ENEMY_MOTION.golem.cadence;const attack=stage==='wind'?Math.max(.001,.95-(i-1)/fps):0;animateActor(m,t,stage==='walk'?2.5:0,attack,0);m.updateMatrixWorld(true);
   armRaise=Math.max(armRaise,-d.arms[0].rotation.x);const feet=[];
   for(const leg of d.legs){const mesh=leg.joint.children[0],p=mesh.geometry.attributes.position;let bottom=Infinity;for(let j=0;j<p.count;j++)bottom=Math.min(bottom,point.fromBufferAttribute(p,j).applyMatrix4(mesh.matrixWorld).y-1.2);feet.push(bottom);assert(bottom>=.00799&&bottom<.105,'stone foot lost ground clearance: '+bottom);assert.deepEqual(leg.joint.scale.toArray(),[1,1,1]);}
   assert(Math.min(...feet)<.00801,'both stone feet left the ground during a grounded attack');lift=Math.max(lift,...feet);assert.deepEqual(m.position.toArray(),[4,1.2,-3]);
   const snapshot=pose(m);animateActor(m,t,stage==='walk'?2.5:0,attack,0);assert.deepEqual(pose(m),snapshot,'paused support correction drifted');
  }
  assert(lift>.07,'swing foot never cleared the ground');assert(armRaise>1,'heavy slam has no visible shoulder windup');assert.equal(d.release,0);
 }
 assert.deepEqual(ENEMY_MOTION.golem,{wind:.95,recover:.48,cadence:4.7,range:2.4});assert.deepEqual(ENEMY_MOTION.wolf,{wind:.48,recover:.18,cadence:12,range:3});
});

test('wolf bite hinges below the same cheek and restores after release without changing its leg anchors',()=>{
 const m=actor('wolf'),d=m.userData,anchors=d.legs.map(l=>[...l.joint.position.toArray(),...l.knee.position.toArray(),...l.paw.position.toArray()]);let opening=0;
 for(let i=0;i<=120;i++){const attack=i<29?.48-i/60:0;animateActor(m,i/60,0,attack,0);opening=Math.max(opening,d.jaw.rotation.x);const before=[d.jaw.position.y,d.jaw.rotation.x];animateActor(m,i/60,0,attack,0);assert.deepEqual([d.jaw.position.y,d.jaw.rotation.x],before);}
 assert(opening>.14&&opening<.3);assert.equal(d.jaw.rotation.x,0);assert.equal(d.jaw.position.y,-.21);assert.deepEqual(d.legs.map(l=>[...l.joint.position.toArray(),...l.knee.position.toArray(),...l.paw.position.toArray()]),anchors);
});
