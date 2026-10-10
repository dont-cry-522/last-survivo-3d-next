import{MIRAGE as C}from'./mirage-config.js?v=114';
const EPS=1e-8,clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

// Owns only the new hero's decoy, concealment and poison. All damage/rewards still use the game callback.
export class MirageCombat{
 constructor(api){this.api=api;this.reset();}
 reset(){const p=this.api.player?.();if(p)p.mirageHidden=false;if(this.decoy)this.decoy.alive=false;this.now=0;this.tickIndex=1;this.lastTick=0;this.serial=0;this.decoy=null;this.clouds=[];this.marks=new Map();this.hiddenUntil=0;this.revealAt=0;this.pursuitUntil=0;this.shield={amount:0,until:0};this.guardReady=0;}
 active(){return this.api.active()&&this.api.player()?.heroId==='mirage';}
 get hidden(){return this.api.player()?.heroId==='mirage'&&this.now+EPS<this.hiddenUntil;}
 rank(id){return clamp(this.api.player()?.upgrades?.[id]||0,0,3);}
 fx(kind,x,z,extra={}){this.api.fx?.({kind,x,z,...extra});}
 clear(a,b){return !this.api.blocked?.(a.x,a.z,b.x,b.z);}
 modifyShot(w){
  if(!this.active()||w.id!=='miasmalantern'||this.now+EPS>=this.pursuitUntil)return w;
  const rank=w.venomRank||0;if(rank<2)return w;
  return{...w,needleDamage:w.needleDamage+C.pursuitDps*(w.poisonScale||1),rate:w.rate*(rank>=3?C.pursuitRate:1),miragePursuit:true};
 }
 residue(mark,t){const rank=this.rank('mirage_residue');if(!rank)return;if(!(mark.residueUntil>t))mark.residueBorn=t;mark.residueDamage=C.residueDps[rank];mark.residueUntil=t+C.residueDuration[rank];}
 attackHit(e,w,{silent=false}={}){
  if(!this.active()||!e?.alive||w.id!=='miasmalantern')return false;
  // Finish the old value before a refresh replaces it between regular poison ticks.
  if(this.marks.has(e)&&this.now>this.lastTick+EPS){this.tick(this.now);if(!this.active()||!e.alive)return false;}
  const mark=this.marks.get(e)||{};if(!(mark.needleUntil>this.now))mark.needleBorn=this.now;
  mark.needleDamage=w.needleDamage??C.needleDps;mark.needleUntil=this.now+C.needleDuration;this.residue(mark,this.now);this.marks.set(e,mark);
  if(!silent)this.fx('mirageHit',e.x,e.z,{angle:w.angle||0,size:e.size||.5,w});return true;
 }
 burst(x,z,w,primary=null){
  if(!this.active()||w?.id!=='miasmalantern'||!Number.isFinite(x)||!Number.isFinite(z))return false;
  const origin={x,z},r=w.burstRadius??C.burstRadius,damage=w.splashDamage??C.splashDamage;
  this.fx('mirageBurst',x,z,{r,angle:w.angle||0,w});
  // A large boss can be hit at its surface while its centre lies outside the spread radius.
  if(primary?.alive)this.attackHit(primary,w,{silent:true});
  for(const e of this.api.foes()){
   if(!this.active())return true;
   if(e===primary||!e.alive||Math.hypot(e.x-x,e.z-z,Math.max((e.y||0)-(w.impactY||0),0,(w.impactY||0)-(e.y||0)-(e.height||1.5)))>r||!this.clear(origin,e))continue;
   // Spread is secondary and cannot inherit hit/kill procs or hit primary twice.
   this.api.damage(e,damage,false,{kind:'miragePoison',source:'mirage-splash',secondary:true});if(!this.active())return true;
   if(e.alive)this.attackHit(e,w,{silent:true});
  }
  return true;
 }
 startDodge(x,z,angle,w){
  if(!this.active())return false;const p=this.api.player();if(!(p.hp>0))return false;
  this.removeDecoy('replaced');const lure=w.lureRank||0;
  this.decoy={id:++this.serial,alive:true,x,z,angle,hp:p.hp,maxHp:p.hp,r:C.decoyRadius,born:this.now,expires:this.now+(lure?C.lureDuration:C.decoyDuration),damageTaken:lure?C.lureDamageTaken:1,w:{...w}};
  this.hiddenUntil=this.now+C.hiddenDuration;this.revealAt=this.hiddenUntil;p.mirageHidden=true;
  this.fx('mirageHide',x,z,{angle});this.fx('mirageDecoy',x,z,{angle,id:this.decoy.id,r:this.decoy.r,life:this.decoy.expires-this.now});return true;
 }
 removeDecoy(reason){const d=this.decoy;if(!d)return;d.alive=false;this.decoy=null;this.fx('mirageBreak',d.x,d.z,{id:d.id,reason,angle:d.angle});}
 damageDecoy(n){
  const d=this.decoy;if(!this.active()||!d?.alive||d.expires<=this.now||!Number.isFinite(n)||n<=0)return false;
  d.hp=Math.max(0,d.hp-n*d.damageTaken);this.fx('mirageDecoyHit',d.x,d.z,{id:d.id,r:d.r,angle:d.angle});if(d.hp<=0)this.removeDecoy('killed');return true;
 }
 reveal(){
  this.revealAt=0;const p=this.api.player();p.mirageHidden=false;this.pursuitUntil=this.now+C.pursuitDuration;this.fx('mirageReveal',p.x,p.z);
  const rank=this.rank('mirage_mantle');if(rank&&this.now+EPS>=this.guardReady){this.guardReady=this.now+C.shieldCooldown;this.shield.amount=Math.max(this.shield.amount,C.shield[rank]);this.shield.until=this.now+C.shieldDuration;this.fx('mirageShield',p.x,p.z);}
 }
 absorb(n){if(!this.active()||this.shield.until<=this.now||this.shield.amount<=0)return n;const used=Math.min(n,this.shield.amount);this.shield.amount-=used;return n-used;}
 bloom(){
  const d=this.decoy;if(!d?.alive)return;
  if(this.now>this.lastTick+EPS){this.tick(this.now);if(!this.active()||this.decoy!==d)return;}
  d.alive=false;this.decoy=null;const lure=d.w.lureRank||0,scale=d.w.poisonScale||1;
  const r=lure>=2?C.lureBloomRadius:C.bloomRadius,damage=C.bloomDamage*scale*(lure>=3?C.lureFinalBloom:1);
  this.clouds=this.clouds.filter(q=>q.expires>this.now);if(this.clouds.length>=C.maxClouds)this.clouds.shift();
  this.clouds.push({id:++this.serial,x:d.x,z:d.z,r:lure>=2?C.lureCloudRadius:C.cloudRadius,born:this.now,expires:this.now+(lure>=2?C.lureCloudDuration:C.cloudDuration),damage:(lure>=2?C.lureCloudDps:C.cloudDps)*scale*(lure>=3?C.lureFinalDps:1),lureRank:lure});
  this.fx('mirageBloom',d.x,d.z,{id:d.id,angle:d.angle,r,lureRank:lure,w:d.w});
  for(const e of this.api.foes()){
   if(!this.active())return;if(!e.alive||Math.hypot(e.x-d.x,e.z-d.z)>r||!this.clear(d,e))continue;
   this.api.damage(e,damage,false,{kind:'miragePoison',source:'mirage-bloom',secondary:true});if(!e.alive)continue;
   const rank=this.rank('mirage_burial');if(rank){const mark=this.marks.get(e)||{};if(!(mark.burialUntil>this.now))mark.burialBorn=this.now;mark.burialDamage=C.burialDps[rank];mark.burialUntil=this.now+C.burialDuration;this.marks.set(e,mark);e.slow=Math.max(e.slow||0,C.burialSlow[rank]);}
   if(lure>=3)e.slow=Math.max(e.slow||0,C.lureSlow);
  }
 }
 area(e,t){if((e.y||0)>.9)return null;let best=null;for(const q of this.clouds){if(q.born-EPS>t||q.expires+EPS<t||Math.hypot(e.x-q.x,e.z-q.z)>q.r||!this.clear(q,e))continue;if(!best||q.damage>best.damage)best=q;}return best;}
 tick(t){
  for(const e of this.api.foes()){
   if(!this.active())return;if(!e.alive){this.marks.delete(e);continue;}
   let mark=this.marks.get(e);const touching=this.area(e,t);
   if(touching){mark??={};this.residue(mark,t);if(touching.lureRank>=3)e.slow=Math.max(e.slow||0,C.lureSlow);if(Object.keys(mark).length)this.marks.set(e,mark);}
   // Split only at the bounded source endpoints: partial first/last poison ticks stay frame-rate independent.
   const cuts=[this.lastTick,t];for(const q of this.clouds)cuts.push(q.born,q.expires);
   if(mark)for(const key of['needle','residue','burial'])cuts.push(mark[key+'Born'],mark[key+'Until']);
   const times=[...new Set(cuts.filter(v=>Number.isFinite(v)&&v>=this.lastTick&&v<=t))].sort((a,b)=>a-b);
   let damage=0,source='mirage-cloud';
   for(let i=1;i<times.length;i++){
    const at=(times[i-1]+times[i])/2,q=this.area(e,at);let dps=q?.damage||0,kind='mirage-cloud';
    if(!q&&mark)for(const key of['needle','residue','burial']){if(mark[key+'Born']<=at&&mark[key+'Until']>at&&(mark[key+'Damage']||0)>dps){dps=mark[key+'Damage'];kind='mirage-'+key;}}
    if(dps){damage+=dps*(times[i]-times[i-1]);source=kind;}
   }
   if(damage>EPS){this.api.damage(e,damage,false,{kind:'miragePoison',source,secondary:true});if(!this.active())return;if(e.alive&&this.tickIndex%4===0)this.fx('mirageStatus',e.x,e.z,{size:e.size||.5});}
   if(mark&&(!e.alive||!['needle','residue','burial'].some(key=>mark[key+'Until']>t)))this.marks.delete(e);
  }
  for(const[e]of this.marks)if(!e.alive)this.marks.delete(e);this.lastTick=t;
 }
 update(dt){
  if(!this.active()||!Number.isFinite(dt)||dt<=0)return;const end=this.now+dt;
  while(this.active()){
   const tickAt=this.tickIndex*C.tick,cloudEnd=this.clouds.reduce((at,q)=>Math.min(at,q.expires),Infinity),next=Math.min(tickAt,cloudEnd,this.decoy?.expires??Infinity,this.revealAt||Infinity);if(next>end+EPS)break;this.now=next;
   if(tickAt<=next+EPS||cloudEnd<=next+EPS){this.tick(next);if(!this.active())return;if(tickAt<=next+EPS)this.tickIndex++;}
   this.clouds=this.clouds.filter(q=>q.expires>next+EPS);
   if(this.revealAt&&this.revealAt<=next+EPS)this.reveal();
   if(this.decoy&&this.decoy.expires<=next+EPS)this.bloom();
   if(!this.active())return;
  }
  if(!this.active())return;this.now=end;this.api.player().mirageHidden=this.hidden;if(this.shield.until<=this.now)this.shield.amount=0;
 }
}
