import * as T from './vendor/three.module.js';
import {segmentDistance} from './rules.js?v=125';
import {waterDepth} from './water.js?v=156';
import {bridgeContains} from './coast.js?v=114';

const STEP=2,CLEARANCE=.60,MAX_POINTS=40;
const directions=[[-1,-1],[0,-1],[1,-1],[-1,0],[1,0],[-1,1],[0,1],[1,1]];

// Build-time only. The fixed 2m grid has at most 19,600 nodes at the current
// 140m map bound; shared point/edge caches serve every landmark in this world.
function navigator(world){
 const half=Math.min(140,world.half||96),origin=-half+1,count=Math.floor((half-1-origin)/STEP)+1,total=count*count;
 const obstacles=world.obstacles||[],vents=(world.patches||[]).filter(p=>p.kind==='vent');
 const solids=[...obstacles,...vents].map(o=>{const r=o.r+CLEARANCE;return{x:o.x,z:o.z,r,r2:r*r,minX:o.x-r,maxX:o.x+r,minZ:o.z-r,maxZ:o.z+r};});
 const ponds=(world.ponds||[]).map(p=>{const k=p.baseRx===undefined?1:1.19,rx=(p.baseRx??p.rx)*k+CLEARANCE,rz=(p.baseRz??p.rz)*k+CLEARANCE;return{...p,rx,rz,r:Math.max(rx,rz)*1.12};});
 const bridges=world.bridges||[],valid=new Int8Array(total),edges=new Uint8Array(total*8),special=[],links=new Map();
 const point=i=>i<total?{x:origin+(i%count)*STEP,z:origin+Math.floor(i/count)*STEP}:special[i-total];
 const terrainClear=p=>bridges.some(b=>bridgeContains(b,p.x,p.z,-CLEARANCE))||ponds.every(w=>waterDepth(w,p.x,p.z)===0);
 const clear=p=>Math.abs(p.x)<half-CLEARANCE&&Math.abs(p.z)<half-CLEARANCE&&solids.every(o=>(p.x-o.x)**2+(p.z-o.z)**2>o.r2)&&terrainClear(p);
 const segment=(a,b,knownClear=false)=>{
  if(!knownClear&&(!clear(a)||!clear(b)))return false;
  const minX=Math.min(a.x,b.x),maxX=Math.max(a.x,b.x),minZ=Math.min(a.z,b.z),maxZ=Math.max(a.z,b.z);
  // Most grid edges are metres away from almost every obstacle. Reject their
  // bounds first, retaining the original exact circle query for nearby solids.
  for(const o of solids)if(maxX>=o.minX&&minX<=o.maxX&&maxZ>=o.minZ&&minZ<=o.maxZ&&segmentDistance(o.x,o.z,a.x,a.z,b.x,b.z)<=o.r)return false;
  const steps=Math.ceil(Math.hypot(b.x-a.x,b.z-a.z)/.45);
  for(let i=1;i<steps;i++)if(!terrainClear({x:a.x+(b.x-a.x)*i/steps,z:a.z+(b.z-a.z)*i/steps}))return false;
  return true;
 };
 const cellClear=i=>{if(!valid[i])valid[i]=clear(point(i))?1:-1;return valid[i]>0;};
 const nearby=p=>{
  const cx=Math.round((p.x-origin)/STEP),cz=Math.round((p.z-origin)/STEP),out=[];
  for(let dz=-2;dz<=2;dz++)for(let dx=-2;dx<=2;dx++){const x=cx+dx,z=cz+dz;if(x>=0&&z>=0&&x<count&&z<count){const i=z*count+x;if(cellClear(i)&&segment(p,point(i)))out.push(i);}}
  return out;
 };
 const connect=(map,a,b)=>{if(!map.has(a))map.set(a,[]);if(!map.has(b))map.set(b,[]);map.get(a).push(b);map.get(b).push(a);};
 // Bridge axes supplement the grid: diagonal narrow decks can fall entirely
 // between grid rows. Their original dry entrances stay the only crossing.
 for(const bridge of bridges){
  const ids=[];
  for(const side of[-1,1]){const d=side*(bridge.width/2+1),p={x:bridge.x+Math.cos(bridge.angle||0)*d,z:bridge.z-Math.sin(bridge.angle||0)*d};if(!clear(p))continue;
   const id=total+special.length;special.push(p);ids.push(id);for(const near of nearby(p))connect(links,id,near);
  }
  if(ids.length===2&&segment(point(ids[0]),point(ids[1])))connect(links,...ids);
 }
 const bridgeCount=special.length;
 return{segment,route(start,end){
  if(!clear(start)||!clear(end))return[];
  if(segment(start,end))return[start,end];
  special.length=bridgeCount;const from=total+special.length;special.push(start);const to=total+special.length;special.push(end);
  const extra=new Map();for(const id of[from,to]){
   for(const near of nearby(point(id)))connect(extra,id,near);
   for(let i=total;i<total+bridgeCount;i++)if(segment(point(id),point(i)))connect(extra,id,i);
  }
  if(!extra.has(from)||!extra.has(to))return[];
  const length=total+special.length,cost=new Float64Array(length).fill(Infinity),previous=new Int32Array(length).fill(-1),closed=new Uint8Array(length),heap=[];
  const heuristic=i=>Math.hypot(point(i).x-end.x,point(i).z-end.z);
  const push=(id,score)=>{let i=heap.length;heap.push({id,score});while(i){const parent=(i-1)>>1;if(heap[parent].score<=score)break;heap[i]=heap[parent];i=parent;}heap[i]={id,score};};
  const pop=()=>{const result=heap[0],last=heap.pop();if(heap.length){let i=0;while(i*2+1<heap.length){let child=i*2+1;if(child+1<heap.length&&heap[child+1].score<heap[child].score)child++;if(heap[child].score>=last.score)break;heap[i]=heap[child];i=child;}heap[i]=last;}return result.id;};
  cost[from]=0;push(from,heuristic(from));let visits=0;
  while(heap.length&&visits<length){
   const current=pop();if(closed[current])continue;closed[current]=1;visits++;if(current===to)break;
   const neighbors=[...(links.get(current)||[]),...(extra.get(current)||[])];
   if(current<total){const x=current%count,z=Math.floor(current/count);
    for(let d=0;d<8;d++){const [dx,dz]=directions[d],nx=x+dx,nz=z+dz;if(nx<0||nz<0||nx>=count||nz>=count)continue;const next=nz*count+nx,key=current*8+d;
     if(!edges[key]){const safe=cellClear(next)&&segment(point(current),point(next),true);edges[key]=safe?1:2;edges[next*8+7-d]=edges[key];}
     if(edges[key]===1)neighbors.push(next);
    }
   }
   const a=point(current);
   for(const next of neighbors){if(closed[next])continue;const b=point(next),score=cost[current]+Math.hypot(b.x-a.x,b.z-a.z);if(score>=cost[next])continue;cost[next]=score;previous[next]=current;push(next,score+heuristic(next));}
  }
  if(!closed[to])return[];
  const raw=[];for(let at=to;at>=0;at=previous[at])raw.push(point(at));raw.reverse();
  const points=[raw[0]];let at=0;
  while(at<raw.length-1&&points.length<MAX_POINTS){let next=raw.length-1;while(next>at+1&&!segment(raw[at],raw[next]))next--;points.push(raw[next]);at=next;}
  return at===raw.length-1?points:[];
 }};
}

