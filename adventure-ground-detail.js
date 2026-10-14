import {applyFernSurface} from './fern-surfaces.js?v=190';
import {applyTreeLeafSurface,TREE_LEAF_UVS} from './tree-scenery.js?v=190';
import{sceneryRhythmAt}from'./exploration-composition.js?v=190';
import * as T from './vendor/three.module.js';
import {mergeGeometries} from './vendor/BufferGeometryUtils.js';
import {seeded,segmentDistance} from './rules.js?v=190';
import {forestHabitatAt} from './forest-habitats.js?v=190';
import {bridgeContains} from './coast.js?v=190';
import {naturalRockGeometry} from './biome-scenery.js?v=190';
import {surfaceUniforms} from './surface-textures.js?v=190';

const profiles={
 forest:{count:1200,grass:.83,height:1,tuft:[0x6e8650,0x87985a],litter:[0x827561,0x66685c]},
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
  float grassBreeze=.65+.35*(.5+.5*sin(groundWindTime*.42+grassPoint.x*.08+grassPoint.z*.06));
  vec3 grassBend=vec3(-.644,0.,.765)*grassWave*grassBreeze*groundFlex*.035;
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
const grassMaterial=material.clone();grassMaterial.name='M_Forest_FineGrass_A';
grassMaterial.onBeforeCompile=shader=>{
 material.onBeforeCompile(shader);
 shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
  float grassRoot=1.0-smoothstep(0.0,.11,groundLeaf);
  diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.092,.084,.041),grassRoot*.68);
 `);
 shader.fragmentShader=shader.fragmentShader.replace('#include <lights_fragment_end>',`#include <lights_fragment_end>
  #if NUM_HEMI_LIGHTS > 0
   reflectedLight.indirectDiffuse+=diffuseColor.rgb*hemisphereLights[0].skyColor*.10*groundLeaf;
  #endif
 `);
};
grassMaterial.customProgramCacheKey=()=> 'forest-fine-grass-wind';
const fernTint=new T.Color(0xffffff),fernMaterial=material.clone();
fernMaterial.name='M_Fern_Scanned_A';fernMaterial.onBeforeCompile=material.onBeforeCompile;fernMaterial.customProgramCacheKey=material.customProgramCacheKey;
applyFernSurface(fernMaterial);
const shrubMaterial=material.clone();
shrubMaterial.name='M_Shrub_Scanned_A';shrubMaterial.onBeforeCompile=material.onBeforeCompile;shrubMaterial.customProgramCacheKey=material.customProgramCacheKey;
applyTreeLeafSurface(shrubMaterial);
// Low scree is solid mineral, not flexible foliage. The shared rock maps are
// already loaded for scenery; these two samples need no new texture or pass.
const habitatStoneMaterial=new T.MeshStandardMaterial({name:'M_Habitat_Stone_A',vertexColors:true,roughness:.96,flatShading:true});
habitatStoneMaterial.onBeforeCompile=shader=>{
 Object.assign(shader.uniforms,{rockColor:surfaceUniforms.rockColor,rockHeight:surfaceUniforms.rockHeight,rockReady:surfaceUniforms.rockReady});
 shader.vertexShader='attribute float stoneDamp; varying vec3 habitatStonePoint; varying float habitatStoneDamp;\n'+shader.vertexShader;
 shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
  vec4 stonePoint=vec4(position,1.0);
  #ifdef USE_INSTANCING
   stonePoint=instanceMatrix*stonePoint;
  #endif
  habitatStonePoint=(modelMatrix*stonePoint).xyz;habitatStoneDamp=stoneDamp;
 `);
 shader.fragmentShader='uniform sampler2D rockColor,rockHeight; uniform float rockReady; varying vec3 habitatStonePoint; varying float habitatStoneDamp;\n'+shader.fragmentShader;
 shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
  vec2 stoneUV=habitatStonePoint.xz*.82+habitatStonePoint.y*vec2(.36,.21);
  vec3 stoneAlbedo=texture2D(rockColor,stoneUV).rgb;
  float stoneHeight=texture2D(rockHeight,stoneUV).r;
  float stonePixel=max(length(dFdx(habitatStonePoint)),length(dFdy(habitatStonePoint)));
  float stoneDetail=1.0-smoothstep(.015,.085,stonePixel);
  diffuseColor.rgb*=mix(vec3(1.0),clamp(stoneAlbedo*2.45,vec3(.45),vec3(1.18)),rockReady*.66);
  float stoneRelief=(stoneHeight-.5)*.005*rockReady*stoneDetail*(1.0-habitatStoneDamp*.35);
 `);
 shader.fragmentShader=shader.fragmentShader.replace('#include <roughnessmap_fragment>','#include <roughnessmap_fragment>\nroughnessFactor=clamp(roughnessFactor-habitatStoneDamp*.08,.87,1.0);');
 shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
  vec3 stoneDx=dFdx(-vViewPosition),stoneDy=dFdy(-vViewPosition),stoneRx=cross(stoneDy,normal),stoneRy=cross(normal,stoneDx);
  float stoneDet=dot(stoneDx,stoneRx);
  normal=normalize(abs(stoneDet)*normal-sign(stoneDet)*(dFdx(stoneRelief)*stoneRx+dFdy(stoneRelief)*stoneRy));
 `);
};
habitatStoneMaterial.customProgramCacheKey=()=> 'habitat-low-mineral';
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
 const positions=[],colors=[],indices=[],flex=[];
 // Three offset root clusters make fine grass, rather than four wide ribbon
 // leaves and a repeated miniature fern. Every tip tapers to a separate point.
 const roots=[[-.15,.075],[.105,.145],[.075,-.175]];
 for(let blade=0;blade<12;blade++){
  const cluster=Math.floor(blade/4),[rx,rz]=roots[cluster],a=blade*2.399+.24*Math.sin(blade*1.7),sn=Math.sin(a),cs=Math.cos(a);
  const height=.13+(.5+.5*Math.sin(blade*1.87))*.16,reach=.085+(.5+.5*Math.cos(blade*2.41))*.085,width=.006+(.5+.5*Math.sin(blade*2.73))*.006;
  const x=rx+Math.sin(blade*1.9)*.026,z=rz+Math.cos(blade*2.3)*.026,start=positions.length/3;
  const vertex=(t,side)=>{
   const bend=reach*t*t,twist=a+t*(.35+Math.sin(blade)*.3),w=width*(t<.4?.52:1-(t-.4)*.9),curl=height*.28*t*t*t;
   positions.push(x+sn*bend+Math.cos(twist)*w*side,-.035+height*t-curl+side*w*.17,z+cs*bend-Math.sin(twist)*w*side);
   const shade=.69+t*.34+(blade%4)*.015;colors.push(shade*.99,shade,shade*.89);flex.push(t*t*.85);
  };
  for(const [row,t]of[0,.38,.73].entries()){
   vertex(t,-1);vertex(t,1);
   if(row<2){const n=start+row*2;indices.push(n,n+2,n+1,n+1,n+2,n+3);}
  }
  vertex(1,0);indices.push(start+4,start+6,start+5);
 }
 // Short seedlings feather the base into the duff between the three taller
 // clusters. Their roots occupy an irregular area, never an opaque grass card.
 for(let blade=0;blade<8;blade++){
  const a=blade*2.399+.7,sn=Math.sin(a),cs=Math.cos(a),radius=.19+(blade%3)*.046,x=sn*radius,z=cs*radius,start=positions.length/3;
  const height=.065+(blade%3)*.024,reach=.045+(blade%2)*.028,w=.0055+(blade%2)*.0015;
  for(const t of[0,.6,1])for(const side of t===1?[0]:[-1,1]){
   positions.push(x+sn*reach*t*t+cs*w*side,-.035+height*Math.sin(t*Math.PI*.76),z+cs*reach*t*t-sn*w*side);
   const shade=.69+t*.28;colors.push(shade,shade,shade*.83);flex.push(t*t*.45);
  }
  indices.push(start,start+2,start+1,start+1,start+2,start+3,start+2,start+4,start+3);
 }
 const g=new T.BufferGeometry();g.name='SM_Forest_FineGrass_A';g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setAttribute('color',new T.Float32BufferAttribute(colors,3));g.setAttribute('groundFlex',new T.Float32BufferAttribute(flex,1));g.setIndex(indices);g.computeVertexNormals();return g;
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
 const approach=world.forestHabitats?.approach;if(approach?.points.length>1)routes.push({points:approach.points,width:1.65});
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
  ...places.map((p,index)=>({...p,edge:'place',index,weight:3})),
  ...(world.environmentClusters?.records||[]).map((p,index)=>({...p,edge:'cluster',index,weight:1,solids:[{x:p.x,z:p.z,r:p.footprint}]}))
 ].filter(p=>p.solids?.length);
 if(!sources.length)return;
 // Some scenery gets a fuller apron and some stays quiet. Both cover layers
 // share this slow spatial field instead of outlining every object equally.
 for(const source of sources)source.weight*=.48+(1+Math.sin(source.x*.085+Math.sin(source.z*.10)*1.4))*.55;
 const approach=world.forestHabitats?.approach;
 if(approach)for(const source of sources)if(source.biome==='forest'){
  let distance=Infinity;for(let i=1;i<approach.points.length;i++){const a=approach.points[i-1],b=approach.points[i];distance=Math.min(distance,segmentDistance(source.x,source.z,a.x,a.z,b.x,b.z));}
  source.weight*=1+(1-T.MathUtils.smoothstep(distance,5,15))*.65;
 }
 const random=seeded(layoutSeed(world,mapId)^(footprint===FOOTPRINT?0x2ce459:0x7ab913)),budget=Math.floor(records.length*.32),weight=sources.reduce((n,p)=>n+p.weight,0),donors=new Map();
 const quadrant=p=>Number(p.x>=0)+Number(p.z>=0)*2,key=p=>p.biome+':'+quadrant(p);
 // Keep road shoulders, near-spawn cover, and existing scenery-edge growth.
 // Keeping each donor's quadrant also preserves the habitat's culling batches.
 for(let i=0;i<records.length;i++){
  const p=records[i];if(p.shoulder||p.transition||p.biome==='forest'&&['reed','stone'].includes(p.kind)||near(p.x,p.z,world.spawn,20)||sources.some(s=>near(p.x,p.z,s,s.edge==='place'?17:s.footprint+5)))continue;
  const k=key(p);if(!donors.has(k))donors.set(k,[]);donors.get(k).push(i);
 }
 const localWeights=new Map();for(const source of sources){const k=key(source);localWeights.set(k,(localWeights.get(k)||0)+source.weight);}
 const available=new Map([...donors].map(([k,list])=>[k,list.length]));
 const lanes=[];
 for(const route of [...(world.explorationRoutes||[]),...(approach?[approach]:[])])for(let i=1;i<route.points.length;i++){
  const a=route.points[i-1],b=route.points[i],r=2+footprint;
  lanes.push({a,b,r,minX:Math.min(a.x,b.x)-r,maxX:Math.max(a.x,b.x)+r,minZ:Math.min(a.z,b.z)-r,maxZ:Math.max(a.z,b.z)+r});
 }
 const passages=places.map(p=>({...p,c:Math.cos(p.angle||0),s:Math.sin(p.angle||0)}));
 const banks=(world.ponds||[]).map(p=>{const tide=p.baseRx===undefined?1:1.19;return{x:p.x,z:p.z,c:Math.cos(p.angle||0),s:Math.sin(p.angle||0),rx:(p.baseRx??p.rx)*tide*1.12+footprint*1.42+.15,rz:(p.baseRz??p.rz)*tide*1.12+footprint*1.42+.15};});
 let moved=0;
 for(const source of sources){
  const quota=Math.min(Math.floor(budget*source.weight/weight),Math.floor((available.get(key(source))||0)*source.weight/localWeights.get(key(source)))),region=world.regions?.find(r=>r.id===source.biome),biome=source.biome;
  let axis=(source.angle||0)+Math.sin(source.x*.27+source.z*.19)*.7;
  if(biome==='snow')axis=(source.angle||0)+2.7;
  if(biome==='sand')axis=-.7+Math.sin(source.x*.07+source.z*.09)*.12;
  if(biome==='coast'){
   const shore=(world.ponds||[]).reduce((best,p)=>!best||Math.hypot(source.x-p.x,source.z-p.z)-Math.max(p.rx,p.rz)<Math.hypot(source.x-best.x,source.z-best.z)-Math.max(best.rx,best.rz)?p:best,null);
   if(shore)axis=Math.atan2(source.z-shore.z,shore.x-source.x);
  }
  // Every candidate lies inside these fixed bounds; prefilter nearby solids
  // once per scenery source instead of rescanning the whole map per attempt.
  const reach=footprint+2.94,minX=Math.min(...source.solids.map(p=>p.x-p.r))-reach,maxX=Math.max(...source.solids.map(p=>p.x+p.r))+reach,minZ=Math.min(...source.solids.map(p=>p.z-p.r))-reach,maxZ=Math.max(...source.solids.map(p=>p.z+p.r))+reach;
  const obstacles=(world.obstacles||[]).filter(o=>{const r=(o.r||0)+footprint+.2;return o.x+r>=minX&&o.x-r<=maxX&&o.z+r>=minZ&&o.z-r<=maxZ;});
  // Two unequal, loose lobes leave bare intervals instead of forming a ring.
  // Places use their real outer solid edges, including irregular fallen timber.
  let planted=0;
  for(let attempt=0;attempt<Math.min(biome==='coast'?300:180,quota*20)&&planted<quota&&moved<budget;attempt++){
   const solid=source.solids[Math.floor(random()*source.solids.length)];
   let angle=source.edge==='place'?Math.atan2(solid.x-source.x,solid.z-source.z)+(random()-.5)*1.25:axis+(random()<.78?0:2.3)+(random()-.5)*1.35;
   let distance=random()**2*2.7;
   if(biome!=='forest'){
    // The same two layers follow one habitat axis: lee-side snow pockets,
    // broken scree, wind-drawn sand trails, or tangential shoreline wrack.
    const outward=Math.atan2(solid.x-source.x,solid.z-source.z),heading=source.edge==='place'?outward+Math.sin(axis-outward)*.65:axis;
    const spread=biome==='snow'?1.15:biome==='ash'?.55:biome==='sand'?.34:.72;
    const other=random()<(biome==='ash'?.27:biome==='coast'?.38:.16);
    angle=heading+(other?(biome==='snow'?1.8:Math.PI):0)+(random()-.5)*spread;
    const depth=random();distance=2.7*(biome==='ash'?(depth<.6?depth*.58:.66+(depth-.6)*.85):depth**1.35);
    if(planted===0)distance*=.18;
   }
   const radius=solid.r+footprint+.24+distance,x=solid.x+Math.sin(angle)*radius,z=solid.z+Math.cos(angle)*radius;
   const list=donors.get(key({x,z,biome:source.biome}));if(!list?.length||region&&!region.contains(x,z))continue;
   if(passages.some(p=>{const dx=x-p.x,dz=z-p.z;return Math.abs(p.c*dx-p.s*dz)<3.1+footprint&&Math.abs(p.s*dx+p.c*dz)<10+footprint;}))continue;
   if(banks.some(p=>{const dx=x-p.x,dz=z-p.z;return Math.hypot((p.c*dx-p.s*dz)/p.rx,(p.s*dx+p.c*dz)/p.rz)<1;}))continue;
   if(lanes.some(l=>x>l.minX&&x<l.maxX&&z>l.minZ&&z<l.maxZ&&segmentDistance(x,z,l.a.x,l.a.z,l.b.x,l.b.z)<l.r))continue;
   // Overlapping leaf tips make a patch, while the reserved footprint still
   // protects gameplay. Reuse the forest bank's dense ground-cover spacing.
   if(!allowed(x,z,obstacles)||records.some(p=>near(x,z,p,footprint===FOOTPRINT?.64:.54)))continue;
   const record=records[list.pop()];record.x=x;record.z=z;record.edge=source.edge;record.edgeIndex=source.index;
   // A low, broken fringe joins the open floor; taller cover gathers nearer
   // the sheltered solid. Geometry can only shrink within its tested footprint.
   const growth=1-T.MathUtils.smoothstep(distance+Math.sin(x*.63+z*.41)*.24,.15,2.7);
   record.edgeGrowth=growth;record.height*=.58+growth*.42;
   if(footprint===FOOTPRINT)record.size*=.76+growth*.24;else record.width*=.76+growth*.24;
   record.color=new T.Color(record.color).lerp(new T.Color(profiles[biome].litter[0]),(1-growth)*.28).getHex();
   if(biome==='sand')record.angle=axis+Math.sin(x*.63+z*.41)*.18;
   planted++;moved++;
  }
 }
}

