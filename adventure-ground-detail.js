import{sceneryRhythmAt}from'./exploration-composition.js?v=144';
import * as T from './vendor/three.module.js';
import {mergeGeometries} from './vendor/BufferGeometryUtils.js';
import {seeded,segmentDistance} from './rules.js?v=125';
import {forestHabitatAt} from './forest-habitats.js?v=139';
import {bridgeContains} from './coast.js?v=114';
import {naturalRockGeometry} from './biome-scenery.js?v=143';

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
export const groundWindTime={value:0};
const windTime=groundWindTime;
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

function dryTuftGeometry(biome){
 const positions=[],colors=[],indices=[],flex=[];
 const count=biome==='sand'?5:4;
 for(let blade=0;blade<count;blade++){
  const a=blade*2.399,s=Math.sin(a),c=Math.cos(a),start=positions.length/3;
  const height=biome==='snow'?.19+blade*.022:biome==='ash'?.13+blade*.026:biome==='sand'?.18+blade*.019:.23+blade*.016;
  const reach=biome==='snow'?.12:biome==='ash'?.15:biome==='sand'?.25:.17;
  for(let row=0;row<4;row++){
   const t=row/3,bend=reach*t*t,width=(biome==='ash'?.014:biome==='snow'?.008:biome==='sand'?.012:.022)*(row===3?.07:row===0?.38:1);
   const y=-.035+height*t-(biome==='snow'?.09:biome==='ash'?0:biome==='sand'?.075:.045)*t*t*t;
   for(const side of[-1,1]){
    positions.push(s*bend+c*width*side,y+width*side*.25,c*bend-s*width*side);
    const shade=.57+t*.34;colors.push(shade,shade,shade*(biome==='coast'?.87:1));flex.push(biome==='ash'?0:t*t*(biome==='snow'?.4:.85));
   }
   if(row<3){const n=start+row*2;indices.push(n,n+1,n+2,n+1,n+3,n+2);}
  }
  if(biome==='ash'){
   // A brittle fork, not another green leaf recolored black.
   const n=positions.length/3,t=.54,b=reach*t*t,y=-.035+height*t;
   positions.push(s*b-c*.008,y,c*b+s*.008,s*b+c*.008,y,c*b-s*.008,s*b+c*.065,y+.055,c*b-s*.065);
   for(let j=0;j<3;j++){colors.push(.69,.66,.65);flex.push(0);}indices.push(n,n+1,n+2);
  }
 }
 const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));geometry.setAttribute('color',new T.Float32BufferAttribute(colors,3));geometry.setAttribute('groundFlex',new T.Float32BufferAttribute(flex,1));geometry.setIndex(indices);geometry.computeVertexNormals();return geometry;
}
function tuftGeometry(biome='forest'){
 if(biome!=='forest')return dryTuftGeometry(biome);
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

// Shallow, irregular broken plates share a buried underside. Their inset tops
// are offset instead of ending at a gemstone point or four square corners.
function groundShardGeometry(snow,variant){
 const outline=snow?[[-.96,-.44],[-.20,-.90],[.83,-.51],[.66,.78],[-.61,.63]]:[[-.98,-.23],[-.62,-.78],[.24,-.91],[.89,-.41],[.76,.39],[.20,.78],[-.70,.66]],p=[],ix=[],n=outline.length;
 for(let row=0;row<2;row++)for(let i=0;i<n;i++){
  const [x,z]=outline[i],wear=1+Math.sin(i*2.3+variant*1.8)*.09,k=row===1?.68:1;
  p.push(x*wear*k+(row===1?.10*Math.sin(variant+1):0),row===0?0:((snow?.039:.057)+Math.sin(i*1.8+variant)*.008),z*wear*k+(row===1?-.09:0));
  if(row===0){const a=i,b=(i+1)%n;ix.push(a,a+n,b,b,a+n,b+n);}
 }
 for(let i=1;i<n-1;i++)ix.push(n,n+i+1,n+i);
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setIndex(ix);g.computeVertexNormals();return g;
}

function litterGeometry(biome){
 const forest=biome==='forest',pieces=[],matrix=new T.Matrix4();
 const add=(geometry,position,scale,rotation,color)=>{
  if(geometry.index){const flat=geometry.toNonIndexed();geometry.dispose();geometry=flat;}
  matrix.compose(new T.Vector3(...position),new T.Quaternion().setFromEuler(new T.Euler(...rotation)),new T.Vector3(...scale));geometry.applyMatrix4(matrix);geometry.deleteAttribute('uv');
  const tint=new T.Color(color),colors=[];for(let i=0;i<geometry.attributes.position.count;i++)colors.push(tint.r,tint.g,tint.b);
  geometry.setAttribute('color',new T.Float32BufferAttribute(colors,3));pieces.push(geometry);
 };
 if(forest){
  // Folded, curled leaves and one tiny fungus growing beside fallen wood share
  // the existing sparse litter patches; no extra plants, textures or draws.
  for(const [i,[x,z,angle]]of[[-.17,-.16,-.7],[.12,-.14,1.2],[-.13,.16,2.7]].entries()){
   const leaf=new T.BufferGeometry();
   leaf.setAttribute('position',new T.Float32BufferAttribute([0,.016,0,-.055,.022,.06,0,.050,.075,.044,.016,.08,-.050,.038,.15,0,.064,.15,.055,.029,.15,.02,.080,.24],3));
   leaf.setIndex([0,1,2,0,2,3,1,4,2,2,4,5,2,5,3,3,5,6,4,7,5,5,7,6]);leaf.computeVertexNormals();
   add(leaf,[x,-.026,z],[1-i*.10,1,1-i*.10],[0,angle,0],[0xe7d0aa,0xbba486,0xd4c198][i]);
  }
  add(new T.CylinderGeometry(.010,.014,.07,4,1,true),[.06,.016,.055],[1,1,1],[0,0,-.15],0xd2c8b5);
  add(new T.SphereGeometry(1,6,2,0,Math.PI*2,0,Math.PI/2),[.064,.046,.055],[.060,.028,.050],[.09,.5,-.12],0xc7b28c);
 }else if(biome==='snow'){
  for(const [i,[x,z]]of[[-.16,.04],[.14,-.13],[.04,.18]].entries())add(groundShardGeometry(true,i),[x,0,z],[.14-i*.018,1,.11],[0,i*1.3,0],i===1?0xabc0c8:0xd4e1e1); }else if(biome==='ash'){
  for(const [i,[x,z]]of[[-.18,-.04],[.16,-.1],[.05,.19]].entries())add(new T.TetrahedronGeometry(1),[x,-.005,z],[.14,.064,.11],[.1,i*1.7,.2],i===1?0x877d76:0x514c4d);
 }else if(biome==='sand'){
  for(const [i,[x,z]]of[[-.19,-.04],[.14,-.13],[.03,.17]].entries())add(groundShardGeometry(false,i),[x,0,z],[.12-i*.016,1,.105+i*.009],[0,i*1.6,0],i===1?0xd9c7a8:0xbba98d); }else if(biome==='coast'){
  add(new T.CylinderGeometry(.019,.029,.42,5),[-.035,.006,-.03],[1,1,1],[Math.PI/2,.65,.035],0x8d8779);
  for(const [i,[x,z]]of[[.16,-.13],[-.13,.17]].entries()){
   const shell=new T.BufferGeometry(),p=[0,.023,0],ix=[];
   for(let j=0;j<=6;j++){const a=-Math.PI*.75+j*Math.PI*1.5/6;p.push(Math.sin(a)*.076,.006+(j%2)*.003,Math.cos(a)*.095);if(j<6)ix.push(0,j+1,j+2);}
   shell.setAttribute('position',new T.Float32BufferAttribute(p,3));shell.setIndex(ix);shell.computeVertexNormals();add(shell,[x,-.014,z],[1,1,1],[0,i*1.7,0],i?0xf0e4cd:0xc5cfcc);
  }
 }
 if(forest||biome==='ash'){
  add(new T.CylinderGeometry(.009,.016,.48,3,1,forest),[-.04,-.025,-.025],[1,1,1],[Math.PI/2,.65,0],forest?0x76654e:0x4c4543);
  add(new T.CylinderGeometry(.006,.011,.21,3,1,forest),[.065,-.025,.025],[1,1,1],[Math.PI/2,-.55,0],forest?0x8c795c:0x746860);
 }
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
 return(x,z,obstacles=world.obstacles||[])=>{
  if(Math.abs(x)>(world.half||96)-2-FOOTPRINT||Math.abs(z)>(world.half||96)-2-FOOTPRINT)return false;
  if(clearings.some(p=>near(x,z,p,p.r+FOOTPRINT)))return false;
  if(obstacles.some(o=>near(x,z,o,(o.r||0)+FOOTPRINT+.2)))return false;
  if((world.patches||[]).some(p=>p.kind==='vent'&&near(x,z,p,p.r+1+FOOTPRINT)||p.kind==='ice'&&near(x,z,p,p.r*1.2+FOOTPRINT)))return false;
  if(crossings.some(b=>bridgeContains(b,x,z,FOOTPRINT+.8)))return false;
  if(shores.some(p=>{const a=p.angle||0,c=Math.cos(a),s=Math.sin(a),dx=x-p.x,dz=z-p.z;return Math.hypot((c*dx-s*dz)/p.rx,(s*dx+c*dz)/p.rz)<1;}))return false;
  for(const route of routes)for(let i=1;i<route.points.length;i++){
   const a=route.points[i-1],b=route.points[i],width=shoulder?(route.width===5.8?4.2:1.65):route.width;if(segmentDistance(x,z,a.x,a.z,b.x,b.z)<width+FOOTPRINT)return false;
  }
  return true;
 };
}

// Replant a bounded part of the existing cover beside substantial scenery.
// Separate randomness leaves the original sampling, kinds and draw counts intact.
function softenSceneryEdges(world,mapId,records,footprint,allowed){
 const places=world.biomePlaces||[],sources=[
  ...(world.environmentClusters?.records||[]).map((p,index)=>({...p,edge:'cluster',index,weight:1,solids:[{x:p.x,z:p.z,r:p.footprint}]})),
  ...places.map((p,index)=>({...p,edge:'place',index,weight:3}))
 ].filter(p=>p.solids?.length);
 if(!sources.length)return;
 const random=seeded(layoutSeed(world,mapId)^(footprint===FOOTPRINT?0x2ce459:0x7ab913)),budget=Math.floor(records.length*.22),weight=sources.reduce((n,p)=>n+p.weight,0),donors=new Map();
 const quadrant=p=>Number(p.x>=0)+Number(p.z>=0)*2,key=p=>p.biome+':'+quadrant(p);
 // Keep road shoulders, near-spawn cover, and existing scenery-edge growth.
 // Keeping each donor's quadrant also preserves the habitat's culling batches.
 for(let i=0;i<records.length;i++){
  const p=records[i];if(p.shoulder||p.biome==='forest'&&['reed','stone'].includes(p.kind)||near(p.x,p.z,world.spawn,20)||sources.some(s=>near(p.x,p.z,s,s.edge==='place'?17:s.footprint+5)))continue;
  const k=key(p);if(!donors.has(k))donors.set(k,[]);donors.get(k).push(i);
 }
 const lanes=[];
 for(const route of world.explorationRoutes||[])for(let i=1;i<route.points.length;i++){
  const a=route.points[i-1],b=route.points[i],r=2+footprint;
  lanes.push({a,b,r,minX:Math.min(a.x,b.x)-r,maxX:Math.max(a.x,b.x)+r,minZ:Math.min(a.z,b.z)-r,maxZ:Math.max(a.z,b.z)+r});
 }
 const passages=places.map(p=>({...p,c:Math.cos(p.angle||0),s:Math.sin(p.angle||0)}));
 let moved=0;
 for(const source of sources){
  const quota=Math.floor(budget*source.weight/weight),region=world.regions?.find(r=>r.id===source.biome),axis=(source.angle||0)+Math.sin(source.x*.27+source.z*.19)*.7;
  // Every candidate lies inside these fixed bounds; prefilter nearby solids
  // once per scenery source instead of rescanning the whole map per attempt.
  const reach=footprint+2.94,minX=Math.min(...source.solids.map(p=>p.x-p.r))-reach,maxX=Math.max(...source.solids.map(p=>p.x+p.r))+reach,minZ=Math.min(...source.solids.map(p=>p.z-p.r))-reach,maxZ=Math.max(...source.solids.map(p=>p.z+p.r))+reach;
  const obstacles=(world.obstacles||[]).filter(o=>{const r=(o.r||0)+footprint+.2;return o.x+r>=minX&&o.x-r<=maxX&&o.z+r>=minZ&&o.z-r<=maxZ;});
  // Two unequal, loose lobes leave bare intervals instead of forming a ring.
  // Places use their real outer solid edges, including irregular fallen timber.
  let planted=0;
  for(let attempt=0;attempt<Math.min(180,quota*20)&&planted<quota&&moved<budget;attempt++){
   const solid=source.solids[Math.floor(random()*source.solids.length)];
   const angle=source.edge==='place'?Math.atan2(solid.x-source.x,solid.z-source.z)+(random()-.5)*1.25:axis+(random()<.78?0:2.3)+(random()-.5)*1.35;
   const radius=solid.r+footprint+.24+random()**2*2.7,x=solid.x+Math.sin(angle)*radius,z=solid.z+Math.cos(angle)*radius;
   const list=donors.get(key({x,z,biome:source.biome}));if(!list?.length||region&&!region.contains(x,z))continue;
   if(passages.some(p=>{const dx=x-p.x,dz=z-p.z;return Math.abs(p.c*dx-p.s*dz)<3.1+footprint&&Math.abs(p.s*dx+p.c*dz)<10+footprint;}))continue;
   if(lanes.some(l=>x>l.minX&&x<l.maxX&&z>l.minZ&&z<l.maxZ&&segmentDistance(x,z,l.a.x,l.a.z,l.b.x,l.b.z)<l.r))continue;
   if(!allowed(x,z,obstacles)||records.some(p=>near(x,z,p,footprint===FOOTPRINT?.9:.62)))continue;
   const record=records[list.pop()];record.x=x;record.z=z;record.edge=source.edge;record.edgeIndex=source.index;planted++;moved++;
  }
 }
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
 softenSceneryEdges(world,mapId,records,FOOTPRINT,allowed);
 // Blend existing floor colors across districts without adding decal layers.
 for(const p of records)if(p.biome==='forest'){
  const h=forestHabitatAt(world,p.x,p.z),tint=new T.Color(p.color);
  tint.lerp(new T.Color(p.kind==='tuft'?0x456b57:0x4b574b),h.shade*.65).lerp(new T.Color(p.kind==='tuft'?0x64866e:0x657a70),h.bank*.7).lerp(new T.Color(p.kind==='tuft'?0x8b9861:0x99866a),h.ruin*.6);p.color=tint.getHex();
  // Smooth patches vary the same existing plants: fuller growth in shelter,
  // low sparse blades between it. Placement and the seeded stream stay intact.
  if(p.kind==='tuft'){
   const growth=.5+.5*Math.sin(p.x*.23+Math.sin(p.z*.17)*1.7);
   p.size*=.80+growth*.30+h.shade*.08;p.height*=.68+growth*.29;
  }
 }
 // Reuse the same instances; open patches stay low while sheltered shoulders
 // retain their existing growth. This never expands the collision-free footprint.
 if(world.explorationComposition)for(const p of records){
  const rhythm=sceneryRhythmAt(world,p.x,p.z);if(p.kind==='tuft'){p.size*=rhythm.cover;p.height*=rhythm.cover;}
  const tint=new T.Color(p.color);tint.multiplyScalar(1-rhythm.enclosure*.07+rhythm.opening*.045);p.color=tint.getHex();
 }
 if(!records.length)return null;
 const group=new T.Group();group.name='adventure-ground-detail';group.userData.records=records;group.userData.disposed=false;
 const matrix=new T.Matrix4(),position=new T.Vector3(),scale=new T.Vector3(),rotation=new T.Quaternion(),up=new T.Vector3(0,1,0),color=new T.Color();
 // Two batches per present biome retain every existing placement. The joined
 // map needs at most ten draws so each region can have its own actual silhouette.
 for(const biome of Object.keys(profiles))for(const kind of['tuft','litter']){
  const instances=records.filter(p=>p.biome===biome&&p.kind===kind);if(!instances.length)continue;
  const geometry=kind==='tuft'?tuftGeometry(biome):litterGeometry(biome),batch=new T.InstancedMesh(geometry,material,instances.length);batch.name='adventure-ground-'+(biome==='forest'&&kind==='tuft'?'tuft':biome+'-'+kind);batch.userData.biome=biome;batch.userData.kind=kind;
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
  const a=frond*2.399+.14*Math.sin(frond*1.6),s=Math.sin(a),co=Math.cos(a),reach=.57+(frond%3)*.065,h=.36+(frond%2)*.18;
  const point=(t,side,shade,fold=0)=>{const curl=.06*Math.sin(t*Math.PI)*Math.sin(a);return vertex(s*t*reach+co*(side+curl),Math.sin(t*Math.PI*(.78+frond*.013))*h-.025+fold,co*t*reach-s*(side+curl),shade);};
  // A bent stem is a narrow ribbon along the arc. Connecting base/middle/tip
  // as one fan filled the entire space under the arc with a solid green wedge.
  const stem=p.length/3;
  for(let row=0;row<=3;row++){
   const t=row/3,w=.006*(1-t*.8);point(t,-w,.46+t*.40);point(t,w,.49+t*.40);
   if(row<3){const n=stem+row*2;ix.push(n,n+1,n+2,n+1,n+3,n+2);}
  }
  for(let pair=0;pair<4;pair++)for(const side of[-1,1]){
   const t=.18+pair*.18,w=(.15-pair*.028)*side,n=point(t,0,.56+pair*.05),b=point(t+.055,w*.72,.79,.018),end=point(t+.15,w,.87,-.027-pair*.002),d=point(t+.17,w*.38,.69,.004);ix.push(n,b,end,n,end,d);
  }
 }
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setAttribute('color',new T.Float32BufferAttribute(c,3));g.setAttribute('groundFlex',new T.Float32BufferAttribute(flex,1));g.setIndex(ix);g.computeVertexNormals();return g;
}
// A low woodland shrub with curved stems and broad, drooping leaves. It shares
// the ground wind material and replaces part of the fern budget, not extra cover.
function shrubGeometry(){
 const positions=[],colors=[],flex=[],indices=[];
 const vertex=(x,y,z,shade)=>{const i=positions.length/3;positions.push(x,y,z);colors.push(shade*.91,shade,shade*.78);flex.push(Math.max(0,Math.min(1,y/.65))**2);return i;};
 for(let branch=0;branch<4;branch++){
  const a=branch*2.399+.20*Math.sin(branch),s=Math.sin(a),c=Math.cos(a),height=.39+(branch%3)*.075,reach=.18+branch*.036,start=positions.length/3;
  const stem=t=>({x:s*reach*t*t,y:height*t-.035-.055*t*t*t,z:c*reach*t*t});
  for(let row=0;row<=3;row++){const t=row/3,p=stem(t),w=.012*(1-t*.7);vertex(p.x+c*w,p.y,p.z-s*w,.43+t*.27);vertex(p.x-c*w,p.y,p.z+s*w,.48+t*.27);if(row<3){const n=start+row*2;indices.push(n,n+1,n+2,n+1,n+3,n+2);}}
  for(let tier=0;tier<2;tier++)for(const side of[-1,1]){
   const base=stem(.47+tier*.33),angle=a+side*(.9+tier*.3),sx=Math.sin(angle),cz=Math.cos(angle),length=.32-tier*.035,n=positions.length/3;
   const leaf=(t,width,shade)=>vertex(base.x+sx*length*t+cz*width,base.y+.08*Math.sin(t*Math.PI)-.09*t*t+width*.18,base.z+cz*length*t-sx*width,shade);
   // Three rounded sections soften the former spear-shaped silhouette while
   // retaining a folded, drooping surface and gaps between individual leaves.
   leaf(0,0,.61);for(const t of[.28,.61,.88]){const w=Math.sin(t*Math.PI)*(.112-tier*.012);leaf(t,-w,.67+t*.15);leaf(t,w,.78+t*.13);}leaf(1,0,.87);
   indices.push(n,n+1,n+2,n+1,n+3,n+2,n+2,n+3,n+4,n+3,n+5,n+4,n+4,n+5,n+6,n+5,n+7,n+6);
  }
 }
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setAttribute('color',new T.Float32BufferAttribute(colors,3));g.setAttribute('groundFlex',new T.Float32BufferAttribute(flex,1));g.setIndex(indices);g.computeVertexNormals();return g;
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
  // Patches share a dominant plant, instead of every specimen alternating mechanically.
  const habitat=biome==='forest'?forestHabitatAt(world,x,z):{shade:0,bank:0,ruin:0};
  const shrub=biome==='forest'&&habitat.shade<.5&&habitat.bank<.4&&Math.sin(x*.19+Math.sin(z*.14)*1.6)>.18;
  const bank=biome==='forest'&&habitat.bank>.4;
  const plantKind=bank?(Math.sin(x*1.7+z*.9)>.45?'stone':'reed'):shrub?'shrub':profile.kind;
  // Uneven crescent patches have dense centers, tapered ends, and bare intervals.
  const count=profile.kind==='reed'?7:profile.kind==='fern'?4:3,mid=(count-1)/2;
  for(let j=0;j<count;j++){
   const along=(j-mid)*.63,across=Math.sin(j*.9)*.65+(random()-.5)*.7,px=x+Math.sin(angle)*along+Math.cos(angle)*across,pz=z+Math.cos(angle)*along-Math.sin(angle)*across;
   if(!allowed(px,pz))continue;
   if(mapId==='confluence'&&!(world.regions||[]).find(r=>r.id===biome)?.contains(px,pz))continue;
   const size=(.70+random()*.30)*(1-Math.abs(j-mid)*.10);
   const tint=new T.Color(shrub?[0x506c42,0x698151,0x7f905c][j%3]:profile.color[j%3]);
   if(biome==='forest')tint.lerp(new T.Color(0x3e6653),habitat.shade*.55).lerp(new T.Color(plantKind==='stone'?0x72877d:0x5e8671),habitat.bank*.85).lerp(new T.Color(0x91995f),habitat.ruin*.5);
   records.push({x:px,z:pz,biome,kind:plantKind,angle:angle+(random()-.5)*1.2,width:profile.width*size,height:bank&&plantKind==='stone'?.13*size:profile.height*size*(1+habitat.shade*.13-habitat.ruin*.22),color:tint.getHex()});
  }
 }
 softenSceneryEdges(world,mapId,records,1.15,allowed);
 // Broad patches alternate with quiet gaps; their widths grow into one another
 // below the sight line, staying inside the already-reserved 1.15m footprint.
 for(const p of records)if(p.biome==='forest'&&(p.kind==='fern'||p.kind==='shrub')){
  const habitat=forestHabitatAt(world,p.x,p.z),growth=.5+.5*Math.sin(p.x*.23+Math.sin(p.z*.17)*1.7);
  p.width*=.84+growth*.40+habitat.shade*.12;p.height*=.76+growth*.22;
 }
 const group=new T.Group();group.name='habitat-detail';group.userData={records,centers,disposed:false};
 const dummy=new T.Object3D(),color=new T.Color();
 // Four quadrants permit frustum culling while bounding the complete layer to 16 draws.
 for(const kind of['fern','shrub','reed','stone'])for(let quadrant=0;quadrant<4;quadrant++){
  const list=records.filter(p=>p.kind===kind&&(Number(p.x>=0)+Number(p.z>=0)*2)===quadrant);if(!list.length)continue;
  const geometry=kind==='fern'?fernGeometry():kind==='shrub'?shrubGeometry():kind==='reed'?reedGeometry():naturalRockGeometry.clone();
  if(kind==='stone')geometry.setAttribute('groundFlex',new T.Float32BufferAttribute(new Float32Array(geometry.attributes.position.count),1));
  geometry.computeBoundingBox();const batch=new T.InstancedMesh(geometry,material,list.length);batch.name='habitat-'+kind;batch.receiveShadow=true;batch.userData.ownedGeometry=true;
  list.forEach((p,i)=>{dummy.position.set(p.x,kind==='stone'?-.055:-.042-geometry.boundingBox.min.y*p.height,p.z);dummy.scale.set(p.width,p.height,p.width);dummy.rotation.set(0,p.angle,0);dummy.updateMatrix();batch.setMatrixAt(i,dummy.matrix);batch.setColorAt(i,color.set(p.color));});
  batch.computeBoundingSphere();batch.addEventListener('dispose',()=>{batch.visible=false;group.userData.disposed=true;});group.add(batch);
 }
 world.group.add(group);world.habitatDetail=group;return group;
}
