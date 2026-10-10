import{POISON as C}from'./poison-config.js?v=114';
const EPS=1e-8,clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
function nearestPoint(p,a,b){const dx=b.x-a.x,dz=b.z-a.z,l=dx*dx+dz*dz,t=l?clamp(((p.x-a.x)*dx+(p.z-a.z)*dz)/l,0,1):0;return{x:a.x+dx*t,z:a.z+dz*t};}
function local(q,p){const c=Math.cos(q.angle||0),s=Math.sin(q.angle||0),x=p.x-q.x,z=p.z-q.z;return{x:x*c-z*s,z:x*s+z*c};}
export function cloudContains(q,x,z,now){const p=local(q,{x,z});return now<q.curtainUntil?Math.abs(p.x)<=C.curtainHalfWidth&&Math.abs(p.z)<=C.curtainHalfDepth:p.x*p.x+p.z*p.z<=q.r*q.r;}
// Earliest intersection along the actual collision-resolved segment, including a start inside.
export function cloudEntry(q,a,b,now){
 if(cloudContains(q,a.x,a.z,now))return 0;
 if(now<q.curtainUntil){const p=local(q,a),end=local(q,b);let lo=0,hi=1;for(const[k,r]of[['x',C.curtainHalfWidth],['z',C.curtainHalfDepth]]){const d=end[k]-p[k];if(Math.abs(d)<EPS){if(Math.abs(p[k])>r)return Infinity;continue;}const v=(-r-p[k])/d,w=(r-p[k])/d;lo=Math.max(lo,Math.min(v,w));hi=Math.min(hi,Math.max(v,w));if(lo>hi)return Infinity;}return lo;}
 const dx=b.x-a.x,dz=b.z-a.z,px=a.x-q.x,pz=a.z-q.z,A=dx*dx+dz*dz;if(A<EPS)return Infinity;
 const B=2*(px*dx+pz*dz),D=B*B-4*A*(px*px+pz*pz-q.r*q.r);if(D<0)return Infinity;
 const t=(-B-Math.sqrt(D))/(2*A);return t>=0&&t<=1?t:Infinity;
}
export class PoisonCombat{
 constructor(api){this.api=api;this.reset();}
 reset(){this.now=0;this.tickIndex=1;this.serial=0;this.clouds=[];this.bands=[];this.pods=[];this.marks=new Map();this.dodge=null;this.shield={amount:0,until:0};this.guardReady=0;}
 rank(id){return clamp(this.api.player()?.upgrades?.[id]||0,0,3);}
 active(){return this.api.active()&&this.api.player()?.heroId==='wuling';}
 fx(kind,x,z,extra={}){this.api.fx?.({kind,x,z,...extra});}
 clear(a,b){return !this.api.blocked?.(a.x,a.z,b.x,b.z);}
 cast(w,start,angle,target){
  if(!this.active())return false;
  const delay=Math.min(C.castRecovery,.9/w.rate)*C.releaseFraction,flight=clamp(Math.hypot(target.x-start.x,target.z-start.z)/C.speed,C.flightMin,C.flightMax);
  if(this.pods.length>=C.maxPods)this.pods.shift();
  this.pods.push({id:++this.serial,startX:start.x,startZ:start.z,x:target.x,z:target.z,angle,releaseAt:this.now+delay,landAt:this.now+delay+flight,w:{...w}});return true;
 }
 addCloud(x,z,w,born=this.now){
  const q={id:++this.serial,x,z,r:w.cloudRadius??C.radius,damage:w.cloudDamage??C.dps,born,expires:born+(w.cloudDuration??C.duration),settledAt:born,stillRank:w.stillRank||0,roamRank:w.roamRank||0,carried:false,angle:0,curtainUntil:0};
  this.clouds=this.clouds.filter(q=>q.expires>this.now);if(this.clouds.length>=C.maxClouds)this.clouds.shift();this.clouds.push(q);return q;
 }
 land(pod){
  if(!this.active())return;const q=this.addCloud(pod.x,pod.z,pod.w,pod.landAt);this.fx('poisonLand',q.x,q.z,{r:q.r,angle:pod.angle,w:pod.w});
  this.api.impactTerrain?.(q.x,q.z,C.impactRadius,pod.w.damage);
  for(const e of this.api.foes()){if(!this.active())break;if(e.alive&&(e.y||0)<=.9&&Math.hypot(e.x-q.x,e.z-q.z)<=C.impactRadius&&this.clear(q,e))this.api.damage(e,pod.w.damage,true,{kind:'sporelantern',source:'poison-impact',angle:pod.angle});}
 }
 beginDodge(x,z){
  if(!this.active())return;this.pods=this.pods.filter(q=>q.releaseAt<=this.now);
  this.dodge={engaged:false,cloud:null,points:[{x,z}],origin:null};this.moveDodge(x,z,x,z);
 }
 moveDodge(ax,az,bx,bz){
  const d=this.dodge;if(!d||!this.active())return;
  if(!d.engaged){let chosen=null,entry=Infinity;for(const q of this.clouds){if(q.carried||q.expires<=this.now)continue;const t=cloudEntry(q,{x:ax,z:az},{x:bx,z:bz},this.now);if(t<entry){entry=t;chosen=q;}}
   if(chosen){d.engaged=true;d.cloud=chosen;d.origin={x:chosen.x,z:chosen.z};chosen.carried=true;chosen.settledAt=this.now;chosen.curtainUntil=0;d.points=[{x:ax+(bx-ax)*entry,z:az+(bz-az)*entry}];this.fx('poisonPickup',chosen.x,chosen.z,{id:chosen.id});}
  }
  if(d.engaged){const last=d.points.at(-1);if(Math.hypot(bx-last.x,bz-last.z)>.001){
   // ponytail: one 4.8m dodge needs <128 collision samples; longer abilities need path resampling.
   if(d.points.length<128)d.points.push({x:bx,z:bz});else d.points[d.points.length-1]={x:bx,z:bz};
  }}
 }
 endDodge(x,z){
  const d=this.dodge;this.dodge=null;const q=d?.cloud;
  if(!this.active()||!q||!this.clouds.includes(q)||q.expires<=this.now)return false;
  q.x=x;q.z=z;q.carried=false;q.settledAt=this.now;const first=d.points[0];q.angle=Math.atan2(x-first.x,z-first.z);
  if(q.roamRank>=2&&d.points.length>1){if(this.bands.length>=C.maxBands)this.bands.shift();this.bands.push({id:++this.serial,points:d.points.map(p=>({...p})),r:C.bandRadius,damage:q.damage*C.bandMultiplier,born:this.now,expires:Math.min(q.expires,this.now+C.bandDuration)});}
  q.curtainUntil=q.roamRank>=3?Math.min(q.expires,this.now+C.curtainDuration):0;
  this.fx('poisonMove',x,z,{fromX:d.origin.x,fromZ:d.origin.z,angle:q.angle,w:{id:'sporelantern',pathId:q.roamRank?'sporelantern_roam':'sporelantern_still',pathRank:q.roamRank||q.stillRank}});
  const rank=this.rank('poison_guard');if(rank&&this.now+EPS>=this.guardReady){this.guardReady=this.now+C.shieldCooldown;this.shield.amount=Math.max(this.shield.amount,C.shield[rank]);this.shield.until=this.now+C.shieldDuration;this.fx('poisonGuard',x,z);}
  return true;
 }
 absorb(damage){if(!this.active()||this.shield.until<=this.now||this.shield.amount<=0)return damage;const used=Math.min(damage,this.shield.amount);this.shield.amount-=used;return damage-used;}
 strongest(e,t){
  if((e.y||0)>.9)return null;
  let best=null;
  for(const q of this.clouds){if(q.carried||q.born>=t||q.expires+EPS<t||!cloudContains(q,e.x,e.z,t)||!this.clear(q,e))continue;
   const maturity=clamp((t-q.settledAt)/C.matureTime,0,1);let damage=q.damage*(q.stillRank>=2?1+C.matureBonus*maturity:1);
   if(q.stillRank>=3&&maturity>=1&&Math.hypot(e.x-q.x,e.z-q.z)<=C.coreRadius)damage*=C.coreMultiplier;
   if(!best||damage>best.damage)best={damage,source:'poison-main'};
  }
  for(const b of this.bands){if(b.born>=t||b.expires+EPS<t||best?.damage>=b.damage)continue;for(let i=1;i<b.points.length;i++){const point=nearestPoint(e,b.points[i-1],b.points[i]);if(Math.hypot(e.x-point.x,e.z-point.z)<=b.r&&this.clear(point,e)){best={damage:b.damage,source:'poison-band'};break;}}}
  return best;
 }
 spread(dead,t){
  const rank=this.rank('poison_spread');if(!rank||!this.active())return;
  let target=null,distance=C.spreadRange;for(const e of this.api.foes()){const d=Math.hypot(e.x-dead.x,e.z-dead.z);if(e!==dead&&e.alive&&d<distance&&this.clear(dead,e)){target=e;distance=d;}}
  if(!target)return;const mark=this.marks.get(target)||{};if(!(mark.spreadUntil+EPS>=t))mark.spreadBorn=t;mark.spreadDamage=C.spreadDps[rank];mark.spreadUntil=t+C.spreadDuration;this.marks.set(target,mark);this.fx('poisonSpread',dead.x,dead.z,{x2:target.x,z2:target.z});
 }
 tick(t){
  // One bounded scan of the existing enemy list per game-time tick, not per particle or cloud.
  for(const e of this.api.foes()){
   if(!this.active())return;if(!e.alive){this.marks.delete(e);continue;}
   const area=this.strongest(e,t);let mark=this.marks.get(e),damage=0,source='';
   if(area){damage=area.damage;source=area.source;const rank=this.rank('poison_linger');if(rank){mark??={};mark.lingerDamage=C.lingerDps[rank];mark.lingerUntil=t+C.lingerDuration[rank];this.marks.set(e,mark);}}
   else if(mark){const linger=mark.lingerUntil+EPS>=t?mark.lingerDamage||0:0,spread=mark.spreadUntil+EPS>=t&&!(mark.spreadBorn>=t)?mark.spreadDamage||0:0;damage=Math.max(linger,spread);source=spread>linger?'poison-spread':'poison-linger';}
   if(damage>0){this.api.damage(e,damage*C.tick,false,{source,kind:'poison'});if(!this.active())return;if(!e.alive){this.marks.delete(e);if(source==='poison-main')this.spread(e,t);}
    else if(this.tickIndex%4===0)this.fx('poisonStatus',e.x,e.z,{size:e.size||.5,variant:area?'area':source});}
   if(mark&&!area&&!(mark.lingerUntil>t)&&!(mark.spreadUntil>t))this.marks.delete(e);
  }
  for(const[e]of this.marks)if(!e.alive)this.marks.delete(e);
 }
 update(dt){
  if(!this.active()||!Number.isFinite(dt)||dt<=0)return;const end=this.now+dt;
  // Discrete poison ticks and impact events use absolute game timestamps, independent of render FPS.
  while(this.active()){
   const eventAt=q=>q.released?q.landAt:q.releaseAt,pod=this.pods.reduce((best,q)=>!best||eventAt(q)<eventAt(best)?q:best,null),tickAt=this.tickIndex*C.tick,next=Math.min(tickAt,pod?eventAt(pod):Infinity);
   if(next>end+EPS)break;this.now=next;
   if(pod&&eventAt(pod)<=tickAt){if(!pod.released){pod.released=true;const origin=this.api.release?.(pod);if(origin){pod.startX=origin.x;pod.startZ=origin.z;pod.startY=origin.y;}this.fx('poisonThrow',pod.startX,pod.startZ);}else{this.pods.splice(this.pods.indexOf(pod),1);this.land(pod);}}else{this.tick(tickAt);this.tickIndex++;}
  }
  if(!this.active())return;this.now=end;this.clouds=this.clouds.filter(q=>q.expires>this.now);this.bands=this.bands.filter(q=>q.expires>this.now);if(this.shield.until<=this.now)this.shield.amount=0;
 }
}
