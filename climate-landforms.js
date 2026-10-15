import * as T from './vendor/three.module.js';
import {mergeGeometries} from './vendor/BufferGeometryUtils.js';
import {batchedSurfaceMaterial} from './environment-props.js?v=209';
import {segmentDistance} from './rules.js?v=209';

const BIOMES=['snow','ash','sand'],materials=new Map(),fade=T.MathUtils.smoothstep;
const palette={snow:[0x647e88,0x90a6ac,0xd6e4e5],ash:[0x383b3b,0x56504a,0x777065],sand:[0x9d8059,0xbd9e6b,0xd1b887]};
function material(id){
 if(!materials.has(id)){const source=new T.MeshStandardMaterial({color:0xffffff,vertexColors:true,roughness:.95,metalness:0});const result=batchedSurfaceMaterial(source,'stone');if(result!==source)source.dispose();materials.set(id,result);}
 return materials.get(id);
}
const distanceBox=(q,x,z)=>{const dx=x-q.x,dz=z-q.z,u=q.c*dx-q.s*dz,v=q.s*dx+q.c*dz;return Math.hypot(Math.max(0,Math.abs(u)-q.hx),Math.max(0,Math.abs(v)-q.hz));};
function reservations(world){
 const circles=[{...world.spawn,r:7},...(world.regions||[]).map(p=>({x:p.x,z:p.z,r:7})),...(world.sites||[]).flatMap(s=>[{...s,r:s.event?9:5},...(s.nodes||[]).map(n=>({...n,r:3}))]),
  ...(world.discoveries||[]).flatMap(s=>[{...s,r:4.2},...(s.nodes||[]).map(n=>({...n,r:2.5}))]),...(world.roaming||[]).map(s=>({...s,r:s.kind==='camp'?7:4.5})),
  ...(world.obstacles||[]).map(o=>({...o,r:o.r+.6})),...(world.patches||[]).filter(p=>p.kind==='vent').map(p=>({...p,r:p.r+2})),
  ...[...(world.districts||[]),...(world.regions||[]).flatMap(r=>r.districts||[])].map(p=>({...p,r:11}))];
 const boxes=[...(world.biomePlaces||[]).map(p=>({...p,hx:10,hz:10})),...(world.bridges||[]).map(p=>({...p,hx:p.width/2+2,hz:p.length/2+2})),...(world.fords||[]).map(p=>({...p,hx:p.half+2,hz:p.width/2+2}))].map(p=>({...p,c:Math.cos(p.angle||0),s:Math.sin(p.angle||0)}));
 const waters=[...(world.ponds||[]).map(p=>{const k=p.baseRx===undefined?1:1.19;return{...p,rx:(p.baseRx??p.rx)*k*1.25+1,rz:(p.baseRz??p.rz)*k*1.25+1};}),...(world.ice||[]).map(p=>({...p,rx:p.rx*1.16+1,rz:p.rz*1.16+1}))].map(p=>({...p,c:Math.cos(p.angle||0),s:Math.sin(p.angle||0)}));
 const paths=[];
 if(world.road?.length)for(let i=0;i<world.road.length;i++)paths.push({a:world.road[i],b:world.road[(i+1)%world.road.length],width:5.8});
 for(const site of world.sites||[]){const p=site.trail?.geometry.attributes.position;if(!p)continue;let last;for(let i=0;i<p.count;i+=4){const at={x:(p.getX(i+1)+p.getX(i+2))/2,z:(p.getZ(i+1)+p.getZ(i+2))/2};if(last)paths.push({a:last,b:at,width:3.6});last=at;}}
 return {circles,boxes,waters,paths,clearance(x,z){
  let d=(world.half||96)-3-Math.max(Math.abs(x),Math.abs(z));
  for(const p of circles){if(Math.abs(x-p.x)>p.r+d||Math.abs(z-p.z)>p.r+d)continue;d=Math.min(d,Math.hypot(x-p.x,z-p.z)-p.r);if(d<=0)return d;}
  for(const p of boxes){d=Math.min(d,distanceBox(p,x,z));if(d<=0)return d;}
  for(const p of waters){const dx=x-p.x,dz=z-p.z,u=p.c*dx-p.s*dz,v=p.s*dx+p.c*dz;d=Math.min(d,(Math.hypot(u/p.rx,v/p.rz)-1)*Math.min(p.rx,p.rz));if(d<=0)return d;}
  for(const p of paths){d=Math.min(d,segmentDistance(x,z,p.a.x,p.a.z,p.b.x,p.b.z)-p.width);if(d<=0)return d;}
  return d;
 }};
}
function within(scope,x,z,r=0){if(!scope.contains)return true;for(let i=0;i<8;i++){const a=i*Math.PI/4;if(!scope.contains(x+Math.cos(a)*r,z+Math.sin(a)*r))return false;}return true;}
function profile(p,t){
 const u=(t-.5)*p.length,bend=p.biome==='sand'?0:Math.sin(t*Math.PI)*p.width*.9,c=Math.cos(p.angle),s=Math.sin(p.angle);
 return {x:p.x+c*u-s*bend,z:p.z+s*u+c*bend};
}
function spans(p,scope,reserved){
 const result=[],steps=p.biome==='sand'?10:14,step=p.length/steps;
 for(let i=0;i<steps;i++){
  // An open 5–7m breach and both open ends prevent a decorative ridge from
  // becoming an arena fence. Safety cuts can only enlarge those exits.
  if(i===Math.floor(steps/2)-1||i===Math.floor(steps/2))continue;
  const a=profile(p,i/steps),b=profile(p,(i+1)/steps),x=(a.x+b.x)/2,z=(a.z+b.z)/2,r=Math.hypot(step*.55,p.width*.55);
  if(!within(scope,x,z,r+.5)||reserved.clearance(x,z)<r+.4)continue;
  result.push({a,b,x,z,r,i});
 }
 // Keep connected runs, not scattered little rocks left by all the exclusions.
 return result.filter((p,i,a)=>a[i-1]?.i===p.i-1||a[i+1]?.i===p.i+1);
}
function ridgeGeometry(p,span){
 const positions=[],colors=[],indices=[],tone=palette[p.biome].map(c=>new T.Color(c)),segments=6;
 // Broad rock shoulders and offset strata, not a triangular tent section.
 // Sand uses upright masonry faces on a wider buried foundation instead.
 const section=p.biome==='sand'?[[-1,0],[-1,.18],[-.84,.19],[-.84,.91],[-.53,1],[.50,1],[.82,.92],[.85,.19],[1,.17],[1,0]]:
  [[-1,0],[-.97,.17],[-.80,.20],[-.84,.47],[-.65,.51],[-.67,.73],[-.44,.86],[-.26,1],[.21,.97],[.43,.84],[.49,.67],[.75,.63],[.80,.29],[.98,.18],[1,0]];
 const cols=section.length,steps=p.biome==='sand'?10:14,step=p.length/steps;
 let runStart=span.i,runEnd=span.i;while(p.parts.some(q=>q.i===runStart-1))runStart--;while(p.parts.some(q=>q.i===runEnd+1))runEnd++;
 for(let row=0;row<=segments;row++){
  const station=span.i+row/segments,t=station/steps,q=profile(p,t),ahead=profile(p,Math.min(1,t+.001)),back=profile(p,Math.max(0,t-.001)),dx=ahead.x-back.x,dz=ahead.z-back.z,l=Math.hypot(dx,dz),nx=-dz/l,nz=dx/l;
  const edge=Math.min(station-runStart,runEnd+1-station)*step;
  // Each actual break subsides into a low apron. Safety cuts no longer leave a
  // repeated triangular vertical end wall or sharp sawtooth at every gap.
  const end=.13+.87*fade(edge,0,p.biome==='sand'?1.1:2.1),taper=.67+.33*Math.sin(Math.PI*t);
  const h=p.height*taper*(.91+.09*Math.cos(t*13+p.index))*end;
  for(let col=0;col<cols;col++){
   const [u,crest]=section[col],shift=p.biome==='sand'?0:.065*Math.sin(t*17+col*.41)*(1-Math.abs(u));
   const across=(u+shift)*p.width/2*(.93+.07*Math.cos(t*19));
   const strata=p.biome==='sand'?.035*Math.sin(t*61):.052*Math.sin(t*31+Math.floor(col/2)*.84);
   const y=col===0||col===cols-1?-.06:Math.max(.04,h*crest+strata*end);
   positions.push(q.x+nx*across,y,q.z+nz*across);
   const stone=tone[0].clone().lerp(tone[1],.30+.35*Math.sin(t*11+col*.62)**2);
   // Snow belongs to the same solid silhouette; no hovering white ellipsoids.
   if(p.biome==='snow')stone.lerp(tone[2],fade(crest,.70,.93)*(.90+.1*Math.sin(t*21)**2));else stone.lerp(tone[2],.09+.10*Math.sin(y*9+t*10)**2);
   colors.push(stone.r,stone.g,stone.b);
  }
 }
 for(let row=0;row<segments;row++)for(let col=0;col<cols-1;col++){const a=row*cols+col,b=a+cols;indices.push(a,a+1,b,a+1,b+1,b);}
 // Only actual breaks have end faces. An internal cap would pull boundary
 // normals inward and paint an artificial dark seam at every collider span.
 for(const row of [...(span.i===runStart?[0]:[]),...(span.i===runEnd?[segments]:[])]){const first=row*cols;for(let col=1;col<cols-1;col++)if(row===0)indices.push(first,first+col+1,first+col);else indices.push(first,first+col,first+col+1);}
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setAttribute('color',new T.Float32BufferAttribute(colors,3));g.setIndex(indices);g.computeVertexNormals();g.computeBoundingBox();
 return g;
}
function smoothJoinedNormals(geometry){
 // Weld the *normal contributions* at exact shared positions, retaining the
 // vertex ranges used to verify each collider. This is area-weighted smoothing
 // across the complete rock, not six separately lit two-metre concrete panels.
 const p=geometry.attributes.position,index=geometry.index,shared=new Map(),ids=new Uint32Array(p.count),sum=new Float64Array(p.count*3),normal=new Float32Array(p.count*3);
 for(let i=0;i<p.count;i++){const key=p.getX(i)+','+p.getY(i)+','+p.getZ(i);if(!shared.has(key))shared.set(key,i);ids[i]=shared.get(key);}
 const a=new T.Vector3(),b=new T.Vector3(),c=new T.Vector3(),cross=new T.Vector3();
 for(let i=0;i<index.count;i+=3){const ia=index.getX(i),ib=index.getX(i+1),ic=index.getX(i+2);a.fromBufferAttribute(p,ia);b.fromBufferAttribute(p,ib).sub(a);c.fromBufferAttribute(p,ic).sub(a);cross.crossVectors(b,c);for(const v of [ia,ib,ic]){const n=ids[v]*3;sum[n]+=cross.x;sum[n+1]+=cross.y;sum[n+2]+=cross.z;}}
 for(let i=0;i<p.count;i++){const n=ids[i]*3,l=Math.hypot(sum[n],sum[n+1],sum[n+2])||1;normal[i*3]=sum[n]/l;normal[i*3+1]=sum[n+1]/l;normal[i*3+2]=sum[n+2]/l;}
 geometry.setAttribute('normal',new T.BufferAttribute(normal,3));
}
const duneWeight=(p,x,z)=>{const dx=x-p.x,dz=z-p.z,u=(Math.cos(p.angle)*dx+Math.sin(p.angle)*dz)/(p.length/2),v=(-Math.sin(p.angle)*dx+Math.cos(p.angle)*dz)/(p.width/2);if(Math.abs(u)>=1||Math.abs(v)>=1)return 0;return (1-u*u)**2*(1-v*v)**2*p.height;};

