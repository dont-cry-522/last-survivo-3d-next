import * as T from './vendor/three.module.js';
import {mergeGeometries,toCreasedNormals} from './vendor/BufferGeometryUtils.js';
import {naturalRockGeometry} from './biome-scenery.js?v=156';
import {batchedSurfaceMaterial,prepareBatchedSurface,wornStoneBlock} from './environment-props.js?v=166';
import {addTree} from './tree-scenery.js?v=166';
import {bridgeContains} from './coast.js?v=114';
import {seeded,segmentDistance} from './rules.js?v=125';

const templates=new Map(),finishes=new Map(),BIOMES=['forest','snow','ash','sand','coast'];
function finish(kind){
 if(finishes.has(kind))return finishes.get(kind);
 let m=new T.MeshStandardMaterial({color:0xffffff,vertexColors:true,roughness:kind==='ice'?.32:kind==='metal'?.67:.96,metalness:kind==='metal'?.35:0,side:T.DoubleSide});
 const base=m;m=batchedSurfaceMaterial(base,kind);if(m!==base)base.dispose();
 finishes.set(kind,m);return m;
}
const bent=(points,radius=.05)=>new T.TubeGeometry(new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p))),6,radius,5,false);

function forestStone(fragment,variant){
 const source=naturalRockGeometry.clone(),p=source.attributes.position;
 // Keep the buried skirt and topology. One stone is a broad, stepped slab;
 // the other is an oblique wedge with a broken corner, not a resized copy.
 for(let i=0;i<p.count;i++){
  const originalY=p.getY(i),layer=T.MathUtils.smoothstep(originalY,-.32,-.04)*(1-T.MathUtils.smoothstep(originalY,.04,.34));
  let x=p.getX(i)*(fragment?.83:.95)*(1-layer*.085),z=p.getZ(i)*(fragment?.98:.91)*(1-layer*.045);
  x=T.MathUtils.clamp(x,fragment?-.66-.22*z:-.86+.13*z,fragment?.84-.13*z:.79-.12*z);
  z=T.MathUtils.clamp(z,fragment?-.81+.20*x:-.76-.05*x,fragment?.68-.27*x:.83+.18*x);
  const tilt=variant?.055:-.025;
  const y=fragment?Math.min(originalY,.40-.24*x-(.12+tilt)*z,.58+.30*x+.14*z,.61+.28*x-.29*z):Math.min(originalY,.53+(.11+tilt)*x-.23*z,.53-.26*x+.06*z,.64+.32*x+.10*z);
  p.setXYZ(i,x,y,z);
 }
 // Preserve broken edges without turning the whole stone into a flat-shaded
 // gem. This splits normals only: the triangle count and shared source stay put.
 const g=toCreasedNormals(source,.62);source.dispose();
 g.setIndex(Array.from({length:g.attributes.position.count},(_,i)=>i));
 // Quiet mineral strata and patchy lower-face staining sit below the existing
 // scanned rock finish. No extra decal, material or per-frame surface lookup.
 const vertices=g.attributes.position,normals=g.attributes.normal,colors=[];
 for(let i=0;i<vertices.count;i++){
  const x=vertices.getX(i),y=vertices.getY(i),z=vertices.getZ(i),up=Math.max(0,normals.getY(i));
  const patch=.5+.25*Math.sin(x*5.2+z*3.1+variant)+.25*Math.sin(x*-3.3+z*4.7-y*1.9+fragment);
  const strata=.5+.5*Math.sin((y+x*.16-z*.09)*20+Math.sin(x*3.1+z*2.7)*.30);
  const damp=(1-T.MathUtils.smoothstep(y,-.18,.30))*T.MathUtils.smoothstep(patch,.30,.78);
  const moss=(1-T.MathUtils.smoothstep(y,.08,.36))*T.MathUtils.smoothstep(patch,.68,.91)*T.MathUtils.smoothstep(up,.08,.65);
  const shade=(.86+up*.09+strata*.065)*(1-damp*.18);
  colors.push(shade*(1-moss*.34),shade*(1-moss*.13),shade*(1-moss*.40));
 }
 g.setAttribute('color',new T.Float32BufferAttribute(colors,3));
 return g;
}

