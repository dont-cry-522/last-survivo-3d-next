import * as T from './vendor/three.module.js';
import {biomeWeights} from './confluence.js?v=209';

// Build-time composition only: existing crowns, owned branches and floor colors.
// No scene nodes, materials, listeners or animation work are installed.
const tones={
 forest:{closed:[.80,.91,.86],open:[1.08,1.07,.96],flow:[.062,.038],layer:[.025,.034,.025],bed:[-.025,-.085,-.13]},
 snow:{closed:[.92,.96,1.01],open:[1.04,1.03,1.015],flow:[-.056,.080],layer:[.013,.019,.028],bed:[-.08,-.035,.005]},
 ash:{closed:[.91,.88,.90],open:[1.08,1.03,.96],flow:[.044,.064],layer:[.033,.016,.012],bed:[-.13,-.10,-.07]},
 sand:{closed:[.93,.90,.86],open:[1.045,1.03,.985],flow:[.030,-.052],layer:[.030,.020,.010],bed:[.018,-.038,-.078]},
 coast:{closed:[.91,.96,.98],open:[1.06,1.055,1.02],flow:[.070,.012],layer:[.013,.026,.034],bed:[-.13,-.08,-.065]}
};
const smooth=T.MathUtils.smoothstep;

// Later-added places were missing from the original ground-colour pass. Blend
// their feet and nearby scenery into the same soil; never mark hidden rewards.
function sceneryBeds(world){
 const beds=[],places=world.biomePlaces||[];
 const add=(a,b,biome,width)=>beds.push({x:a.x,z:a.z,dx:b.x-a.x,dz:b.z-a.z,lengthSq:(b.x-a.x)**2+(b.z-a.z)**2,biome,width});
 const at=(p,x,z)=>({x:p.x+Math.cos(p.angle)*x+Math.sin(p.angle)*z,z:p.z-Math.sin(p.angle)*x+Math.cos(p.angle)*z});
 for(const p of places)for(const side of[-1,1])add(at(p,side*7,-6),at(p,side*7,6),p.biome,5.2);
 for(const cluster of world.environmentClusters?.records||[]){
  let nearest,from,distance=Infinity;
  for(const p of places){
   if(p.biome!==cluster.biome)continue;
   const c=Math.cos(p.angle),s=Math.sin(p.angle),dx=cluster.x-p.x,dz=cluster.z-p.z,point=at(p,T.MathUtils.clamp(c*dx-s*dz,-7,7),T.MathUtils.clamp(s*dx+c*dz,-6,6)),d=Math.hypot(cluster.x-point.x,cluster.z-point.z);
   if(d<distance){distance=d;nearest=p;from=point;}
  }
  if(nearest&&distance<=16)add(from,cluster,cluster.biome,4.2);
  else{const s=Math.sin(cluster.angle),c=Math.cos(cluster.angle),r=cluster.footprint;add({x:cluster.x-s*r,z:cluster.z-c*r},{x:cluster.x+s*r,z:cluster.z+c*r},cluster.biome,r+3.5);}
 }
 return beds;
}
function bedWeight(beds,biome,x,z){
 let weight=0;
 for(const b of beds){
  if(b.biome!==biome)continue;
  const t=b.lengthSq?T.MathUtils.clamp(((x-b.x)*b.dx+(z-b.z)*b.dz)/b.lengthSq,0,1):0,d=Math.hypot(x-b.x-b.dx*t,z-b.z-b.dz*t);
  const width=b.width*(1+.13*Math.sin(x*.24+z*.13)+.08*Math.sin(z*.31-x*.12));
  weight=Math.max(weight,(1-smooth(d,width*.2,width))*(.80+.20*Math.sin(x*.15-z*.19)**2));
 }
 return weight;
}

