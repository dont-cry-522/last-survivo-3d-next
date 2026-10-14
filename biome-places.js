import * as T from './vendor/three.module.js';
import{mergeGeometries}from'./vendor/BufferGeometryUtils.js';
import{batchedSurfaceMaterial,prepareBatchedSurface}from'./environment-props.js?v=191';
import{waterDepth}from'./water.js?v=191';
import{bridgeContains}from'./coast.js?v=191';
import{segmentDistance}from'./rules.js?v=191';
import{buildWoodlandPlace}from'./woodland-places.js?v=191';
import{buildRuinPlace}from'./ruin-places.js?v=191';
import{buildHarborPlace}from'./harbor-place.js?v=191';
import{coastPlaceCandidates,harborPierPlan}from'./harbor-bank-layout.js?v=191';
import{installHarborBank}from'./harbor-bank.js?v=191';

const templates=new Map(),materials=new Map(),HALF_X=9.4,HALF_Z=8.4;
function finish(category){
 if(materials.has(category))return materials.get(category);
 let material=new T.MeshStandardMaterial({color:0xffffff,vertexColors:true,roughness:/ice/.test(category)?.28:/metal/.test(category)?.57:.95,metalness:/metal/.test(category)?.55:0,side:T.DoubleSide});
 const kind=/wood/.test(category)?'wood':/cloth/.test(category)?'cloth':/stone|rock/.test(category)?'stone':category;
 const base=material;material=batchedSurfaceMaterial(base,kind);if(material!==base)base.dispose();
 materials.set(category,material);return material;
}

// Five authored places, combined once per category. No scene-sized textures or
// per-frame work. Source pieces are owned here; installed copies use world cleanup.
export function placeTemplate(id,variant=0){
 variant=variant===1?1:0;const key=id+':'+variant;
 if(templates.has(key))return templates.get(key);
 const parts=new Map(),solids=[],dummy=new T.Object3D(),tint=new T.Color();
 const kit={piece(category,geometry,color,transform={}){
  const{x=0,y=0,z=0,rx=0,ry=0,rz=0,sx=1,sy=1,sz=1,overhead=false}=transform;
  prepareBatchedSurface(geometry,/wood/.test(category)?'wood':/cloth/.test(category)?'cloth':category,transform);
  dummy.position.set(x,y,z);dummy.rotation.set(rx,ry,rz);dummy.scale.set(sx,sy,sz);dummy.updateMatrix();geometry.applyMatrix4(dummy.matrix);
  const p=geometry.attributes.position,c=geometry.attributes.color,colors=[];tint.setHex(color);
  for(let i=0;i<p.count;i++){const shade=c?(c.getX(i)+c.getY(i)+c.getZ(i))/3:1;colors.push(tint.r*shade,tint.g*shade,tint.b*shade);}
  geometry.setAttribute('color',new T.Float32BufferAttribute(colors,3));if(!geometry.attributes.normal)geometry.computeVertexNormals();
  for(const name of Object.keys(geometry.attributes))if(!['position','normal','color','surfaceCoord','surfaceKind','harborFlex'].includes(name))geometry.deleteAttribute(name);
  if(!geometry.index)geometry.setIndex(Array.from({length:p.count},(_,i)=>i));
  const key=category+(overhead?':roof':'');if(!parts.has(key))parts.set(key,{category,overhead,geometries:[]});parts.get(key).geometries.push(geometry);
 },solid(x,z,r,height){solids.push({x,z,r,height});},solidBox(x,z,w,d,height,angle=0){
  // A chain of short circles bounds the real wall; separate calls preserve doors.
  const alongX=w>=d,length=Math.max(w,d),thick=Math.min(w,d),steps=Math.max(1,Math.ceil(length/.65)),span=length/steps,r=Math.hypot(span/2,thick/2),c=Math.cos(angle),s=Math.sin(angle);
  for(let i=0;i<steps;i++){const q=-length/2+(i+.5)*span,dx=alongX?q:0,dz=alongX?0:q;solids.push({x:x+c*dx+s*dz,z:z-s*dx+c*dz,r,height});}
 }};
 const info=id==='forest'||id==='snow'?buildWoodlandPlace(id,kit,variant):id==='ash'||id==='sand'?buildRuinPlace(id,kit,variant):buildHarborPlace(kit,variant),batches=[];
 for(const part of parts.values()){const geometry=mergeGeometries(part.geometries);for(const g of part.geometries)g.dispose();geometry.computeBoundingBox();geometry.computeBoundingSphere();if(geometry.attributes.harborFlex?.array.some(v=>v>0))geometry.boundingSphere.radius+=.03;batches.push({geometry,material:finish(part.category),overhead:part.overhead});}
 const result={...info,variant,batches,solids};templates.set(key,result);return result;
}