// Preserve the established placement/collision envelope, independently of leaf silhouettes.
const forestEnvelope=[
 {footprint:1.7924601726519591,height:2.384399890899658},
 {footprint:1.7380870700551916,height:2.384399890899658}
];
// Model-only revisions must not reseed the placement search or change clearance.
const mineralEnvelopes={
 snow:[{footprint:1.6518517266366224,height:2.2583999633789062},{footprint:1.5735932232532226,height:2.2583999633789062}],
 ash:[{footprint:1.6784790160827399,height:1.9311074018478394},{footprint:1.5402436141536555,height:1.9311074018478394}],
 sand:[{footprint:1.6553711347720972,height:1.5230000019073486},{footprint:1.660690370914034,height:1.5230000019073486}]
};
function fracturedStone(fragment,variant,ash=false){
 const source=naturalRockGeometry.clone(),p=source.attributes.position;
 for(let i=0;i<p.count;i++){
  let x=p.getX(i),y=p.getY(i),z=p.getZ(i);
  // Broad fracture planes retain a rough buried foot; the crown is not a dome.
  x=T.MathUtils.clamp(x,-.79+.10*z,.77-.16*z)*(1-.045*Math.sin(y*12+fragment));
  z=T.MathUtils.clamp(z,-.77-.09*x,.76+.18*x);
  y=Math.min(y,.59-(ash?.28:.12)*x+.09*z,.58+.23*x-.19*z,.70-.09*x+.25*z);
  if(ash)y=Math.min(y,.69-.36*z+(fragment-1)*.075*x);
  p.setXYZ(i,x,y,z);
 }
 const g=toCreasedNormals(source,ash?.56:.76);source.dispose();g.setIndex(Array.from({length:g.attributes.position.count},(_,i)=>i));
 const vertices=g.attributes.position,n=g.attributes.normal,colors=[];
 for(let i=0;i<vertices.count;i++){
  const x=vertices.getX(i),y=vertices.getY(i),z=vertices.getZ(i),up=Math.max(0,n.getY(i)),seam=.5+.5*Math.sin(y*23+x*2-z*3+fragment+variant*.7);
  const shade=.78+up*.15+seam*.045+T.MathUtils.smoothstep(y,-.3,.45)*.055;
  colors.push(shade,shade*(ash?.96:1.01),shade*(ash?.94:1.03));
 }
 g.setAttribute('color',new T.Float32BufferAttribute(colors,3));return g;
}
function settledSnow(stone){
 const p=stone.attributes.position,index=stone.index,a=new T.Vector3(),b=new T.Vector3(),c=new T.Vector3(),normal=new T.Vector3(),vertices=[],colors=[];
 // A thin covering follows the actual exposed rock faces, including their tilt.
 // It is not a second floating, scaled pebble sitting above the stone.
 for(let i=0;i<index.count;i+=3){
  const ids=[index.getX(i),index.getX(i+1),index.getX(i+2)];a.fromBufferAttribute(p,ids[0]);b.fromBufferAttribute(p,ids[1]);c.fromBufferAttribute(p,ids[2]);
  normal.crossVectors(b.clone().sub(a),c.clone().sub(a)).normalize();
  if(normal.y<.38||(a.y+b.y+c.y)/3<.12)continue;
  for(const id of ids){const x=p.getX(id),y=p.getY(id),z=p.getZ(id),depth=.024+.012*Math.sin(x*3.1+z*2.7)**2;vertices.push(x,y+depth,z);const shade=.92+normal.y*.07;colors.push(shade*.97,shade,shade);}
 }
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(vertices,3));g.setAttribute('color',new T.Float32BufferAttribute(colors,3));g.setIndex(Array.from({length:vertices.length/3},(_,i)=>i));g.computeVertexNormals();return g;
}
function erodedStrata(variant){
 const levels=[[0,1.18],[.08,1.21],[.20,1.13],[.47,1.13],[.64,1.05],[.81,1.08],[1,1.03]],sides=16,vertices=[],colors=[],indices=[],crown=(x,z)=>Math.min(1.50,1.09+.45*x+.13*z);
 // A broad tilted fracture keeps one shoulder high and the opposite edge low.
 // Its sides retain only two shallow erosion seams, without a stepped cone.
 for(const [j,[t,r]]of levels.entries())for(let i=0;i<sides;i++){
  const a=i/sides*Math.PI*2,wear=1+.075*Math.sin(a*3+variant*.7)+.035*Math.cos(a*5+.3);
  let x=Math.cos(a)*r*wear-.12+t*.06,z=Math.sin(a)*r*.65*wear-.08+t*.05;
  x=T.MathUtils.clamp(x,-1.11+.12*z,1.10-.09*z);z=T.MathUtils.clamp(z,-.75-.07*x,.75-.13*x);
  const y=-.07+(crown(x,z)+.07)*t;
  vertices.push(x,y,z);const shade=.84+t*.035+.014*Math.sin(a*3+t*.8)+.008*Math.sin(y*18+x);colors.push(shade*1.04,shade,shade*.92);
  if(j<levels.length-1){const k=j*sides+i,next=j*sides+(i+1)%sides;indices.push(k,k+sides,next,next,k+sides,next+sides);}
 }
 for(const j of[0,levels.length-1]){
  const center=vertices.length/3,offset=j*sides,x=j?-.06:-.12,z=j?-.03:-.08;vertices.push(x,j?crown(x,z):-.07,z);colors.push(.91,.875,.805);
  for(let i=0;i<sides;i++){const a=offset+i,b=offset+(i+1)%sides;indices.push(center,...(j?[b,a]:[a,b]));}
 }
 const source=new T.BufferGeometry();source.setAttribute('position',new T.Float32BufferAttribute(vertices,3));source.setAttribute('color',new T.Float32BufferAttribute(colors,3));source.setIndex(indices);source.computeVertexNormals();
 const g=toCreasedNormals(source,.63);source.dispose();g.setIndex(Array.from({length:g.attributes.position.count},(_,i)=>i));return g;
}
function forestUndergrowth(variant){
 const source=new T.Group();addTree(source,'forest',3,{angle:variant*.7});
 const stems=[],vertices=[],indices=[],colors=[],uvs=[],up=new T.Vector3(0,1,0),point=new T.Vector3();
 // Both fallback and scanned atlases reserve this opaque sample. Fixed UVs
 // survive late texture replacement without hiding existing young-tree leaves.
 const u=.5,v=.5;
 const branch=(points,radius,sides=3,steps=2)=>{
  const curve=new T.CatmullRomCurve3(points),g=new T.TubeGeometry(curve,steps,radius,sides,false),p=g.attributes.position;
  for(let i=0;i<=steps;i++){
   const center=curve.getPointAt(i/steps),taper=1-.88*i/steps;
   for(let j=0;j<=sides;j++){const n=i*(sides+1)+j;point.fromBufferAttribute(p,n).sub(center).multiplyScalar(taper).add(center);p.setXYZ(n,point.x,point.y,point.z);}
  }
  g.deleteAttribute('uv');g.computeVertexNormals();stems.push(g);return curve;
 };
 const leafyTwig=(start,end,phase,count=6)=>{
  const middle=start.clone().lerp(end,.52);middle.y+=.045;
  const curve=branch([start,middle,end],.0065),heading=Math.atan2(end.z-start.z,end.x-start.x);
  for(let i=0;i<count;i++){
   const t=.22+i*.73/(count-1),base=curve.getPointAt(t),angle=heading+(i%2?1:-1)*(.62+.21*Math.sin(phase+i*1.7));
   const along=new T.Vector3(Math.cos(angle),.12+.21*Math.sin(phase+i*.9),Math.sin(angle)).normalize(),across=new T.Vector3().crossVectors(up,along).normalize().applyAxisAngle(along,.35*Math.sin(phase+i*2.3)),normal=new T.Vector3().crossVectors(along,across);
   const length=.095+.048*(.5+.5*Math.sin(phase+i*2.1)),width=length*(.22+.035*Math.sin(phase+i)),first=vertices.length/3;
   // Each blade starts on its twig, with a raised midrib and gently drooping tip.
   // Real gaps replace the opaque, adult-sized spray underneath the old small leaves.
   const shape=[[0,0,0],[0,length*.38,length*.07],[-width,length*.34,0],[0,length,-length*.10],[width,length*.43,-length*.005],[0,length*.73,length*.035]];
   for(const [j,[x,y,z]]of shape.entries()){
    point.copy(base).addScaledVector(across,x).addScaledVector(along,y).addScaledVector(normal,z);vertices.push(point.x,point.y,point.z);uvs.push(u,v);
    const shade=(j===1||j===5?.97:.83)+.055*Math.sin(phase+i*1.3);colors.push(shade*.91,shade,shade*.87);
   }
   indices.push(first,first+1,first+2,first+2,first+1,first+5,first+2,first+5,first+3,first,first+4,first+1,first+4,first+5,first+1,first+4,first+3,first+5);
  }
 };
 const trunk=branch([new T.Vector3(-.32,-.015,-.32),new T.Vector3(-.37,.70,-.30),new T.Vector3(-.24,1.46,-.39),new T.Vector3(-.20+(variant?.08:-.06),2.26,-.25)],.056,6,5);
 for(let i=0;i<7;i++){
  const t=.34+i*.087,start=trunk.getPointAt(t),a=i*2.399+variant*.61,reach=.60-i*.043+Math.sin(i*1.8+variant)*.05;
  const end=start.clone().add(new T.Vector3(Math.cos(a)*reach,.14+Math.sin(i*2.2)*.06,Math.sin(a)*reach)),middle=start.clone().lerp(end,.50);middle.y+=.10;
  const fork=branch([start,middle,end],.017,4,3);
  for(let j=0;j<3;j++){
   const base=fork.getPointAt(.38+j*.28),angle=a+(j-1)*(.67+variant*.09),length=.23+.07*Math.sin(i*2.8+j)**2;
   leafyTwig(base,base.clone().add(new T.Vector3(Math.cos(angle)*length,.045+(j===1?.045:0),Math.sin(angle)*length)),i*1.7+j+variant);
  }
 }
 const tip=trunk.getPointAt(.88);leafyTwig(tip,trunk.getPointAt(1),variant+.6);
 for(const [b,x,z,h]of[[0,.55,.25,.59],[1,-.70,.48,.43]]){
  const stem=branch([new T.Vector3(x,-.01,z),new T.Vector3(x+.04,.24,z-.04),new T.Vector3(x+.10,h,z+.03)],.022,4,3);
  for(let i=0;i<5;i++){
   const base=stem.getPointAt(.28+i*.16),a=i*2.399+b*.9+variant*.57,r=.33+.13*Math.sin(i*2.1+b+variant)**2;
   leafyTwig(base,base.clone().add(new T.Vector3(Math.cos(a)*r,.11+Math.sin(i*1.7)*.055,Math.sin(a)*r)),b*3+i*1.3+variant,5);
  }
 }
 const wood=mergeGeometries(stems);for(const g of stems)g.dispose();wood.setAttribute('treeSurface',new T.Float32BufferAttribute(new Float32Array(wood.attributes.position.count),1));
 const leaves=new T.BufferGeometry();leaves.setAttribute('position',new T.Float32BufferAttribute(vertices,3));leaves.setAttribute('color',new T.Float32BufferAttribute(colors,3));leaves.setAttribute('uv',new T.Float32BufferAttribute(uvs,2));leaves.setAttribute('treeSurface',new T.Float32BufferAttribute(new Float32Array(vertices.length/3).fill(1),1));leaves.setIndex(indices);leaves.computeVertexNormals();
 return[{geometry:wood,material:source.children[0].material,color:0x70634a},{geometry:leaves,material:source.children[1].material,color:0xffffff}];
}

