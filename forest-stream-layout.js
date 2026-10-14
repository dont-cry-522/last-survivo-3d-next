// Pure authored-layout math. The water renderer adds up to 11.5% shoreline
// variation, so all clearances use its conservative enclosing ellipse.
const SHORE=1.115,TAU=Math.PI*2;
function ellipseDistance(pond,point){
 const c=Math.cos(pond.angle),s=Math.sin(pond.angle),dx=point.x-pond.x,dz=point.z-pond.z;
 const x=Math.abs(c*dx-s*dz),z=Math.abs(s*dx+c*dz),a=pond.rx*SHORE,b=pond.rz*SHORE;
 if((x/a)**2+(z/b)**2<=1)return 0;
 let low=0,high=Math.max(a,b)*Math.hypot(x,z);
 // Closest point on the ellipse, rather than rejecting a long reach by a large
 // circular radius. This leaves usable dry banks beside the narrower stream.
 for(let i=0;i<22;i++){const t=(low+high)/2;if((a*x/(t+a*a))**2+(b*z/(t+b*b))**2>1)low=t;else high=t;}
 return Math.hypot(x-a*a*x/(high+a*a),z-b*b*z/(high+b*b));
}

function safeReach(p,spawn,sites,half,contains,roadDistance){
 const c=Math.cos(p.angle),s=Math.sin(p.angle);
 if(Math.abs(p.x)+SHORE*Math.hypot(p.rx*c,p.rz*s)>half-1||Math.abs(p.z)+SHORE*Math.hypot(p.rx*s,p.rz*c)>half-1)return false;
 if(ellipseDistance(p,spawn)<6.05||sites.some(site=>ellipseDistance(p,site)<7.05))return false;
 if(!contains&&!roadDistance)return true;
 // Boundary and filled interior: road clearance is enlarged by a conservative
 // sample-cover radius, so a road cannot hide between two tested points.
 const cover=Math.max(p.rx,p.rz)*1.12*.28;
 const check=(x,z)=>(!contains||contains(x,z))&&(!roadDistance||roadDistance(x,z)>=6+cover);
 if(!check(p.x,p.z))return false;
 for(const ring of[.5,1])for(let i=0;i<48;i++){
  const angle=i*TAU/48,x=Math.cos(angle)*p.rx*1.12*ring,z=Math.sin(angle)*p.rz*1.12*ring;
  if(!check(p.x+c*x+s*z,p.z-s*x+c*z))return false;
 }
 return true;
}

function chain(x,z,angle,count,run,bend,width,phase){
 const c=Math.cos(angle),s=Math.sin(angle),step=run/(count-1),ponds=[];
 for(let i=0;i<count;i++){
  const t=i/(count-1),u=bend*Math.sin(t*TAU+phase),v=(t-.5)*run;
  const last=i===count-1;
  ponds.push({x:x+c*u+s*v,z:z-s*u+c*v,
   rx:last?width*1.75:width*(.94+.06*Math.sin(t*Math.PI)),
   rz:last?Math.max(width*1.65,step*.85+1.8):step*.85+1.8,
   angle:angle+Math.atan2(bend*TAU*Math.cos(t*TAU+phase),run)});
 }
 return ponds;
}

export function forestStreamLayout(rnd,spawn,sites,{half=96,contains,roadDistance,center={x:0,z:0}}={}){
 // Whole-chain acceptance prevents disconnected survivors of a rejected river.
 // Confluence can take a shorter route through its smaller forest region.
 const accepted=ponds=>ponds.every(p=>safeReach(p,spawn,sites,half,contains,roadDistance));
 for(const short of[false,true])for(let attempt=0;attempt<48;attempt++){
  const bearing=rnd()*TAU,radius=short?14+rnd()*35:24+rnd()*32;
  const x=center.x+Math.sin(bearing)*radius,z=center.z+Math.cos(bearing)*radius;
  const count=short?4+Math.floor(rnd()*2):6+Math.floor(rnd()*2),run=short?22+rnd()*8:42+rnd()*4;
  const ponds=chain(x,z,rnd()*TAU,count,run,short?1.8+rnd()*1.4:3+rnd()*2,3.3+rnd()*1.1,rnd()*TAU);
  if(accepted(ponds))return ponds;
 }
 // Deterministic short fallback still has two narrow reaches and an end pool.
 // Finite candidates are essential when a caller's region has no safe pocket.
 for(let ring=0;ring<5;ring++)for(let i=0;i<16;i++){
  const angle=i*TAU/16,radius=ring*12,x=center.x+Math.sin(angle)*radius,z=center.z+Math.cos(angle)*radius;
  for(const turn of[0,Math.PI/2]){
   const ponds=chain(x,z,angle+turn,3,12,1.2,3.2,0);
   if(accepted(ponds))return ponds;
  }
 }
 return [];
}