function ribbon(points,world){
 const positions=[],colors=[],indices=[];
 for(let i=0;i<points.length;i++){
  const p=points[i],a=points[Math.max(0,i-1)],b=points[Math.min(points.length-1,i+1)],length=Math.hypot(b.x-a.x,b.z-a.z)||1,nx=-(b.z-a.z)/length,nz=(b.x-a.x)/length;
  const clearance=(world.obstacles||[]).reduce((width,o)=>Math.min(width,Math.hypot(p.x-o.x,p.z-o.z)-o.r-.08),.70),width=Math.min(clearance,.64+Math.sin(p.x*.39+p.z*.27)*.04);
  for(const [side,alpha]of[[-1,0],[-.46,.13],[.46,.13],[1,0]]){positions.push(p.x+nx*side*width,.008,p.z+nz*side*width);colors.push(1,1,1,alpha);}
  if(i<points.length-1)for(let strip=0;strip<3;strip++){const n=i*4+strip;indices.push(n,n+4,n+1,n+1,n+4,n+5);}
 }
 const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));geometry.setAttribute('color',new T.Float32BufferAttribute(colors,4));geometry.setIndex(indices);geometry.computeVertexNormals();return geometry;
}

// Subdivide only already-validated straight spans. This varies the worn edges
// without rounding a safe corner back into a solid, and keeps the 40-row cap.
function ribbonPoints(points){
 if(points.length<2||points.length>=MAX_POINTS)return points;
 let length=0;for(let i=1;i<points.length;i++)length+=Math.hypot(points[i].x-points[i-1].x,points[i].z-points[i-1].z);
 const spacing=Math.max(4,length/(MAX_POINTS-points.length)),out=[points[0]];
 for(let i=1;i<points.length;i++){
  const a=points[i-1],b=points[i],steps=Math.ceil(Math.hypot(b.x-a.x,b.z-a.z)/spacing);
  for(let n=1;n<steps;n++)out.push({x:a.x+(b.x-a.x)*n/steps,z:a.z+(b.z-a.z)*n/steps});
  out.push(b);
 }
 return out;
}

