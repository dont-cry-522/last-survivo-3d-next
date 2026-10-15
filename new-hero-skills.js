// New hero skills trigger from resolved combat events, never from cosmetic animation.
export class NewHeroSkills {
 constructor(owner){this.owner=owner;this.reset();}
 reset(){this.pending=[];this.fields=[];this.cool={};this.careHits=0;this.marks=new Map();this.snared=new Map();this.primeUntil=0;}
 rank(id){return this.owner.rank(id);}
 ready(id,delay){const now=this.owner.now;if(now<(this.cool[id]||0))return false;this.cool[id]=now+delay;return true;}
 strike(angle,kind,finisher){
  const s=this.owner,p=s.api.player(),id=kind==='hammer'?'fault':'surge',r=this.rank(id);
  if(!s.api.active()||!finisher||!r)return;
  const charged=id==='fault'&&this.primeUntil>s.now; if(id==='fault')this.primeUntil=0;
  for(let i=1;i<=3;i++){const x=p.x+Math.sin(angle)*i*2,z=p.z+Math.cos(angle)*i*2;if(s.api.blocked(p.x,p.z,x,z))break;
   s.fx(id==='fault'?'faultAim':'surgeAim',x,z,{angle,delay:i*.13,charged});this.pending.push({kind:id,x,z,angle,charged,delay:i*.13,damage:(id==='fault'?14+8*r:10+7*r)*(charged?1.35:1)});}
 }
 parry(){const s=this.owner,p=s.api.player(),r=this.rank('reprisal');if(!s.api.active()||!r||!this.ready('reprisal',4))return;
  if(this.rank('fault')){this.primeUntil=s.now+8;s.fx('faultPrime',p.x,p.z);}
  s.fx('reprisal',p.x,p.z);for(const e of s.foes(p.x,p.z,3)){if(!s.canHit(p.x,p.z,e))continue;s.hit(e,16+10*r);if(e.alive&&!e.boss)s.api.knock(e,.7);}
 }
 dodge(duration){const s=this.owner,p=s.api.player();if(!s.api.active())return;
  for(const id of ['landing','wake'])if(this.rank(id)&&this.ready(id,6))this.pending.push({kind:id,delay:duration});
  if(this.rank('briar')){const traps=this.fields.filter(q=>q.kind==='briar');if(traps.length>=2)this.fields.splice(this.fields.indexOf(traps[0]),1);this.fields.push({kind:'briar',x:p.x,z:p.z,life:8,arm:.45,pulse:0,hits:new Set()});s.fx('briarSet',p.x,p.z);}
 }
 hit(e,brineWeight=1){const s=this.owner,r=this.rank('brine');if(!s.api.active()||!r||!e.alive)return;
  let m=this.marks.get(e);if(!m||s.now-m.time>3)m={count:0,time:s.now};m.time=s.now;m.count+=brineWeight;m.pulse=.35;this.marks.set(e,m);
  s.fx('brineMark',e.x,e.z,{count:m.count});if(m.count>=3&&this.ready('brine',1)){m.count=0;s.hit(e,16+10*r);s.fx('brine',e.x,e.z);}
 }
 petHit(e){const s=this.owner,pet=s.api.companion?.(),r=this.rank('bond');if(!s.api.active()||!r||!e.alive||!pet?.alive||!(e.lingyaMark>pet.now)||!this.ready('bond',1.5))return;const linked=(this.snared.get(e)||0)>s.now;s.hit(e,(12+8*r)*(linked?1.25:1));s.fx('bond',e.x,e.z,{linked});}
 slingHit(){const s=this.owner,r=this.rank('care');if(!s.api.active()||!r)return;if(++this.careHits%4)return;const p=s.api.player(),pet=s.api.companion?.();if(pet?.alive&&Math.hypot(pet.x-p.x,pet.z-p.z)<=10&&pet.hp<pet.maxHp){pet.hp=Math.min(pet.maxHp,pet.hp+6+4*r);s.fx('care',pet.x,pet.z);}}
 update(dt){const s=this.owner,p=s.api.player();
  for(const [e,m]of this.marks){if(!e.alive||s.now-m.time>3){this.marks.delete(e);continue;}m.pulse=(m.pulse||0)-dt;if(m.count>0&&m.pulse<=0){m.pulse=.35;s.fx('brineMark',e.x,e.z,{count:m.count});}}
  for(const [e,until]of this.snared)if(!e.alive||s.now>=until)this.snared.delete(e);
  for(const q of this.pending){q.delay-=dt;if(q.delay>0||q.done)continue;q.done=true;if(!s.api.active())break;
   if(q.kind==='landing'){s.fx('landing',p.x,p.z);s.area(p.x,p.z,2.8,12+9*this.rank('landing'),1);}
   else if(q.kind==='wake'){this.fields.push({kind:'wake',x:p.x,z:p.z,life:3,arm:0,pulse:0,hits:new Set()});}
   else{s.fx(q.kind,q.x,q.z,{angle:q.angle,charged:q.charged});s.area(q.x,q.z,1.25,q.damage,q.kind==='surge'?1:0);}
  }this.pending=this.pending.filter(q=>!q.done);
  for(const q of this.fields){q.life-=dt;q.arm-=dt;q.pulse-=dt;if(q.life<=0)continue;if(q.pulse<=0){q.pulse=.4;s.fx(q.kind==='briar'?'briarIdle':'wake',q.x,q.z);}
   if(q.arm>0)continue;const foes=s.foes(q.x,q.z,q.kind==='wake'?2.2:1.8).filter(e=>s.canHit(q.x,q.z,e));
   if(q.kind==='briar'&&foes.length){q.life=0;s.fx('briar',q.x,q.z);for(const e of foes){s.hit(e,12+8*this.rank('briar'));if(e.alive){if(this.rank('bond')){const pet=s.api.companion?.();if(pet?.alive){e.lingyaMark=Math.max(e.lingyaMark||0,pet.now+2);this.snared.set(e,s.now+2);s.fx('snareMark',e.x,e.z);}}e.slow=Math.max(e.slow||0,2);if(!e.boss)e.stagger=Math.max(e.stagger||0,.5);}}}
   else if(q.kind==='wake')for(const e of foes){e.slow=Math.max(e.slow||0,.65);if(!q.hits.has(e)){q.hits.add(e);s.hit(e,9+7*this.rank('wake'));if(e.alive&&this.rank('brine')){this.hit(e);s.fx('saltWake',e.x,e.z);}}}
  }this.fields=this.fields.filter(q=>q.life>0);
 }
}