const local=(p,x,z)=>{const dx=x-p.x,dz=z-p.z,c=Math.cos(p.angle),s=Math.sin(p.angle);return{x:c*dx-s*dz,z:s*dx+c*dz};};
const at=(p,x,z)=>{const c=Math.cos(p.angle),s=Math.sin(p.angle);return{x:p.x+c*x+s*z,z:p.z-s*x+c*z};};
// The walk-through endpoints extend beyond the visible floor. Keep their rounded
// approach clear as well, without enlarging the whole place or moving its props.
const inFootprint=(p,x,z,margin=0)=>{const q=local(p,x,z);return Math.abs(q.x)<HALF_X+margin&&Math.abs(q.z)<HALF_Z+margin||Math.hypot(q.x,Math.max(0,Math.abs(q.z)-9))<margin;};
function protectedRoot(world,o){
 return o.tactic||world.breakables.includes(o)||o.mesh.userData.district||o.mesh.userData.fragile||o.mesh.userData.forestVistaTrunk||o===world.forestHabitats?.elder||world.forestVista?.anchors.some(a=>a.x===o.x&&a.z===o.z)||(world.regions||[]).some(r=>r.beacon?.parent===o.mesh)||world.sites.some(s=>s.mesh===o.mesh||(s.gates||[]).includes(o));
}
export function installBiomePlaces(world,mapId){
 if(world.biomePlaces)return world.biomePlaces;
 const places=[],skips=[],protectedObjects=world.obstacles.filter(o=>protectedRoot(world,o)),ponds=world.ponds.map(p=>{const k=p.baseRx===undefined?1:1.19,rx=(p.baseRx??p.rx)*k+1,rz=(p.baseRz??p.rz)*k+1;return{...p,rx,rz,r:Math.max(rx,rz)*1.12};});
 const clearings=[{...world.spawn,r:7},...world.sites.map(s=>({...s,r:s.event?8:4.5})),...world.discoveries.flatMap(d=>[{...d,r:3.8},...(d.nodes||[]).map(n=>({...n,r:2}))]),...world.roaming.map(r=>({...r,r:4}))];
 const safe=(p,scope)=>{
  if(places.some(q=>Math.hypot(p.x-q.x,p.z-q.z)<28))return false;
  for(const q of clearings)if(inFootprint(p,q.x,q.z,q.r))return false;
  for(const o of protectedObjects)if(inFootprint(p,o.x,o.z,o.r+1))return false;
  // The old circular road and bridge approaches remain at least as wide as before.
  if(world.road?.some(q=>inFootprint(p,q.x,q.z,5.8)))return false;
  for(let x=-HALF_X;x<=HALF_X+.1;x+=HALF_X/3)for(let z=-HALF_Z;z<=HALF_Z+.1;z+=HALF_Z/3){const q=at(p,x,z);
   if(Math.abs(q.x)>world.half-3||Math.abs(q.z)>world.half-3||scope.contains&&!scope.contains(q.x,q.z))return false;
   if(ponds.some(w=>waterDepth(w,q.x,q.z)>0)||world.bridges?.some(b=>bridgeContains(b,q.x,q.z,2)))return false;
   if(world.patches.some(v=>v.kind==='vent'&&Math.hypot(q.x-v.x,q.z-v.z)<v.r+2))return false;
  }
  return true;
 };
 for(const scope of world.regions||[{id:mapId,...world.spawn}]){
  const id=scope.id,sites=world.sites.filter(s=>(!world.regions||s.biome===id)&&(s.type==='relic'||s.event)),start=world.regions?{x:scope.x,z:scope.z}:world.spawn;
  const shoreCandidates=id==='coast'?coastPlaceCandidates(world,scope):[];
  for(let n=0;n<2;n++){
   const template=placeTemplate(id,n),anchor=n===0?start:sites.find(s=>s.event)||sites[0]||start,candidates=[];
   for(const radius of[n===0?24:22,32,42,54,66])for(let i=0;i<24;i++){
    const a=-.75+i*Math.PI/12,p={x:anchor.x+Math.sin(a)*radius,z:anchor.z+Math.cos(a)*radius,angle:a};
    if(!safe(p,scope))continue;
    const near=sites.reduce((best,s)=>Math.hypot(p.x-s.x,p.z-s.z)<Math.hypot(p.x-best.x,p.z-best.z)?s:best,sites[0]||anchor),d=Math.hypot(p.x-start.x,p.z-start.z);
    const routeDistance=segmentDistance(p.x,p.z,start.x,start.z,near.x,near.z),viewPenalty=n===0?Math.abs(Math.atan2(Math.sin(a+.75),Math.cos(a+.75)))*3:0;
    candidates.push({...p,site:near,score:radius+routeDistance*.25+viewPenalty+(id==='coast'&&ponds.length?Math.min(...ponds.map(w=>Math.max(0,Math.hypot(p.x-w.x,p.z-w.z)-Math.max(w.rx,w.rz))))*.25:0)+Math.max(0,16-d)*3});
   }
   if(id==='coast')for(const candidate of shoreCandidates){
    if(!safe(candidate,scope))continue;const pier=harborPierPlan(world,candidate);if(!pier)continue;
    const near=sites.reduce((best,s)=>Math.hypot(candidate.x-s.x,candidate.z-s.z)<Math.hypot(candidate.x-best.x,candidate.z-best.z)?s:best,sites[0]||anchor);
    const detour=Math.hypot(candidate.x-start.x,candidate.z-start.z)+Math.hypot(candidate.x-near.x,candidate.z-near.z)-Math.hypot(start.x-near.x,start.z-near.z);
    candidates.push({...candidate,pier,site:near,score:-1000+Math.hypot(candidate.x-anchor.x,candidate.z-anchor.z)*.25+detour*2+segmentDistance(candidate.x,candidate.z,start.x,start.z,near.x,near.z)+pier.width*.35});
   }
   candidates.sort((a,b)=>a.score-b.score);const p=candidates[0];if(!p){skips.push({biome:id,reason:'no-clear-footprint',index:n});continue;}
   // Trade sparse ordinary props for a connected place. Tactical objects and
   // interactive clearings were rejected above, never moved or consumed.
   const removed=world.obstacles.filter(o=>!protectedRoot(world,o)&&!o.place&&!o.environmentCluster&&(inFootprint(p,o.x,o.z,o.r+.6)||p.pier&&bridgeContains(p.pier,o.x,o.z,o.r+.7))),roots=new Set(removed.map(o=>o.mesh));
   for(const root of roots){root.removeFromParent();root.traverse(o=>{if(o.isInstancedMesh)o.dispose();if(o.userData.ownedGeometry)o.geometry.dispose();});}
   world.obstacles=world.obstacles.filter(o=>!roots.has(o.mesh));
   for(const region of[world,...world.regions||[]]){region.foliage=region.foliage.filter(f=>{let parent=f.leaf;while(parent&&parent!==world.group)parent=parent.parent;return parent===world.group;});if(region!==world)region.obstacles=region.obstacles.filter(o=>!roots.has(o.mesh));}
   const group=new T.Group();group.name='SM_Place_'+id+'_'+n;group.position.set(p.x,0,p.z);group.rotation.y=p.angle;world.group.add(group);
   for(const b of template.batches){const mesh=new T.Mesh(b.geometry.clone(),b.material);mesh.name=group.name+'_'+group.children.length;mesh.castShadow=mesh.receiveShadow=true;mesh.userData.ownedGeometry=true;mesh.userData.placeOverhead=b.overhead;group.add(mesh);}
   const solids=[];for(const s of template.solids){const q=at(p,s.x,s.z),root=new T.Object3D();root.position.set(s.x,0,s.z);root.name='COL_'+id;group.add(root);const obstacle={...q,r:s.r,height:s.height,sceneryHeight:s.height,mesh:root,biome:id,place:true};world.obstacles.push(obstacle);if(world.regions)scope.obstacles.push(obstacle);solids.push(obstacle);}
   const place={...p,biome:id,index:n,variant:template.variant,kind:template.kind,name:template.name,focus:{...at(p,template.focus.x,template.focus.z),y:template.focus.y},mesh:group,solids,removed:removed.length,entrance:at(p,0,-9),exit:at(p,0,9)};
   if(place.pier)place.solids.push(...installHarborBank(world,place));places.push(place);
  }
 }
 world.biomePlaces=places;world.biomePlaceSkips=skips;return places;
}
