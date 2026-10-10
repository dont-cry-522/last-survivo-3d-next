import{observePlayer}from'./target-awareness.js?v=114';
// A locked target and a readable anticipation precede every damaging attack.
export const BOSS_STYLES={
 wreckwarden:{name:'沉舟寄居王',speed:1.8,wind:1.25,recovery:1.7,color:0x82d7da,moves:['claws','surge','anchors']},
 boss:{name:'林心古树',speed:1.5,wind:1.2,recovery:1.6,color:0xb6d38b,moves:['branches','roots']},
 frostking:{name:'霜冠巨猿',speed:2.3,wind:1.15,recovery:1.7,color:0xa8e9ff,moves:['leap','icefan']},
 cinderlord:{name:'熔炉暴君',speed:2,wind:1.3,recovery:1.5,color:0xffaa67,moves:['furnace','embers']},
 dunescorpion:{name:'蚀金巨蝎',speed:2.5,wind:1.1,recovery:1.55,color:0xebca81,moves:['pincers','tail','burrow']}
};
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export function bossAttackPlan(kind,move,b,target){
 const a=Math.atan2(target.x-b.x,target.z-b.z),r=b.phase===2?1.2:1,at=(d,s=0)=>({x:b.x+Math.sin(a)*d+Math.cos(a)*s,z:b.z+Math.cos(a)*d-Math.sin(a)*s}),zones=[];
 const add=(p,radius,delay,damage,type)=>zones.push({...p,r:radius,delay,damage,kind:type});
 const wind=BOSS_STYLES[kind].wind;
 if(move==='claws')for(const s of [-1.65,1.65])add(at(3.4,s),1.8*r,wind,26,'tide');
 if(move==='surge')for(let i=0;i<3;i++)add(at(3+i*2.4),1.1*r,wind+i*.27,21,'tide');
 if(move==='anchors')for(const s of [-3.2,3.2])add({x:target.x+Math.cos(a)*s,z:target.z-Math.sin(a)*s},1.65*r,wind+.3,27,'tide');
 if(move==='branches')for(const s of [-2.4,0,2.4])add(at(3.3,s),1.8*r,wind+Math.abs(s)*.055,24,'root');
 if(move==='roots')for(let i=0;i<(b.phase===2?6:4);i++)add(at(3+i*2.1),1.05,wind+i*.16,20,'root');
 if(move==='leap')add(target,2.9*r,wind+.65,28,'frost');
 if(move==='icefan')for(const offset of [-.52,0,.52])for(let i=0;i<3;i++)add({x:b.x+Math.sin(a+offset)*(3+i*2.3),z:b.z+Math.cos(a+offset)*(3+i*2.3)},1.05*r,wind+i*.18,20,'frost');
 if(move==='furnace')for(const s of [-3.5,3.5])for(let i=0;i<3;i++)add(at(3+i*2.8,s),1.35*r,wind+i*.16,22,'ember');
 if(move==='embers')for(const s of (b.phase===2?[-4,0,4]:[-2.5,2.5]))add({x:target.x+Math.cos(a)*s,z:target.z-Math.sin(a)*s},1.65,wind+Math.abs(s)*.06,24,'ember');
 if(move==='pincers')for(const s of [-1.5,1.5])add(at(3.4,s),1.7,wind,25,'sand');
 if(move==='tail')add(target,1.65*r,wind+.15,30,'sand');
 if(move==='burrow')add(target,2.5*r,wind+.85,27,'sand');
 return{angle:a,zones,duration:Math.max(...zones.map(z=>z.delay))-wind+.3};
}
// Don't spend the entire attack cycle swinging at empty ground outside reach.
export function chooseBossMove(b,distance){
 const moves=BOSS_STYLES[b.kind].moves,ranges={claws:5.4,surge:9,anchors:12,branches:5.5,roots:b.phase===2?14:10.4,leap:12,icefan:9,furnace:10,embers:12,pincers:5.3,tail:5.2,burrow:12};
 for(let i=0;i<moves.length;i++){const turn=(b.turn||0)+i,move=moves[turn%moves.length];if(distance<=ranges[move])return{move,next:turn+1};}return null;
}
export function tickBoss(b,p,dt,io){
 const style=BOSS_STYLES[b.kind],d=b.mesh.userData,focus=observePlayer(b,p,dt,io.decoy);
 if(b.reacquired)b.cool=Math.max(b.cool||0,.45);
 b.slow=Math.max(0,(b.slow||0)-dt);b.hurt=Math.max(0,(b.hurt||0)-dt);
 if(b.hp<b.maxHp*.5&&b.phase===1){b.phase=2;io.notice(style.name+'进入狂暴 · 留意扩大的攻击范围');}
 if(!b.stage){b.stage='walk';b.cool=2;}
 const oldX=b.x,oldZ=b.z;
 if(b.stage==='walk'){
  b.cool-=dt;const a=Math.atan2(focus.x-b.x,focus.z-b.z),distance=Math.hypot(focus.x-b.x,focus.z-b.z);
  const orbit=!b.targetLost&&b.kind==='cinderlord'?(distance<8?1.15:.4):0;
  if(distance>(b.kind==='cinderlord'?5:3))io.move(b,Math.sin(a+orbit)*style.speed*1.25*(b.pressure||1)*dt*(b.slow>0?.6:1),Math.cos(a+orbit)*style.speed*1.25*(b.pressure||1)*dt*(b.slow>0?.6:1));
  b.angle=b.targetLost&&distance<=3?b.searchHeading+Math.sin(b.searchTime*2)*.4:a;
  const selected=chooseBossMove(b,distance);
  if(!b.targetLost&&b.cool<=0&&selected&&io.visible(b)){
   b.move=selected.move;b.turn=selected.next;
   const distance=Math.hypot(focus.x-b.x,focus.z-b.z),limit=b.move==='tail'?4.2:12,k=Math.min(1,limit/Math.max(distance,.01));
   b.target=io.landing({x:b.x+(focus.x-b.x)*k,z:b.z+(focus.z-b.z)*k},b);
   const plan=bossAttackPlan(b.kind,b.move,b,b.target);b.angle=plan.angle;b.actionDuration=plan.duration;
   for(const z of plan.zones)io.zone(z,b.kind);
   b.stage='wind';b.elapsed=0;b.wind=style.wind;io.sound(b,'wind');
  }
 }else{
  b.elapsed+=dt;
  if(b.stage==='wind'){
   b.wind=Math.max(0,style.wind-b.elapsed);
   if(b.elapsed>=style.wind){b.stage='strike';b.elapsed=0;b.from={x:b.x,z:b.z};io.sound(b,'attack');}
  }else if(b.stage==='strike'){
   if(b.move==='leap'||b.move==='burrow'){
    const duration=b.move==='leap'?.65:.85,u=clamp(b.elapsed/duration,0,1),f=u*u*(3-2*u);
    const x=b.from.x+(b.target.x-b.from.x)*f,z=b.from.z+(b.target.z-b.from.z)*f;io.move(b,x-b.x,z-b.z);
    d.lift=b.move==='leap'?Math.sin(u*Math.PI)*3.8:-Math.sin(u*Math.PI)*2.5;
   }
   if(b.elapsed>=b.actionDuration){b.stage='recover';b.elapsed=0;b.recover=style.recovery;d.lift=0;io.sound(b,'impact');}
  }else{
   b.recover=Math.max(0,style.recovery-b.elapsed);
   if(!b.recover){b.stage='walk';b.cool=(b.phase===2?.9:1.5)/(b.pressure||1);b.elapsed=0;}
  }
 }
 const diff=Math.atan2(Math.sin(b.angle-b.mesh.rotation.y),Math.cos(b.angle-b.mesh.rotation.y));
 b.mesh.rotation.y+=clamp(diff*dt*5,-dt*2.5,dt*2.5);
 Object.assign(d,{bossStage:b.stage,bossMove:b.move,windProgress:b.stage==='wind'?clamp(b.elapsed/style.wind,0,1):0,strikeProgress:b.stage==='strike'?clamp(b.elapsed/b.actionDuration,0,1):0,recoverProgress:b.stage==='recover'?clamp(b.elapsed/style.recovery,0,1):0});
 b.mesh.position.set(b.x,0,b.z);return Math.hypot(b.x-oldX,b.z-oldZ)/Math.max(dt,.001);
}
