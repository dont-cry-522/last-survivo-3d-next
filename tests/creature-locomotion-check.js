import * as T from '../vendor/three.module.js';
import {actor,animateActor} from '../world.js';
import {MAP_ROSTERS,REGIONAL_ENEMIES} from '../map-enemies.js';
import {ENEMIES} from '../rules.js';
import {BOSS_ROUTES} from '../boss-roster.js';
import {BOSS_STYLES,tickBoss} from '../boss-combat.js';
import {ENEMY_MOTION,advanceEnemyLocomotion} from '../enemy-motion.js';
import {setCreatureTime} from '../creature-forms.js';

const $=id=>document.getElementById(id),TAU=Math.PI*2,round=(x,n=4)=>Number.isFinite(x)?+x.toFixed(n):null;
const names={wolf:'林地狼',mushroom:'蘑菇',golem:'岩石巨人',spitter:'孢子术士',shaman:'林地萨满'};
const stages=['慢走','加速','追击','急停','重新起步','转弯','减速','蓄势','扑击／攻击','落地／收招','恢复步行'];
const scene=new T.Scene(),renderer=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});
renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.setSize(1200,560,false);renderer.setClearColor(0x263a31);renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.25;$('stage').append(renderer.domElement);
scene.add(new T.HemisphereLight(0xd8e6f0,0x293c30,2));const sun=new T.DirectionalLight(0xffe6c2,3.6);sun.position.set(3,7,5);scene.add(sun);const rim=new T.DirectionalLight(0x93cfd9,1.3);rim.position.set(-4,3,-3);scene.add(rim);
const ground=new T.Mesh(new T.PlaneGeometry(400,400),new T.MeshStandardMaterial({color:0x3b4c3c,roughness:1}));ground.rotation.x=-Math.PI/2;ground.position.y=-.015;scene.add(ground);
const grid=new T.GridHelper(400,400,0x90aa8e,0x69816c);grid.position.y=-.009;grid.material.transparent=true;grid.material.opacity=.4;scene.add(grid);
const camera=new T.OrthographicCamera(-5,5,2.3,-2.3,.1,100),point=new T.Vector3(),scaleVector=new T.Vector3();
let model,kind,time=0,paused=false,last=0,accumulator=0,heading=0,gait=0,totalDistance=0,previousFeet=[],samples={},instant={},boss,bossCompleted=false,attackOrigin,boundsHalf=1,markers=[];
const phase=()=>{const d=model.userData;return d.bossModel||d.bossAppearance||d.bossVariant||d.sandModel||d.coastModel?d.phase||0:d.walkPhase??d.phase??0;};
function populate(){const map=$('biome').value;$('kind').replaceChildren();for(const id of [...Object.values(MAP_ROSTERS[map]).slice(0,5),...BOSS_ROUTES[map]]){const option=document.createElement('option');option.value=id;option.textContent=(names[id]||REGIONAL_ENEMIES[id]?.name||BOSS_STYLES[id]?.name||id)+(BOSS_STYLES[id]?' · 首领':'');$('kind').append(option);}if(map==='forest')$('kind').value='wolf';}
function reset(){
 if(model)scene.remove(model);for(const marker of markers){scene.remove(marker);marker.geometry.dispose();marker.material.dispose();}markers=[];kind=$('kind').value;model=actor(kind);model.userData.expressionSeed=.37;model.scale.multiplyScalar(+$('scale').value);scene.add(model);
 time=heading=gait=totalDistance=accumulator=0;samples={};previousFeet=[];boss=null;bossCompleted=false;attackOrigin=null;instant={};
 animateActor(model,0,0);const box=new T.Box3().setFromObject(model),size=box.getSize(new T.Vector3());boundsHalf=Math.max(1.1,size.y*.64,size.z*.5,size.x*.5);paused=false;$('play').textContent='暂停';
 $('timeline').replaceChildren(...stages.map((name,index)=>{const span=document.createElement('span');span.textContent=name;span.dataset.stage=index;return span;}));draw();
}
function stageAt(t){
 if(t<9.2)return t<2.2?0:t<3?1:t<5?2:t<6?3:t<6.7?4:t<8.7?5:6;
 if(BOSS_STYLES[kind])return bossCompleted?10:boss?.stage==='strike'?8:boss?.stage==='recover'?9:7;
 const cfg=ENEMY_MOTION[kind],release=9.2+(cfg?.wind||.48),duration=(REGIONAL_ENEMIES[kind]?.role||kind)==='wolf'?.24:.22;
 return t<release?7:t<release+duration?8:t<release+duration+(cfg?.recover||.18)+.7?9:10;
}
function feet(){
 const d=model.userData;if(d.legs?.some(l=>l.paw))return d.legs.filter(l=>l.paw).map(l=>({node:l.paw,planted:typeof l.planted==='boolean'?l.planted:null}));
 return (d.feet||[]).map(node=>({node,planted:null}));
}
function advance(dt){
 const oldPhase=phase(),before=model.position.clone(),oldHeading=model.rotation.y,d=model.userData;
 time+=dt;let stage=stageAt(time);const base=ENEMIES[kind]?.speed??BOSS_STYLES[kind]?.speed*1.25??2.5;
 let speed=stage===0?.45:stage===1?.45+(base-.45)*(time-2.2)/.8:stage===2?base:stage===4?base*(time-6)/.7:stage===5?base:stage===6?base*(1-(time-8.7)/.5):stage===10?base*.65:0;
 if(stage===5)heading+=(Math.PI/2)/2*dt;
 let wind=0,pounce=0,recover=0;const isBoss=!!BOSS_STYLES[kind];
 if(isBoss&&stage>=7&&stage<=9){
  if(!boss){boss={kind,mesh:model,x:model.position.x,z:model.position.z,hp:2000,maxHp:2000,phase:1,stage:'walk',cool:0,turn:0,angle:heading};attackOrigin={x:boss.x+Math.sin(heading)*6,z:boss.z+Math.cos(heading)*6};}
  tickBoss(boss,attackOrigin,dt,{move:(b,x,z)=>{b.x+=x;b.z+=z;},visible:()=>true,groundHeight:()=>0,landing:p=>p,zone(){},sound(){},notice(){}});
  heading=model.rotation.y;if(boss.move&&boss.stage==='walk')bossCompleted=true;stage=stageAt(time);
 }else{
  if(isBoss){d.bossStage='walk';d.lift=0;}
  if(!isBoss&&stage>=7&&stage<=9){
   const cfg=ENEMY_MOTION[kind],start=9.2,duration=(REGIONAL_ENEMIES[kind]?.role||kind)==='wolf'?.24:.22,age=time-start;
   wind=Math.max(0,(cfg?.wind||.48)-age);
   const launch=age-(cfg?.wind||.48);
   if(['wolf','mushroom'].includes(REGIONAL_ENEMIES[kind]?.role||kind)&&launch>=0&&launch-dt<duration){
    pounce=Math.max(0,1-launch/duration);const from=Math.max(0,(launch-dt)/duration),to=Math.min(1,launch/duration),ease=p=>.25*p+1.2/Math.PI*(1-Math.cos(Math.PI*p));
    // Same lunge distance easing as main.js, with controlled target and clear ground.
    speed=((REGIONAL_ENEMIES[kind]?.role||kind)==='wolf'?14:10)*duration*(ease(to)-ease(from))/ease(1)/dt;
   }
   if(launch>=duration)recover=Math.max(0,(cfg?.recover||.18)-(launch-duration));
  }
  model.position.x+=Math.sin(heading)*speed*dt;model.position.z+=Math.cos(heading)*speed*dt;model.rotation.y=heading;
 }
 const distance=model.position.distanceTo(before),actualSpeed=distance/dt,walking=actualSpeed>.05&&wind<=0&&pounce<=0&&recover<=0;totalDistance+=distance;if(walking)gait+=dt*(ENEMY_MOTION[kind]?.cadence||4);
 Object.assign(d,{walkPhase:gait,pounce,landRecover:recover,turnRate:(model.rotation.y-oldHeading)/dt,lookTurn:0});
 if(!isBoss)advanceEnemyLocomotion(d,dt,distance,walking);
 animateActor(model,time,actualSpeed,wind,0);setCreatureTime(time);model.updateMatrixWorld(true);
 let finite=true;model.traverse(o=>{if(!o.matrixWorld.elements.every(Number.isFinite))finite=false;});
 const phaseChange=Math.max(0,phase()-oldPhase),list=feet(),positions=[];let slip=0,pairs=0,maxSlip=0,maxFootStep=0,maxReleaseStep=0,touchdowns=0,marked=0;
 list.forEach(({node,planted},i)=>{node.getWorldPosition(point);const previous=previousFeet[i];if(planted!==null)marked++;if(previous){const step=Math.hypot(point.x-previous.x,point.y-previous.y,point.z-previous.z);maxFootStep=Math.max(maxFootStep,step);if(previous.planted&&!planted)maxReleaseStep=Math.max(maxReleaseStep,step);}if(planted&&previous?.planted){const travel=Math.hypot(point.x-previous.x,point.z-previous.z);slip+=travel;maxSlip=Math.max(maxSlip,travel);pairs++;}if(planted&&!previous?.planted)touchdowns++;positions.push({x:point.x,y:point.y,z:point.z,planted});});previousFeet=positions;
 const entry=samples[stage]??={stage:stages[stage],seconds:0,distance:0,phase:0,plantedPairs:0,slip:0,supportSeconds:0,maxSlip:0,maxFootStep:0,maxReleaseStep:0,touchdowns:0,finite:true,markers:marked};
 entry.seconds+=dt;entry.distance+=distance;entry.phase+=phaseChange;entry.plantedPairs+=pairs;entry.slip+=slip;entry.supportSeconds+=pairs*dt;entry.maxSlip=Math.max(entry.maxSlip,maxSlip);entry.maxFootStep=Math.max(entry.maxFootStep,maxFootStep);entry.maxReleaseStep=Math.max(entry.maxReleaseStep,maxReleaseStep);entry.touchdowns+=touchdowns;entry.finite&&=finite;
 model.getWorldScale(scaleVector);instant={stage:stages[stage],actualSpeed,phase:phase(),hz:phaseChange/TAU/dt,root:model.position.toArray().map(x=>round(x)),worldScale:scaleVector.toArray().map(x=>round(x)),stride:d.stride??d.walkStride??null,pounce:d.pounce,bossStage:d.bossStage||null,finite,feet:positions};
 if(time>=14.5){paused=true;$('play').textContent='播放';}
}
function draw(){
 const center=model.position.clone();center.y+=boundsHalf*.77+(model.userData.lift||0)*model.scale.y;const angle=$('view').value,offset=angle==='side'?[7,1,0]:angle==='front'?[0,1,7]:angle==='top'?[.01,8,0]:[6,2,6];
 camera.position.copy(center).add(new T.Vector3(...offset).multiplyScalar(Math.max(1,boundsHalf/1.5)));camera.lookAt(center);camera.top=boundsHalf;camera.bottom=-boundsHalf;camera.left=-boundsHalf*1200/560;camera.right=boundsHalf*1200/560;camera.updateProjectionMatrix();
 const positions=instant.feet||[];while(markers.length<positions.length){const marker=new T.Mesh(new T.SphereGeometry(.025,8,6),new T.MeshBasicMaterial());markers.push(marker);scene.add(marker);}positions.forEach((p,i)=>{markers[i].position.set(p.x,p.y+.02,p.z);markers[i].material.color.setHex(p.planted===null?0xaaaaaa:p.planted?0xbfff72:0xffb863);});
 renderer.render(scene,camera);const summary=Object.values(samples).map(s=>({...s,averageSpeed:round(s.distance/s.seconds),frequencyHz:round(s.phase/TAU/s.seconds),averageSupportSlip:s.supportSeconds?round(s.slip/s.supportSeconds,6):null,maxSupportSlipMm:s.plantedPairs?round(s.maxSlip*1000,3):null,maxFootStepMm:round(s.maxFootStep*1000,3),maxReleaseStepMm:round(s.maxReleaseStep*1000,3)}));
 $('status').textContent=`${names[kind]||REGIONAL_ENEMIES[kind]?.name||BOSS_STYLES[kind]?.name||kind} · ${instant.stage||'待机'} · ${time.toFixed(2)} 秒`;
 $('live').textContent=`实际速度 ${(instant.actualSpeed||0).toFixed(3)} m/s · 累计路程 ${totalDistance.toFixed(3)} m · 周期 ${(instant.hz||0).toFixed(3)} Hz · ${instant.finite===false?'存在无效坐标':'坐标有限'}`;
 $('timeline').querySelectorAll('span').forEach((el,i)=>el.classList.toggle('active',i===stageAt(time)));
 $('measurements').innerHTML=summary.map(s=>`<tr><td>${s.stage}</td><td>${s.distance.toFixed(3)}</td><td>${s.averageSpeed}</td><td>${s.frequencyHz}</td><td>${s.plantedPairs}</td><td>${s.averageSupportSlip??'N/A'}</td><td>${s.maxSupportSlipMm??'N/A'}</td><td>${s.maxFootStepMm}</td><td>${s.finite?'有效':'失败'}</td></tr>`).join('');
 $('report').textContent=JSON.stringify({status:'OBSERVED',scope:'Controlled production-pose fixture; not full AI gameplay verification',kind,time:round(time),fps:+$('fps').value,eliteScale:+$('scale').value,instant:{...instant,feet:positions.map(p=>({...p,x:round(p.x),y:round(p.y),z:round(p.z)}))},stages:summary,renderCalls:renderer.info.render.calls},null,2);
}
function capture(){draw();const figure=document.createElement('figure'),img=document.createElement('img'),caption=document.createElement('figcaption');img.src=renderer.domElement.toDataURL('image/png');img.alt=`${kind} ${instant.stage} ${time.toFixed(2)} 秒`;caption.textContent=`${kind} ×${$('scale').value} · ${time.toFixed(2)} s · ${instant.stage} · ${(instant.actualSpeed||0).toFixed(2)} m/s`;figure.append(img,caption);$('captures').append(figure);}
function advanceSeconds(seconds){const dt=1/+$('fps').value;for(let remaining=seconds;remaining>1e-9;remaining-=dt)advance(Math.min(dt,remaining));draw();}
$('biome').onchange=()=>{populate();reset();};$('kind').onchange=reset;$('scale').onchange=reset;$('view').onchange=draw;
$('play').onclick=()=>{paused=!paused;$('play').textContent=paused?'播放':'暂停';};$('restart').onclick=reset;
$('step').onclick=()=>{paused=true;$('play').textContent='播放';advance(1/+$('fps').value);draw();};
$('cycle').onclick=()=>{reset();advanceSeconds(14.5);paused=true;$('play').textContent='播放';};
$('jump').onclick=()=>{reset();const moment=$('moment').value;advanceSeconds(moment==='slow'?1:moment==='chase'?3.8:moment==='turn'?7.1:9.2+(ENEMY_MOTION[kind]?.wind||BOSS_STYLES[kind]?.wind||.48)+.08);paused=true;$('play').textContent='播放';};
$('suite').onclick=async()=>{
 const savedMap=$('biome').value,savedKind=$('kind').value,results=[];$('suite').disabled=true;
 try{for(const map of ['forest','snow','ash','sand','coast'])for(const id of [MAP_ROSTERS[map].wolf,MAP_ROSTERS[map].golem,BOSS_ROUTES[map][0]]){
  $('biome').value=map;populate();$('kind').value=id;reset();paused=true;advanceSeconds(14.5);
  const report=JSON.parse($('report').textContent);results.push({map,kind:id,finite:report.stages.every(s=>s.finite),stages:report.stages.map(s=>({stage:s.stage,frequencyHz:s.frequencyHz,speed:s.averageSpeed,supportPairs:s.plantedPairs,meanSlip:s.averageSupportSlip,maxSlipMm:s.maxSupportSlipMm,maxFootStepMm:s.maxFootStepMm,maxReleaseStepMm:s.maxReleaseStepMm}))});
  $('suite-report').textContent=JSON.stringify({status:'RUNNING',completed:results.length,results},null,2);await new Promise(requestAnimationFrame);
 }$('suite-report').textContent=JSON.stringify({status:results.every(r=>r.finite)?'FINITE_POSES_OBSERVED':'INVALID_POSE',scope:'15 controlled production-pose samples; visual quality requires review; viewport sizing is not a real-device or performance test',fps:+$('fps').value,eliteScale:+$('scale').value,viewport:{width:innerWidth,height:innerHeight},results},null,2);
 }catch(error){$('suite-report').textContent=JSON.stringify({status:'ERROR',error:String(error),results},null,2);}
 finally{$('biome').value=savedMap;populate();$('kind').value=savedKind;reset();paused=true;$('play').textContent='播放';$('suite').disabled=false;}
};
$('capture').onclick=capture;$('strip').onclick=()=>{paused=true;$('play').textContent='播放';for(let i=0;i<8;i++){if(i)advanceSeconds(.1);capture();}};$('clear').onclick=()=>$('captures').replaceChildren();
populate();reset();
function frame(now){if(!paused){accumulator+=Math.min(.05,(now-last)/1000||0)*+$('rate').value;const dt=1/+$('fps').value;while(accumulator>=dt&&!paused){advance(dt);accumulator-=dt;}draw();}last=now;requestAnimationFrame(frame);}requestAnimationFrame(frame);
