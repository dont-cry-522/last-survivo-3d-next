const EPS=1e-9;
const pointAt=(a,d,t)=>({x:a.x+d.x*t,y:(a.y||0)+d.y*t,z:a.z+d.z*t});
const length=v=>Math.hypot(v.x,v.y,v.z);
const delta=(a,b)=>({x:b.x-a.x,y:(b.y||0)-(a.y||0),z:b.z-a.z});
const body=target=>{const size=Math.max(0,target.size??.5),bottom=target.y??0;return{x:target.x,z:target.z,r:Math.max(0,target.radius??target.r??size*.7),bottom,top:bottom+Math.max(0,target.height??Math.max(.8,size*2))};};

// Intersection interval of a segment (t=0..1) and a finite vertical cylinder.
function cylinderEntry(a,d,c){
 let lo=0,hi=1;const x=a.x-c.x,z=a.z-c.z,aa=d.x*d.x+d.z*d.z,cc=x*x+z*z-c.r*c.r;
 if(aa<EPS){if(cc>EPS)return null;}
 else{const b=x*d.x+z*d.z,disc=b*b-aa*cc;if(disc<0)return null;const root=Math.sqrt(disc);lo=Math.max(lo,(-b-root)/aa);hi=Math.min(hi,(-b+root)/aa);}
 if(Math.abs(d.y)<EPS){if((a.y||0)<c.bottom||(a.y||0)>c.top)return null;}
 else{const t0=(c.bottom-(a.y||0))/d.y,t1=(c.top-(a.y||0))/d.y;lo=Math.max(lo,Math.min(t0,t1));hi=Math.min(hi,Math.max(t0,t1));}
 return lo<=hi?{lo,hi}:null;
}

/** Camera-center ray: nearest visible body or blocking obstacle, otherwise range end. */
export function aimPoint(ray,range,enemies=[],obstacles=[]){
 const reach=Math.max(0,range),n=length(ray.direction),d=n>EPS?{x:ray.direction.x/n*reach,y:ray.direction.y/n*reach,z:ray.direction.z/n*reach}:{x:0,y:0,z:0};
 let nearest=1;
 for(const target of enemies){if(target.alive===false)continue;const hit=cylinderEntry(ray.origin,d,body(target));if(hit)nearest=Math.min(nearest,hit.lo);}
 for(const target of obstacles){const bottom=target.y??0,c={x:target.x,z:target.z,r:Math.max(0,target.radius??target.r??target.size??.5),bottom,top:bottom+Math.max(0,target.height??6)},hit=cylinderEntry(ray.origin,d,c);if(hit)nearest=Math.min(nearest,hit.lo);}
 return pointAt(ray.origin,d,nearest);
}

/** Swept spherical projectile against a finite body, including rounded cap edges. */
export function segmentHitsBody(ax,ay,az,bx,by,bz,target,radius=0){
 if(target.alive===false)return false;
 const a={x:ax,y:ay,z:az},d={x:bx-ax,y:by-ay,z:bz-az},c=body(target),r=Math.max(0,radius);
 const broad=cylinderEntry(a,d,{...c,r:c.r+r,bottom:c.bottom-r,top:c.top+r});if(!broad)return false;
 if(r===0||cylinderEntry(a,d,c))return true;
 const distance2=t=>{const p=pointAt(a,d,t),horizontal=Math.max(0,Math.hypot(p.x-c.x,p.z-c.z)-c.r),vertical=Math.max(c.bottom-p.y,0,p.y-c.top);return horizontal*horizontal+vertical*vertical;};
 const rr=r*r+EPS;if(distance2(broad.lo)<=rr||distance2(broad.hi)<=rr)return true;
 // Only a grazing cap needs this bounded convex-distance search. Ordinary hits use the fast path.
 let lo=broad.lo,hi=broad.hi;for(let i=0;i<28;i++){const third=(hi-lo)/3,a=lo+third,b=hi-third;if(distance2(a)<distance2(b))hi=b;else lo=a;}
 return distance2((lo+hi)/2)<=rr;
}

/** Direction from the actual weapon origin to the camera aim point. */
export function launchVelocity(origin,target,speed){
 const d=delta(origin,target),n=length(d),scale=n>EPS?Math.max(0,speed)/n:0;
 return{vx:d.x*scale,vy:d.y*scale,vz:d.z*scale,angle:n>EPS?Math.atan2(d.x,d.z):0};
}

/** Ground spells stay inside the player's horizontal range, even when looking at the sky. */
export function groundAim(ray,origin,range,fallbackAngle=0){
 const reach=Math.max(0,range),t=Math.abs(ray.direction.y)>EPS?-(ray.origin.y||0)/ray.direction.y:-1;
 if(t>=0){const p=pointAt(ray.origin,ray.direction,t),dx=p.x-origin.x,dz=p.z-origin.z,d=Math.hypot(dx,dz),scale=d>reach?reach/d:1;return{x:origin.x+dx*scale,y:0,z:origin.z+dz*scale};}
 const horizontal=Math.hypot(ray.direction.x,ray.direction.z),dx=horizontal>EPS?ray.direction.x/horizontal:Math.sin(fallbackAngle),dz=horizontal>EPS?ray.direction.z/horizontal:Math.cos(fallbackAngle);
 return{x:origin.x+dx*reach,y:0,z:origin.z+dz*reach};
}
