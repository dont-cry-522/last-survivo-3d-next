import * as T from './vendor/three.module.js';

// Build-time composition only. It reuses existing tree crowns and owned ground
// colors; no scene nodes, GPU assets, listeners or animation work are installed.
const tones={
 forest:{closed:[.80,.91,.86],open:[1.08,1.07,.96]},
 snow:{closed:[.92,.96,1.01],open:[1.04,1.03,1.015]},
 ash:{closed:[.91,.88,.90],open:[1.08,1.03,.96]},
 sand:{closed:[.93,.90,.86],open:[1.045,1.03,.985]},
 coast:{closed:[.91,.96,.98],open:[1.06,1.055,1.02]}
};
const smooth=T.MathUtils.smoothstep;

// This is queried while placing the existing low-detail records, never per frame.
// cover <= 1 preserves their old collision-free footprint and height budgets.
export function sceneryRhythmAt(world,x,z){
 const state=world.explorationComposition,region=world.regions?.find(r=>r.contains?.(x,z));
 let biome=region?.id||state?.mapId,distance=Infinity,progress=0,influence=0,opening=0,closed=0;
 if(!state)return{biome,distance,progress,enclosure:0,opening:0,cover:1,shade:0};
 for(const route of state.routes){
  if(region&&route.biome!==region.id)continue;
  for(const s of route.segments){
   const t=T.MathUtils.clamp(((x-s.x)*s.dx+(z-s.z)*s.dz)/(s.length*s.length),0,1);
   const d=Math.hypot(x-s.x-s.dx*t,z-s.z-s.dz*t);
   const routeProgress=(s.start+t*s.length)/route.length;
   if(d<distance){distance=d;progress=routeProgress;biome=route.biome;}
   if(d>=18)continue;
   const weight=1-smooth(d,5,18);influence=Math.max(influence,weight);
   // Each segment contributes a continuous field. Choosing one nearest segment
   // jumps between unrelated progress values inside a folded/U-shaped trail.
   opening=Math.max(opening,Math.max(1-smooth(routeProgress,.07,.27),smooth(routeProgress,.73,.95))*weight);
   closed=Math.max(closed,smooth(routeProgress,.17,.34)*(1-smooth(routeProgress,.60,.82))*weight);
  }
 }
 for(const landmark of state.landmarks){
  if(region&&landmark.biome!==region.id)continue;
  opening=Math.max(opening,1-smooth(Math.hypot(x-landmark.x,z-landmark.z),8,20));
 }
 const enclosure=closed*(1-opening);
 return{biome,distance,progress,enclosure,opening,cover:Math.max(.48,1-opening*.38-influence*(1-enclosure)*.14),shade:enclosure*.10-opening*.025};
}

export function installExplorationComposition(world,mapId){
 if(world.explorationComposition)return world.explorationComposition;
 const routes=[];
 for(const source of world.explorationRoutes||[]){
  const points=source.points||[],segments=[];let length=0;
  for(let i=1;i<points.length;i++){
   const a=points[i-1],b=points[i];if(![a?.x,a?.z,b?.x,b?.z].every(Number.isFinite))continue;
   const dx=b.x-a.x,dz=b.z-a.z,d=Math.hypot(dx,dz);if(d<.001)continue;
   segments.push({x:a.x,z:a.z,dx,dz,length:d,start:length});length+=d;
  }
  if(length>1)routes.push({biome:source.biome||mapId,segments,length});
 }
 if(!routes.length)return null;
 const landmarks=(world.explorationLandmarks||[]).filter(p=>Number.isFinite(p.x)&&Number.isFinite(p.z));
 const state={mapId,routes,landmarks,trees:0,skippedLowTrees:0,groundVertices:0};world.explorationComposition=state;
 const protectedMeshes=new Set(landmarks.flatMap(p=>[p.mesh,p.obstacle?.mesh])),protectedObstacles=new Set([...(world.breakables||[]),...landmarks.map(p=>p.obstacle)]);
 const gate=world.forestVista?.gateCenter,box=new T.Box3(),oldScale=new T.Vector3();world.group.updateMatrixWorld(true);
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
  oldScale.copy(canopy.scale);
  const width=1+rhythm.enclosure*.30-rhythm.opening*.28;
  canopy.scale.x*=width;canopy.scale.z*=width;canopy.scale.y*=1+rhythm.enclosure*.09-rhythm.opening*.055;
  canopy.updateWorldMatrix(false,false);
  if(headroom(canopy)<3.2){canopy.scale.copy(oldScale);canopy.updateWorldMatrix(false,false);state.skippedLowTrees++;continue;}
  state.trees++;
 }
 const ground=world.ground,positions=ground?.geometry.attributes.position,colors=ground?.geometry.attributes.color,point=new T.Vector3();
 if(ground?.userData.ownedGeometry&&positions&&colors){
  ground.updateWorldMatrix(true,false);
  for(let i=0;i<positions.count;i++){
   point.fromBufferAttribute(positions,i).applyMatrix4(ground.matrixWorld);
   const rhythm=sceneryRhythmAt(world,point.x,point.z),tone=tones[rhythm.biome];if(!tone||!rhythm.enclosure&&!rhythm.opening)continue;
   colors.setXYZ(i,...[colors.getX(i),colors.getY(i),colors.getZ(i)].map((v,j)=>v*(1+(tone.closed[j]-1)*rhythm.enclosure+(tone.open[j]-1)*rhythm.opening)));state.groundVertices++;
  }
  colors.needsUpdate=true;
 }
 return state;
}
