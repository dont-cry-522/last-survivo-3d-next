import {waterDepth} from './water.js?v=201';

const HALF_X=9.4,HALF_Z=8.4,PIER_START=-7.6,PIER_MAX=35,PIER_BREADTH=2.8;
const shore=a=>1+.07*Math.sin(a*3)+.045*Math.cos(a*5);
const at=(p,x,z)=>({x:p.x+Math.cos(p.angle)*x+Math.sin(p.angle)*z,z:p.z-Math.sin(p.angle)*x+Math.cos(p.angle)*z});
const axes=b=>{const c=Math.cos(b.angle||0),s=Math.sin(b.angle||0);return[{x:c,z:-s},{x:s,z:c}];};
function rectangleCircle(b,p,r=0){
 const [u,v]=axes(b),dx=p.x-b.x,dz=p.z-b.z;
 return Math.hypot(Math.max(0,Math.abs(dx*u.x+dz*u.z)-b.width/2),Math.max(0,Math.abs(dx*v.x+dz*v.z)-b.length/2))<=r;
}
function rectanglesOverlap(a,b,gap){
 const aa=axes(a),bb=axes(b),dx=b.x-a.x,dz=b.z-a.z;
 for(const axis of [...aa,...bb]){
  const ra=Math.abs(axis.x*aa[0].x+axis.z*aa[0].z)*a.width/2+Math.abs(axis.x*aa[1].x+axis.z*aa[1].z)*a.length/2;
  const rb=Math.abs(axis.x*bb[0].x+axis.z*bb[0].z)*b.width/2+Math.abs(axis.x*bb[1].x+axis.z*bb[1].z)*b.length/2;
  if(Math.abs(dx*axis.x+dz*axis.z)>ra+rb+gap)return false;
 }
 return true;
}
function context(world){
 const ponds=(world.ponds||[]).filter(p=>p.biome==='coast'||(!world.regions&&world.weather?.kind==='coast'));
 const high=ponds.map(p=>{const rx=(p.baseRx??p.rx)*1.19+1,rz=(p.baseRz??p.rz)*1.19+1;return{...p,rx,rz,r:Math.max(rx,rz)*1.12};});
 const low=ponds.map(p=>{const rx=p.baseRx??p.rx,rz=p.baseRz??p.rz;return{...p,rx,rz,r:Math.max(rx,rz)*1.12};});
 const clearings=[{...world.spawn,r:7},...(world.sites||[]).map(s=>({...s,r:s.event?8:4.5})),...(world.discoveries||[]).flatMap(d=>[{...d,r:3.8},...(d.nodes||[]).map(n=>({...n,r:2}))]),...(world.roaming||[]).map(r=>({...r,r:4}))];
 const protectedObjects=(world.obstacles||[]).filter(o=>o.tactic||world.breakables?.includes(o)||o.mesh?.userData.district||o.mesh?.userData.fragile||o.mesh?.userData.forestVistaTrunk||o===world.forestHabitats?.elder||world.forestVista?.anchors.some(a=>a.x===o.x&&a.z===o.z)||(world.regions||[]).some(r=>r.beacon?.parent===o.mesh)||(world.sites||[]).some(s=>s.mesh===o.mesh||s.gates?.includes(o))||o.place||o.environmentCluster);
 const crossings=[...(world.bridges||[]),...(world.fords||[]).map(f=>({x:f.x,z:f.z,angle:f.angle,width:f.half*2,length:f.width}))];
 return{ponds,high,low,clearings,protectedObjects,crossings};
}
function protectedRectangle(world,b,c){
 if(c.clearings.some(p=>rectangleCircle(b,p,p.r)))return true;
 if(c.protectedObjects.some(o=>rectangleCircle(b,o,o.r+1)))return true;
 if(c.crossings.some(p=>rectanglesOverlap(b,p,1.2)))return true;
 if(world.road?.some(p=>rectangleCircle(b,p,5.8)))return true;
 return(world.patches||[]).some(p=>p.kind==='vent'&&rectangleCircle(b,p,p.r+2));
}
function plan(world,p,c){
 if(!c.low.length||![p.x,p.z,p.angle].every(Number.isFinite))return null;
 const scope=world.regions?.find(r=>r.id==='coast');
 const start=at(p,0,PIER_START);
 if(c.high.some(w=>waterDepth(w,start.x,start.z)>0))return null;
 let span=0,end;
 // End in water even at low tide, not on the temporarily wet upper bank.
 for(let d=1;d<=PIER_MAX;d+=.5){const q=at(p,0,PIER_START-d);if(c.low.some(w=>waterDepth(w,q.x,q.z)>=.35)){span=d;end=q;break;}}
 if(!end)return null;
 const pier={x:(start.x+end.x)/2,z:(start.z+end.z)/2,width:span,length:PIER_BREADTH,angle:p.angle+Math.PI/2,start,end,localStartZ:PIER_START,localEndZ:PIER_START-span};
 if(protectedRectangle(world,pier,c))return null;
 // Check the full deck, including its edges, against region/map boundaries.
 const steps=Math.ceil(span);
 for(let i=0;i<=steps;i++)for(const x of[-PIER_BREADTH/2,0,PIER_BREADTH/2]){
  const q=at(p,x,PIER_START-span*i/steps);
  if(Math.abs(q.x)>world.half-2||Math.abs(q.z)>world.half-2||scope&&!scope.contains(q.x,q.z))return null;
 }
 return pier;
}

// Bridge coordinates match coast.js: width follows the bridge's local X axis.
export function harborPierPlan(world,p){return plan(world,p,context(world));}

export function coastPlaceCandidates(world,scope){
 if(scope?.id!=='coast')return[];
 const c=context(world),candidates=[];
 const boundary=(pond,a)=>{const k=shore(a),x=Math.cos(a)*pond.rx*k,z=Math.sin(a)*pond.rz*k;return at({...pond,angle:pond.angle||0},x,z);};
 for(const pond of c.high)for(let i=0;i<96;i++){
  const a=i*Math.PI*2/96,edge=boundary(pond,a),left=boundary(pond,a-.005),right=boundary(pond,a+.005),dx=right.x-left.x,dz=right.z-left.z,length=Math.hypot(dx,dz);
  if(length<.001)continue;
  const nx=dz/length,nz=-dx/length,angle=Math.atan2(nx,nz);
  for(const distance of[9.6,11.6,14]){
   const p={x:edge.x+nx*distance,z:edge.z+nz*distance,angle},footprint={...p,width:HALF_X*2,length:HALF_Z*2};
   if(protectedRectangle(world,footprint,c))continue;
   let dry=true;
   for(let x=-HALF_X;x<=HALF_X+.001&&dry;x+=HALF_X/6)for(let z=-HALF_Z;z<=HALF_Z+.001;z+=HALF_Z/6){
    const q=at(p,x,z);
    if(Math.abs(q.x)>world.half-3||Math.abs(q.z)>world.half-3||scope.contains&&!scope.contains(q.x,q.z)||c.high.some(w=>waterDepth(w,q.x,q.z)>0)){dry=false;break;}
   }
   if(!dry)continue;
   const pier=plan(world,p,c);if(pier)candidates.push({...p,pier});
  }
 }
 return candidates;
}
