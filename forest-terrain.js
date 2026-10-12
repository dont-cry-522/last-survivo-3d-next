import * as T from './vendor/three.module.js';

// Refine only triangles near the raised floor. Shared edge midpoints preserve
// the existing colour/alpha falloff; the same mesh and material keep one draw.
function refineOverlay(mesh,bounds,spacing,budget,sample,floorY){
 if(!budget)return 0;
 const source=mesh.geometry,attributes=Object.entries(source.attributes).filter(([name])=>name!=='normal');
 const arrays=Object.fromEntries(attributes.map(([name,a])=>[name,Array.from(a.array)])),points=[],indices=[],midpoints=new Map();
 for(let i=0;i<source.attributes.position.count;i++)points.push(new T.Vector3().fromBufferAttribute(source.attributes.position,i).applyMatrix4(mesh.matrixWorld));
 const midpoint=(a,b)=>{
  const key=a<b?a+':'+b:b+':'+a;if(midpoints.has(key))return midpoints.get(key);
  const id=points.length;points.push(points[a].clone().add(points[b]).multiplyScalar(.5));
  for(const [name,attr]of attributes)for(let c=0;c<attr.itemSize;c++)arrays[name].push((arrays[name][a*attr.itemSize+c]+arrays[name][b*attr.itemSize+c])*.5);
  midpoints.set(key,id);return id;
 };
 let added=0;
 const split=(a,b,c,depth)=>{
  const pa=points[a],pb=points[b],pc=points[c],minX=Math.min(pa.x,pb.x,pc.x),maxX=Math.max(pa.x,pb.x,pc.x),minZ=Math.min(pa.z,pb.z,pc.z),maxZ=Math.max(pa.z,pb.z,pc.z),near=maxX>=bounds.minX&&minX<=bounds.maxX&&maxZ>=bounds.minZ&&minZ<=bounds.maxZ&&bounds.raised(minX,maxX,minZ,maxZ);
  const ab=pa.distanceToSquared(pb),bc=pb.distanceToSquared(pc),ca=pc.distanceToSquared(pa);
  if(!near||Math.max(ab,bc,ca)<=spacing*spacing||depth===12||added===budget){indices.push(a,b,c);return;}
  // Most already-draped triangles need no subdivision. Sample their interiors
  // after the long spans have been split, reserving the shared budget for crests.
  if(Math.max(ab,bc,ca)<=4){
   const ya=pa.y+sample(pa.x,pa.z),yb=pb.y+sample(pb.x,pb.z),yc=pc.y+sample(pc.x,pc.z);
   let clear=true;for(let i=0;i<=4&&clear;i++)for(let j=0;j<=4-i;j++){const u=i/4,v=j/4,w=1-u-v,x=pa.x*u+pb.x*v+pc.x*w,z=pa.z*u+pb.z*v+pc.z*w;if(ya*u+yb*v+yc*w<floorY+sample(x,z)+.010){clear=false;break;}}
   if(clear){indices.push(a,b,c);return;}
  }
  added++;
  if(ab>=bc&&ab>=ca){const m=midpoint(a,b);split(a,m,c,depth+1);split(m,b,c,depth+1);}
  else if(bc>=ca){const m=midpoint(b,c);split(a,b,m,depth+1);split(a,m,c,depth+1);}
  else{const m=midpoint(c,a);split(a,b,m,depth+1);split(m,b,c,depth+1);}
 };
 const count=source.index?.count??points.length;
 for(let i=0;i<count;i+=3)split(source.index?.getX(i)??i,source.index?.getX(i+1)??i+1,source.index?.getX(i+2)??i+2,0);
 if(!added||!points.some(p=>sample(p.x,p.z)>0))return 0;
 const refined=new T.BufferGeometry();for(const [name,a]of attributes)refined.setAttribute(name,new T.BufferAttribute(new a.array.constructor(arrays[name]),a.itemSize,a.normalized));
 refined.setIndex(indices);refined.computeVertexNormals();refined.computeBoundingSphere();mesh.geometry=refined;source.dispose();return added;
}

