// Companions have their own health; they never block movement or redirect owner damage.
export const PET_LIFE={base:150,perLevel:8,perVitality:20,revive:12,protection:2,hitGrace:.8,regenDelay:4,regenRate:.035};
export const PET_LEASH={follow:10,engage:16,recall:18,resume:10,nearby:6};
export const PET_TIMING={wind:.28,pounce:.30,recover:.34};
const dist=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
const angleDiff=(a,b)=>Math.atan2(Math.sin(a-b),Math.cos(a-b));
export class BeastCompanion{
 constructor(api){this.api=api;const p=api.player();Object.assign(this,{x:p.x-.9,z:p.z-.7,angle:0,state:'sniff',elapsed:0,cool:.6,now:0,command:null,target:null,throwCount:0,traps:[],recallUntil:0,decisionAt:.9,seed:1937,vx:0,vz:0,stuck:0,hp:0,maxHp:0,alive:true,inv:0,hurt:0,reviveLeft:0,reviveRetry:0});this.syncHealth();}
 get level(){return Math.max(1,this.api.player().level||1);}
 syncHealth(){const maximum=PET_LIFE.base+PET_LIFE.perLevel*(this.level-1)+PET_LIFE.perVitality*(this.api.player().upgrades?.vitality||0)+(this.api.player().huntBoon==='shelter'?30:0),gain=maximum-this.maxHp;this.maxHp=maximum;this.hp=this.alive?Math.max(0,Math.min(maximum,this.hp+Math.max(0,gain))):0;}
 takeDamage(amount){if(!this.api.active()||!this.alive||this.inv>0||!Number.isFinite(amount)||amount<=0)return false;
  this.lastHurt=this.now;this.hp=Math.max(0,this.hp-amount);this.regenerating=false;this.hurt=.30;this.inv=PET_LIFE.hitGrace;
  if(this.hp===0){this.alive=false;this.state='down';this.elapsed=0;this.reviveLeft=PET_LIFE.revive;this.reviveRetry=0;this.target=this.command=this.roamGoal=null;this.forcedReturn=false;this.vx=this.vz=this.speed=this.turnRate=0;this.api.fx('petDown',this.x,this.z);}else this.api.fx('petHurt',this.x,this.z);return true;
 }
 revive(){if(this.alive||!this.api.active()||this.reviveLeft>0)return false;const home=this.api.home();if(!home)return false;this.x=home.x;this.z=home.z;this.hp=this.maxHp;this.alive=true;this.inv=PET_LIFE.protection;this.hurt=0;this.change('look');this.cool=.65;this.decisionAt=this.now+1;this.recallUntil=0;this.commandUntil=0;this.stuck=0;this.api.fx('petRevive',this.x,this.z);return true;}
 random(){this.seed=(Math.imul(this.seed,1664525)+1013904223)>>>0;return this.seed/4294967296;}
 change(state){if(this.state!==state){this.state=state;this.elapsed=0;}}
 order(angle,thrown=true){const p=this.api.player();let best=null,score=Infinity;
  for(const e of this.alive?this.api.foes():[]){if(!e.alive||!this.api.visible(e)||dist(e,p)>=10||!this.api.clear(p.x,p.z,e.x,e.z))continue;
   const diff=Math.abs(angleDiff(Math.atan2(e.x-p.x,e.z-p.z),angle));if(diff>.46)continue;const s=diff*15+dist(e,p)*.05;if(s<score){score=s;best=e;}}
  this.command=best;this.commandUntil=this.now+1.5;
  // An explicit aim can redirect an approach, but cannot swivel an airborne pounce.
  if(best&&this.state==='approach')this.target=best;
  if(!thrown)return;
  const w=this.api.stats();this.throwCount++;if(w.trapRank&&this.throwCount%3===0){if(this.traps.length>=3)this.traps.shift();this.traps.push({x:p.x,z:p.z,life:8,arm:.45,rank:w.trapRank,pulse:0});this.api.fx('trapSet',p.x,p.z,{rank:w.trapRank});}
 }
 cover(x,z){if(!this.alive)return;this.coverGoal={x,z};this.coverWaypoint=null;
  const dx=x-this.x,dz=z-this.z,d=Math.hypot(dx,dz)||1;
  for(const side of [1,-1]){const q={x:(this.x+x)/2+dz/d*1.3*side,z:(this.z+z)/2-dx/d*1.3*side};if(this.api.clear(this.x,this.z,q.x,q.z)&&this.api.clear(q.x,q.z,x,z)){this.coverWaypoint=q;break;}}
  this.coverUntil=this.now+1.7;this.target=this.command=this.roamGoal=null;this.forcedReturn=false;this.inv=Math.max(this.inv,.45);this.change('cover');}
 recall(){if(!this.alive)return;this.forcedReturn=true;this.change('return');this.target=this.command=null;this.roamGoal=null;this.recallUntil=this.now+1.1;this.cool=Math.max(this.cool,1.1);}
 marked(e){e.lingyaMark=this.now+2.5;}
 updateTraps(dt){for(const trap of this.traps){trap.life-=dt;trap.arm-=dt;trap.pulse-=dt;if(trap.life<=0)continue;
  if(trap.pulse<=0){trap.pulse=.28;this.api.fx('trap',trap.x,trap.z,{rank:trap.rank});}
  if(trap.arm<=0){const enemies=this.api.foes().filter(e=>e.alive&&dist(e,trap)<1.5+.15*trap.rank&&this.api.clear(trap.x,trap.z,e.x,e.z));
   if(enemies.length){trap.life=0;this.api.fx('trapSnap',trap.x,trap.z,{rank:trap.rank});for(const e of enemies){if(!this.api.active())break;this.api.damage(e,10+8*trap.rank);e.slow=Math.max(e.slow||0,1+.3*trap.rank);if(!e.boss)e.stagger=Math.max(e.stagger||0,.3+.1*trap.rank);}}}}
  this.traps=this.traps.filter(q=>q.life>0);
 }
 nearbyTarget(p){let best=null,score=Infinity;for(const e of this.api.foes()){
  const d=dist(e,this);if(!e.alive||dist(e,p)>PET_LEASH.engage||d>PET_LEASH.nearby||!this.api.clear(this.x,this.z,e.x,e.z))continue;
  const priority=d-(e.lingyaMark>this.now?1.8:0);if(priority<score){score=priority;best=e;}}
  return best;
 }
 chooseRoam(p){this.roamGoal=null;for(let i=0;i<6;i++){const a=this.random()*Math.PI*2,r=1.5+this.random()*2,x=p.x+Math.sin(a)*r,z=p.z+Math.cos(a)*r;
  if(this.api.clear(this.x,this.z,x,z)){this.roamGoal={x,z};this.change('roam');return;}}
  this.change('look');this.decisionAt=this.now+.8;
 }
 update(dt){if(dt<=0||!this.api.active())return;this.now+=dt;this.syncHealth();this.inv=Math.max(0,this.inv-dt);this.hurt=Math.max(0,this.hurt-dt);this.cool=Math.max(0,this.cool-dt);this.elapsed+=dt;
  const p=this.api.player(),w=this.api.stats(),oldX=this.x,oldZ=this.z,oldAngle=this.angle;this.updateTraps(dt);if(!this.api.active())return;
  if(!this.alive){this.reviveLeft=Math.max(0,this.reviveLeft-dt);this.reviveRetry=Math.max(0,this.reviveRetry-dt);if(this.reviveLeft<=0&&this.reviveRetry<=0){if(!this.revive())this.reviveRetry=.5;}return;}
  const ownerDistance=dist(this,p);
  this.regenerating=this.hp<this.maxHp&&this.now-(this.lastHurt??-Infinity)>=PET_LIFE.regenDelay&&ownerDistance<6&&!['approach','wind','pounce','recover'].includes(this.state)&&!this.api.foes().some(e=>e.alive&&dist(e,this)<4);if(this.regenerating)this.hp=Math.min(this.maxHp,this.hp+this.maxHp*PET_LIFE.regenRate*dt);
  // Only the outer leash interrupts combat. Camera visibility and ordinary owner movement do not.
  if(ownerDistance>PET_LEASH.recall&&!this.forcedReturn)this.recall();
  if(this.forcedReturn&&ownerDistance<PET_LEASH.resume&&this.now>=this.recallUntil)this.forcedReturn=false;
  if(this.target&&!this.target.alive){this.target=null;this.change(['wind','pounce'].includes(this.state)?'recover':'look');}
  if(!this.forcedReturn&&['sniff','look','roam','follow','return'].includes(this.state)&&this.cool<=0){
   const commanded=this.commandUntil>=this.now&&this.command?.alive&&dist(this.command,p)<PET_LEASH.engage&&this.api.clear(this.x,this.z,this.command.x,this.command.z);
   const choice=commanded?this.command:this.nearbyTarget(p);
   if(choice){this.target=choice;this.change('approach');}
  }
  if(ownerDistance>PET_LEASH.follow&&['sniff','look','roam','follow'].includes(this.state)){this.change('return');this.roamGoal=null;}
  let goal,moveSpeed=0;
  if(this.state==='cover'){
   if(this.coverWaypoint&&dist(this,this.coverWaypoint)<.65)this.coverWaypoint=null;
   goal=this.coverWaypoint||this.coverGoal;moveSpeed=8;
   if(!this.coverGoal||dist(this,this.coverGoal)<.4||this.now>=this.coverUntil){this.coverGoal=this.coverWaypoint=null;goal=null;this.change('look');this.decisionAt=this.now+.35;}
  }else if(this.state==='approach'){
   const e=this.target;if(!e){this.recall();return;}const a=Math.atan2(e.x-p.x,e.z-p.z),offset=w.pincerRank?1.35:0;goal={x:e.x+Math.cos(a)*offset,z:e.z-Math.sin(a)*offset};moveSpeed=5.1;
   if(dist(e,this)<2.35){this.change('wind');this.attackAngle=Math.atan2(e.x-this.x,e.z-this.z);goal=null;}
   else if(this.elapsed>2){this.change('return');this.target=null;}
  }else if(this.state==='wind'){
   const e=this.target;if(e)this.attackAngle+=angleDiff(Math.atan2(e.x-this.x,e.z-this.z),this.attackAngle)*(1-Math.exp(-dt*14));
   if(this.elapsed>=PET_TIMING.wind){this.change('pounce');this.struck=false;this.vx=this.vz=0;this.api.fx('pounce',this.x,this.z);}
  }else if(this.state==='pounce'){
   const e=this.target,reach=(e?.size||.5)+.60,available=e?Math.max(0,dist(e,this)-reach):2.6;const travel=this.struck?0:Math.min(available,Math.min(dt,Math.max(0,PET_TIMING.pounce-(this.elapsed-dt)))*8.7);
   this.api.move(this,Math.sin(this.attackAngle)*travel,Math.cos(this.attackAngle)*travel);
   if(this.elapsed>=PET_TIMING.pounce*.55&&!this.struck&&e?.alive&&dist(e,this)<reach+.08&&this.api.clear(this.x,this.z,e.x,e.z)){
    this.struck=true;this.api.damage(e,w.petDamage*(e.lingyaMark>this.now?1+.22*(w.pincerRank||0):1));this.api.onHit?.(e);if(e.alive&&!e.boss)e.stagger=Math.max(e.stagger||0,.22);this.api.fx('bite',e.x,e.z);}
   if(this.elapsed>=PET_TIMING.pounce){this.change('recover');this.target=null;this.cool=w.petCooldown;this.api.fx('land',this.x,this.z);}
  }else if(this.state==='recover'){
   if(this.elapsed>=PET_TIMING.recover){this.change(dist(this,p)>PET_LEASH.follow?'return':'look');this.decisionAt=this.now+.5;}
  }else if(this.state==='return'){
   // Hysteresis: catch up only outside the leash; stop well inside it instead of orbiting a fixed slot.
   if(dist(this,p)<4&&!this.forcedReturn){this.change('look');this.decisionAt=this.now+.65;this.roamGoal=null;}
   else{const a=p.angle||0;goal={x:p.x-Math.sin(a)*.9,z:p.z-Math.cos(a)*.9};moveSpeed=Math.min(this.now<this.recallUntil?12:10,4+dist(this,p)*.8);}
  }else if(this.state==='roam'){
   goal=this.roamGoal;moveSpeed=1.15;if(!goal||dist(this,goal)<.35||this.elapsed>3.5){goal=null;this.change(this.random()<.65?'sniff':'look');this.decisionAt=this.now+1+this.random()*1.8;}
  }else if(this.now>=this.decisionAt)this.chooseRoam(p);
  // Smooth steering, acceleration and braking, while keeping the leap's committed path.
  if(!['pounce','recover'].includes(this.state)){
   const distance=goal?dist(goal,this):0,a=goal?Math.atan2(goal.x-this.x,goal.z-this.z):this.angle;
   const desiredSpeed=goal?Math.min(moveSpeed,distance*4):0,k=1-Math.exp(-dt*(goal?7:14));
   this.vx+=(Math.sin(a)*desiredSpeed-this.vx)*k;this.vz+=(Math.cos(a)*desiredSpeed-this.vz)*k;
   this.api.move(this,this.vx*dt,this.vz*dt);
  }else this.vx=this.vz=0;
  const travel= Math.hypot(this.x-oldX,this.z-oldZ);this.stuck=goal&&travel<dt*.08?this.stuck+dt:0;
  if(this.state==='roam'&&this.stuck>.6){this.change('look');this.decisionAt=this.now+.5;this.roamGoal=null;this.stuck=0;}
  // Only a far-away, truly blocked pet may recover at a verified free point.
  if(dist(this,p)>PET_LEASH.recall&&this.stuck>.8){const safe=this.api.home();if(safe){this.x=safe.x;this.z=safe.z;this.recall();this.stuck=0;}}
  this.speed=travel/dt;const desired=['wind','pounce','recover'].includes(this.state)?this.attackAngle:this.speed>.12?Math.atan2(this.x-oldX,this.z-oldZ):this.angle;
  this.angle+=angleDiff(desired,this.angle)*(1-Math.exp(-dt*(['wind','pounce'].includes(this.state)?16:7)));this.turnRate=angleDiff(this.angle,oldAngle)/dt;
 }
}
export {sideHopTravel} from './lingya-motion.js?v=197';
