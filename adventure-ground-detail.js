import * as T from './vendor/three.module.js';
import {mergeGeometries} from './vendor/BufferGeometryUtils.js';
import {seeded,segmentDistance} from './rules.js?v=125';
import {bridgeContains} from './coast.js?v=114';
import {naturalRockGeometry} from './biome-scenery.js?v=131';

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
 shader.vertexShader='uniform float groundWindTime; attribute float groundFlex; varying float groundLeaf;\n'+shader.vertexShader;
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
  groundLeaf=clamp(groundFlex,0.0,1.0);
 `);
 shader.fragmentShader='varying float groundLeaf;\n'+shader.fragmentShader;
 shader.fragmentShader=shader.fragmentShader.replace('#include <lights_fragment_end>',`#include <lights_fragment_end>
  #if NUM_DIR_LIGHTS > 0
   // Thin leaves transmit sunlight; rocks and litter (zero flex) stay opaque.
   float leafBacklight=pow(max(0.0,dot(-normal,directionalLights[0].direction)),2.0);
   reflectedLight.indirectDiffuse+=diffuseColor.rgb*directionalLights[0].color*vec3(.10,.14,.055)*leafBacklight*groundLeaf;
  #endif
 `);
};
material.customProgramCacheKey=()=> 'adventure-ground-wind';
export function animateAdventureGroundDetail(time){if(Number.isFinite(time))windTime.value=time;}
const near=(x,z,p,r)=>(x-p.x)**2+(z-p.z)**2<r*r;

function tuftGeometry(){
 const positions=[],colors=[],indices=[];
 const vertex=(x,y,z,shade)=>{const index=positions.length/3;positions.push(x,y,z);colors.push(shade*.98,shade,shade*.87);return index;};
 // Four arching ribbon leaves have separate tapered tips, so all 20 triangles contribute.
 // The lower leaves curl back down instead of forming the same straight spike silhouette.
 for(let blade=0;blade<4;blade++){
  const angle=blade*2.399+.18*Math.sin(blade*1.8),s=Math.sin(angle),c=Math.cos(angle),height=[.22,.28,.18,.25][blade],reach=[.19,.15,.27,.23][blade],base=.024+blade*.008,start=positions.length/3;
  for(const [row,t]of[0,.38,.72].entries()){
   const bend=base+reach*t*t,width=[.007,.026,.015][row]*(1+blade*.10),fold=Math.sin(t*Math.PI)*.009;
   for(const side of[-1,1])vertex(s*bend+c*width*side,-.035+Math.sin(t*Math.PI*.78)*height+side*fold,c*bend-s*width*side,.56+t*.40+side*.025);
   if(row<2){const n=start+row*2;indices.push(n,n+1,n+2,n+1,n+3,n+2);}
  }
  const tip=vertex(s*(base+reach),-.035+Math.sin(Math.PI*.78)*height,c*(base+reach),.91);indices.push(start+4,start+5,tip);
 }
 // One low feathered frond adds paired leaflets and real gaps, with no alpha cards or texture.
 const angle=1.35,s=Math.sin(angle),c=Math.cos(angle),point=(t,side,lift,shade)=>{
  const reach=.035+t*.29,arch=t<.5?t*.30:.15-(t-.5)*.11;
  return vertex(s*reach+c*side,-.035+arch+lift,c*reach-s*side,shade);
 };
 const stem=positions.length/3;point(0,-.004,0,.53);point(0,.004,0,.57);point(.5,-.003,0,.74);point(.5,.003,0,.77);point(1,0,0,.90);indices.push(stem,stem+1,stem+2,stem+1,stem+3,stem+2,stem+2,stem+3,stem+4);
 for(let pair=0;pair<3;pair++)for(const side of[-1,1]){
  const t=.15+pair*.22,width=(.080-pair*.017)*side,a=point(t,0,0,.61+pair*.08),b=point(t+.11,width*.47,.012,.76+pair*.055),tip=point(t+.22,width,-.009,.83+pair*.04),d=point(t+.18,width*.37,-.009,.66+pair*.075);
  indices.push(a,b,tip,a,tip,d);
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

function placementFilter(world,footprint=FOOTPRINT,shoulder=false){
 const FOOTPRINT=footprint;
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
   const a=route.points[i-1],b=route.points[i],width=shoulder?(route.width===5.8?4.2:1.65):route.width;if(segmentDistance(x,z,a.x,a.z,b.x,b.z)<width+FOOTPRINT)return false;
  }
  return true;
 };
}

export function installAdventureGroundDetail(world,mapId){
 if(!profiles[mapId]&&mapId!=='confluence')return null;
 if(world.adventureGroundDetail&&!world.adventureGroundDetail.userData.disposed)return world.adventureGroundDetail;
 const limit=mapId==='confluence'?2200:profiles[mapId].count,random=seeded(layoutSeed(world,mapId)),allowed=placementFilter(world),records=[];
 const anchors=(world.obstacles||[]).filter(o=>!o.tactic),half=(world.half||96)-4;
 // Reassign part of the existing budget to irregular road shoulders. The worn
 // center stays open; ankle-high plants soften the former eight-metre bare strip.
 const shoulderAllowed=placementFilter(world,FOOTPRINT,true),routes=routesFor(world);
 for(let attempt=0;routes.length&&attempt<limit*3&&records.length<limit*.22;attempt++){
  const route=routes[Math.floor(random()*routes.length)];if(route.points.length<2)continue;
  const i=1+Math.floor(random()*(route.points.length-1)),a=route.points[i-1],b=route.points[i],t=random(),dx=b.x-a.x,dz=b.z-a.z,length=Math.hypot(dx,dz)||1;
  const side=(random()<.5?-1:1)*((route.width===5.8?4.85:2.3)+random()*1.3),x=a.x+dx*t-dz/length*side,z=a.z+dz*t+dx/length*side;
  if(!shoulderAllowed(x,z)||records.some(p=>near(x,z,p,.9)))continue;
  const biome=mapId==='confluence'?(world.regions||[]).find(r=>r.contains(x,z))?.id:mapId,profile=profiles[biome];if(!profile)continue;
  const kind=random()<profile.grass?'tuft':'litter';
  records.push({x,z,biome,kind,shoulder:true,size:.78+random()*.3,height:kind==='tuft'?profile.height*(.55+random()*.3):.8,angle:random()*Math.PI*2,color:profile[kind][Math.floor(random()*2)],shade:.94+random()*.12});
 }
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

// A separate mid-height layer: clustered growth follows shelter and banks, not a grid.
// All solid scree stays ankle-high. Soft foliage bends and remains below the sight line.
const habitatProfiles={
 forest:{kind:'fern',color:[0x5e7945,0x78904e,0x939a60],height:1,width:1},
 snow:{kind:'stone',color:[0xb3c4c6,0x7a929a,0xd3dedd],height:.15,width:.65},
 ash:{kind:'stone',color:[0x484247,0x65534b,0x817066],height:.17,width:.74},
 sand:{kind:'reed',color:[0xa19063,0x88784f,0xb3a175],height:.65,width:.75},
 coast:{kind:'reed',color:[0x567460,0x789071,0x8c986e],height:1.0,width:.9}
};
function fernGeometry(){
 const p=[],c=[],ix=[],flex=[];
 const vertex=(x,y,z,shade)=>{const n=p.length/3;p.push(x,y,z);c.push(shade*.94,shade,shade*.80);flex.push(Math.max(0,y/.65)**2);return n;};
 for(let frond=0;frond<6;frond++){
  const a=frond*2.399,s=Math.sin(a),co=Math.cos(a),reach=.55+(frond%3)*.075,h=.38+(frond%2)*.20;
  const point=(t,side,shade)=>vertex(s*t*reach+co*side,Math.sin(t*Math.PI*.76)*h-.025,co*t*reach-s*side,shade);
  const base=point(0,0,.46),left=point(.6,-.012,.74),tip=point(1,0,.9),right=point(.6,.012,.80);ix.push(base,left,tip,base,tip,right);
  for(let pair=0;pair<4;pair++)for(const side of[-1,1]){
   const t=.18+pair*.18,w=(.13-pair*.025)*side,n=point(t,0,.53+pair*.05),b=point(t+.07,w*.5,.81),end=point(t+.19,w,.92),d=point(t+.13,w*.34,.65);ix.push(n,b,end,n,end,d);
  }
 }
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setAttribute('color',new T.Float32BufferAttribute(c,3));g.setAttribute('groundFlex',new T.Float32BufferAttribute(flex,1));g.setIndex(ix);g.computeVertexNormals();return g;
}
function reedGeometry(){
 const p=[],c=[],ix=[],flex=[];
 for(let blade=0;blade<7;blade++){
  const a=blade*2.399,s=Math.sin(a),z=Math.cos(a),height=.40+(blade%3)*.095,reach=.16+(blade%2)*.12,start=p.length/3;
  for(let row=0;row<4;row++){
   const t=row/3,w=Math.sin(Math.PI*t)*.024+.002,bend=reach*t*t;
   for(const side of[-1,1]){p.push(s*bend+z*w*side,height*t,z*bend-s*w*side);const shade=.55+t*.42;c.push(shade*.98,shade,shade*.84);flex.push(t*t);}
   if(row<3){const n=start+row*2;ix.push(n,n+1,n+2,n+1,n+3,n+2);}
  }
 }
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setAttribute('color',new T.Float32BufferAttribute(c,3));g.setAttribute('groundFlex',new T.Float32BufferAttribute(flex,1));g.setIndex(ix);g.computeVertexNormals();return g;
}
export function installHabitatDetail(world,mapId){
 if(!habitatProfiles[mapId]&&mapId!=='confluence')return null;
 if(world.habitatDetail&&!world.habitatDetail.userData.disposed)return world.habitatDetail;
 const random=seeded(layoutSeed(world,mapId)^0x71af029),allowed=placementFilter(world,1.15),half=(world.half||96)-5;
 const anchors=(world.obstacles||[]).filter(o=>!o.tactic),ponds=world.ponds||[],records=[],centers=[],limit=mapId==='confluence'?500:300;
 for(let attempt=0;attempt<limit*12&&centers.length<limit;attempt++){
  let x,z;
  // Near-camp shoulders receive cover too; paths and the camp itself remain clear.
  if(attempt%6===0){const a=random()*Math.PI*2,r=6+random()*19;x=world.spawn.x+Math.sin(a)*r;z=world.spawn.z+Math.cos(a)*r;}
  else if(ponds.length&&attempt%3===0){const p=ponds[Math.floor(random()*ponds.length)],a=random()*Math.PI*2,tide=p.baseRx===undefined?1:1.19,rx=(p.baseRx??p.rx)*tide*1.12+2.8,rz=(p.baseRz??p.rz)*tide*1.12+2.8,u=Math.sin(a)*rx,v=Math.cos(a)*rz,turn=p.angle||0;x=p.x+Math.cos(turn)*u+Math.sin(turn)*v;z=p.z-Math.sin(turn)*u+Math.cos(turn)*v;}
  else if(anchors.length&&attempt%5!==0){const o=anchors[Math.floor(random()*anchors.length)],a=random()*Math.PI*2,r=(o.r||.7)+2+random()*4;x=o.x+Math.sin(a)*r;z=o.z+Math.cos(a)*r;}
  else{x=(random()-.5)*half*2;z=(random()-.5)*half*2;}
  if(!allowed(x,z)||centers.some(p=>near(x,z,p,3.2)))continue;
  const biome=mapId==='confluence'?(world.regions||[]).find(r=>r.contains(x,z))?.id:mapId,profile=habitatProfiles[biome];if(!profile)continue;
  centers.push({x,z,biome});const angle=biome==='sand'?-.7:random()*Math.PI*2;
  // Uneven crescent patches have dense centers, tapered ends, and bare intervals.
  const count=profile.kind==='reed'?7:profile.kind==='fern'?4:3,mid=(count-1)/2;
  for(let j=0;j<count;j++){
   const along=(j-mid)*.63,across=Math.sin(j*.9)*.65+(random()-.5)*.7,px=x+Math.sin(angle)*along+Math.cos(angle)*across,pz=z+Math.cos(angle)*along-Math.sin(angle)*across;
   if(!allowed(px,pz))continue;
   if(mapId==='confluence'&&!(world.regions||[]).find(r=>r.id===biome)?.contains(px,pz))continue;
   const size=(.70+random()*.30)*(1-Math.abs(j-mid)*.10);
   records.push({x:px,z:pz,biome,kind:profile.kind,angle:angle+(random()-.5)*1.2,width:profile.width*size,height:profile.height*size,color:profile.color[j%3]});
  }
 }
 const group=new T.Group();group.name='habitat-detail';group.userData={records,centers,disposed:false};
 const dummy=new T.Object3D(),color=new T.Color();
 // Four quadrants permit frustum culling while bounding the complete layer to 12 draws.
 for(const kind of['fern','reed','stone'])for(let quadrant=0;quadrant<4;quadrant++){
  const list=records.filter(p=>p.kind===kind&&(Number(p.x>=0)+Number(p.z>=0)*2)===quadrant);if(!list.length)continue;
  const geometry=kind==='fern'?fernGeometry():kind==='reed'?reedGeometry():naturalRockGeometry.clone();
  if(kind==='stone')geometry.setAttribute('groundFlex',new T.Float32BufferAttribute(new Float32Array(geometry.attributes.position.count),1));
  geometry.computeBoundingBox();const batch=new T.InstancedMesh(geometry,material,list.length);batch.name='habitat-'+kind;batch.receiveShadow=true;batch.userData.ownedGeometry=true;
  list.forEach((p,i)=>{dummy.position.set(p.x,kind==='stone'?-.055:-.042-geometry.boundingBox.min.y*p.height,p.z);dummy.scale.set(p.width,p.height,p.width);dummy.rotation.set(0,p.angle,0);dummy.updateMatrix();batch.setMatrixAt(i,dummy.matrix);batch.setColorAt(i,color.set(p.color));});
  batch.computeBoundingSphere();batch.addEventListener('dispose',()=>{batch.visible=false;group.userData.disposed=true;});group.add(batch);
 }
 world.group.add(group);world.habitatDetail=group;return group;
}
