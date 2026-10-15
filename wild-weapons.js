import{segmentBodyEntry,segmentGroundEntry}from'./adventure-combat.js?v=211';

export const ARCSTAFF={rate:4,damage:9,range:9.5,radius:.09,jump:3,chainScale:.6,focusWindow:.55,focusTime:1.25,focusCap:[0,.55,.80,1.05],brineWeight:.5};
export const BRIARPOT={rate:.85,damage:44,range:10,radius:2.1,gravity:12,arm:.55,max:6,slow:.7,staggerCooldown:2};
const distance=(a,b)=>Math.hypot(b.x-a.x,b.y-a.y,b.z-a.z);
const mix=(a,b,t)=>({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t,z:a.z+(b.z-a.z)*t});
const center=e=>({x:e.x,y:(e.y||0)+(e.height||1.4)*.55,z:e.z});
export const briarTargetPoint=e=>({x:e.x,y:(e.y||0)+Math.min(.7,(e.height||1.4)*.5),z:e.z});

// Multiple waiting pods may explode together; only one can interrupt this foe
// during the cooldown. Slow and damage still resolve normally on later hits.
export function briarStagger(enemy,w,now){
 if(!w.stagger||enemy.boss||!enemy.alive||now<(enemy.briarStaggerReady||0))return false;
 enemy.stagger=Math.max(enemy.stagger||0,w.stagger);enemy.briarStaggerReady=now+BRIARPOT.staggerCooldown;return true;
}

// Only these two new weapons share this query. All collision shapes come from
// the existing world; trees, ceilings and height changes remain authoritative.
export function wildWeaponBlock(a,b,world,radius=0){
 let t=1,hit=null;
 const ground=segmentGroundEntry(a,b,world.groundHeightAt,radius);
 if(ground!==null){t=ground;hit={ground:true};}
 for(const o of world.obstacles||[]){const entry=segmentBodyEntry(a,b,o,radius);if(entry!==null&&entry<=t){t=entry;hit={obstacle:o};}}
 const roof=world.overhead?.firstHit(a,b);
 if(roof){const entry=distance(a,roof.point)/(distance(a,b)||1);if(entry<=t){t=entry;hit={roof};}}
 const edge=(world.size?world.size/2:world.half??Infinity)-radius;
 for(const k of ['x','z']){const d=b[k]-a[k],entry=d>0?(edge-a[k])/d:d<0?(-edge-a[k])/d:Infinity;if(entry>=0&&entry<=t){t=entry;hit={edge:true};}}
 return{t,point:mix(a,b,t),...hit,blocked:!!hit};
}

export function traceArcStaff(origin,aim,w,foes,world){
 const len=distance(origin,aim),end=len>1e-8?mix(origin,aim,w.range/len):{...origin};
 const block=wildWeaponBlock(origin,end,world,w.hitRadius),hits=[];
 let first=null,entry=block.t;
 for(const e of foes){if(!e.alive)continue;const t=segmentBodyEntry(origin,end,e,w.hitRadius);if(t!==null&&(t<entry||t===entry&&!block.blocked)){entry=t;first=e;}}
 const point=mix(origin,end,entry);
 if(!first)return{hits,end:point,block};
 hits.push({enemy:first,from:origin,to:point,scale:1});
 const used=new Set([first]);let from=center(first);
 // At most five total targets. Candidates remain within the weapon's own
// reach, so a chain cannot crawl across a map or hit one enemy twice.
 for(let n=1;n<w.chainCount;n++){
  let next=null,to=null,best=w.chainRange;
  for(const e of foes){if(!e.alive||used.has(e))continue;const p=center(e),d=distance(from,p);if(d>best||distance(origin,p)>w.range||wildWeaponBlock(from,p,world,.02).blocked)continue;next=e;to=p;best=d;}
  if(!next)break;hits.push({enemy:next,from,to,scale:ARCSTAFF.chainScale});used.add(next);from=to;
 }
 return{hits,end:point,block:null};
}