const BIOMES=['forest','snow','ash','sand','coast'];
const fade=T.MathUtils.smoothstep;
const HEIGHT=1.2,AXIS_GRADE=.12,OVERLAY_BUDGET=4096;

function corridor(points,biome,from=0,extent=48){
 const segments=[];let walked=0,length=0;
 for(let i=1;i<points.length;i++){
  const a=points[i-1],b=points[i],dx=b.x-a.x,dz=b.z-a.z,l=Math.hypot(dx,dz),lo=Math.max(0,from-walked),hi=Math.min(l,from+extent-walked);walked+=l;
  if(l<.001||hi-lo<.001)continue;
  const start={x:a.x+dx*lo/l,z:a.z+dz*lo/l},end={x:a.x+dx*hi/l,z:a.z+dz*hi/l};
  segments.push({a:start,dx:end.x-start.x,dz:end.z-start.z,l:hi-lo,start:length});length+=hi-lo;
 }
 if(length<8)return null;
 const middle=segments.find(s=>s.start+s.l>=length/2),t=(length/2-middle.start)/middle.l;
 return{biome,segments,length,x:middle.a.x+middle.dx*t,z:middle.a.z+middle.dz*t};
}
function corridorWeight(route,x,z){
 let distance=Infinity,progress=0,across=0;
 for(const s of route.segments){const t=T.MathUtils.clamp(((x-s.a.x)*s.dx+(z-s.a.z)*s.dz)/(s.l*s.l),0,1),d=Math.hypot(x-s.a.x-s.dx*t,z-s.a.z-s.dz*t);if(d<distance){distance=d;progress=(s.start+t*s.l)/route.length;across=((x-s.a.x)*s.dz-(z-s.a.z)*s.dx)/s.l;}}
 if(distance>=18||progress<=0||progress>=1)return 0;
 // Leave the walking lane low. Broad, unequal shoulders give the route a
 // valley silhouette rather than putting a speed bump under the player.
 const side=Math.abs(across),envelope=fade(side,2.8,6.5)*(1-fade(side,10,18))*Math.sin(Math.PI*progress)**2;
 // Broad, static climate shapes. Valleys remain at the old datum, so water,
 // projectile floors and jump/platform rules keep their existing semantics.
 const shape=route.biome==='sand'?.78+.22*Math.cos(across*.22+progress*1.8)**2:route.biome==='snow'?.82+.18*Math.sin(across*.18-progress*2.2)**2:route.biome==='ash'?.80+.20*Math.cos(progress*Math.PI*2.0)**2:route.biome==='coast'?.86+.14*Math.sin(progress*Math.PI*.5):1;
 return envelope*shape*(across<0?1:.82);
}

