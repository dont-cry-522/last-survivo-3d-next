import * as T from './vendor/three.module.js';
import{addTree}from'./tree-scenery.js?v=124';
import{MAPS,seeded,segmentDistance}from'./rules.js?v=114';
import{buildPonds}from'./water.js?v=124';
import{installCoast}from'./coast.js?v=114';
import{coastProp}from'./coast-models.js?v=114';
import{buildDistricts}from'./map-districts.js?v=120';
import{installScenery}from'./biome-scenery.js?v=120';
import{installDiscoveries}from'./map-discoveries.js?v=120';
import{installTactics}from'./map-tactics.js?v=114';
import{installRoaming}from'./roaming-events.js?v=120';
import{biomeEvent}from'./map-events.js?v=114';
import{groundCue}from'./ground-cues.js?v=114';
export const CONFLUENCE_HALF=140;
export const REGIONS=[
 {id:'forest',x:-72,z:20,label:'古木河谷',transition:'林缘渐冷，针叶林沿山麓向雪线延伸'},
 {id:'snow',x:-46,z:-68,label:'霜雪山口',transition:'积雪在地热裸岩间融化，越过山脊进入赤烬地'},
 {id:'ash',x:52,z:-68,label:'地热裂谷',transition:'熔岩逐渐冷却成黑砾，风化碎岩汇入沙地'},
 {id:'sand',x:78,z:24,label:'风沙古道',transition:'遗城石路向海岸延伸，细沙逐渐变成潮湿滩地'},
 {id:'coast',x:0,z:88,label:'河口遗港',transition:'沿河口湿岸回到林地，芦苇与蕨草渐渐增多'}
];
export const CONFLUENCE_TEXT='五境环游 · 280 × 280 连续地图。沿古道自由跨越林地、雪山、地热裂谷、遗城和海港；灰岩山麓、冷却砾地与河口湿岸形成过渡。完成各区地标事件并领取奖励后，靠近该区路标唤醒守卫；击败五位守卫完成远征。跨区保留生命、技能和敌人。';
// Curved climate boundaries, softened over a broad band instead of hard rectangular tiles.
export function biomeWeights(x,z){
 const u=x+5*Math.sin(z*.041),v=z+4*Math.sin(x*.035),ds=REGIONS.map(r=>Math.hypot(u-r.x,v-r.z)),near=Math.min(...ds),raw=ds.map(d=>Math.max(0,1-(d-near)/24)**2),sum=raw.reduce((a,b)=>a+b,0);
 return Object.fromEntries(REGIONS.map((r,i)=>[r.id,raw[i]/sum]));
}
export function biomeAt(x,z){const weights=biomeWeights(x,z);return REGIONS.reduce((best,r)=>weights[r.id]>weights[best.id]?r:best,REGIONS[0]).id;}
const palette={forest:0x3e6047,snow:0xb2c7c8,ash:0x634c4d,sand:0xae9873,coast:0x728d79},colors=Object.fromEntries(Object.entries(palette).map(([k,v])=>[k,new T.Color(v)]));
export function biomeColor(x,z){const c=new T.Color(0),weights=biomeWeights(x,z);for(const r of REGIONS)c.add(colors[r.id].clone().multiplyScalar(weights[r.id]));return c;}
const curve=new T.CatmullRomCurve3(REGIONS.map(r=>new T.Vector3(r.x,0,r.z)),true,'catmullrom',.25),road=curve.getPoints(160).map(p=>{if(p.z>70)p.z=T.MathUtils.lerp(p.z,88,1-T.MathUtils.smoothstep(Math.abs(p.x),17,27));return p;});
export function roadDistance(x,z){let distance=Infinity;for(let i=1;i<road.length;i++)distance=Math.min(distance,segmentDistance(x,z,road[i-1].x,road[i-1].z,road[i].x,road[i].z));return distance;}
const groundMaterial=new T.MeshStandardMaterial({vertexColors:true,roughness:1});
const grain=new Uint8Array(256*256*4),grainRandom=seeded(892);
const noiseLayers=[8,24,64].map(n=>({n,values:Float32Array.from({length:n*n},()=>grainRandom())}));
const noiseAt=(layer,x,y)=>{const u=x/256*layer.n,v=y/256*layer.n,ix=Math.floor(u),iy=Math.floor(v),fx=u-ix,fy=v-iy,get=(a,b)=>layer.values[(b%layer.n)*layer.n+a%layer.n];return T.MathUtils.lerp(T.MathUtils.lerp(get(ix,iy),get(ix+1,iy),fx),T.MathUtils.lerp(get(ix,iy+1),get(ix+1,iy+1),fx),fy);};
for(let y=0;y<256;y++)for(let x=0;x<256;x++){const n=noiseAt(noiseLayers[0],x,y)*.08+noiseAt(noiseLayers[1],x,y)*.06+noiseAt(noiseLayers[2],x,y)*.025+(grainRandom()-.5)*.045,k=(y*256+x)*4;grain[k]=grain[k+1]=grain[k+2]=Math.round((.82+n)*255);grain[k+3]=255;}
const grainTexture=new T.DataTexture(grain,256,256);grainTexture.wrapS=grainTexture.wrapT=T.RepeatWrapping;grainTexture.repeat.set(26,26);grainTexture.magFilter=T.LinearFilter;grainTexture.minFilter=T.LinearMipmapLinearFilter;grainTexture.generateMipmaps=true;grainTexture.needsUpdate=true;groundMaterial.map=grainTexture;
export function buildConfluence(seed,{mesh,trail,makeWeather,buildSites,groundShape}){
 const rnd=seeded(seed),group=new T.Group(),spawn={x:-83,z:32},w={group,half:CONFLUENCE_HALF,spawn,theme:MAPS.forest,obstacles:[],patches:[],ponds:[],sites:[],foliage:[],motes:[],breakables:[],ice:[],fords:[],bridges:[],discoveries:[],roaming:[],regions:[],road,weather:{kind:'confluence'},visited:new Set(['forest']),activeBiome:'forest'};
 const g=new T.PlaneGeometry(296,296,112,112),a=g.attributes.position,tones=[];
 for(let i=0;i<a.count;i++){const x=a.getX(i),z=-a.getY(i),c=biomeColor(x,z),n=Math.sin(x*.12+Math.sin(z*.055)*2)*Math.cos(z*.09)*.04+Math.sin(x*.64+z*.39)*.01,d=roadDistance(x,z),track=1-T.MathUtils.smoothstep(d,1.9,5.2);c.multiplyScalar(1+n).lerp(new T.Color(0x9b9076),track*.52);tones.push(c.r,c.g,c.b);}
 g.setAttribute('color',new T.Float32BufferAttribute(tones,3));const ground=new T.Mesh(g,groundMaterial);ground.rotation.x=-Math.PI/2;ground.position.y=-.03;ground.receiveShadow=true;ground.userData.ownedGeometry=true;group.add(ground);w.ground=ground;
 // One landmark event per region, plus a nearby starting relic and recovery supplies.
 for(const [i,r]of REGIONS.entries()){
  const site={x:r.x+(r.id==='coast'?20:12),z:r.z+11,type:'altar',event:biomeEvent(r.id),biome:r.id,eventAngle:rnd()*6.28,availableAt:15,claimed:false,discovered:false,reveal:0};
  w.sites.push(site,{x:r.x-17,z:r.z-13,type:'supply',biome:r.id,availableAt:30,claimed:false,discovered:false,reveal:0});
 }
 w.sites.push({x:-98,z:38,type:'relic',biome:'forest',availableAt:0,claimed:false,discovered:false,reveal:0});
 const locations={forest:[{x:-111,z:5,rx:7,rz:5,angle:.45}],snow:[{x:-77,z:-102,rx:6,rz:4,angle:-.3}],ash:[],sand:[],coast:[{x:0,z:88,rx:12,rz:17},{x:34,z:112,rx:7,rz:11}]};
 for(const r of REGIONS){
  const ponds=['ash','sand'].includes(r.id)?[]:buildPonds(group,r.id,rnd,spawn,w.sites,locations[r.id]);w.ponds.push(...ponds);w.patches.push(...ponds);
 }
 // Sparse groves and mixed foothill stones soften borders; the old road stays passable.
 for(let i=0;i<850;i++){
  const r=REGIONS[i%5],cluster=i%3!==0,ang=rnd()*6.28,rad=18+Math.sqrt(rnd())*58,x=cluster?r.x+Math.sin(ang)*rad:(rnd()-.5)*264,z=cluster?r.z+Math.cos(ang)*rad:(rnd()-.5)*264;
  if(Math.abs(x)>134||Math.abs(z)>134||roadDistance(x,z)<5.8||Math.hypot(x-spawn.x,z-spawn.z)<7||REGIONS.some(r=>Math.hypot(x-r.x,z-r.z)<11)||w.sites.some(s=>Math.hypot(x-s.x,z-s.z)<11)||w.ponds.some(p=>Math.hypot((x-p.x)/p.rx,(z-p.z)/p.rz)<1.4)||w.obstacles.some(o=>Math.hypot(x-o.x,z-o.z)<3.1))continue;
  const weights=biomeWeights(x,z);let roll=rnd(),id=REGIONS.at(-1).id;for(const q of REGIONS){roll-=weights[q.id];if(roll<=0){id=q.id;break;}}
  const prop=new T.Group();prop.position.set(x,0,z);group.add(prop);const o={x,z,r:.7,mesh:prop,biome:id};w.obstacles.push(o);const tall=2.8+rnd()*2.2;
  if(id==='forest'||id==='snow'){
   const angle=x*.37+z*.23,leaf=addTree(prop,id,tall,{angle,variation:1+Math.sin(angle)*.16,bend:Math.sin(angle*.7)*.08});w.foliage.push({leaf,x:leaf.position.x,z:leaf.position.z,phase:x*.1+z*.17});
  }else if(id==='coast')o.r=coastProp(prop,i,rnd);
  else{
   const rock=mesh('DodecahedronGeometry',[1,1],id==='ash'?0x645650:0xa18e70,0,.7,0,prop);rock.scale.set(.9,.65+rnd()*1.2,.85);rock.rotation.y=rnd()*6;
   if(id==='sand'&&i%3===0){mesh('CylinderGeometry',[.40,.5,2,9],0xb5a183,.1,1,0,prop);mesh('BoxGeometry',[1.1,.2,1.1],0xc6b798,.1,2.1,0,prop);}
   if(id==='ash'&&i%3===0){const ember=mesh('DodecahedronGeometry',[.19,0],0xcb8450,.35,.15,.45,prop);ember.scale.set(1,.3,2);}
  }
 }
 for(const r of REGIONS){
  const regional={...w,group:new T.Group(),regional:true,regions:null,spawn:{x:r.x,z:r.z},id:r.id,label:r.label,x:r.x,z:r.z,cleared:false,theme:MAPS[r.id],obstacles:w.obstacles.filter(o=>o.biome===r.id),ponds:w.ponds.filter(p=>p.biome===r.id),patches:[],sites:w.sites,foliage:w.foliage.filter(f=>f.leaf.parent&&biomeAt(f.leaf.parent.position.x,f.leaf.parent.position.z)===r.id),groves:[],contains:(x,z)=>biomeAt(x,z)===r.id,landmark:w.sites.find(s=>s.biome===r.id&&s.event)};
  group.add(regional.group);regional.weather=makeWeather(r.id,rnd,regional.group,regional.spawn,w.half);regional.weather.half=w.half;
  if(r.id==='coast'){installCoast(regional);w.bridges.push(...regional.bridges);}
  if(['sand','coast'].includes(r.id)){buildDistricts(regional,r.id,[{x:r.x-6,z:r.z+27,kind:r.id==='sand'?'court':'warehouse'}],mesh,rnd);for(const o of regional.obstacles)if(!w.obstacles.includes(o))w.obstacles.push(o);}
  let pockets=0;for(let i=0;i<200&&pockets<5;i++){const x=r.x-30+rnd()*60,z=r.z-30+rnd()*60,rad=2+rnd()*2;if(roadDistance(x,z)<6||w.sites.some(s=>Math.hypot(s.x-x,s.z-z)<9)||!regional.contains(x,z)||w.obstacles.some(o=>Math.hypot(x-o.x,z-o.z)<rad+o.r))continue;
   pockets++;const kind=r.id==='ash'?'vent':'slow',patch={x,z,r:rad,kind,biome:r.id,phase:rnd()*4};w.patches.push(patch);regional.group.add(groundShape(x,z,rad,rnd,r.id==='ash'?0x995f40:r.id==='snow'?0x9eaca8:r.id==='sand'?0x9b835f:0x405c46));if(kind==='vent'){patch.marker=groundCue(0xffa45f,rad);patch.marker.position.set(x,.09,z);patch.marker.visible=false;regional.group.add(patch.marker);}
  }
  const props=regional.obstacles;regional.obstacles=w.obstacles;installDiscoveries(regional,r.id,rnd);regional.obstacles=r.id==='snow'?w.obstacles:props;installTactics(regional,r.id,rnd);regional.obstacles=w.obstacles;installRoaming(regional,r.id,rnd);regional.obstacles=props;const terrainPatches=regional.patches;regional.patches=w.patches.filter(p=>p.biome===r.id).concat(terrainPatches);installScenery(regional,r.id,rnd);
  w.patches.push(...terrainPatches);for(const key of['discoveries','breakables','ice','fords','roaming'])w[key].push(...regional[key]);
  // A readable stone waypost, rather than another large ground ring.
  const marker=new T.Group();const tangent=curve.getTangent(REGIONS.indexOf(r)/5);marker.position.set(r.x+tangent.z*6,0,r.z-tangent.x*6);group.add(marker);w.obstacles.push({x:marker.position.x,z:marker.position.z,r:.65,mesh:marker,biome:r.id});mesh('CylinderGeometry',[.45,.65,1.3,8],0x847e68,0,.65,0,marker);const crystal=mesh('OctahedronGeometry',[.38],MAPS[r.id].accent,0,1.65,0,marker,true);regional.beacon=crystal;w.regions.push(regional);
 }
 // Coast installation can remove props in bridge lanes; remove them from global collision too.
 w.obstacles=w.obstacles.filter(o=>o.mesh.parent);
 const sandSite=w.sites.find(s=>s.event==='mechanism');sandSite.gates=[];for(let i=-1;i<=1;i++){const x=sandSite.x-9,z=sandSite.z+i*1.8,gate=new T.Group();gate.position.set(x,0,z);group.add(gate);mesh('BoxGeometry',[.85,2.2,1.5],0x9d8a6b,0,1.1,0,gate);const o={x,z,r:.85,mesh:gate,biome:'sand'};w.obstacles.push(o);sandSite.gates.push(o);}
 for(const s of w.sites){buildSites(group,[s],MAPS[s.biome]);s.trail=trail(group,REGIONS.find(r=>r.id===s.biome),s,s.biome,rnd);s.trail.visible=s.type==='relic';}
 w.fire=new T.Group();w.fire.position.set(spawn.x-2,.2,spawn.z+2);group.add(w.fire);mesh('ConeGeometry',[.2,.8,7],0xffb262,0,.4,0,w.fire,true);for(let i=0;i<5;i++){const a=i*1.26,log=mesh('CylinderGeometry',[.08,.12,1.05,6],0x68503c,Math.sin(a)*.22,0,Math.cos(a)*.22,w.fire);log.rotation.z=Math.PI/2;log.rotation.y=a;}w.light=new T.PointLight(0xffb56d,6,9);w.light.position.set(spawn.x-2,1,spawn.z+2);group.add(w.light);
 w.scenery={batches:w.regions.flatMap(r=>r.scenery.batches)};return w;
}