// This is queried while placing the existing low-detail records, never per frame.
// cover <= 1 preserves their old collision-free footprint and height budgets.
export function sceneryRhythmAt(world,x,z){
 const state=world.explorationComposition,region=world.regions?.find(r=>r.contains?.(x,z));
 let biome=region?.id||state?.mapId,distance=Infinity,progress=0,influence=0,opening=0,closed=0,approachWeight=0,approachOpen=0,approachClosed=0,canopyX=0,canopyZ=0,approachDistance=Infinity,approachX=0,approachZ=0;
 if(!state)return{biome,distance,progress,enclosure:0,opening:0,cover:1,shade:0};
 for(const route of state.routes){
  if(region&&route.biome!==region.id)continue;
  for(const s of route.segments){
   const t=T.MathUtils.clamp(((x-s.x)*s.dx+(z-s.z)*s.dz)/(s.length*s.length),0,1);
   const d=Math.hypot(x-s.x-s.dx*t,z-s.z-s.dz*t);
   const routeProgress=(s.start+t*s.length)/route.length;
   const towardX=(s.x+s.dx*t-x)/Math.max(d,1),towardZ=(s.z+s.dz*t-z)/Math.max(d,1);
   if(d<distance){distance=d;progress=routeProgress;biome=route.biome;canopyX=towardX;canopyZ=towardZ;}
   if(route.approach){
    if(d<approachDistance){approachDistance=d;approachX=towardX;approachZ=towardZ;}
    const weight=1-smooth(d,3.5,11);approachWeight=Math.max(approachWeight,weight);
    approachOpen=Math.max(approachOpen,Math.max(1-smooth(routeProgress,.04,.20),smooth(routeProgress,.76,.98))*weight);
    approachClosed=Math.max(approachClosed,smooth(routeProgress,.12,.32)*(1-smooth(routeProgress,.67,.88))*weight);
    continue;
   }
   if(d>=18)continue;
   const weight=1-smooth(d,5,18);influence=Math.max(influence,weight);
   // Each segment contributes a continuous field. Choosing one nearest segment
   // jumps between unrelated progress values inside a folded/U-shaped trail.
   // Clearings have a physical extent. A long excursion must not turn its
   // first quarter (sometimes 40 metres) into an ever-expanding open field.
   const travel=routeProgress*route.length,remaining=route.length-travel;
   opening=Math.max(opening,Math.max(1-smooth(travel,Math.min(7,route.length*.07),Math.min(16,route.length*.27)),1-smooth(remaining,Math.min(7,route.length*.05),Math.min(18,route.length*.27)))*weight);
   closed=Math.max(closed,smooth(travel,Math.min(10,route.length*.17),Math.min(22,route.length*.34))*smooth(remaining,Math.min(10,route.length*.18),Math.min(25,route.length*.40))*weight);
  }
 }
 for(const landmark of state.landmarks){
  if(region&&landmark.biome!==region.id)continue;
  const compact=state.approach&&landmark.biome==='forest';
  opening=Math.max(opening,1-smooth(Math.hypot(x-landmark.x,z-landmark.z),compact?4:6,compact?11:14));
 }
 opening=opening*(1-approachWeight)+approachOpen;closed=closed*(1-approachWeight)+approachClosed;influence=Math.max(influence,approachWeight);
 const enclosure=closed*(1-opening);
 return{biome,distance,progress,enclosure,opening,canopyX:T.MathUtils.lerp(canopyX,approachX,approachWeight),canopyZ:T.MathUtils.lerp(canopyZ,approachZ,approachWeight),cover:Math.max(.48,1-opening*.38-influence*(1-enclosure)*.14),shade:enclosure*.10-opening*.025};
}

