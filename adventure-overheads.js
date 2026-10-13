import * as T from './vendor/three.module.js';
import {bodyHeight} from './adventure-mobility.js?v=183';

const ceilingOffsets=[[0,0],[.3,0],[-.3,0],[0,.3],[0,-.3]];
// Natural soil elevation is not an airborne/platform posture. Avoid raycasting
// every roof on each ordinary step along a shallow hill.
export function needsMobilityCeiling(world,p,crouching=false){
 return (p.y||0)>(world.groundHeightAt?.(p.x,p.z)||0)+.001||Math.abs(p.jumpVelocity||0)>.0001||(p.crouch||0)>0||crouching;
}
// Return a world height, querying above the feet so a raised support is not a roof.
export function mobilityCeiling(world,p,x=p.x,z=p.z){
 if(!world.overhead?.meshes?.length)return Infinity;
 let ceiling=Infinity;
 const feet=p.y||0,top=feet+(p.standHeight||1.8)+1.2;
 for(const [dx,dz]of ceilingOffsets){
  const low={x:x+dx,y:feet+.05,z:z+dz},high={...low,y:top};
  const hit=world.overhead.firstHit(low,high)||world.overhead.firstHit(high,low);
  if(hit)ceiling=Math.min(ceiling,hit.point.y-.08);
 }
 return ceiling;
}

// Airborne movement must meet a roof's side before the next vertical update.
// Ground movement keeps its existing footprint collision and crouch behaviour.
export function canMoveBelowOverhead(world,p,x,z){
 if(!world.overhead?.meshes?.length||!needsMobilityCeiling(world,p))return true;
 const dx=x-p.x,dz=z-p.z,d=Math.hypot(dx,dz);
 if(d<1e-8)return true;
 const height=bodyHeight(p),radius=p.size||.45,nx=-dz/d,nz=dx/d;
 if(mobilityCeiling(world,p,x,z)<p.y+height-.02)return false;
 for(const fraction of[.5,.8,1])for(const side of[-radius,0,radius]){
  const y=p.y+height*fraction-.02;
  const start={x:p.x+nx*side,y,z:p.z+nz*side};
  const end={x:x+nx*side+dx/d*radius,y,z:z+nz*side+dz/d*radius};
  // Either winding is valid for single-sided sheets as well as closed roofs.
  if(world.overhead.firstHit(start,end)||world.overhead.firstHit(end,start))return false;
 }
 return true;
}

/** Static overhead geometry stays separate from the walkable ground footprints.
 * Build once after scenery installation; query only this small mesh collection.
 */
export function createOverheadQuery(world){
 world.group.updateMatrixWorld(true);
 const meshes=[],bounds=new T.Box3(),stone=world.forestVista?.group.getObjectByName('forest-vista-stone');
 world.group.traverse(mesh=>{
  if(!mesh.isMesh)return;
  if(mesh===stone||mesh.userData.placeOverhead){meshes.push(mesh);return;}
  let parent=mesh,district;
  while(parent&&parent!==world.group){if(parent.userData.explorationLandmark){meshes.push(mesh);return;}if(parent.userData.district){district=parent.userData.district;break;}parent=parent.parent;}
  if(district!=='warehouse'&&district!=='gate'&&district!=='court')return;
  bounds.setFromObject(mesh);
  if(bounds.min.y>(district==='warehouse'?2.4:2.5))meshes.push(mesh);
 });
 const raycaster=new T.Raycaster(),direction=new T.Vector3(),hits=[],active=[];
 return{meshes,firstHit(start,end,clearance=0){
  direction.set(end.x-start.x,end.y-start.y,end.z-start.z);
  const length=direction.length();
  if(length<1e-8||!Number.isFinite(length))return null;
  raycaster.ray.origin.set(start.x,start.y,start.z);raycaster.ray.direction.copy(direction).divideScalar(length);
  raycaster.near=0;raycaster.far=length;hits.length=0;active.length=0;
  for(const mesh of meshes){
   let parent=mesh;
   // Three's raycaster ignores visibility. Hidden/removed scenery is no longer
   // solid, but hiding the whole world for another render pass changes nothing.
   while(parent&&parent!==world.group&&parent.visible)parent=parent.parent;
   if(parent!==world.group)continue;
   mesh.updateWorldMatrix(true,false);active.push(mesh);
  }
  raycaster.intersectObjects(active,false,hits);
  if(!hits.length)return null;
  // Clearance retracts along the segment; it does not expand a roof's footprint.
  const distance=Math.max(0,hits[0].distance-Math.max(0,clearance));
  const point=raycaster.ray.at(distance,direction);
  return{point:{x:point.x,y:point.y,z:point.z},distance};
 }};
}
