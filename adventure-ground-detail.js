import * as T from './vendor/three.module.js';
import {mergeGeometries} from './vendor/BufferGeometryUtils.js';
import {seeded,segmentDistance} from './rules.js?v=114';
import {bridgeContains} from './coast.js?v=114';

const profiles={
 forest:{count:1200,grass:.83,height:1,tuft:[0x566d48,0x829360],litter:[0x827561,0x66685c]},
 snow:{count:420,grass:.24,height:.62,tuft:[0x7b8275,0x9aa9a5],litter:[0x9cafb5,0x72858b]},
 ash:{count:380,grass:.16,height:.55,tuft:[0x51494a,0x675a50],litter:[0x595455,0x7d7067]},
 sand:{count:520,grass:.32,height:.76,tuft:[0x92815d,0xb19c73],litter:[0x9d886b,0xb9a786]},
 coast:{count:920,grass:.70,height:.90,tuft:[0x63765c,0x849270],litter:[0x8b9588,0xb3ab93]}
};
const FOOTPRINT=.55;
// One bounded shared material survives world rebuilds. Each batch owns its geometry.
const material=new T.MeshStandardMaterial({vertexColors:true,roughness:1,side:T.DoubleSide});
const windTime={value:0};
material.onBeforeCompile=shader=>{
 shader.uniforms.groundWindTime=windTime;
 shader.vertexShader='uniform float groundWindTime; attribute float groundFlex;\n'+shader.vertexShader;
 shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
  vec4 grassPoint=vec4(position,1.0);
  #ifdef USE_INSTANCING
   grassPoint=instanceMatrix*grassPoint;
  #endif
  float grassWave=sin(groundWindTime*1.35+grassPoint.x*.7+grassPoint.z*.45)*.7+sin(groundWindTime*2.1+grassPoint.z*1.2)*.3;
  // Only blade tips move. Stones/twigs carry zero flexibility, and roots stay buried.
  vec3 grassBend=vec3(-.644,0.,.765)*grassWave*groundFlex*.035;
  #ifdef USE_INSTANCING
   mat3 grassBasis=mat3(modelMatrix*instanceMatrix);
   grassBend=vec3(dot(grassBend,grassBasis[0])/dot(grassBasis[0],grassBasis[0]),dot(grassBend,grassBasis[1])/dot(grassBasis[1],grassBasis[1]),dot(grassBend,grassBasis[2])/dot(grassBasis[2],grassBasis[2]));
  #endif
  transformed+=grassBend;
 `);
};
material.customProgramCacheKey=()=> 'adventure-ground-wind';
export function animateAdventureGroundDetail(time){if(Number.isFinite(time))windTime.value=time;}
const near=(x,z,p,r)=>(x-p.x)**2+(z-p.z)**2<r*r;

function tuftGeometry(){
 const positions=[],colors=[],indices=[];
 // Unequal blades open out from a low crown, rather than five identical upright spikes.
 // Seven curved blades use 28 triangles: fewer than the former five-blade mesh.
 for(let blade=0;blade<7;blade++){
  const angle=blade*2.399+.18*Math.sin(blade*1.8),s=Math.sin(angle),c=Math.cos(angle),height=.19+(.5+.5*Math.sin(blade*1.93))*.085,start=positions.length/3,reach=.12+(.5+.5*Math.cos(blade*2.7))*.10;
  for(let row=0;row<=2;row++){
   const t=row/2,bend=reach*t*t,wide=(.018+blade%3*.005)*(1-t),shade=.57+t*.39+Math.sin(blade*2.1)*.035,base=.024+blade%3*.018;
   for(const side of[-1,1]){positions.push(s*(base+bend)+c*wide*side,-.035+Math.sin(t*Math.PI*.66)*height,c*(base+bend)-s*wide*side);colors.push(shade*.98,shade,shade*.87);}
   if(row<2){const n=start+row*2;indices.push(n,n+1,n+2,n+1,n+3,n+2);}
  }
 }
 const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));geometry.setAttribute('color',new T.Float32BufferAttribute(colors,3));geometry.setAttribute('groundFlex',new T.Float32BufferAttribute(positions.filter((v,i)=>i%3===1).map(y=>Math.max(0,(y+.035)/.29)**2),1));geometry.setIndex(indices);geometry.computeVertexNormals();return geometry;
}

function litterGeometry(){
 const pieces=[],matrix=new T.Matrix4();
 const add=(geometry,position,scale,rotation,color)=>{
  if(geometry.index){const flat=geometry.toNonIndexed();geometry.dispose();geometry=flat;}
  matrix.compose(new T.Vector3(...position),new T.Quaternion().setFromEuler(new T.Euler(...rotation)),new T.Vector3(...scale));geometry.applyMatrix4(matrix);geometry.deleteAttribute('uv');
  const tint=new T.Color(color),colors=[];for(let i=0;i<geometry.attributes.position.count;i++)colors.push(tint.r,tint.g,tint.b);
  geometry.setAttribute('color',new T.Float32BufferAttribute(colors,3));pieces.push(geometry);
 };
 for(const [i,[x,z]]of[[-.19,.04],[.16,-.14],[.02,.19]].entries())add(new T.OctahedronGeometry(1,0),[x,.006,z],[.13-i*.015,.044+i*.009,.105+i*.012],[0,i*1.2,.06],i===1?0xdbdedb:0xf0efeb);
 add(new T.CylinderGeometry(.009,.016,.48,3),[-.04,-.025,-.025],[1,1,1],[Math.PI/2,.65,0],0x76654e);
 add(new T.CylinderGeometry(.006,.011,.21,3),[.065,-.025,.025],[1,1,1],[Math.PI/2,-.55,0],0x8c795c);
 const geometry=mergeGeometries(pieces);for(const piece of pieces)piece.dispose();geometry.setAttribute('groundFlex',new T.Float32BufferAttribute(new Float32Array(geometry.attributes.position.count),1));return geometry;
}

function layoutSeed(world,mapId){
 if(Number.isFinite(world.seed))return world.seed>>>0;
 // buildWorld currently omits its seed. Its seeded coordinates provide the same
 // stable identity without consuming its random stream or depending on UUIDs.
 let hash=2166136261;const mix=n=>{hash=Math.imul(hash^(n|0),16777619)>>>0;};
 for(const letter of mapId)mix(letter.charCodeAt(0));
 for(const point of[world.spawn,...(world.sites||[]),...(world.obstacles||[])])if(point){mix(Math.round(point.x*1000));mix(Math.round(point.z*1000));}
 return hash;
}

function routesFor(world){
 const routes=world.road?[{points:world.road,width:5.8}]:[];
 for(const site of world.sites||[]){
  const p=site.trail?.geometry?.attributes.position;if(!p)continue;
  const points=[];for(let i=0;i+3<p.count;i+=4)points.push({x:(p.getX(i+1)+p.getX(i+2))*.5,z:(p.getZ(i+1)+p.getZ(i+2))*.5});
  routes.push({points,width:3.6});
 }
 return routes;
}

function placementFilter(world){
 const regions=world.regions||[],routes=routesFor(world),districts=[...(world.districts||[]),...regions.flatMap(r=>r.districts||[])];
 const clearings=[{...world.spawn,r:4},...regions.map(r=>({x:r.x,z:r.z,r:6})),
  ...(world.sites||[]).flatMap(s=>[{x:s.x,z:s.z,r:s.event?7:5.5},...(s.nodes||[]).map(n=>({...n,r:2}))]),
  ...(world.discoveries||[]).map(p=>({...p,r:3})),...(world.roaming||[]).map(p=>({...p,r:p.kind==='camp'?6:3})),
  ...districts.map(d=>({...d,r:['gate','court'].includes(d.kind)?10:7}))];
 // The actual shore is irregular; its maximum radial ripple is <1.12. Reserve
 // high-tide footprints even if installed during low tide, plus a dry bank margin.
 const shores=(world.ponds||[]).map(p=>{const k=p.baseRx===undefined?1:1.19;return{...p,rx:(p.baseRx??p.rx)*k*1.12+.9,rz:(p.baseRz??p.rz)*k*1.12+.9};});
 const crossings=[...(world.bridges||[]),...(world.fords||[]).map(f=>({...f,width:f.half*2,length:f.width}))];
 return(x,z)=>{
  if(Math.abs(x)>(world.half||96)-2-FOOTPRINT||Math.abs(z)>(world.half||96)-2-FOOTPRINT)return false;
  if(clearings.some(p=>near(x,z,p,p.r+FOOTPRINT)))return false;
  if((world.obstacles||[]).some(o=>near(x,z,o,(o.r||0)+FOOTPRINT+.2)))return false;
  if((world.patches||[]).some(p=>p.kind==='vent'&&near(x,z,p,p.r+1+FOOTPRINT)||p.kind==='ice'&&near(x,z,p,p.r*1.2+FOOTPRINT)))return false;
  if(crossings.some(b=>bridgeContains(b,x,z,FOOTPRINT+.8)))return false;
  if(shores.some(p=>{const a=p.angle||0,c=Math.cos(a),s=Math.sin(a),dx=x-p.x,dz=z-p.z;return Math.hypot((c*dx-s*dz)/p.rx,(s*dx+c*dz)/p.rz)<1;}))return false;
  for(const route of routes)for(let i=1;i<route.points.length;i++){
   const a=route.points[i-1],b=route.points[i];if(segmentDistance(x,z,a.x,a.z,b.x,b.z)<route.width+FOOTPRINT)return false;
  }
  return true;
 };
}

export function installAdventureGroundDetail(world,mapId){
 if(!profiles[mapId]&&mapId!=='confluence')return null;
 if(world.adventureGroundDetail&&!world.adventureGroundDetail.userData.disposed)return world.adventureGroundDetail;
 const limit=mapId==='confluence'?2200:profiles[mapId].count,random=seeded(layoutSeed(world,mapId)),allowed=placementFilter(world),records=[];
 const anchors=(world.obstacles||[]).filter(o=>!o.tactic),half=(world.half||96)-4;
 for(let attempt=0;attempt<limit*20&&records.length<limit;attempt++){
  let x,z;
  if(attempt%5===0){const angle=random()*Math.PI*2,r=4.8+Math.sqrt(random())*15;x=world.spawn.x+Math.sin(angle)*r;z=world.spawn.z+Math.cos(angle)*r;}
  else if(anchors.length&&attempt%4!==0){const anchor=anchors[Math.floor(random()*anchors.length)],angle=random()*Math.PI*2,r=(anchor.r||.7)+1+Math.sqrt(random())*3.6;x=anchor.x+Math.sin(angle)*r;z=anchor.z+Math.cos(angle)*r;}
  else{x=(random()-.5)*half*2;z=(random()-.5)*half*2;}
  if(!allowed(x,z)||records.some(p=>near(x,z,p,.9)))continue;
  const biome=mapId==='confluence'?(world.regions||[]).find(r=>r.contains(x,z))?.id:mapId,profile=profiles[biome];if(!profile)continue;
  const kind=random()<profile.grass?'tuft':'litter',size=.78+random()*.36,height=(.82+random()*.30)*(kind==='tuft'?profile.height:1),palette=profile[kind];
  records.push({x,z,biome,kind,size,height,angle:random()*Math.PI*2,color:palette[Math.floor(random()*palette.length)],shade:.90+random()*.16});
 }
 if(!records.length)return null;
 const group=new T.Group();group.name='adventure-ground-detail';group.userData.records=records;group.userData.disposed=false;
 const matrix=new T.Matrix4(),position=new T.Vector3(),scale=new T.Vector3(),rotation=new T.Quaternion(),up=new T.Vector3(0,1,0),color=new T.Color();
 for(const kind of['tuft','litter']){
  const instances=records.filter(p=>p.kind===kind);if(!instances.length)continue;
  const geometry=kind==='tuft'?tuftGeometry():litterGeometry(),batch=new T.InstancedMesh(geometry,material,instances.length);batch.name='adventure-ground-'+kind;
  geometry.computeBoundingBox();
  batch.userData.ownedGeometry=true;batch.receiveShadow=true;batch.castShadow=false;
  for(const [i,p]of instances.entries()){
   matrix.compose(position.set(p.x,-.042-geometry.boundingBox.min.y*p.height,p.z),rotation.setFromAxisAngle(up,p.angle),scale.set(p.size,p.height,p.size));batch.setMatrixAt(i,matrix);batch.setColorAt(i,color.set(p.color).multiplyScalar(p.shade));
  }
  batch.instanceMatrix.needsUpdate=true;batch.instanceColor.needsUpdate=true;batch.computeBoundingSphere();
  batch.addEventListener('dispose',()=>{batch.visible=false;group.userData.disposed=true;});group.add(batch);
 }
 // Existing world cleanup calls InstancedMesh.dispose and disposes ownedGeometry.
 // Moving drops can land anywhere; all detail stays below .30m, below their glow.
 world.group.add(group);world.adventureGroundDetail=group;return group;
}
