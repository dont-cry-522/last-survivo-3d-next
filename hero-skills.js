import{NewHeroSkills}from'./new-hero-skills.js?v=114';
import{segmentDistance}from'./rules.js?v=125';
// Gameplay records are bounded and independent from the recycled visual particles.
export class HeroSkills{
 constructor(api){this.api=api;this.reset();}
 reset(){this.now=0;this.cool={};this.count={};this.mines=[];this.trails=[];this.bolts=[];this.pending=[];this.last=null;this.anchor=null;this.walked=0;this.mark=null;this.counterUntil=0;this.counterReady=0;if(this.newHeroes)this.newHeroes.reset();else this.newHeroes=new NewHeroSkills(this);}
 rank(id){return this.api.player().upgrades[id]||0;}
 fx(kind,x,z,extra={}){this.api.fx({kind,x,z,...extra});}
 foes(x=this.api.player().x,z=this.api.player().z,r=14){return this.api.foes().filter(e=>e.alive&&Math.hypot(e.x-x,e.z-z)<r).sort((a,b)=>Math.hypot(a.x-x,a.z-z)-Math.hypot(b.x-x,b.z-z));}
 canHit(x,z,e){return !this.api.blocked(x,z,e.x,e.z);}
 hit(e,damage){if(this.api.active()&&e.alive)this.api.damage(e,damage);}
 area(x,z,r,damage,slow=0){for(const e of this.foes(x,z,r)){if(!this.api.active())break;if(!this.canHit(x,z,e))continue;this.hit(e,damage);if(e.alive&&slow)e.slow=Math.max(e.slow||0,slow);}}
 onDodge(duration){this.newHeroes.dodge(duration);if(!this.api.active()||!this.rank('counter'))return;this.counterReady=this.now+duration;this.counterUntil=this.counterReady+2;}
 onShot(angle,elapsed=0){
  if(!this.api.active())return;const p=this.api.player(),now=this.now+elapsed;
  if(this.rank('counter')&&this.counterUntil>now&&now>=this.counterReady){
   this.counterUntil=0;this.fx('counter',p.x,p.z,{angle});
   for(const e of this.foes(p.x,p.z,5)){const a=Math.atan2(e.x-p.x,e.z-p.z);if(Math.abs(Math.atan2(Math.sin(a-angle),Math.cos(a-angle)))>.7||!this.canHit(p.x,p.z,e))continue;this.hit(e,14+12*this.rank('counter'));if(e.alive&&!e.boss)this.api.knock(e,.65);}
  }
  if(!this.api.active())return;
  if(this.rank('volley')&&((this.count.volley=(this.count.volley||0)+1)%5===0)){
   this.fx('volley',p.x,p.z,{angle});
   for(const offset of [-.18,0,.18]){if(this.bolts.length>=18)this.bolts.shift();const a=angle+offset;this.bolts.push({x:p.x,z:p.z,vx:Math.sin(a)*22,vz:Math.cos(a)*22,life:10/22,damage:8+4*this.rank('volley'),hits:new Set()});}
  }
  if(this.rank('echo')&&((this.count.echo=(this.count.echo||0)+1)%4===0)&&now>=(this.cool.echo||0)){
   this.cool.echo=now+3;const x=p.x+Math.cos(angle)*.7,z=p.z-Math.sin(angle)*.7;this.fx('echo',x,z);
   for(const delay of [.25,.65])this.pending.push({kind:'echo',x,z,delay,damage:14+7*this.rank('echo')});
  }
 }
 onHit(e){
  this.newHeroes.hit(e);
  if(!this.api.active()||!this.rank('pursuit')||!e.alive||this.now<(this.cool.pursuit||0))return;
  if(!this.mark||this.mark.enemy!==e||this.now-this.mark.time>2.5)this.mark={enemy:e,count:0,time:this.now};
  this.mark.count++;this.mark.time=this.now;
  if(this.mark.count<4)return;this.mark=null;this.cool.pursuit=this.now+1.2;this.hit(e,9+9*this.rank('pursuit'));
  if(e.alive){if(e.boss)e.slow=Math.max(e.slow||0,.8);else e.stagger=Math.max(e.stagger||0,.35+.15*this.rank('pursuit'));}this.fx('pursuit',e.x,e.z);
 }
 onKill(e){
  if(!this.api.active()||!this.rank('soul')||this.now<(this.cool.soul||0))return;const p=this.api.player();if(Math.hypot(e.x-p.x,e.z-p.z)>8||p.hp>=p.maxHp)return;
  this.cool.soul=this.now+1;p.hp=Math.min(p.maxHp,p.hp+1+this.rank('soul'));this.fx('soul',e.x,e.z,{x2:p.x,z2:p.z});
 }
 update(dt){
  if(!this.api.active()||dt<=0)return;this.now+=dt;const p=this.api.player();this.newHeroes.update(dt);if(!this.api.active())return;
  for(const [id,cooldown]of [['mine',6],['rain',8],['spikes',7]]){
   if(!this.rank(id))continue;this.cool[id]=(this.cool[id]??1)-dt;if(this.cool[id]>0)continue;
   const near=this.foes(p.x,p.z,id==='mine'?14:12).filter(e=>this.canHit(p.x,p.z,e));if(!near.length){this.cool[id]=.3;continue;}this.cool[id]=cooldown;
   if(id==='mine'){if(this.mines.length>=2)this.mines.shift();this.mines.push({x:p.x,z:p.z,arm:.45,life:10,pulse:0,damage:18+14*this.rank(id)});this.fx('mineSet',p.x,p.z);}
   else if(id==='rain'){const e=near[0];this.fx('rainAim',e.x,e.z);for(const delay of [.55,.71,.87])this.pending.push({kind:'rain',x:e.x,z:e.z,delay,damage:12+6*this.rank(id)});}
   else{const aim=this.api.aim?.()??p.aimAngle,angle=Number.isFinite(aim)?aim:Math.atan2(near[0].x-p.x,near[0].z-p.z);for(let i=1;i<=3;i++){const x=p.x+Math.sin(angle)*i*2,z=p.z+Math.cos(angle)*i*2;if(this.api.blocked(p.x,p.z,x,z))break;this.fx('spikeAim',x,z,{angle});this.pending.push({kind:'spikes',x,z,angle,delay:.1+i*.15,damage:18+9*this.rank(id)});}}
  }
  if(this.last){const distance=Math.hypot(p.x-this.last.x,p.z-this.last.z);if(distance>2){this.walked=0;this.anchor={x:p.x,z:p.z};}else if(this.rank('trail')){this.walked+=distance;if(this.walked>=3){const a=this.anchor||this.last;this.walked=0;this.anchor={x:p.x,z:p.z};if(!this.api.blocked(a.x,a.z,p.x,p.z)){if(this.trails.length>=4)this.trails.shift();this.trails.push({x:a.x,z:a.z,x2:p.x,z2:p.z,life:2.5,pulse:0,hits:new Set(),damage:6+3*this.rank('trail')});this.fx('trailSet',p.x,p.z);}}}else{this.anchor={x:p.x,z:p.z};this.walked=0;}}
  this.last={x:p.x,z:p.z};this.anchor??={...this.last};
  for(const m of this.mines){m.life-=dt;m.arm-=dt;m.pulse-=dt;if(m.life<=0)continue;if(m.pulse<=0){m.pulse=.38;this.fx('mine',m.x,m.z,{armed:m.arm<=0});}if(m.arm<=0&&this.foes(m.x,m.z,1.4).some(e=>this.canHit(m.x,m.z,e))){m.life=0;this.fx('mineBlast',m.x,m.z);this.area(m.x,m.z,3,m.damage);}}
  this.mines=this.mines.filter(m=>m.life>0);
  for(const t of this.trails){t.life-=dt;if(t.life<=0)continue;t.pulse-=dt;if(t.pulse<=0){t.pulse=.32;this.fx('trail',t.x,t.z,{x2:t.x2,z2:t.z2});}for(const e of this.api.foes()){if(!e.alive||segmentDistance(e.x,e.z,t.x,t.z,t.x2,t.z2)>1.1)continue;e.slow=Math.max(e.slow||0,.8);if(!t.hits.has(e)){t.hits.add(e);this.hit(e,t.damage);}}}this.trails=this.trails.filter(t=>t.life>0);
  for(const b of this.bolts){const x=b.x,z=b.z,step=Math.min(dt,b.life);b.x+=b.vx*step;b.z+=b.vz*step;b.life-=dt;if(this.api.blocked(x,z,b.x,b.z)){b.life=0;continue;}this.fx('slug',x,z,{x2:b.x,z2:b.z});for(const e of this.api.foes())if(e.alive&&!b.hits.has(e)&&segmentDistance(e.x,e.z,x,z,b.x,b.z)<(e.size||.5)+.12){b.hits.add(e);this.hit(e,b.damage);this.fx('slugHit',e.x,e.z);}}this.bolts=this.bolts.filter(b=>b.life>0);
  for(const q of this.pending){q.delay-=dt;if(q.delay>0||q.done)continue;q.done=true;if(!this.api.active())break;
   if(q.kind==='echo'){const e=this.foes(q.x,q.z,10).find(e=>this.canHit(q.x,q.z,e));if(e){this.fx('echoHit',q.x,q.z,{x2:e.x,z2:e.z});this.hit(e,q.damage);}}
   else if(q.kind==='rain'){this.fx('rain',q.x,q.z);this.area(q.x,q.z,2.5,q.damage);}
   else{this.fx('spikes',q.x,q.z,{angle:q.angle});this.area(q.x,q.z,1.3,q.damage,1.2);}
  }this.pending=this.pending.filter(q=>!q.done);
 }
}