function clusterTemplate(id,variant){
 const key=id+variant;if(templates.has(key))return templates.get(key);
 const parts=new Map(),dummy=new T.Object3D(),tint=new T.Color();
 const add=(g,material,color=0xffffff,pose={})=>{
  const{x=0,y=0,z=0,sx=1,sy=1,sz=1,rx=0,ry=0,rz=0}=pose;
  if(material.userData.propSurface==='wood-piece')prepareBatchedSurface(g,'wood',pose);
  dummy.position.set(x,y,z);dummy.scale.set(sx,sy,sz);dummy.rotation.set(rx,ry,rz);dummy.updateMatrix();g.applyMatrix4(dummy.matrix);
  const p=g.attributes.position,c=g.attributes.color,colors=[];tint.setHex(color);
  for(let i=0;i<p.count;i++)colors.push(tint.r*(c?.getX(i)??1),tint.g*(c?.getY(i)??1),tint.b*(c?.getZ(i)??1));
  g.setAttribute('color',new T.Float32BufferAttribute(colors,3));
  // Keep the tree shader's surface and UV attributes for its shared leaf atlas.
  if(!material.map)g.deleteAttribute('uv');
  if(!parts.has(material))parts.set(material,[]);parts.get(material).push(g);
 };
 const rock=(color,x,y,z,sx,sy,sz,ry=0,kind='stone')=>add(naturalRockGeometry.clone(),finish(kind),color,{x,y,z,sx,sy,sz,ry});
 const wood=(points,radius,color=0x635744)=>add(bent(points,radius),finish('wood'),color);
 const tree=(biome,x,z,width,height)=>{
  const root=new T.Group();addTree(root,biome,3,{angle:variant*.7,variation:.93,bend:.1});root.position.set(x,-.04,z);root.scale.set(width,height,width);root.updateMatrixWorld(true);
  for(const mesh of root.children)add(mesh.geometry.clone().applyMatrix4(mesh.matrixWorld),mesh.material);
  return root;
 };
 if(id==='forest'){
  for(const part of forestUndergrowth(variant))add(part.geometry,part.material,part.color);
  add(forestStone(0,variant),finish('stone'),0x807b6e,{x:-.42,y:.21,z:.27,sx:.78,sy:.35,sz:.69});
  add(forestStone(1,variant),finish('stone'),0x8b8476,{x:.65,y:.16,z:-.24,sx:.59,sy:.27,sz:.50});
 }else if(id==='snow'){
  tree('snow',-.48,-.30,.48,.34);tree('snow',.57,.38,.34,.26);
  for(const [i,x,z,s]of[[0,-.65,.45,.76],[1,.55,-.31,.87],[2,.0,.61,.51]]){
   const stone=fracturedStone(i,variant),snow=settledSnow(stone),pose={x,y:.36*s,z,sx:s,sy:.70*s,sz:.75*s,ry:.3+variant};
   add(stone,finish('stone'),0x718891,pose);add(snow,finish('snow'),0xd6e1dd,pose);
  }
  rock(0x98c3ce,.45,.20,-.66,.39,.36,.34,.7,'ice');
 }else if(id==='ash'){
  for(const [i,x,z,s]of[[0,-.51,.05,1.02],[1,.49,-.30,.78],[2,.53,.60,.62]])add(fracturedStone(i,variant,true),finish('stone'),i%2?0x67584e:0x4c4849,{x,y:.51*s,z,sx:s,sy:.92*s,sz:.79*s,ry:variant+i*.8});
  wood([[-.50,.04,-.26],[-.68,1.10,-.08],[-.30,1.88,.21]],.10,0x332f2c);
  wood([[-.65,.85,-.04],[-1.02,1.34,.16],[-1.08,1.49,.42]],.055,0x3f3630);
  wood([[-.54,1.12,.04],[.18,1.38,-.08],[.43,1.22,-.26]],.053,0x44392f);
 }else if(id==='sand'){
  add(erodedStrata(variant),finish('stone'),0xb7a17c,{ry:.09+variant*.16});
  rock(0xb4a184,.94,.19,.35,.55,.39,.66,.6);rock(0x9f8f71,-.67,.16,.68,.57,.34,.50,.3);
 }else{
  // Cargo, a stave barrel and a low sagging net form one compact working heap.
  for(const [x,y,z,s,turn]of[[-.39,.48,-.34,.96,.08],[.35,.36,.20,.72,-.14]]){
   add(wornStoneBlock.clone(),finish('wood'),variant?0x8e7960:0x7b715c,{x,y,z,sx:s,sy:s,sz:s,ry:turn});
   for(const side of[-1,1])add(new T.BoxGeometry(s+.045,.075,.065),finish('wood'),0x514e41,{x,y:y+side*s*.37,z:z+s*.51,ry:turn});
  }
  const barrel=new T.CylinderGeometry(.36,.33,.94,12,3),p=barrel.attributes.position;
  for(let i=0;i<p.count;i++){const bulge=1+.13*Math.cos(p.getY(i)/.94*Math.PI);p.setX(i,p.getX(i)*bulge);p.setZ(i,p.getZ(i)*bulge);}barrel.computeVertexNormals();
  add(barrel,finish('wood'),0x8c8069,{x:.70,y:.44,z:-.45});
  for(const y of[.17,.68])add(new T.TorusGeometry(.392,.024,5,12),finish('metal'),0x4d605e,{x:.70,y,z:-.45,rx:Math.PI/2});
  for(const x of[-.95,.93])wood([[x,-.035,.47],[x*.98,1.03,.48],[x*.93,1.70,.41]],.055,0x706a55);
  for(let i=0;i<6;i++){const x=-.92+i*.365;wood([[x,.48,.47],[x,1.08-Math.sin(i/5*Math.PI)*.17,.52],[x*.95,1.62-Math.sin(i/5*Math.PI)*.22,.42]],.012,0x667267);}
  for(let i=0;i<4;i++){const y=.51+i*.35;wood([[-.94,y,.47],[0,y-.15,.53],[.94,y,.46]],.012,0x6d796a);}
  wood([[-1.10,.07,-.54],[-.27,.13,-.81],[.71,.09,-.92]],.11,0x918a73);
 }
 const batches=[],point=new T.Vector3();let footprint=0,height=0,triangles=0;
 for(const [material,geometries]of parts){
  const geometry=mergeGeometries(geometries);for(const g of geometries)g.dispose();geometry.computeBoundingBox();geometry.computeBoundingSphere();
  const p=geometry.attributes.position;for(let i=0;i<p.count;i++){point.fromBufferAttribute(p,i);footprint=Math.max(footprint,Math.hypot(point.x,point.z));height=Math.max(height,point.y);}
  triangles+=geometry.index.count/3;batches.push({geometry,material});
 }
 const template={batches,footprint:footprint+.04,height,triangles,...(id==='forest'?forestEnvelope[variant]:mineralEnvelopes[id]?.[variant])};templates.set(key,template);return template;
}