export function installExplorationComposition(world,mapId){
 if(world.explorationComposition)return world.explorationComposition;
 const routes=[];
 const approach=world.forestHabitats?.approach,sources=[...(world.explorationRoutes||[]),...(approach?[{...approach,biome:'forest',approach:true}]:[])];
 for(const source of sources){
  const points=source.points||[],segments=[];let length=0;
  for(let i=1;i<points.length;i++){
   const a=points[i-1],b=points[i];if(![a?.x,a?.z,b?.x,b?.z].every(Number.isFinite))continue;
   const dx=b.x-a.x,dz=b.z-a.z,d=Math.hypot(dx,dz);if(d<.001)continue;
   segments.push({x:a.x,z:a.z,dx,dz,length:d,start:length});length+=d;
  }
  if(length>1)routes.push({biome:source.biome||mapId,segments,length,approach:!!source.approach});
 }
 if(!routes.length)return null;
 const landmarks=(world.explorationLandmarks||[]).filter(p=>Number.isFinite(p.x)&&Number.isFinite(p.z));
 const state={mapId,routes,landmarks,approach:!!approach,trees:0,overhangingTrees:0,skippedLowTrees:0,groundVertices:0};world.explorationComposition=state;
 const protectedMeshes=new Set(landmarks.flatMap(p=>[p.mesh,p.obstacle?.mesh])),protectedObstacles=new Set([...(world.breakables||[]),...landmarks.map(p=>p.obstacle)]);
 const gate=world.forestVista?.gateCenter,box=new T.Box3(),oldScale=new T.Vector3(),oldPosition=new T.Vector3(),oldCrown=new T.Matrix4(),branchDelta=new T.Matrix4(),branchPoint=new T.Vector3();world.group.updateMatrixWorld(true);
 const foliage=new Map([world,...(world.regions||[])].flatMap(scope=>(scope.foliage||[]).map(f=>[f.leaf,f])));
 // Reserve the existing .034-radian canopy sway as well as its resting bounds.
 const headroom=canopy=>{box.setFromObject(canopy);return box.min.y-Math.hypot(box.max.x-box.min.x,box.max.z-box.min.z)*.024;};
 for(const obstacle of world.obstacles||[]){
  const root=obstacle.mesh;
  if(!root||!['forest','snow'].includes(root.userData.treeBiome)||obstacle.tactic||protectedObstacles.has(obstacle)||protectedMeshes.has(root)||root.userData.forestVistaTrunk||obstacle===world.forestHabitats?.elder||root.name==='SM_Tree_Elder_A')continue;
  // Vista previously thinned nearby crowns to frame its gate. Preserve that opening.
  if(gate&&Math.hypot(obstacle.x-gate.x,obstacle.z-gate.z)<8)continue;
  const canopy=root.getObjectByName('tree-canopy');if(!canopy)continue;
  const rhythm=sceneryRhythmAt(world,obstacle.x,obstacle.z);if(!rhythm.enclosure&&!rhythm.opening)continue;
  if(headroom(canopy)<3.2){state.skippedLowTrees++;continue;}
  oldScale.copy(canopy.scale);oldPosition.copy(canopy.position);canopy.updateMatrix();oldCrown.copy(canopy.matrix);
  // Grow existing shoulders inward into a hanging roof. Correlated broad
  // groups alternate stronger spreading trees with lighter supporting crowns;
  // their roots and the entire walking-height stem keep their old positions.
  const c=Math.cos(root.rotation.y),s=Math.sin(root.rotation.y),dx=c*rhythm.canopyX-s*rhythm.canopyZ,dz=s*rhythm.canopyX+c*rhythm.canopyZ;
  const group=.68+.32*(.5+.5*Math.sin(obstacle.x*.17+obstacle.z*.11)),border=world.regions?smooth(biomeWeights(obstacle.x,obstacle.z)[root.userData.treeBiome]||0,.60,.85):1,reach=rhythm.enclosure*group*border,opening=rhythm.opening*.28;
  canopy.scale.x*=1+reach*(.32+Math.abs(dx)*.58)-opening;canopy.scale.z*=1+reach*(.32+Math.abs(dz)*.58)-opening;
  canopy.scale.y*=1+reach*.10-rhythm.opening*.055;
  const overhang=reach*(root.userData.treeBiome==='snow'?.65:1.25);
  canopy.position.x+=dx*overhang;canopy.position.z+=dz*overhang;
  canopy.updateWorldMatrix(false,false);
  if(headroom(canopy)<3.2){canopy.scale.copy(oldScale);canopy.position.copy(oldPosition);canopy.updateWorldMatrix(false,false);state.skippedLowTrees++;continue;}
  if(canopy.scale.equals(oldScale))continue;
  const trunk=root.getObjectByName('tree-trunk');
  if(trunk){
   // Carry the existing upper branch pose through the same crown transform.
   // Habitats already owns forest trunks; clone shared trees/snow just once.
   if(!trunk.userData.ownedGeometry){trunk.geometry=trunk.geometry.clone();trunk.userData.ownedGeometry=true;}
   trunk.updateMatrix();branchDelta.copy(trunk.matrix).invert().multiply(canopy.matrix).multiply(oldCrown.invert()).multiply(trunk.matrix);
   const p=trunk.geometry.attributes.position,original=canopy.userData.treeTemplate?.trunk.attributes.position;
   for(let i=0;i<p.count;i++){
    // Linear transfer follows the stem's straight ring spans; an eased weight
    // bows fork bases away from those spans when a crown reaches over the path.
    const weight=T.MathUtils.clamp(((original?.getY(i)??p.getY(i))-1.8)/1.5,0,1);if(!weight)continue;
    branchPoint.fromBufferAttribute(p,i).applyMatrix4(branchDelta);
    p.setXYZ(i,T.MathUtils.lerp(p.getX(i),branchPoint.x,weight),T.MathUtils.lerp(p.getY(i),branchPoint.y,weight),T.MathUtils.lerp(p.getZ(i),branchPoint.z,weight));
   }
   p.needsUpdate=true;trunk.geometry.computeVertexNormals();trunk.geometry.computeBoundingBox();trunk.geometry.computeBoundingSphere();
  }
  const motion=foliage.get(canopy);if(motion){motion.x+=canopy.position.x-oldPosition.x;motion.z+=canopy.position.z-oldPosition.z;}
  if(canopy.position.distanceTo(oldPosition)>.2)state.overhangingTrees++;
  state.trees++;
 }
 const ground=world.ground,positions=ground?.geometry.attributes.position,colors=ground?.geometry.attributes.color,point=new T.Vector3(),beds=sceneryBeds(world);state.sedimentBeds=beds.length;state.bedVertices=0;
 if(ground?.userData.ownedGeometry&&positions&&colors){
  ground.updateWorldMatrix(true,false);
  for(let i=0;i<positions.count;i++){
   point.fromBufferAttribute(positions,i).applyMatrix4(ground.matrixWorld);
   const rhythm=sceneryRhythmAt(world,point.x,point.z),tone=tones[rhythm.biome];if(!tone)continue;
   // Low-contrast, broad irregular patches, not repeated stripes or new decals.
   // Fade the extra layer out through the joined map's existing climate blend.
   const u=point.x*tone.flow[0]+point.z*tone.flow[1],v=-point.x*tone.flow[1]+point.z*tone.flow[0],border=world.regions?smooth(biomeWeights(point.x,point.z)[rhythm.biome]||0,.55,.85):1;
   const layer=Math.sin(u+.7*Math.sin(v*.63))*Math.cos(v*.78+.5*Math.sin(u*.49))*Math.max(rhythm.enclosure,rhythm.opening)*border;
   const bed=bedWeight(beds,rhythm.biome,point.x,point.z)*border;
   if(!rhythm.enclosure&&!rhythm.opening&&!bed)continue;
   colors.setXYZ(i,...[colors.getX(i),colors.getY(i),colors.getZ(i)].map((value,j)=>value*(1+(tone.closed[j]-1)*rhythm.enclosure+(tone.open[j]-1)*rhythm.opening+tone.layer[j]*layer)*(1+tone.bed[j]*bed)));state.groundVertices++;if(bed)state.bedVertices++;
  }
  colors.needsUpdate=true;
 }
 return state;
}