// Build-time only. Three fixed shared materials; each world owns its merged
// geometry. No scene instance is cached, animated, or searched during combat.
export function installClimateLandforms(world,mapId){
 if(world.climateLandforms)return world.climateLandforms;
 if(!BIOMES.includes(mapId)&&mapId!=='confluence')return null;
 const group=new T.Group();group.name='SM_Landform_Climate';world.group.add(group);
 const records=[],reserved=reservations(world),batches=new Map(),dunes=[];
 for(const scope of world.regions||[{id:mapId,...world.spawn}]){
  const id=scope.id;if(!BIOMES.includes(id))continue;
  const center=world.regions?scope:world.spawn,places=(world.biomePlaces||[]).filter(p=>p.biome===id),anchors=places.length?places:[center],candidates=[];
  for(let ai=0;ai<anchors.length;ai++)for(const radius of [23,34,47,60])for(let j=0;j<16;j++){
   const a=j*Math.PI/8+(id==='ash'?.3:0),anchor=anchors[ai],angle=(anchor.angle??-.65)+(id==='sand'?0:j%3*.13),p={kind:id==='snow'?'snow-ridge':id==='ash'?'basalt-flow':'buried-street',biome:id,index:ai+j,x:anchor.x+Math.cos(a)*radius,z:anchor.z+Math.sin(a)*radius,angle,length:id==='sand'?24:36,width:id==='snow'?3.4:id==='ash'?3.2:1.55,height:id==='snow'?4.2:id==='ash'?4.6:2.1};
   p.parts=spans(p,scope,reserved);if(p.parts.length<5)continue;
   p.score=p.parts.length*7-radius*.18-Math.hypot(p.x-center.x,p.z-center.z)*.055;candidates.push(p);
  }
  candidates.sort((a,b)=>b.score-a.score);
  for(const p of candidates){
   if(records.filter(q=>q.biome===id&&q.kind!=='dune').length>=2)break;
   if(records.some(q=>Math.hypot(p.x-q.x,p.z-q.z)<30))continue;
   p.parts=spans(p,scope,reserved);if(p.parts.length<5)continue;
   const solids=[];for(const span of p.parts){
    const geometry=ridgeGeometry(p,span),position=geometry.attributes.position;let r=0;for(let i=0;i<position.count;i++)r=Math.max(r,Math.hypot(position.getX(i)-span.x,position.getZ(i)-span.z));
    const marker=new T.Object3D();marker.name='COL_Landform_'+id;marker.position.set(span.x,0,span.z);group.add(marker);
    const obstacle={x:span.x,z:span.z,r,height:geometry.boundingBox.max.y,sceneryHeight:geometry.boundingBox.max.y,mesh:marker,biome:id,climateLandform:true};
    world.obstacles.push(obstacle);if(world.regions&&scope.obstacles!==world.obstacles)scope.obstacles.push(obstacle);solids.push(obstacle);
    if(!batches.has(id))batches.set(id,[]);const batch=batches.get(id);obstacle.climateSpan={first:batch.reduce((n,g)=>n+g.attributes.position.count,0),count:position.count};batch.push(geometry);
   }
   reserved.circles.push(...solids.map(o=>({x:o.x,z:o.z,r:o.r+.6})));
   records.push({kind:p.kind,biome:id,x:p.x,z:p.z,angle:p.angle,length:p.length,width:p.width,height:p.height,solids});
  }
  if(id==='sand'){
   const candidates=[];
   // Rank broad empty ground; do not raise scenery or bridge approaches. The
   // prevailing wind aligns dunes, while unequal crests avoid a repeated grid.
   for(let z=-world.half+18;z<world.half-18;z+=12)for(let x=-world.half+18;x<world.half-18;x+=12){
    const p={kind:'dune',biome:id,x,z,angle:.28,length:34,width:18,height:.9,solids:[]};
    if(!within(scope,x,z,20)||reserved.clearance(x,z)<4.5||records.some(q=>Math.hypot(x-q.x,z-q.z)<q.length/2+3))continue;
    let score=0;for(const u of [-.7,0,.7])for(const v of [-.5,0,.5]){const px=x+u*15*Math.cos(p.angle)-v*8*Math.sin(p.angle),pz=z+u*15*Math.sin(p.angle)+v*8*Math.cos(p.angle);score+=fade(reserved.clearance(px,pz),0,4);}
    if(score<5)continue;candidates.push({...p,score:score-Math.hypot(x-center.x,z-center.z)*.008});
   }
   candidates.sort((a,b)=>b.score-a.score);
   for(const p of candidates){if(dunes.length===5)break;if(dunes.some(q=>Math.hypot(p.x-q.x,p.z-q.z)<26))continue;dunes.push(p);records.push(p);}
  }
 }
 let triangles=0;
 for(const [id,parts]of batches){const geometry=mergeGeometries(parts);for(const part of parts)part.dispose();smoothJoinedNormals(geometry);geometry.computeBoundingSphere();const mesh=new T.Mesh(geometry,material(id));mesh.name='SM_Landform_'+id+'_A';mesh.userData.ownedGeometry=true;mesh.castShadow=mesh.receiveShadow=true;group.add(mesh);triangles+=geometry.index.count/3;for(const r of records.filter(r=>r.biome===id&&r.solids.length))r.mesh=mesh;}
 const heightAt=(x,z)=>{let height=0;for(const dune of dunes)height=Math.max(height,duneWeight(dune,x,z));return height?height*fade(reserved.clearance(x,z),0,4):0;};
 return world.climateLandforms={group,records,draws:batches.size,triangles,heightAt};
}
