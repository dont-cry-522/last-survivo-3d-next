import * as T from '../vendor/three.module.js';
import {creatureGait,gaitDistance,gaitStride} from '../creature-gait.js';

const $=s=>document.querySelector(s),wait=ms=>new Promise(r=>setTimeout(r,ms)),precision=n=>Math.round(n*1e6)/1e6;
let win,g,watched,busy=false,sounds=[],html;
const results=[];
function assert(ok,message){if(!ok)throw Error(message);}
function roundAngle(a){return Math.atan2(Math.sin(a),Math.cos(a));}
function position(e){return{x:e.x,z:e.z};}
function distance(a,b){return Math.hypot(a.x-b.x,a.z-b.z);}
function phase(e){return e.mesh.userData.walkPhase||0;}
function pose(e){const d=e.mesh.userData;return[d.rig,d.head,d.cap,d.tail,...(d.feet||[]),...d.legs.flatMap(l=>[l.joint,l.knee,l.paw])].filter(Boolean).flatMap(n=>[...n.position.toArray(),...n.quaternion.toArray(),...n.scale.toArray()]);}
function feet(e){
 e.mesh.updateMatrixWorld(true);const d=e.mesh.userData,nodes=e.kind==='wolf'?d.legs.map(l=>l.paw):d.feet,point=new T.Vector3();
 const markers=nodes.map(n=>n.getWorldPosition(point).y),meshes=e.kind==='wolf'?d.legs.flatMap(l=>[l.knee,l.paw,l.ankle].filter(Boolean)):nodes;
 const surfaceMin=Math.min(...meshes.map(n=>new T.Box3().setFromObject(n,true).min.y));assert(Number.isFinite(surfaceMin),'visible feet geometry was not measured');
 return{markers:markers.map(precision),surfaceMin:precision(surfaceMin)};
}
async function boot(){
 if(g)return;html??=await(await fetch('../index.html',{cache:'no-store'})).text();
 const frame=document.createElement('iframe');frame.width=1280;frame.height=720;$('#view').replaceChildren(frame);
 const inject=`<base href="../"><script>let seed=9137;window.qaSeed=()=>seed=9137;Math.random=()=>((seed=Math.imul(seed,1664525)+1013904223>>>0)/4294967296);window.qaErrors=[];addEventListener('error',e=>qaErrors.push(e.message));addEventListener('unhandledrejection',e=>qaErrors.push(String(e.reason)));window.requestAnimationFrame=cb=>{window.qaFrame=cb;return 0};const mem=new Map([['forest3d-audio','{"muted":true,"music":0,"sfx":0}']]);Object.defineProperty(window,'localStorage',{value:{getItem:k=>mem.get(k)||null,setItem:(k,v)=>mem.set(k,String(v)),removeItem:k=>mem.delete(k)}});<\/script>`;
 frame.srcdoc=html.replace('<head>','<head>'+inject);win=frame.contentWindow;
 for(let i=0;i<1200&&!win.game3d&&!win.qaErrors?.length;i++)await wait(50);
 assert(win.game3d,'game3d did not load');g=win.game3d;g.select('silver','forest',0);g.audio.setMuted(true);
 const creature=g.audio.creature.bind(g.audio);
 g.audio.creature=(kind,event,dx,dz)=>{
  if(watched&&kind===watched.kind&&Math.hypot(dx-(watched.x-g.player.x),dz-(watched.z-g.player.z))<.05)sounds.push({kind,event,time:g.time,phase:phase(watched),air:watched.pounce||0});
  return creature(kind,event,dx,dz);
 };
}
function prune(){for(const e of [...g.enemies])if(e!==watched){e.alive=false;e.mesh.removeFromParent();const at=g.enemies.indexOf(e);if(at>=0)g.enemies.splice(at,1);}}
function step(dt=1/60){prune();g.step(dt);prune();}
function reset(kind='wolf',offset=8){
 watched=null;win.qaSeed();g.start();g.audio.setMuted(true);
 for(const key of['obstacles','patches','ponds','sites','breakables','discoveries','roaming','ice'])if(Array.isArray(g.world[key]))g.world[key].length=0;
 g.player.hp=g.player.maxHp=10000;g.player.inv=100;g.player.attack=999;g.controls.held=false;
 watched=g.spawn(kind,g.player.x,g.player.z+offset);assert(watched,'test spawn failed');watched.cool=999;watched.hp=watched.maxHp=10000;watched.mesh.rotation.y=Math.PI;sounds=[];return watched;
}
function launch(e){e.wind=0;e.hit=false;e.hitPet=false;e.hitDecoy=null;e.landRecover=0;e.pounceDuration=e.pounce=e.kind==='wolf'?.24:.22;e.attackAngle=Math.PI;e.cool=999;}
function untilLanded(e,timesteps=[1/60]){let elapsed=0,i=0;while(e.pounce>0&&i<100){const dt=timesteps[i%timesteps.length];step(dt);elapsed+=dt;i++;}assert(i<100,'pounce never completed');return elapsed;}
function capture(e){
 g.hero.visible=true;g.camera.position.set(e.x+4.5,3.5,e.z-5.7);g.camera.lookAt(e.x,.76,e.z);g.camera.updateMatrixWorld(true);g.renderer.shadowMap.needsUpdate=true;
 g.renderer.render(g.vfx.scene,g.camera);$('#capture').src=g.renderer.domElement.toDataURL('image/jpeg',.92);
}
async function check(name,fn){
 $('#status').textContent=name;try{results.push({name,status:'PASS',...await fn()});}catch(error){results.push({name,status:'FAIL',error:error.message});}
 $('#report').textContent=JSON.stringify({status:'RUNNING',checks:results},null,2);await new Promise(requestAnimationFrame);
}
async function run(){
 if(busy)return;busy=true;results.length=0;$('#run').disabled=true;
 try{
  await boot();
  for(const kind of['wolf','mushroom']){
   await check(kind+' · walking follows real movement',()=>{
    const e=reset(kind),startPhase=phase(e);let length=0,expectedPhase=0,previous=position(e);
    for(let i=0;i<48;i++){step();const travelled=distance(previous,e),local=travelled/e.mesh.scale.x;length+=travelled;if(kind==='wolf')expectedPhase+=gaitDistance(local,creatureGait(kind,local*60),gaitStride(local*60));previous=position(e);}
    const advanced=phase(e)-startPhase;assert(length>.3,'enemy failed to walk');assert(advanced>0,'moving enemy gait froze');
    if(kind==='wolf')assert(Math.abs(advanced-expectedPhase)<1e-5,'wolf phase did not follow actual path length and speed');
    const contacts=sounds.filter(s=>s.event==='step');assert(contacts.length>0,'walking generated no support contact');
    return{distance:precision(length),phase:precision(advanced),steps:contacts.length};
   });
   await check(kind+' · obstacle stall / stopped gait has no footsteps',()=>{
    const e=reset(kind);for(let i=0;i<20;i++)step();const start=position(e),startPhase=phase(e);
    // Test-only solid disk traps this actor; no movement direction can slide around it.
    g.world.obstacles.push({x:e.x,z:e.z,r:1});sounds=[];for(let i=0;i<70;i++)step();
    const blockedTravel=distance(start,e),blockedPhase=phase(e)-startPhase,blockedSteps=sounds.filter(s=>s.event==='step').length;
    assert(blockedTravel<1e-8,'trapped actor moved');assert(blockedSteps===0,'blocked actor emitted footsteps');assert(e.mesh.userData.stride<.001,'blocked actor kept a walking stride');
    if(kind==='wolf')assert(Math.abs(blockedPhase)<1e-8,'blocked wolf advanced distance phase');
    g.world.obstacles.length=0;e.speed=0;sounds=[];for(let i=0;i<35;i++)step();assert(!sounds.some(s=>s.event==='step'),'stationary actor emitted footsteps');
    return{blockedTravel,blockedPhase:precision(blockedPhase),blockedSteps,stride:precision(e.mesh.userData.stride)};
   });
   await check(kind+' · turn follows target without snapping',()=>{
    const e=reset(kind);e.speed=0;step();const before=e.mesh.rotation.y;g.player.x=e.x+6;g.player.z=e.z;step();
    const first=Math.abs(roundAngle(e.mesh.rotation.y-before));for(let i=0;i<50;i++)step();const remaining=Math.abs(roundAngle(Math.PI/2-e.mesh.rotation.y));
    assert(first>0&&first<=.10001,'one-frame facing snapped or did not react');assert(remaining<.08,'enemy did not turn toward target');
    assert(Number.isFinite(e.mesh.userData.motionTurn)&&Number.isFinite(e.mesh.userData.motionLook),'turn follow-through was not connected');
    return{firstTurn:precision(first),remaining:precision(remaining)};
   });
   for(const hit of[false,true])await check(kind+' · '+(hit?'pounce hit':'pounce miss')+' and landing',()=>{
    const e=reset(kind,hit?(kind==='wolf'?2.2:1.5):8);g.player.inv=hit?0:100;const hp=g.player.hp;launch(e);untilLanded(e);
    assert(!!e.hit===hit,'pounce hit classification was wrong');assert(e.mesh.userData.pounceMissed===!hit,'pounceMissed was not propagated to the pose');
    assert(sounds.filter(s=>s.event==='impact').length===1,'landing contact sound must occur once');assert(!sounds.some(s=>s.event==='step'&&s.air>0),'footsteps continued during flight');
    if(hit)assert(g.player.hp<hp,'hit did not reduce health');
    const landing=position(e);let surfaceMin=Infinity,markerMin=Infinity;const samples=[];
    while(e.landRecover>0){const sample=feet(e);surfaceMin=Math.min(surfaceMin,sample.surfaceMin);markerMin=Math.min(markerMin,...sample.markers);samples.push(sample);step();}
    assert(distance(landing,e)<.05,'enemy slid through landing recovery');assert(markerMin>-.001,'landing marker crossed the floor');assert(surfaceMin>-.04,'landing foot geometry sank below floor');
    capture(e);return{hit:!!e.hit,missed:e.mesh.userData.pounceMissed,healthLost:precision(hp-g.player.hp),markerMin:precision(markerMin),surfaceMin:precision(surfaceMin),landingFrames:samples.length};
   });
   await check(kind+' · existing pounce reach survives frame rates',()=>{
    const samples=[];for(const times of[[1/60],[1/30],[.04],[.04,1/60,.025,1/30]]){
     const e=reset(kind),origin=position(e);launch(e);const elapsed=untilLanded(e,times),actual=distance(origin,e),expected=(kind==='wolf'?14:10)*elapsed;
     assert(Math.abs(actual-expected)<.015,'pounce travel changed for '+times.join(','));samples.push({dt:times.map(precision),actual:precision(actual),expected:precision(expected),elapsed:precision(elapsed)});
    }return{samples};
   });
   await check(kind+' · pause freezes position, pose, clocks and sound',()=>{
    const e=reset(kind);launch(e);step();step();g.pause();const old={time:g.time,x:e.x,z:e.z,pounce:e.pounce,pose:pose(e),sounds:sounds.length};
    for(let i=0;i<50;i++)step(.04);
    assert(JSON.stringify(old)===JSON.stringify({time:g.time,x:e.x,z:e.z,pounce:e.pounce,pose:pose(e),sounds:sounds.length}),'paused state advanced');g.resume();step();assert(g.time>old.time,'resume did not advance');return{frozenSeconds:2};
   });
   await check(kind+' · death and restarting remove old actors and effects',()=>{
    let e=reset(kind);step();g.hurtEnemy(e,e.hp+1,false,{secondary:true});assert(!e.alive,'enemy survived lethal damage');for(let i=0;i<14;i++)step(.04);
    assert(e.mesh.parent===null&&!g.enemies.includes(e),'dead body remained beyond cleanup');
    e=reset(kind);launch(e);step();const old=e.mesh;g.player.inv=0;g.damage(g.player.hp+1,g.player.x+1,g.player.z);assert(g.state==='lost','lethal player damage did not end run');const deathTime=g.time;g.step(.2);assert(g.time===deathTime,'lost run continued simulating');watched=null;g.start();g.audio.setMuted(true);
    assert(old.parent===null,'old enemy survived restart');assert(g.time===0&&g.enemies.length===0&&g.bullets.length===0&&g.fields.length===0&&g.zones.length===0,'restart retained combat objects');
    g.pause();return{removed:true,restartTime:g.time};
   });
  }
  await check('sandguard · existing facing and front shield remain unchanged',()=>{
   const e=reset('sandguard');assert(e.kind==='sandguard','shield test spawned wrong species');e.speed=0;e.mesh.rotation.y=.3;g.player.x=e.x+Math.sin(.7)*6;g.player.z=e.z+Math.cos(.7)*6;
   step(.04);assert(Math.abs(e.mesh.rotation.y-(.3+.4*.04*8))<1e-8,'gameplay facing formula changed');
   const front=e.mesh.rotation.y;g.player.x=e.x+Math.sin(front)*6;g.player.z=e.z+Math.cos(front)*6;let hp=e.hp;g.hurtEnemy(e,100,false,{secondary:true});const frontDamage=hp-e.hp;
   g.player.x=e.x-Math.sin(front)*6;g.player.z=e.z-Math.cos(front)*6;hp=e.hp;g.hurtEnemy(e,100,false,{secondary:true});const backDamage=hp-e.hp;
   assert(Math.abs(frontDamage-65)<1e-8&&backDamage===100,'front shield reduction changed');return{frontDamage,backDamage};
  });
  const errors=[...win.qaErrors];$('#report').textContent=JSON.stringify({status:results.every(r=>r.status==='PASS')&&!errors.length?'PASS':'FAIL',checks:results,errors,scope:'Real game simulation and rendering in isolated 1280×720 browser frame; no Android device or subjective animation quality assertion.'},null,2);
  $('#status').textContent=`完成：${results.filter(r=>r.status==='PASS').length} / ${results.length} 通过`;
 }catch(error){$('#report').textContent=JSON.stringify({status:'FAIL',error:error.stack,checks:results,errors:win?.qaErrors||[]},null,2);}
 finally{if(g?.state==='playing')g.pause();busy=false;$('#run').disabled=false;}
}
async function show(stage){
 if(busy)return;busy=true;try{
  await boot();const e=reset($('#kind').value,4);e.attackAngle=Math.PI;e.tx=g.player.x;e.tz=g.player.z;
  if(stage==='wind'){e.wind=e.kind==='wolf'?.48:.42;for(let i=0;i<14;i++)step();}
  else{launch(e);if(stage==='takeoff')for(let i=0;i<2;i++)step();else if(stage==='air')for(let i=0;i<7;i++)step();else{untilLanded(e);for(let i=0;i<(stage==='landing'?5:10);i++)step();}}
  capture(e);$('#status').textContent=`${e.kind} · ${stage} · 游戏时间 ${g.time.toFixed(3)} 秒`;$('#report').textContent=JSON.stringify({status:'VISUAL_REVIEW',kind:e.kind,stage,time:g.time,pounce:e.pounce,landRecover:e.landRecover,missed:e.mesh.userData.pounceMissed,feet:feet(e),errors:win.qaErrors},null,2);g.pause();
 }catch(error){$('#report').textContent=JSON.stringify({status:'FAIL',error:error.stack},null,2);}finally{busy=false;}
}
$('#run').onclick=run;document.querySelectorAll('[data-stage]').forEach(button=>button.onclick=()=>show(button.dataset.stage));
