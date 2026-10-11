import * as T from './vendor/three.module.js';

// Refine only triangles near the raised floor. Shared edge midpoints preserve
// the existing colour/alpha falloff; the same mesh and material keep one draw.
function refineOverlay(mesh,bounds,spacing,budget,sample){
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
  const pa=points[a],pb=points[b],pc=points[c],near=Math.max(pa.x,pb.x,pc.x)>=bounds.minX&&Math.min(pa.x,pb.x,pc.x)<=bounds.maxX&&Math.max(pa.z,pb.z,pc.z)>=bounds.minZ&&Math.min(pa.z,pb.z,pc.z)<=bounds.maxZ;
  const ab=pa.distanceToSquared(pb),bc=pb.distanceToSquared(pc),ca=pc.distanceToSquared(pa);
  if(!near||Math.max(ab,bc,ca)<=spacing*spacing||depth===12||added===budget){indices.push(a,b,c);return;}
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

// One shallow, walkable landscape study, on the existing forest ground mesh.
// Heights are sampled from the rendered triangles, not a second approximation.
export function installForestTerrain(world,mapId){
 if(mapId!=='forest'||world.regions)return null;
 if(world.forestTerrain)return world.forestTerrain;
 const ground=world.ground,old=ground?.geometry,original=old?.parameters,approach=world.forestHabitats?.approach;
 if(!approach?.points?.length||!original?.widthSegments||!ground.userData.ownedGeometry)return null;
 if(approach.points.reduce((n,p,i)=>n+(i?Math.hypot(p.x-approach.points[i-1].x,p.z-approach.points[i-1].z):0),0)<4)return null;
 // Refine the existing surface once; interpolate its original colour triangles
 // so the denser grid does not change the established forest palette.
 const cols=original.widthSegments*2,rows=original.heightSegments*2,{width,height}=original;
 const geometry=new T.PlaneGeometry(width,height,cols,rows),p=geometry.attributes.position,sourceColor=old.attributes.color;
 if(sourceColor){const colors=new Float32Array(p.count*sourceColor.itemSize);
  for(let z=0;z<=rows;z++)for(let x=0;x<=cols;x++){
   const gx=Math.min(x*.5,original.widthSegments-1e-7),gz=Math.min(z*.5,original.heightSegments-1e-7),ix=Math.floor(gx),iz=Math.floor(gz),tx=gx-ix,tz=gz-iz,a=iz*(original.widthSegments+1)+ix,b=a+original.widthSegments+1;
   const ids=tx+tz<=1?[a,b,a+1]:[b,b+1,a+1],weights=tx+tz<=1?[1-tx-tz,tz,tx]:[1-tx,tx+tz-1,1-tz];
   for(let c=0;c<sourceColor.itemSize;c++)colors[(z*(cols+1)+x)*sourceColor.itemSize+c]=ids.reduce((v,id,i)=>v+sourceColor.array[id*sourceColor.itemSize+c]*weights[i],0);
  }geometry.setAttribute('color',new T.BufferAttribute(colors,sourceColor.itemSize));
 }
 ground.geometry=geometry;old.dispose();
 const dx=width/cols,dz=height/rows,pad=Math.hypot(dx,dz),heights=new Float32Array(p.count),segments=[];
 let length=0;
 for(let i=1;i<approach.points.length;i++){
  const a=approach.points[i-1],b=approach.points[i],sx=b.x-a.x,sz=b.z-a.z,l=Math.hypot(sx,sz);
  if(l>.001){segments.push({a,dx:sx,dz:sz,l,start:length});length+=l;}
 }
 if(length<4)return null;
 const clearings=[{...world.spawn,r:4.6},...(world.sites||[]).map(s=>({...s,r:s.event?8:4.5})),
  ...(world.discoveries||[]).flatMap(s=>[{...s,r:3.8},...(s.nodes||[]).map(n=>({...n,r:2}))]),
  ...(world.roaming||[]).map(s=>({...s,r:s.kind==='camp'?6:4})),
  ...(world.explorationLandmarks||[]).map(s=>({...s,r:4.8})),
  ...(world.obstacles||[]).map(o=>({...o,r:o.r+.15}))];
 const places=world.biomePlaces||[],ponds=(world.ponds||[]).map(q=>({...q,c:Math.cos(q.angle||0),s:Math.sin(q.angle||0)}));
 const fade=T.MathUtils.smoothstep;
 // Protected footprints include one cell diagonal. Any triangle underneath an
 // existing solid, interactive clearing or water edge therefore stays flat.
 for(let i=0;i<p.count;i++){
  const x=p.getX(i)+ground.position.x,z=-p.getY(i)+ground.position.z;
  let distance=Infinity,progress=0;
  for(const s of segments){const t=T.MathUtils.clamp(((x-s.a.x)*s.dx+(z-s.a.z)*s.dz)/(s.l*s.l),0,1),d=Math.hypot(x-s.a.x-s.dx*t,z-s.a.z-s.dz*t);if(d<distance){distance=d;progress=(s.start+t*s.l)/length;}}
  if(distance>=15)continue;
  let weight=(1-fade(distance,4,15))*Math.sin(Math.PI*progress)**2;
  for(const q of clearings){weight=Math.min(weight,fade(Math.hypot(x-q.x,z-q.z),q.r+pad,q.r+pad+3));if(weight<.0001)break;}
  if(weight<.0001)continue;
  for(const q of places){const c=Math.cos(q.angle),s=Math.sin(q.angle),rx=c*(x-q.x)-s*(z-q.z),rz=s*(x-q.x)+c*(z-q.z);weight=Math.min(weight,fade(Math.max(Math.abs(rx)-10,Math.abs(rz)-10),pad,pad+3));}
  for(const q of ponds){const rx=q.baseRx??q.rx,rz=q.baseRz??q.rz,u=q.c*(x-q.x)-q.s*(z-q.z),v=q.s*(x-q.x)+q.c*(z-q.z);weight=Math.min(weight,fade((Math.hypot(u/rx,v/rz)-1.13)*Math.min(rx,rz),pad+1,pad+4));}
  heights[i]=.25*weight;
 }
 // Bound both triangle gradients. Only lower peaks; protected zeroes never rise.
 const stepX=dx*.035,stepZ=dz*.035;
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
 const state={heights,cols,rows,width,height,sample,disposed:false,maxHeight:Math.max(...heights),instances:0,draped:0,overlayTrianglesAdded:0};
 world.forestTerrain=state;world.groundHeightAt=sample;
 const matrix=new T.Matrix4(),point=new T.Vector3();world.group.updateMatrixWorld(true);
 // Existing vegetation remains the same plants and batches. Buried roots have
 // enough overlap for this <=5% slope; no per-frame instance work is added.
 const batches=[...(world.scenery?.batches||[]),...(world.adventureGroundDetail?.children||[]),...(world.habitatDetail?.children||[])];
 for(const mesh of batches){let changed=false;if(!mesh.isInstancedMesh)continue;
  for(let i=0;i<mesh.count;i++){mesh.getMatrixAt(i,matrix);point.setFromMatrixPosition(matrix).applyMatrix4(mesh.matrixWorld);const h=sample(point.x,point.z);if(h<=0)continue;matrix.elements[13]+=h;mesh.setMatrixAt(i,matrix);state.instances++;changed=true;}
  if(changed){mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingBox();mesh.computeBoundingSphere();}
 }
 // These are the existing owned flat soil/route overlays, not new decals.
 // Keep their worn edges on the changed surface. Water is protected above.
 const bounds={minX:Infinity,maxX:-Infinity,minZ:Infinity,maxZ:-Infinity};
 for(let i=0;i<heights.length;i++)if(heights[i]>0){const x=p.getX(i)+ground.position.x,z=-p.getY(i)+ground.position.z;bounds.minX=Math.min(bounds.minX,x-dx);bounds.maxX=Math.max(bounds.maxX,x+dx);bounds.minZ=Math.min(bounds.minZ,z-dz);bounds.maxZ=Math.max(bounds.maxZ,z+dz);}
 for(const mesh of world.group.children){
  if(!mesh.isMesh||mesh===ground||mesh.isInstancedMesh||!mesh.userData.ownedGeometry)continue;
  let attr=mesh.geometry.attributes.position;if(!attr)continue;
  let flat=true;for(let i=0;i<attr.count;i++){point.fromBufferAttribute(attr,i).applyMatrix4(mesh.matrixWorld);if(point.y<-.06||point.y>.08){flat=false;break;}}
  if(!flat)continue;let changed=false;
  // At the bounded 5% grade, sub-60cm edges stay within the existing 3.8cm
  // floor clearance even between vertices. Cap setup work at 4096 new triangles.
  state.overlayTrianglesAdded+=refineOverlay(mesh,bounds,Math.min(.6,dx*.4,dz*.4),4096-state.overlayTrianglesAdded,sample);attr=mesh.geometry.attributes.position;
  for(let i=0;i<attr.count;i++){point.fromBufferAttribute(attr,i).applyMatrix4(mesh.matrixWorld);const h=sample(point.x,point.z);if(h<=0)continue;point.y+=h;mesh.worldToLocal(point);attr.setXYZ(i,point.x,point.y,point.z);changed=true;}
  if(changed){attr.needsUpdate=true;mesh.geometry.computeVertexNormals();mesh.geometry.computeBoundingSphere();state.draped++;}
 }
 const release=()=>{state.disposed=true;if(world.groundHeightAt===sample)delete world.groundHeightAt;geometry.removeEventListener('dispose',release);};
 geometry.addEventListener('dispose',release);return state;
}
