import * as T from './vendor/three.module.js';
import{mergeGeometries,toCreasedNormals}from'./vendor/BufferGeometryUtils.js';
import{batchedSurfaceMaterial,prepareBatchedSurface}from'./environment-props.js?v=192';
import{naturalRockGeometry}from'./biome-scenery.js?v=192';
import{waterDepth}from'./water.js?v=192';

const finishes=Object.fromEntries(['wood','stone'].map(kind=>{
 const source=new T.MeshStandardMaterial({vertexColors:true,roughness:.94});
 const material=batchedSurfaceMaterial(source,kind);if(material!==source)source.dispose();return[kind,material];
}));

// A low, step-free pier connects the existing dry place to actual tidal water.
// Its deck uses the same onBridge terrain rule as the map's original crossings.
export function installHarborBank(world,place){
 if(!place.pier)return[];
 const b=place.pier,parts={wood:[],stone:[]},solids=[],matrix=new T.Matrix4(),dummy=new T.Object3D(),tint=new T.Color();
 const c=Math.cos(place.angle),s=Math.sin(place.angle),at=(x,z)=>({x:place.x+c*x+s*z,z:place.z-s*x+c*z});
 const add=(kind,g,color,x,y,z,sx=1,sy=1,sz=1,ry=0)=>{
  prepareBatchedSurface(g,kind,{sx,sy,sz});dummy.position.set(x,y,z);dummy.rotation.set(0,ry,0);dummy.scale.set(sx,sy,sz);dummy.updateMatrix();matrix.copy(dummy.matrix);g.applyMatrix4(matrix);
  tint.setHex(color);const colors=[],a=g.attributes.color;
  for(let i=0;i<g.attributes.position.count;i++){const shade=a?(a.getX(i)+a.getY(i)+a.getZ(i))/3:1;colors.push(tint.r*shade,tint.g*shade,tint.b*shade);}
  g.setAttribute('color',new T.Float32BufferAttribute(colors,3));
  for(const key of Object.keys(g.attributes))if(!['position','normal','color','surfaceCoord','surfaceKind'].includes(key))g.deleteAttribute(key);
  if(!g.index)g.setIndex(Array.from({length:g.attributes.position.count},(_,i)=>i));parts[kind].push(g);
 };
 const solid=(x,z,r,height)=>{
  const q=at(x,z),root=new T.Object3D();root.position.set(x,0,z);root.name='COL_HarborBank';place.mesh.add(root);
  const o={...q,r,height,sceneryHeight:height,mesh:root,biome:'coast',place:true};world.obstacles.push(o);world.regions?.find(r=>r.id==='coast')?.obstacles.push(o);solids.push(o);
 };
 const from=-7.6,to=b.localEndZ,count=Math.ceil((from-to)/.42),step=(from-to)/count;
 for(let i=0;i<count;i++){
  const z=from-(i+.5)*step;
  add('wood',new T.BoxGeometry(2.8,.10,step*.94),i%4?0x817e65:0x6e7462,.015*Math.sin(i*1.3),.06,z,1,1,1,.004*Math.sin(i));
 }
 // Two long bearers stay below ankle height. Mooring posts remain real solids,
 // leaving over 2.6 metres between them; the open end can be left by swimming.
 for(const side of[-1,1]){
  add('wood',new T.BoxGeometry(.16,.12,from-to),0x545f52,side*1.13,.028,(from+to)/2);
  const spans=Math.max(1,Math.ceil((from-to)/4));
  for(let i=0;i<=spans;i++){
   const z=from+(to-from)*i/spans+.12,x=side*1.55;
   add('wood',new T.CylinderGeometry(.125,.165,1.5,8),0x657364,x,.25,z);
   add('wood',new T.BoxGeometry(.44,.10,.19),0x92957b,x,.87,z);solid(x,z,.25,1.02);
  }
 }
 // A broken, low stone apron shoulders the dry landing. It never changes the
 // player's floor height or fills the central route with a cosmetic staircase.
 for(const side of[-1,1])for(let i=0;i<7;i++){
  const x=side*(2.25+i*.66),z=-7.30-.28*Math.sin(i*.9),q=at(x,z);
  if(world.ponds.some(p=>waterDepth(p,q.x,q.z)>.03))continue;
  const height=.20+.065*Math.sin(i*1.7+side),r=.57;
  // Broken, partly buried shore slabs retain the original solid footprint.
  // Reuse the old 120-triangle stones; no extra skirt mesh or wetness pass.
  const source=naturalRockGeometry.clone(),vertices=source.attributes.position;
  for(let n=0;n<vertices.count;n++){
   let px=T.MathUtils.clamp(vertices.getX(n),-.76,.76),pz=T.MathUtils.clamp(vertices.getZ(n),-.78,.78);
   const reach=Math.hypot(px*.64,pz*.49);if(reach>.55){px*=.55/reach;pz*=.55/reach;}
   const py=Math.min(vertices.getY(n),.48+px*.16-pz*.19,.55-px*.23+pz*.10);
   vertices.setXYZ(n,px,py,pz);
  }
  const slab=toCreasedNormals(source,.62);source.dispose();slab.setIndex(Array.from({length:slab.attributes.position.count},(_,n)=>n));
  const colors=[];for(let n=0;n<slab.attributes.position.count;n++){
   const py=slab.attributes.position.getY(n),px=slab.attributes.position.getX(n),pz=slab.attributes.position.getZ(n);
   const damp=1-T.MathUtils.smoothstep(py,-.28,.30),strata=.5+.5*Math.sin(py*21+px*3-pz*2),shade=(.89+strata*.07)*(1-damp*.21);
   colors.push(shade,shade,shade);
  }
  slab.setAttribute('color',new T.Float32BufferAttribute(colors,3));
  add('stone',slab,i%2?0x85918c:0x778680,x,.07,z,.64,height,.49,i*.63);solid(x,z,r,.32);
 }
 for(const[kind,list]of Object.entries(parts)){
  if(!list.length)continue;const geometry=mergeGeometries(list);list.forEach(g=>g.dispose());geometry.computeBoundingBox();geometry.computeBoundingSphere();
  const mesh=new T.Mesh(geometry,finishes[kind]);mesh.name='SM_HarborBank_'+kind;mesh.castShadow=mesh.receiveShadow=true;mesh.userData.ownedGeometry=true;place.mesh.add(mesh);
 }
 world.bridges.push(b);world.regions?.find(r=>r.id==='coast')?.bridges.push(b);
 return solids;
}
