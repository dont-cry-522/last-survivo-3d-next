import * as T from './vendor/three.module.js';

// A landmark is now a complete place with a walkable approach, rather than an
// isolated tower on an arbitrary tree root. Reward discovery stays independent.
export function installExplorationLandmarks(world,mapId){
 if(world.explorationLandmarks)return world.explorationLandmarks;
 const markers=[],skips=[];
 for(const scope of world.regions||[{id:mapId}]){
  const place=world.biomePlaces?.find(p=>p.biome===scope.id);
  if(place){place.mesh.updateWorldMatrix(true,true);markers.push({biome:scope.id,x:place.focus.x,z:place.focus.z,height:new T.Box3().setFromObject(place.mesh).max.y,kind:place.kind,name:place.name,site:place.site,mesh:place.mesh,place});continue;}
  if(scope.id==='forest'&&world.forestHabitats?.elder){const obstacle=world.forestHabitats.elder;obstacle.mesh.updateWorldMatrix(true,true);markers.push({biome:'forest',x:obstacle.x,z:obstacle.z,height:new T.Box3().setFromObject(obstacle.mesh).max.y,kind:'elder',site:world.forestHabitats.relic,obstacle,mesh:obstacle.mesh});}
  else skips.push({biome:scope.id,reason:'no-safe-place'});
 }
 world.explorationLandmarks=markers;world.explorationLandmarkSkips=skips;return markers;
}