function corridors(world){
 const lines=[];
 if(world.road)for(let i=1;i<world.road.length;i++)lines.push({a:world.road[i-1],b:world.road[i],width:5.8});
 for(const s of world.sites||[]){
  const p=s.trail?.geometry.attributes.position;if(!p)continue;let previous;
  for(let i=0;i+3<p.count;i+=4){const next={x:(p.getX(i+1)+p.getX(i+2))/2,z:(p.getZ(i+1)+p.getZ(i+2))/2};if(previous)lines.push({a:previous,b:next,width:2});previous=next;}
 }
 return lines;
}
function layoutSeed(world,id){
 let h=2166136261;for(const c of id)h=Math.imul(h^c.charCodeAt(0),16777619);
 for(const p of[world.spawn,...world.sites,...world.obstacles])for(const n of[p.x,p.z])h=Math.imul(h^Math.round(n*1000),16777619);
 return h>>>0;
}
export function installEnvironmentClusters(world,mapId){
 if(world.environmentClusters)return world.environmentClusters;
 if(!BIOMES.includes(mapId)&&mapId!=='confluence')return null;
 const records=[],group=new T.Group(),lines=corridors(world),existing=world.obstacles.slice(),scopes=world.regions||[{id:mapId,...world.spawn}],random=seeded(layoutSeed(world,mapId));group.name='SM_Environment_Clusters_A';
 const clearings=[{...world.spawn,r:7},...(world.regions||[]).map(r=>({...r,r:7})),...(world.sites||[]).flatMap(s=>[{...s,r:s.event?8:5},...(s.nodes||[]).map(p=>({...p,r:4.5}))]),...(world.discoveries||[]).flatMap(d=>[{...d,r:5},...(d.nodes||[]).map(p=>({...p,r:4.5}))]),...(world.roaming||[]).map(r=>({...r,r:r.kind==='camp'?6:4.5})),...[...(world.districts||[]),...(world.regions||[]).flatMap(r=>r.districts||[])].map(d=>({...d,r:12}))];
 const shores=(world.ponds||[]).map(p=>{const k=p.baseRx===undefined?1:1.19;return{...p,rx:(p.baseRx??p.rx)*k*1.12,rz:(p.baseRz??p.rz)*k*1.12};}),crossings=[...(world.bridges||[]),...(world.fords||[]).map(f=>({...f,width:f.half*2,length:f.width}))];
 const safe=(x,z,r,scope)=>{
  if(Math.abs(x)+r>world.half-2||Math.abs(z)+r>world.half-2)return false;
  if(scope.contains)for(const [dx,dz]of[[0,0],[r,0],[-r,0],[0,r],[0,-r]])if(!scope.contains(x+dx,z+dz))return false;
  if(clearings.some(p=>Math.hypot(x-p.x,z-p.z)<r+p.r))return false;
  if(existing.some(o=>Math.hypot(x-o.x,z-o.z)<r+o.r+(o.tactic||world.breakables?.includes(o)?2.5:1.05)))return false;
  if(records.some(p=>Math.hypot(x-p.x,z-p.z)<r+p.footprint+2.05))return false;
  if((world.patches||[]).some(p=>(p.kind==='vent'||p.kind==='ice')&&Math.hypot(x-p.x,z-p.z)<r+(p.r||Math.max(p.rx||0,p.rz||0))+1.5))return false;
  if(crossings.some(b=>bridgeContains(b,x,z,r+1.2)))return false;
  if(shores.some(p=>{const c=Math.cos(p.angle||0),s=Math.sin(p.angle||0),dx=x-p.x,dz=z-p.z;return Math.hypot((c*dx-s*dz)/(p.rx+r*1.42+.55),(s*dx+c*dz)/(p.rz+r*1.42+.55))<1;}))return false;
  if((world.biomePlaces||[]).some(p=>{const c=Math.cos(p.angle),s=Math.sin(p.angle),dx=x-p.x,dz=z-p.z;return Math.abs(c*dx-s*dz)<9.4+r+.35&&Math.abs(s*dx+c*dz)<8.4+r+.35;}))return false;
  return !lines.some(l=>segmentDistance(x,z,l.a.x,l.a.z,l.b.x,l.b.z)<l.width+r);
 };
 for(const scope of scopes){
  const biome=scope.id;if(!BIOMES.includes(biome))continue;
  const start=world.regions?{x:scope.x,z:scope.z}:world.spawn,sites=world.sites.filter(s=>!world.regions||s.biome===biome),paths=sites.map(s=>[start,s]);
  for(const p of world.biomePlaces||[])if(p.biome===biome){paths.push([start,p]);if(p.site)paths.push([p,p.site]);}
  const anchors=existing.filter(o=>!o.place&&!o.tactic&&(!world.regions||scope.contains(o.x,o.z))),places=(world.biomePlaces||[]).map((place,index)=>({place,index})).filter(p=>p.place.biome===biome),shoulders=lines.filter(l=>!world.regions||scope.contains((l.a.x+l.b.x)/2,(l.a.z+l.b.z)/2)),target=world.regions?6:14,placeTarget=world.regions?3:6,placeCounts=new Map();let count=0,placed=0;
  // Spend the same instance budget in open-sided groups: scenery belongs to
  // a place or real trail shoulder, instead of uniformly dotting a broad band.
  // The final passes keep isolated groves and fill unusually obstructed seeds.
  for(let attempt=0;attempt<1800&&count<target;attempt++){
   const variant=count%2,template=clusterTemplate(biome,variant),scale=.88+random()*.13,r=template.footprint*scale;let x,z,angle,composition='grove',anchorIndex;
   if(attempt<600&&places.length){
    if(placed>=placeTarget)continue;
    const entry=places[attempt%places.length],p=entry.place,slot=placeCounts.get(entry.index)||0;if(slot>=3)continue;
    // Stay outside the full authored footprint, with both entrance and exit
    // open. Cargo/strata follow the place axis; natural growth is less regular.
    const side=(Math.sin(p.x*.19+p.z*.13)>0?1:-1)*(attempt<300?1:-1),u=side*(9.4+r+1.3+random()*2.8),v=-5.8+slot*5.8+(random()-.5)*2.2,c=Math.cos(p.angle),s=Math.sin(p.angle);
    x=p.x+c*u+s*v;z=p.z-s*u+c*v;angle=p.angle+(random()-.5)*(biome==='coast'||biome==='sand'?.28:.9);composition='place';anchorIndex=entry.index;
   }else if(attempt<1050&&shoulders.length){
    if(count>=target-2)continue;
    const l=shoulders[attempt%shoulders.length],dx=l.b.x-l.a.x,dz=l.b.z-l.a.z,length=Math.hypot(dx,dz);if(length<.01)continue;
    const t=.15+random()*.70,side=(Math.floor(attempt/shoulders.length)%2?1:-1)*(l.width+r+1.5+random()*2.4);
    x=l.a.x+dx*t-dz/length*side;z=l.a.z+dz*t+dx/length*side;angle=Math.atan2(dx,dz)+(random()-.5)*.8;composition='shoulder';
   }else if(attempt<1500&&anchors.length){
    const o=anchors[Math.floor(random()*anchors.length)],a=random()*Math.PI*2,d=o.r+r+1.1+random()*2.4;x=o.x+Math.sin(a)*d;z=o.z+Math.cos(a)*d;
    if(paths.length&&Math.min(...paths.map(([a,b])=>segmentDistance(x,z,a.x,a.z,b.x,b.z)))>23)continue;
   }else if(paths.length){
    const [a,b]=paths[attempt%paths.length],dx=b.x-a.x,dz=b.z-a.z,length=Math.hypot(dx,dz);if(length<1)continue;
    const t=.13+random()*.78,side=(Math.floor(attempt/paths.length)%2?1:-1)*(6+random()*7);x=a.x+dx*t-dz/length*side;z=a.z+dz*t+dx/length*side;
   }else break;
   if(!safe(x,z,r,scope))continue;
   records.push({x,z,biome,variant,scale,angle:angle??random()*Math.PI*2,footprint:r,height:template.height*scale,composition,...(anchorIndex===undefined?{}:{anchorIndex}),template});count++;
   if(composition==='place'){placed++;placeCounts.set(anchorIndex,(placeCounts.get(anchorIndex)||0)+1);}
  }
 }
 if(!records.length){world.environmentClusters={group:null,records,draws:0,triangles:0};return world.environmentClusters;}
 let draws=0,triangles=0;const transform=new T.Object3D(),color=new T.Color();
 for(const biome of BIOMES)for(const variant of[0,1]){
  const list=records.filter(r=>r.biome===biome&&r.variant===variant);if(!list.length)continue;
  const template=list[0].template;
  for(const [index,part]of template.batches.entries()){
   const batch=new T.InstancedMesh(part.geometry.clone(),part.material,list.length);batch.name='SM_Cluster_'+biome+'_'+variant+'_'+index;batch.castShadow=batch.receiveShadow=true;batch.userData.ownedGeometry=true;
   list.forEach((r,i)=>{transform.position.set(r.x,0,r.z);transform.rotation.set(0,r.angle,0);transform.scale.setScalar(r.scale);transform.updateMatrix();batch.setMatrixAt(i,transform.matrix);batch.setColorAt(i,color.setScalar(.95+.05*Math.sin(r.x*.31+r.z*.19)));});
   batch.computeBoundingSphere();batch.addEventListener('dispose',()=>{batch.visible=false;});group.add(batch);draws++;triangles+=part.geometry.index.count/3*list.length;
  }
 }
 for(const r of records){
  const root=new T.Object3D();root.name='COL_Cluster_'+r.biome;root.position.set(r.x,0,r.z);group.add(root);
  const obstacle={x:r.x,z:r.z,r:r.footprint,height:r.height,sceneryHeight:r.height,mesh:root,biome:r.biome,environmentCluster:true};world.obstacles.push(obstacle);const region=world.regions?.find(s=>s.id===r.biome);if(region&&!region.obstacles.includes(obstacle))region.obstacles.push(obstacle);r.obstacle=obstacle;delete r.template;
 }
 world.group.add(group);world.environmentClusters={group,records,draws,triangles};return world.environmentClusters;
}