export function arcFocusMultiplier(player,w,target,now){
 if(!target||w.pathId!=='arcstaff_focus'){player.arcFocus=null;return 1;}
 let f=player.arcFocus;
 if(!f||f.target!==target||now-f.time>ARCSTAFF.focusWindow||now<f.time)f=player.arcFocus={target,time:now,started:now};
 f.time=now;return 1+ARCSTAFF.focusCap[w.pathRank]*Math.min(1,Math.max(0,(now-f.started)/ARCSTAFF.focusTime));
}

// Game-time records only. Views consume callbacks through the existing VFX
// pool; no timers, independent renderer or persistent sound loop.
export class BriarPods{
 constructor(api){this.api=api;this.pods=[];}
 clear(){for(const p of this.pods)this.api.remove?.(p);this.pods=[];}
 cancelHeld(){for(const p of this.pods)if(p.state==='held')this.api.remove?.(p);this.pods=this.pods.filter(p=>p.state!=='held');}
 cast(origin,target,w){
  if(this.pods.length>=BRIARPOT.max)this.api.remove?.(this.pods.shift());
  const duration=.65+Math.min(w.range,Math.hypot(target.x-origin.x,target.z-origin.z))*.035;
  const p={...origin,w:{...w},state:'held',delay:Math.min(.65,.9/w.rate)*.24,age:0,flight:0,
   vx:(target.x-origin.x)/duration,vz:(target.z-origin.z)/duration,vy:(target.y-origin.y+.5*BRIARPOT.gravity*duration*duration)/duration};
  this.pods.push(p);this.api.create?.(p);return p;
 }
 update(dt){
  if(!(dt>0))return;
  for(const p of [...this.pods]){
   if(!this.api.active())break;
   let left=dt;
   if(p.state==='held'){const wait=Math.min(left,p.delay);p.delay-=wait;left-=wait;if(p.delay>1e-8)continue;p.state='flight';this.api.release?.(p);if(!this.api.active())break;}
   if(p.state==='flight'){
    // Bounded substeps preserve curved flight at low frame rates.
    while(left>1e-8&&p.state==='flight'){
     const step=Math.min(left,1/60),start={x:p.x,y:p.y,z:p.z},end={x:p.x+p.vx*step,y:p.y+p.vy*step-.5*BRIARPOT.gravity*step*step,z:p.z+p.vz*step},block=wildWeaponBlock(start,end,this.api.world(),.10);
     const used=step*(block.blocked?block.t:1);Object.assign(p,block.point);p.vy-=BRIARPOT.gravity*used;p.flight+=used;left-=used;
     if(block.blocked||p.flight>2.5){
      // A roof contact breaks the seed where it hits, never plants it through
      // the ceiling onto the ground on the other side.
      if(block.roof){p.state='done';this.api.blocked?.(p,block);break;}
      // Back away from a wall before planting, keeping its trunk from clipping
// the cue or invalidating every explosion line-of-sight query.
      if(block.obstacle){const r=block.obstacle.r??block.obstacle.radius??.5,dx=p.x-block.obstacle.x,dz=p.z-block.obstacle.z,d=Math.hypot(dx,dz)||1;p.x=block.obstacle.x+dx/d*(r+.16);p.z=block.obstacle.z+dz/d*(r+.16);}
      p.y=(this.api.world().groundHeightAt?.(p.x,p.z)||0)+.12;p.state='armed';p.arm=BRIARPOT.arm;p.life=p.w.trapLife||BRIARPOT.arm;this.api.land?.(p);
     }
    }
    this.api.move?.(p);
   }
   if(p.state==='armed'&&left>0){
    p.age+=left;p.arm-=left;p.life-=left;this.api.wait?.(p);
    if(p.arm<=0&&(p.life<=0||!p.w.trapLife||this.api.foes().some(e=>e.alive&&distance({x:p.x,y:p.y+.35,z:p.z},briarTargetPoint(e))<p.w.radius+(e.size||.5)*.35&&!wildWeaponBlock({x:p.x,y:p.y+.35,z:p.z},briarTargetPoint(e),this.api.world()).blocked))){p.state='done';this.api.burst(p);}
   }
  }
  for(const p of this.pods)if(p.state==='done')this.api.remove?.(p);
  this.pods=this.pods.filter(p=>p.state!=='done');
 }
}
