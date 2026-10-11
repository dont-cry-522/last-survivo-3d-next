import * as T from './vendor/three.module.js';

// Root shoulders stay wholly inside permanent tree colliders. They are scenery,
// not walkable slopes: the shared walking floor and every collision remain flat.
export function installForestFloorRelief(world,mapId){
 const region=world.regions?.find(r=>r.id==='forest'),ground=world.ground,params=ground?.geometry.parameters;
 if(mapId!=='forest'&&!(mapId==='confluence'&&region)||!params?.widthSegments||!ground.material?.isMeshStandardMaterial)return null;
 if(world.forestFloorRelief&&!world.forestFloorRelief.userData.disposed)return world.forestFloorRelief;
 const sources=(world.obstacles||[]).filter(o=>Number.isFinite(o.x+o.z+o.r)&&o.r>.35&&o.r<2&&!o.tactic&&!world.breakables?.includes(o)&&o.mesh?.userData.treeBiome==='forest'&&!o.mesh.userData.forestVistaTrunk&&(!region||region.contains(o.x,o.z))&&o.mesh.getObjectByName('tree-trunk')?.visible!==false);
 sources.sort((a,b)=>Math.hypot(a.x-world.spawn.x,a.z-world.spawn.z)-Math.hypot(b.x-world.spawn.x,b.z-world.spawn.z));
 if(!sources.length)return null;
 const position=[],color=[],uv=[],indices=[],records=[],point=new T.Vector3(),local=new T.Vector3(),floorColor=ground.geometry.attributes.color,floorUV=ground.geometry.attributes.uv;
 ground.updateWorldMatrix(true,false);
 const floorY=ground.getWorldPosition(point).y,columns=params.widthSegments,rows=params.heightSegments;
 // Match the existing floor's exact triangle interpolation, including its UVs.
 // Reusing its material keeps both scanned soil and contact tint continuous.
 function vertex(x,y,z){
  position.push(x,y,z);local.set(x,floorY,z);ground.worldToLocal(local);
  const gx=T.MathUtils.clamp((local.x/params.width+.5)*columns,0,columns-.000001),gy=T.MathUtils.clamp((.5-local.y/params.height)*rows,0,rows-.000001),ix=Math.floor(gx),iy=Math.floor(gy),tx=gx-ix,ty=gy-iy,a=iy*(columns+1)+ix,b=a+columns+1;
  const ids=tx+ty<=1?[a,b,a+1]:[b,b+1,a+1],weights=tx+ty<=1?[1-tx-ty,ty,tx]:[1-tx,tx+ty-1,1-ty];
  for(let channel=0;channel<3;channel++)color.push(floorColor?ids.reduce((v,id,i)=>v+floorColor.array[id*3+channel]*weights[i],0):1);
  for(let channel=0;channel<2;channel++)uv.push(floorUV?ids.reduce((v,id,i)=>v+floorUV.array[id*2+channel]*weights[i],0):channel===0?gx/columns:1-gy/rows);
 }
 const sides=16,rings=6;
 for(const o of sources.slice(0,32)){
  const phase=o.x*.37+o.z*.61,height=.12+(.5+.5*Math.sin(phase*1.7))*.10,start=position.length/3,cx=o.x+Math.cos(phase)*o.r*.022,cz=o.z+Math.sin(phase)*o.r*.022;
  vertex(cx,height,cz);
  for(let ring=1;ring<=rings;ring++)for(let side=0;side<sides;side++){
   const t=ring/rings,a=side*Math.PI*2/sides,reach=o.r*t*(.87+.045*Math.sin(a*3+phase)+.015*Math.cos(a*5-phase));
   const x=cx+Math.cos(a)*reach,z=cz+Math.sin(a)*reach*(.93+.025*Math.sin(phase)),y=floorY+(height-floorY)*(1-t*t)**2-.008*t**8;
   vertex(x,y,z);
   const current=start+1+(ring-1)*sides+side,next=start+1+(ring-1)*sides+(side+1)%sides;
   if(ring===1)indices.push(start,next,current);
   else{const previous=current-sides,previousNext=next-sides;indices.push(previous,previousNext,current,previousNext,next,current);}
  }
  records.push({x:o.x,z:o.z,r:o.r,height,start,count:1+rings*sides,source:o});
 }
 const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(position,3));geometry.setAttribute('color',new T.Float32BufferAttribute(color,3));geometry.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geometry.setIndex(indices);geometry.computeVertexNormals();geometry.computeBoundingSphere();
 const mesh=new T.Mesh(geometry,ground.material);mesh.name='SM_Forest_RootShoulder_A';mesh.receiveShadow=true;mesh.castShadow=true;mesh.userData={ownedGeometry:true,records,disposed:false};world.group.add(mesh);world.forestFloorRelief=mesh;
 // The floor owns the shared shader/material and its contact mask. Only release
 // this cap's geometry; disposal is idempotent in either traversal order.
 const release=()=>{if(mesh.userData.disposed)return;mesh.userData.disposed=true;mesh.userData.ownedGeometry=false;mesh.visible=false;ground.geometry.removeEventListener('dispose',releaseFloor);};
 const releaseFloor=()=>{if(!mesh.userData.disposed)geometry.dispose();};
 geometry.addEventListener('dispose',release);ground.geometry.addEventListener('dispose',releaseFloor);
 return mesh;
}