const routeLength=points=>points.reduce((sum,p,i)=>sum+(i?Math.hypot(p.x-points[i-1].x,p.z-points[i-1].z):0),0);
function throughPlace(navigation,world,site,start,end,direct){
 if(direct.length<2)return{points:direct,place:null};
 const distance=routeLength(direct),limit=Math.min(distance+35,distance*1.7+12);let best=Infinity,points=direct,place=null;
 for(const candidate of world.biomePlaces||[]){
  if(candidate.site!==site)continue;
  const center={x:candidate.x,z:candidate.z};
  // Cheap lower bound avoids searching routes that already exceed the detour
  // budget, particularly across the large joined map or a distant harbour bay.
  if(Math.hypot(center.x-start.x,center.z-start.z)+Math.hypot(end.x-center.x,end.z-center.z)>Math.min(limit,best))continue;
  let passages=[[center]];
  if(candidate.entrance&&candidate.exit){
   const dx=candidate.exit.x-candidate.entrance.x,dz=candidate.exit.z-candidate.entrance.z,d=Math.hypot(dx,dz);
   if(d>.01){
    const a={x:center.x-dx/d*3.6,z:center.z-dz/d*3.6},b={x:center.x+dx/d*3.6,z:center.z+dz/d*3.6};
    // Cross the middle of the authored passage rather than visiting its centre
    // and immediately retracing the same ribbon. Both travel directions are valid.
    if(!navigation.segment(a,b))continue;passages=[[a,center,b],[b,center,a]];
   }
  }
  for(const passage of passages){
   const a=passage[0],b=passage.at(-1);
   if(Math.hypot(a.x-start.x,a.z-start.z)+routeLength(passage)+Math.hypot(end.x-b.x,end.z-b.z)>Math.min(limit,best))continue;
   const first=navigation.route(start,a);if(first.length<2)continue;
   const second=navigation.route(b,end);if(second.length<2)continue;
   const joined=[...first,...passage.slice(1,-1),...second].filter((p,i,list)=>!i||Math.hypot(p.x-list[i-1].x,p.z-list[i-1].z)>.000001),length=routeLength(joined);
   if(joined.length>MAX_POINTS||length>limit||length>=best)continue;
   points=joined;place=candidate;best=length;
  }
 }
 return{points,place};
}

/** Replace only the owned visual ribbon. Discovery still controls the same mesh;
 * empty geometry means no misleading guide when no complete safe route exists. */
export function installExplorationRoutes(world){
 if(world.explorationRoutes)return world.explorationRoutes;
 const navigation=navigator(world),routes=[];
 for(const site of world.sites||[]){
  if(!site.trail?.isMesh||!site.trail.userData.ownedGeometry)continue;
  const region=world.regions?.find(r=>r.id===site.biome),start={x:region?.x??world.spawn.x,z:region?.z??world.spawn.z},end={x:site.x,z:site.z};
  const selected=throughPlace(navigation,world,site,start,end,navigation.route(start,end)),points=ribbonPoints(selected.points);
  const old=site.trail.geometry;site.trail.geometry=ribbon(points,world);old.dispose();
  routes.push({site,biome:site.biome||world.weather?.kind||'forest',points,start,end,place:selected.place});
 }
 world.explorationRoutes=routes;return routes;
}