// Connect existing cover into loose banks and understory patches. Both layers
// share the same anchor field, so low grass fills between ferns instead of each
// plant sitting on its own island. Relocation keeps every kind and culling cell.
function connectForestCover(world,mapId,records,footprint,allowed){
 const habitat=world.forestHabitats;if(!habitat)return;
 const random=seeded(layoutSeed(world,mapId)^0x5f23a91),sources=[],floor=footprint===FOOTPRINT;
 const add=(x,z,angle,zone,tree)=>{if(!habitat.region||habitat.region.contains(x,z))sources.push({x,z,angle,zone,tree});};
 for(const grove of habitat.groves)for(let i=0;i<3;i++){
  const a=random()*Math.PI*2,r=5+random()*7;add(grove.x+Math.sin(a)*r,grove.z+Math.cos(a)*r,a,'shade');
 }
 // The existing vista trees meet the same low layer instead of rising from a
 // bare circular hole. Keep openings between their roots and the nearby path.
 for(const [i,tree]of(world.forestVista?.anchors||[]).slice(0,12).entries()){
  const a=i*2.399+Math.sin(tree.x*.19+tree.z*.13),r=tree.r+2.5;
  add(tree.x+Math.sin(a)*r,tree.z+Math.cos(a)*r,a+Math.PI/2,'root',tree);
 }
 for(const pond of habitat.ponds)for(let i=0;i<7;i++){
  // Unequal arcs have breaks and varying inland depth, rather than an even ring.
  const a=(i+random()*.7)*Math.PI*2/7,turn=pond.angle||0,c=Math.cos(turn),s=Math.sin(turn),tide=pond.baseRx===undefined?1:1.19;
  const rx=(pond.baseRx??pond.rx)*tide*1.12+3.2+random()*1.8,rz=(pond.baseRz??pond.rz)*tide*1.12+3.2+random()*1.8,u=Math.sin(a)*rx,v=Math.cos(a)*rz;
  const tangent=Math.atan2(c*Math.cos(a)*rx-s*Math.sin(a)*rz,-s*Math.cos(a)*rx-c*Math.sin(a)*rz);
  add(pond.x+c*u+s*v,pond.z-s*u+c*v,tangent,'bank');
 }
 // Route shoulders share the same sparse clumps, with short inner blades and a
 // fuller outer edge. The worn centre retains its original clear width.
 for(const route of routesFor(world))for(let i=1;i<route.points.length;i++){
  const a=route.points[i-1],b=route.points[i],dx=b.x-a.x,dz=b.z-a.z,length=Math.hypot(dx,dz);if(length<.1)continue;
  const steps=Math.min(6,Math.ceil(length/12));
  for(let j=0;j<steps;j++){
   const t=(j+.15+random()*.7)/steps,side=random()<.5?-1:1,offset=route.width===5.8?6.3:3.55;
   add(a.x+dx*t-dz/length*offset*side,a.z+dz*t+dx/length*offset*side,Math.atan2(dx,dz),'shoulder');
  }
 }
 // Give the real opening path two connected, unequal banks of existing plants.
 // A very short shore spur cannot carry both; use its existing relic route.
 const lengthOf=route=>route?.points.reduce((n,p,i,points)=>n+(i?Math.hypot(p.x-points[i-1].x,p.z-points[i-1].z):0),0)||0;
 const approach=lengthOf(habitat.approach)>=14?habitat.approach:(world.explorationRoutes||[]).find(r=>r.biome==='forest'&&r.site===habitat.relic);
 const path=[],end=Math.min(24,lengthOf(approach)-1);let walked=0;
 if(end>=13)for(let i=1;i<approach.points.length;i++){
  const a=approach.points[i-1],b=approach.points[i],dx=b.x-a.x,dz=b.z-a.z,length=Math.hypot(dx,dz);if(length<.001)continue;
  path.push({a,dx,dz,length,start:walked});walked+=length;
 }
 const focused=path.length?2:0;
 if(focused)sources.unshift({zone:'approach',side:-1,from:8,to:Math.min(20,end)},{zone:'approach',side:1,from:Math.min(13,end-3),to:end});
 if(!sources.length)return;
 const region=habitat.region,quadrant=p=>Number(p.x>=0)+Number(p.z>=0)*2,donors=new Map(),budget=Math.floor(records.filter(p=>p.biome==='forest').length*.18);
 for(let i=0;i<records.length;i++){
  const p=records[i];if(p.biome!=='forest'||p.shoulder||near(p.x,p.z,world.spawn,20))continue;
  const key=p.kind+':'+quadrant(p);if(!donors.has(key))donors.set(key,[]);donors.get(key).push(i);
 }
 const lanes=[...(world.explorationRoutes||[]),...(habitat.approach?[habitat.approach]:[])].flatMap(r=>r.points.slice(1).map((b,i)=>({a:r.points[i],b}))),shoulderAllowed=floor?placementFilter(world,footprint,true):allowed;
 const passages=(world.biomePlaces||[]).map(p=>({...p,c:Math.cos(p.angle||0),s:Math.sin(p.angle||0)}));
 // Moving a wide fern needs its whole footprint on dry ground, including the
 // irregular high-water edge; the old fixed .9m pad only covered the low layer.
 const banks=(world.ponds||[]).map(p=>{const tide=p.baseRx===undefined?1:1.19;return{x:p.x,z:p.z,c:Math.cos(p.angle||0),s:Math.sin(p.angle||0),rx:(p.baseRx??p.rx)*tide*1.12+footprint*1.42+.15,rz:(p.baseRz??p.rz)*tide*1.12+footprint*1.42+.15};});
 const shares=sources.slice(focused).map(s=>s.zone==='root'?6:s.zone==='shoulder'&&near(s.x,s.z,world.spawn,20)?3:1),totalShares=shares.reduce((n,w)=>n+w,0);
 let moved=0,remainder=budget,share=0;
 for(const [sourceIndex,source]of sources.entries()){
  if(focused&&sourceIndex===focused)remainder=budget-moved;
  // Reserve half for the old habitats. Apportion it across the complete source
  // list, so early groves cannot consume the later root, shore and path shares.
  const index=sourceIndex-focused,nextShare=share+(shares[index]||0);
  const allotted=!focused?Math.max(2,Math.ceil(budget/sources.length)):sourceIndex<focused?Math.floor(budget*(sourceIndex===0?.32:.18)):Math.floor(nextShare*remainder/totalShares)-Math.floor(share*remainder/totalShares);
  // Even a constrained joined biome with only two vista trees keeps a small
  // root patch at each; the shared moved<budget cap still bounds all planting.
  const quota=source.tree?Math.max(2,allotted):allotted;
  if(sourceIndex>=focused)share=nextShare;
  const kinds=floor?['tuft','litter']:source.zone==='bank'?['reed','stone']:source.zone==='shade'?['fern']:source.zone==='root'||source.zone==='approach'?['fern','shrub']:['shrub'];
  let planted=0;
  for(let attempt=0;planted<quota&&moved<budget&&(attempt<quota*16||(source.tree?planted<2:source.zone==='approach'&&planted<8)&&attempt<quota*(source.tree?40:64));attempt++){
   let x,z;
   if(source.zone==='approach'){
    // If the near shoulder is blocked, continue along the same real opening
    // route before giving up, rather than pushing plants into its water/solids.
    const fallback=planted<8&&attempt>=quota*8,to=sourceIndex===0&&fallback?end:source.to;
    const t=random(),distance=source.from+(to-source.from)*t,s=path.find(s=>s.start+s.length>=distance),u=(distance-s.start)/s.length;
    const offset=source.side*(4.8+random()*(fallback?3.4:1.2+Math.sin(t*Math.PI)*2.2));
    x=s.a.x+s.dx*u+s.dz/s.length*offset;z=s.a.z+s.dz*u-s.dx/s.length*offset;
   }else if(source.tree&&(attempt%4===3||attempt>=quota*8)){
    // A creek or route may occupy the original root-side strip. Try another
    // nearby sector of this same tree, using the same quota and safety checks.
    const angle=source.angle+attempt*2.399,r=source.tree.r+footprint+.35+random()*2.7;
    x=source.tree.x+Math.sin(angle)*r;z=source.tree.z+Math.cos(angle)*r;
   }else{const along=(random()-.5)*7.5,across=(random()-.5)*2.8;x=source.x+Math.sin(source.angle)*along+Math.cos(source.angle)*across;z=source.z+Math.cos(source.angle)*along-Math.sin(source.angle)*across;}
   if(region&&!region.contains(x,z))continue;
   const h=forestHabitatAt(world,x,z),rhythm=sceneryRhythmAt(world,x,z);
   if(source.zone==='shade'&&h.shade<.2||source.zone==='bank'&&h.bank<.22||rhythm.opening>.78&&!habitat.approach&&source.zone!=='approach')continue;
   if(lanes.some(({a,b})=>segmentDistance(x,z,a.x,a.z,b.x,b.z)<2+footprint))continue;
   if(passages.some(p=>{const dx=x-p.x,dz=z-p.z;return Math.abs(p.c*dx-p.s*dz)<3.1+footprint&&Math.abs(p.s*dx+p.c*dz)<10+footprint;}))continue;
   if(banks.some(p=>{const dx=x-p.x,dz=z-p.z;return Math.hypot((p.c*dx-p.s*dz)/p.rx,(p.s*dx+p.c*dz)/p.rz)<1;}))continue;
   if(!(['shoulder','approach'].includes(source.zone)?shoulderAllowed:allowed)(x,z)||records.some(p=>near(x,z,p,floor?(source.zone==='shade'||source.zone==='bank'||source.zone==='approach'?.64:.9):.62)))continue;
   const kind=kinds[Math.floor(random()*kinds.length)],list=donors.get(kind+':'+quadrant({x,z}));if(!list?.length)continue;
   const record=records[list.pop()];record.x=x;record.z=z;record.transition=source.zone;record.transitionIndex=sourceIndex;
   if(floor&&(source.zone==='shoulder'||source.zone==='approach'))record.shoulder=true;
   planted++;moved++;
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
 connectForestCover(world,mapId,records,FOOTPRINT,allowed);
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
   if(p.shoulder){
    let distance=Infinity;for(const route of routes)for(let i=1;i<route.points.length;i++){const a=route.points[i-1],b=route.points[i];distance=Math.min(distance,segmentDistance(p.x,p.z,a.x,a.z,b.x,b.z)-(route.width===5.8?4.2:1.65));}
    const edge=T.MathUtils.smoothstep(distance,.55,2.5);p.height*=.58+edge*.42;p.size*=.78+edge*.22;
   }
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
  const geometry=kind==='tuft'?tuftGeometry(biome):litterGeometry(biome),batch=new T.InstancedMesh(geometry,biome==='forest'&&kind==='tuft'?grassMaterial:material,instances.length);batch.name='adventure-ground-'+(biome==='forest'&&kind==='tuft'?'tuft':biome+'-'+kind);batch.userData.biome=biome;batch.userData.kind=kind;
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
// Bent fronds use three scanned atlas regions; alpha cuts the individual leaflets,
// while the curved midrib/cross-fold remain real geometry (132 triangles per plant).
function fernGeometry(){
 const p=[],c=[],uv=[],ix=[],flex=[],stalk=[],progress=[];
 const regions=[[.078,.240,.948,.109],[.307,.458,.786,.021],[.718,.839,.903,.107]];
 for(let frond=0;frond<6;frond++){
  const a=frond*2.399+.14*Math.sin(frond*1.6),s=Math.sin(a),co=Math.cos(a),reach=.57+(frond%3)*.065,h=.36+(frond%2)*.18;
  const [u0,u1,base,tip]=regions[frond%3],start=p.length/3;
  const vertex=(t,side,stem=false)=>{
   const curl=.025*Math.sin(t*Math.PI)*Math.sin(a),width=stem?.0045:.078+(frond%3)*.009;
   p.push(s*t*reach+co*(side*width+curl),Math.sin(t*Math.PI*(.78+frond*.013))*h-.025+(1-Math.abs(side))*.018*Math.sin(t*Math.PI),co*t*reach-s*(side*width+curl));
   const shade=.80+t*.22+(side===0?-.025:0);c.push(shade,shade,shade);flex.push(t*t*.75);stalk.push(stem?1:0);progress.push(t);
   uv.push(u0+(side+1)*.5*(u1-u0),1-(base+(tip-base)*t));
  };
  for(let row=0;row<=4;row++){
   for(const side of[-1,0,1])vertex(row*.2375,side);
   if(row<4){const n=start+row*3;ix.push(n,n+3,n+1,n+1,n+3,n+4,n+1,n+4,n+2,n+2,n+4,n+5);}
  }
  vertex(1,0);ix.push(start+12,start+15,start+13,start+13,start+15,start+14);
  const root=p.length/3;
  for(let row=0;row<3;row++){for(const side of[-1,1])vertex(row*.12,side,true);if(row<2){const n=root+row*2;ix.push(n,n+2,n+1,n+1,n+2,n+3);}}
 }
 const g=new T.BufferGeometry();g.setAttribute('fernProgress',new T.Float32BufferAttribute(progress,1));g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setAttribute('color',new T.Float32BufferAttribute(c,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setAttribute('fernStem',new T.Float32BufferAttribute(stalk,1));g.setAttribute('groundFlex',new T.Float32BufferAttribute(flex,1));g.setIndex(ix);g.computeVertexNormals();return g;
}
// Each small leaf bends across a raised midrib. The scan supplies the irregular
// outline, so the geometry does not taper it a second time into a pointed arrow.
function shrubGeometry(){
 const positions=[],colors=[],uv=[],flex=[],indices=[];
 const vertex=(x,y,z,shade,u=.085,v=.78)=>{const i=positions.length/3;positions.push(x,y,z);colors.push(shade,shade,shade);uv.push(u,v);flex.push(Math.max(0,Math.min(1,y/.65))**2);return i;};
 for(let branch=0;branch<3;branch++){
  const a=branch*2.399+.20*Math.sin(branch),s=Math.sin(a),c=Math.cos(a),height=.39+(branch%3)*.075,reach=.18+branch*.036,start=positions.length/3;
  const stem=t=>({x:s*reach*t*t,y:height*t-.035-.055*t*t*t,z:c*reach*t*t});
  for(let row=0;row<=4;row++){const t=row/4,p=stem(t),w=.008*(1-t*.7);vertex(p.x+c*w,p.y,p.z-s*w,.43+t*.27);vertex(p.x-c*w,p.y,p.z+s*w,.48+t*.27);if(row<4){const n=start+row*2;indices.push(n,n+1,n+2,n+1,n+3,n+2);}}
  for(let tier=0;tier<2;tier++)for(const side of[-1,1]){
   const base=stem(.43+tier*.37+(side===1?.055:0)),angle=a+side*(.9+tier*.3),sx=Math.sin(angle),cz=Math.cos(angle),length=.22-tier*.023,n=positions.length/3;
   const [u,v,uw,vh]=TREE_LEAF_UVS[(branch*4+tier*2+(side===1?1:0))%TREE_LEAF_UVS.length];
   for(const [row,t]of[0,.52,1].entries()){
    for(const cross of[-1,0,1]){
     const w=(.052-tier*.007)*cross,fold=Math.sin(t*Math.PI)*(1-Math.abs(cross))*.023;
     vertex(base.x+sx*length*t+cz*w,base.y+.075*Math.sin(t*Math.PI)-.105*t*t+fold+w*side*.35,base.z+cz*length*t-sx*w,.86+t*.11+cross*.025,u+(cross+1)*.5*uw,v+t*vh);
    }
    if(row<2){const k=n+row*3;indices.push(k,k+3,k+1,k+1,k+3,k+4,k+1,k+4,k+2,k+2,k+4,k+5);}
   }
  }
 }
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setAttribute('color',new T.Float32BufferAttribute(colors,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setAttribute('groundFlex',new T.Float32BufferAttribute(flex,1));g.setIndex(indices);g.computeVertexNormals();return g;
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
function habitatStoneGeometry(){
 const g=naturalRockGeometry.clone(),p=g.attributes.position,c=g.attributes.color;
 g.name='SM_Habitat_Stone_A';
 for(let i=0;i<p.count;i++){
  const x=p.getX(i),y=p.getY(i),z=p.getZ(i),ledge=.5+.5*Math.sin(x*4.8+z*3.1),upper=T.MathUtils.smoothstep(y,-.05,.52);
  // A shorter, inset shoulder exposes the side planes of the original low
  // boulder. The buried underside and placed height never move upward.
  p.setXYZ(i,x*(.82-upper*ledge*.045),y-upper*ledge*.045,z*(.84-upper*(1-ledge)*.045));
  const shade=.64+T.MathUtils.smoothstep(y,-.35,.70)*.25+Math.sin(x*7-z*4+y*3)*.045;
  c.setXYZ(i,shade*1.025,shade,shade*.955);
 }
 g.setAttribute('groundFlex',new T.Float32BufferAttribute(new Float32Array(p.count),1));g.computeVertexNormals();
 // Sphere UV seams include unused pole vertices; keep their valid shared normal
 // instead of leaving a zero vector after recalculating the reshaped surface.
 const n=g.attributes.normal,source=naturalRockGeometry.attributes.normal;
 for(let i=0;i<n.count;i++)if(Math.hypot(n.getX(i),n.getY(i),n.getZ(i))<1e-6)n.setXYZ(i,source.getX(i),source.getY(i),source.getZ(i));
 return g;
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
 connectForestCover(world,mapId,records,1.15,allowed);
 softenSceneryEdges(world,mapId,records,1.15,allowed);
 // Broad patches alternate with quiet gaps; their widths grow into one another
 // below the sight line, staying inside the already-reserved 1.15m footprint.
 for(const p of records)if(p.biome==='forest'&&(p.kind==='fern'||p.kind==='shrub')){
  const habitat=forestHabitatAt(world,p.x,p.z),growth=.5+.5*Math.sin(p.x*.23+Math.sin(p.z*.17)*1.7);
  p.width*=.84+growth*.40+habitat.shade*.12;p.height*=.76+growth*.22;
  if(world.forestHabitats?.approach)p.height*=.80+sceneryRhythmAt(world,p.x,p.z).cover*.20;
 }
 const group=new T.Group();group.name='habitat-detail';group.userData={records,centers,disposed:false};
 const dummy=new T.Object3D(),color=new T.Color();
 // Four quadrants permit frustum culling while bounding the complete layer to 16 draws.
 for(const kind of['fern','shrub','reed','stone'])for(let quadrant=0;quadrant<4;quadrant++){
  const list=records.filter(p=>p.kind===kind&&(Number(p.x>=0)+Number(p.z>=0)*2)===quadrant);if(!list.length)continue;
  const geometry=kind==='fern'?fernGeometry():kind==='shrub'?shrubGeometry():kind==='reed'?reedGeometry():habitatStoneGeometry();
  const damp=kind==='stone'?Float32Array.from(list,p=>p.biome==='forest'?forestHabitatAt(world,p.x,p.z).bank:0):null;
  if(damp)geometry.setAttribute('stoneDamp',new T.InstancedBufferAttribute(damp,1));
  geometry.computeBoundingBox();const batch=new T.InstancedMesh(geometry,kind==='fern'?fernMaterial:kind==='shrub'?shrubMaterial:kind==='stone'?habitatStoneMaterial:material,list.length);batch.name='habitat-'+kind;batch.receiveShadow=true;batch.userData.ownedGeometry=true;
  list.forEach((p,i)=>{dummy.position.set(p.x,kind==='stone'?-.055:-.042-geometry.boundingBox.min.y*p.height,p.z);dummy.scale.set(p.width,p.height,p.width);dummy.rotation.set(0,p.angle,0);dummy.updateMatrix();batch.setMatrixAt(i,dummy.matrix);color.set(p.color);if(kind==='fern'||kind==='shrub')color.lerp(fernTint,.84);if(kind==='stone'&&p.biome==='forest')color.lerp(new T.Color(0x777468).lerp(new T.Color(0x545d57),damp[i]),.88);batch.setColorAt(i,color);});
  batch.computeBoundingSphere();batch.addEventListener('dispose',()=>{batch.visible=false;group.userData.disposed=true;});group.add(batch);
 }
 world.group.add(group);world.habitatDetail=group;return group;
}
