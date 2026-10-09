import * as T from './vendor/three.module.js';

/** Static overhead geometry stays separate from the walkable ground footprints.
 * Build once after scenery installation; query only this small mesh collection.
 */
export function createOverheadQuery(world){
 world.group.updateMatrixWorld(true);
 const meshes=[],bounds=new T.Box3(),stone=world.forestVista?.group.getObjectByName('forest-vista-stone');
 world.group.traverse(mesh=>{
  if(!mesh.isMesh)return;
  if(mesh===stone){meshes.push(mesh);return;}
  let parent=mesh,district;
  while(parent&&parent!==world.group){if(parent.userData.district){district=parent.userData.district;break;}parent=parent.parent;}
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
