// Horizontal swept body collision, shared by walking, rolls, lunges and knockback.
// Fliers above head height and explicitly submerged/concealed actors are not ground blockers.
export function bodyRadius(p){return p.boss?1.6:p.heroId?.45:(p.size||.5)*.6;}
function intangible(p){return p.alive===false||p.mirageHidden||(p.heroId==='tide'&&p.dashTime>0)||(p.move==='burrow'&&p.stage==='strike');}
function above(p,q){if(p.role!=='flyer'&&q.role!=='flyer')return false;const py=p.y||0,qy=q.y||0;return py>=qy+(q.height||q.standHeight||1.6)||qy>=py+(p.height||p.standHeight||1.6);}
export function bodiesClear(world,p,x,z,r=bodyRadius(p)){
 for(const q of world.solidActors?.()||[]){if(q===p||intangible(q)||above(p,q))continue;if(Math.hypot(x-q.x,z-q.z)<r+bodyRadius(q)-.001)return false;}return true;
}
export function bodyTravel(world,p,dx,dz,r=bodyRadius(p)){
 if(intangible(p))return 1;const a=dx*dx+dz*dz;if(a<1e-12)return 1;let fraction=1;
 for(const q of world.solidActors?.()||[]){
  if(q===p||intangible(q)||above(p,q))continue;
  const x=p.x-q.x,z=p.z-q.z,radius=r+bodyRadius(q),c=x*x+z*z-radius*radius,b=x*dx+z*dz;
  if(c<-.001){if(b<0)fraction=0;continue;} // Allow separation of old overlaps, never deepen them.
  const discriminant=b*b-a*c;if(b>=0||discriminant<0)continue;
  const hit=(-b-Math.sqrt(discriminant))/a;if(hit>=-.001&&hit<=fraction)fraction=Math.max(0,hit-.001/Math.sqrt(a));
 }return fraction;
}