// A bounded set of real, walkable route shoulders on the existing ground mesh.
// Heights always sample rendered triangles, with no extra per-frame searches.
export function installForestTerrain(world,mapId){
 if(!BIOMES.includes(mapId)&&mapId!=='confluence')return null;
 if(world.forestTerrain)return world.forestTerrain;
 const ground=world.ground,old=ground?.geometry,original=old?.parameters,approach=world.forestHabitats?.approach;
 if(!original?.widthSegments||!ground.userData.ownedGeometry||!approach?.points?.length&&!world.explorationRoutes?.length)return null;
 const cols=world.regions?160:144,rows=cols,{width,height}=original,dx=width/cols,dz=height/rows,pad=Math.hypot(dx,dz);
 const clearings=[{...world.spawn,r:4.6},...(world.regions||[]).map(q=>({x:q.x,z:q.z,r:6})),...(world.sites||[]).map(s=>({...s,r:s.event?8:4.5})),
  ...(world.discoveries||[]).flatMap(s=>[{...s,r:3.8},...(s.nodes||[]).map(n=>({...n,r:2}))]),
  ...(world.roaming||[]).map(s=>({...s,r:s.kind==='camp'?6:4})),
  ...(world.explorationLandmarks||[]).map(s=>({...s,r:4.8})),
  ...(world.obstacles||[]).map(o=>({...o,r:o.tactic==='timber'?4.8:o.r+.15})),
  ...(world.patches||[]).filter(q=>q.kind==='vent').map(q=>({...q,r:q.r+1})),
  ...[...(world.districts||[]),...(world.regions||[]).flatMap(r=>r.districts||[])].map(q=>({...q,r:11}))].map(q=>({x:q.x,z:q.z,r:q.r+pad,outer:q.r+pad+3}));
 const boxes=[...(world.biomePlaces||[]).map(q=>({...q,hx:10,hz:10})),...(world.bridges||[]).map(q=>({...q,hx:q.width/2+1,hz:q.length/2+1})),...(world.fords||[]).map(q=>({...q,hx:q.half+1,hz:q.width/2+1}))].map(q=>({...q,c:Math.cos(q.angle||0),s:Math.sin(q.angle||0)}));
 const waters=[...(world.ponds||[]).map(q=>{const k=q.baseRx===undefined?1:1.19;return{...q,rx:(q.baseRx??q.rx)*k*1.12*1.115,rz:(q.baseRz??q.rz)*k*1.12*1.115};}),...(world.ice||[]).map(q=>({...q,rx:q.rx*1.16,rz:q.rz*1.16}))].map(q=>({...q,c:Math.cos(q.angle||0),s:Math.sin(q.angle||0)}));
 const protection=(x,z)=>{
  let weight=1;
  for(const q of clearings){const ax=x-q.x,az=z-q.z;if(Math.abs(ax)>q.outer||Math.abs(az)>q.outer)continue;weight=Math.min(weight,fade(Math.hypot(ax,az),q.r,q.outer));if(weight<.0001)return 0;}
  for(const q of boxes){const ax=x-q.x,az=z-q.z,u=q.c*ax-q.s*az,v=q.s*ax+q.c*az;weight=Math.min(weight,fade(Math.max(Math.abs(u)-q.hx,Math.abs(v)-q.hz),pad,pad+3));if(weight<.0001)return 0;}
  for(const q of waters){const ax=x-q.x,az=z-q.z,u=q.c*ax-q.s*az,v=q.s*ax+q.c*az,d=(Math.hypot(u/q.rx,v/q.rz)-1)*Math.min(q.rx,q.rz);weight=Math.min(weight,fade(d,pad+1,pad+4));if(weight<.0001)return 0;}
  return weight;
 };
 const corridors=[];
 for(const biome of world.regions?BIOMES:[mapId]){
  const region=world.regions?.find(r=>r.id===biome),candidates=[];
  if(biome==='forest'&&!world.regions&&approach?.points?.length){const first=corridor(approach.points,biome,0,Infinity);if(first)corridors.push(first);}
  for(const route of world.explorationRoutes||[]){
   if((route.biome||mapId)!==biome||route.points.length<2)continue;
   const length=route.points.reduce((n,p,i)=>n+(i?Math.hypot(p.x-route.points[i-1].x,p.z-route.points[i-1].z):0),0);
   for(const start of new Set([0,Math.max(0,length*.5-24),Math.max(0,length-48)])){
    const candidate=corridor(route.points,biome,start);if(!candidate||region&&!region.contains(candidate.x,candidate.z))continue;
    let score=0;for(const s of candidate.segments)for(const t of[.25,.75])for(const side of[-6,0,6]){const x=s.a.x+s.dx*t+s.dz/s.l*side,z=s.a.z+s.dz*t-s.dx/s.l*side;score+=protection(x,z)*corridorWeight(candidate,x,z)*s.l;}
    if(score>.01)candidates.push({...candidate,score});
   }
  }
  candidates.sort((a,b)=>b.score-a.score);
  for(const candidate of candidates){const selected=corridors.filter(q=>q.biome===biome);if(selected.length===2)break;if(selected.some(q=>Math.hypot(q.x-candidate.x,q.z-candidate.z)<18))continue;corridors.push(candidate);}
 }
 if(!corridors.length)return null;
 // Refine the existing surface once; interpolate its original colour triangles
 // so the denser grid does not change the established forest palette.
 const geometry=new T.PlaneGeometry(width,height,cols,rows),p=geometry.attributes.position,sourceColor=old.attributes.color;
 if(sourceColor){const colors=new Float32Array(p.count*sourceColor.itemSize);
  for(let z=0;z<=rows;z++)for(let x=0;x<=cols;x++){
   const gx=Math.min(x*original.widthSegments/cols,original.widthSegments-1e-7),gz=Math.min(z*original.heightSegments/rows,original.heightSegments-1e-7),ix=Math.floor(gx),iz=Math.floor(gz),tx=gx-ix,tz=gz-iz,a=iz*(original.widthSegments+1)+ix,b=a+original.widthSegments+1;
   const ids=tx+tz<=1?[a,b,a+1]:[b,b+1,a+1],weights=tx+tz<=1?[1-tx-tz,tz,tx]:[1-tx,tx+tz-1,1-tz];
   for(let c=0;c<sourceColor.itemSize;c++)colors[(z*(cols+1)+x)*sourceColor.itemSize+c]=ids.reduce((v,id,i)=>v+sourceColor.array[id*sourceColor.itemSize+c]*weights[i],0);
  }geometry.setAttribute('color',new T.BufferAttribute(colors,sourceColor.itemSize));
 }
 ground.geometry=geometry;old.dispose();
 const heights=new Float32Array(p.count);
 // Protected footprints include one cell diagonal. Any triangle underneath an
 // existing solid, interactive clearing or water edge therefore stays flat.
 for(let i=0;i<p.count;i++){
  const x=p.getX(i)+ground.position.x,z=-p.getY(i)+ground.position.z;
  let weight=0;for(const route of corridors)weight=Math.max(weight,corridorWeight(route,x,z));
  if(weight>0)heights[i]=HEIGHT*Math.min(weight,protection(x,z));
 }
 // Bound both triangle gradients. Only lower peaks; protected zeroes never rise.
 const stepX=dx*AXIS_GRADE,stepZ=dz*AXIS_GRADE;
 for(let pass=0;pass<2;pass++){
  for(let z=0;z<=rows;z++)for(let x=0;x<=cols;x++){const i=z*(cols+1)+x;if(x)heights[i]=Math.min(heights[i],heights[i-1]+stepX);if(z)heights[i]=Math.min(heights[i],heights[i-cols-1]+stepZ);}
  for(let z=rows;z>=0;z--)for(let x=cols;x>=0;x--){const i=z*(cols+1)+x;if(x<cols)heights[i]=Math.min(heights[i],heights[i+1]+stepX);if(z<rows)heights[i]=Math.min(heights[i],heights[i+cols+1]+stepZ);}
 }
 const sample=(x,z)=>{
  if(!Number.isFinite(x+z))return 0;
  const gx=(x-ground.position.x+width*.5)/dx,gz=(z-ground.position.z+height*.5)/dz;
  if(gx<0||gz<0||gx>=cols||gz>=rows)return 0;
  const ix=Math.floor(gx),iz=Math.floor(gz),tx=gx-ix,tz=gz-iz,a=iz*(cols+1)+ix,b=a+cols+1;
  return tx+tz<=1?heights[a]*(1-tx-tz)+heights[b]*tz+heights[a+1]*tx:heights[b]*(1-tx)+heights[b+1]*(tx+tz-1)+heights[a+1]*(1-tz);
 };
 for(let i=0;i<p.count;i++)p.setZ(i,heights[i]);
 p.needsUpdate=true;geometry.computeVertexNormals();geometry.computeBoundingBox();geometry.computeBoundingSphere();
 const state={heights,cols,rows,width,height,sample,corridors,disposed:false,maxHeight:Math.max(...heights),instances:0,draped:0,overlayTrianglesAdded:0};
 world.forestTerrain=state;world.groundHeightAt=sample;
 const matrix=new T.Matrix4(),point=new T.Vector3();world.group.updateMatrixWorld(true);
 // Existing plants retain their placement, shared geometry and buried roots.
 // All height attachment happens at build time, with no per-frame instance work.
 const batches=[...(world.scenery?.batches||[]),...(world.adventureGroundDetail?.children||[]),...(world.habitatDetail?.children||[])];
 for(const mesh of batches){let changed=false;if(!mesh.isInstancedMesh)continue;
  for(let i=0;i<mesh.count;i++){mesh.getMatrixAt(i,matrix);point.setFromMatrixPosition(matrix).applyMatrix4(mesh.matrixWorld);const h=sample(point.x,point.z);if(h<=0)continue;matrix.elements[13]+=h;mesh.setMatrixAt(i,matrix);state.instances++;changed=true;}
  if(changed){mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingBox();mesh.computeBoundingSphere();}
 }
 // These are the existing owned flat soil/route overlays, not new decals.
 // Keep their worn edges on the changed surface. Water is protected above.
 const bounds={minX:Infinity,maxX:-Infinity,minZ:Infinity,maxZ:-Infinity};
 for(let i=0;i<heights.length;i++)if(heights[i]>0){const x=p.getX(i)+ground.position.x,z=-p.getY(i)+ground.position.z;bounds.minX=Math.min(bounds.minX,x-dx);bounds.maxX=Math.max(bounds.maxX,x+dx);bounds.minZ=Math.min(bounds.minZ,z-dz);bounds.maxZ=Math.max(bounds.maxZ,z+dz);}
 bounds.raised=(minX,maxX,minZ,maxZ)=>{
  const x0=Math.max(0,Math.floor((minX-ground.position.x+width/2)/dx)),x1=Math.min(cols,Math.ceil((maxX-ground.position.x+width/2)/dx)),z0=Math.max(0,Math.floor((minZ-ground.position.z+height/2)/dz)),z1=Math.min(rows,Math.ceil((maxZ-ground.position.z+height/2)/dz));
  for(let z=z0;z<=z1;z++)for(let x=x0;x<=x1;x++)if(heights[z*(cols+1)+x]>0)return true;return false;
 };
 const overlays=[];world.group.traverse(mesh=>{if(mesh.isMesh&&!mesh.isInstancedMesh&&mesh!==ground&&mesh.userData.ownedGeometry&&!mesh.userData.groundCue)overlays.push(mesh);});
 for(const mesh of overlays){
  if(!mesh.isMesh||mesh===ground||mesh.isInstancedMesh||!mesh.userData.ownedGeometry)continue;
  let attr=mesh.geometry.attributes.position;if(!attr)continue;
  let flat=true;for(let i=0;i<attr.count;i++){point.fromBufferAttribute(attr,i).applyMatrix4(mesh.matrixWorld);if(point.y<-.06||point.y>.08){flat=false;break;}}
  if(!flat)continue;let changed=false;
  // Tighter edges at crests keep worn soil above the steeper rendered surface;
  // most interiors pass unchanged. No extra meshes or per-frame subdivision.
  state.overlayTrianglesAdded+=refineOverlay(mesh,bounds,Math.min(.25,dx*.4,dz*.4),OVERLAY_BUDGET-state.overlayTrianglesAdded,sample,ground.position.y);attr=mesh.geometry.attributes.position;
  for(let i=0;i<attr.count;i++){point.fromBufferAttribute(attr,i).applyMatrix4(mesh.matrixWorld);const h=sample(point.x,point.z);if(h<=0)continue;point.y+=h;mesh.worldToLocal(point);attr.setXYZ(i,point.x,point.y,point.z);changed=true;}
  if(changed){attr.needsUpdate=true;mesh.geometry.computeVertexNormals();mesh.geometry.computeBoundingSphere();state.draped++;}
 }
 const release=()=>{state.disposed=true;if(world.groundHeightAt===sample)delete world.groundHeightAt;geometry.removeEventListener('dispose',release);};
 geometry.addEventListener('dispose',release);return state;
}
