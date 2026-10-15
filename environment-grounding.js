import * as T from './vendor/three.module.js';
import {forestHabitatAt} from './forest-habitats.js?v=211';
import {biomeWeights} from './confluence.js?v=211';

function bakeForestFloor(world,data,size,extent){
 const habitat=world.forestHabitats;if(!habitat)return 0;
 const inside=(x,z)=>!habitat.region||habitat.region.contains(x,z),pixel=2*extent/size,segments=[],point=new T.Vector3();
 const line=(a,b,width)=>{if(segments.length<2048&&Number.isFinite(a.x+a.z+b.x+b.z)&&Math.hypot(a.x-b.x,a.z-b.z)>.001)segments.push({a,b,width});};
 for(let i=1;i<(world.road?.length||0);i++)line(world.road[i-1],world.road[i],2.2);
 const approach=world.forestHabitats?.approach;
 for(let i=1;i<(approach?.points.length||0);i++)line(approach.points[i-1],approach.points[i],.72);
 for(const site of world.sites||[]){
  const trail=site.trail,p=trail?.geometry?.attributes.position;
  // Discovery still owns hidden guides. Do not bake unrevealed destinations
  // permanently into the floor or replace the existing guide mesh.
  if(!trail?.visible||!p||site.biome&&site.biome!=='forest')continue;
  trail.updateWorldMatrix(true,false);let previous;
  for(let i=0;i+3<p.count;i+=4){
   point.set((p.getX(i+1)+p.getX(i+2))*.5,(p.getY(i+1)+p.getY(i+2))*.5,(p.getZ(i+1)+p.getZ(i+2))*.5).applyMatrix4(trail.matrixWorld);
   const next={x:point.x,z:point.z};
   if(previous)line(previous,next,.65);previous=next;
  }
 }
 for(const {a,b,width}of segments){
  const outer=width+1.25,dx=b.x-a.x,dz=b.z-a.z,length2=dx*dx+dz*dz;
  const minX=Math.max(0,Math.floor((Math.min(a.x,b.x)-outer+extent)/pixel)),maxX=Math.min(size-1,Math.ceil((Math.max(a.x,b.x)+outer+extent)/pixel));
  const minZ=Math.max(0,Math.floor((Math.min(a.z,b.z)-outer+extent)/pixel)),maxZ=Math.min(size-1,Math.ceil((Math.max(a.z,b.z)+outer+extent)/pixel));
  for(let z=minZ;z<=maxZ;z++)for(let x=minX;x<=maxX;x++){
   const wx=(x+.5)*pixel-extent,wz=(z+.5)*pixel-extent;if(!inside(wx,wz))continue;
   const t=T.MathUtils.clamp(((wx-a.x)*dx+(wz-a.z)*dz)/length2,0,1),distance=Math.hypot(wx-a.x-dx*t,wz-a.z-dz*t);
   const rag=.11*Math.sin(wx*1.43+wz*.61)+.08*Math.sin(wz*2.17-wx*.38);
   const wear=1-T.MathUtils.smoothstep(distance,width*.38,outer+rag),k=(z*size+x)*4+2;
   data[k]=Math.max(data[k],Math.round(255*wear));
  }
 }
 const ponds=habitat.ponds.map(p=>({...p,c:Math.cos(p.angle||0),s:Math.sin(p.angle||0)}));
 // Outside these existing habitats and the baked road channel, the answer is
 // neutral. Avoid expensive biome membership queries across the joined map.
 const bounds=[...habitat.groves.map(p=>({...p,r:17})),...ponds.map(p=>({...p,r:Math.max(p.rx,p.rz)*1.12+2.5}))].map(p=>({
  minX:Math.floor((p.x-p.r+extent)/pixel),maxX:Math.ceil((p.x+p.r+extent)/pixel),minZ:Math.floor((p.z-p.r+extent)/pixel),maxZ:Math.ceil((p.z+p.r+extent)/pixel)
 }));let pixels=0;
 for(let z=0;z<size;z++)for(let x=0;x<size;x++){
  const k=(z*size+x)*4;if(!data[k+2]&&!bounds.some(b=>x>=b.minX&&x<=b.maxX&&z>=b.minZ&&z<=b.maxZ))continue;
  const wx=(x+.5)*pixel-extent,wz=(z+.5)*pixel-extent;if(!inside(wx,wz))continue;
  const area=forestHabitatAt(world,wx,wz),patch=.5+.5*Math.sin(wx*.24+Math.sin(wz*.19)*1.3)*Math.sin(wz*.31-wx*.08);
  const track=data[k+2]/255,shoulder=4*track*(1-track);let wet=0;
  if(area.bank>.2)for(const p of ponds){
   const dx=wx-p.x,dz=wz-p.z,u=(p.c*dx-p.s*dz)/p.rx,v=(p.s*dx+p.c*dz)/p.rz,a=Math.atan2(v,u);
   // Same irregular shoreline as the water mesh; the broad habitat bank weight
   // alone would stain a nine-metre halo around every pond.
   const distance=(Math.hypot(u,v)-(1+.07*Math.sin(a*3)+.045*Math.cos(a*5)))*Math.min(p.rx,p.rz);
   const damp=T.MathUtils.smoothstep(distance,-.75,.08)*(1-T.MathUtils.smoothstep(distance,.15,1.45+patch*.8));
   wet=Math.max(wet,damp*(.44+patch*.22));
  }
  const leaf=Math.max(area.shade*(.26+patch*.32),shoulder*(.24+patch*.18))*(1-wet)*(1-T.MathUtils.smoothstep(track,.68,.96));
  // A is signed around 128: dry duff above, damp mineral soil below. This leaves
  // B independent for tracks and keeps neutral/non-forest pixels truly neutral.
  const value=leaf*(1-wet*1.5)-wet;
  data[k+3]=Math.round(128+T.MathUtils.clamp(value,-1,1)*127);
  if(data[k+2]||data[k+3]!==128)pixels++;
 }
 return pixels;
}

// One separable tent filter per occupied biome joins nearby roots and scree.
// Its bounded CPU buffers are reused; only the existing G texture channel changes.
function blendRoots(data,roots,horizontal,size,pixel,extent,region,bounds){
 const radius=T.MathUtils.clamp(Math.round(.65/pixel),1,7),weight=(radius+1)**2;
 const minX=Math.max(0,bounds.minX-radius),maxX=Math.min(size-1,bounds.maxX+radius),minZ=Math.max(0,bounds.minZ-radius),maxZ=Math.min(size-1,bounds.maxZ+radius);
 for(let z=minZ;z<=maxZ;z++)for(let x=minX;x<=maxX;x++){
  let sum=0;for(let dx=-radius;dx<=radius;dx++){const sx=x+dx;if(sx>=0&&sx<size)sum+=roots[z*size+sx]*(radius+1-Math.abs(dx));}
  horizontal[z*size+x]=sum/weight;
 }
 for(let z=minZ;z<=maxZ;z++)for(let x=minX;x<=maxX;x++){
  let sum=0;for(let dz=-radius;dz<=radius;dz++){const sz=z+dz;if(sz>=minZ&&sz<=maxZ)sum+=horizontal[sz*size+x]*(radius+1-Math.abs(dz));}
  if(!sum)continue;
  const k=(z*size+x)*4,wx=(x+.5)*pixel-extent,wz=(z+.5)*pixel-extent;
  if(region&&!region.contains(wx,wz))continue;
  const grain=.89+.11*Math.sin(wx*3.7+wz*1.9)*Math.sin(wz*2.6-wx*.7),track=1-T.MathUtils.smoothstep(data[k+2]/255,.30,.85),border=region?.id?T.MathUtils.smoothstep(biomeWeights(wx,wz)[region.id]||0,.50,.72):1;
  // Keep stronger irregular root centres; never sum overlapping plants. The
  // softer low contribution between them follows the scanned floor grain.
  data[k+1]=Math.max(data[k+1],Math.round(Math.min(220,Math.max(roots[z*size+x]*.80,sum/weight*1.65))*grain*track*border));
 }
}

// Local use leaves a broken path through each existing place, with loose
// material collecting at its shoulders. Never follow a site or reward guide.
// Run after root blending so R/G and every existing forest track stay exact.
function bakePlaceFloors(world,data,size,pixel,extent){
 const records=[],smooth=T.MathUtils.smoothstep;
 for(const place of world.biomePlaces||[]){
  const {biome,x,z,angle=0}=place;if(!['forest','snow','ash','sand','coast'].includes(biome)||!Number.isFinite(x+z+angle))continue;
  const c=Math.cos(angle),s=Math.sin(angle),region=world.regions?.find(r=>r.id===biome),phase=(place.variant||0)*2.1;
  const record={biome,index:place.index,x,z,angle,entrance:place.entrance,exit:place.exit,pixels:0,wearPixels:0,sedimentPixels:0};
  const reach=13,minX=Math.max(0,Math.floor((x-reach+extent)/pixel)),maxX=Math.min(size-1,Math.ceil((x+reach+extent)/pixel)),minZ=Math.max(0,Math.floor((z-reach+extent)/pixel)),maxZ=Math.min(size-1,Math.ceil((z+reach+extent)/pixel));
  const fx=place.focus?c*(place.focus.x-x)-s*(place.focus.z-z):0,fz=place.focus?s*(place.focus.x-x)+c*(place.focus.z-z):0;
  for(let row=minZ;row<=maxZ;row++)for(let col=minX;col<=maxX;col++){
   const wx=(col+.5)*pixel-extent,wz=(row+.5)*pixel-extent,dx=wx-x,dz=wz-z,u=c*dx-s*dz,v=s*dx+c*dz,k=(row*size+col)*4;
   if(Math.abs(u)>8.7||Math.abs(v)>11.5||region&&!region.contains(wx,wz))continue;
   const border=world.regions?smooth(biomeWeights(wx,wz)[biome]||0,.58,.88):1;if(!border)continue;
   // A visible guide, a road shoulder or damp forest bank already owns this
   // pixel. Do not recolor it, erase it or change the roots blended against it.
   if(data[k+2]||biome==='forest'&&data[k+3]<128)continue;
   const patch=.5+.5*Math.sin(u*1.21+v*.63+phase)*Math.sin(v*.91-u*.36),grain=.72+.28*patch;
   const end=1-smooth(Math.abs(v),8.2,11.5),axis=.35*Math.sin(v*.43+phase)+.16*Math.sin(v*.91),d=Math.abs(u-axis);
   const lane=(1-smooth(d,.35,1.55+.22*Math.sin(v*.7)))*end;
   // Only the near, open side of the focus receives a short lateral scuff.
   // A trunk, kiln or wreck focus itself can be solid and is never a waypoint.
   const side=Math.sign(fx),toward=side*u,branch=(1-smooth(Math.abs(v-fz+.18*Math.sin(u*1.4)),.28,1.16))*smooth(toward,.35,1.25)*(1-smooth(toward,2.8,3.9))*end;
   const shoulder=(1-smooth(Math.abs(d-(2.05+.24*Math.sin(v*.58+phase))),.18,1.18))*end;
   const edge=(1-smooth(Math.abs(u),6.9,8.7))*(1-smooth(Math.abs(v),6.2,8.5));
   const sheltered=smooth(Math.abs(u),3.1,4.7)*edge*(.48+.52*patch);
   let wear=0,deposit=0;
   if(biome==='forest'){
    wear=Math.max(lane*.63,branch*.48)*grain;deposit=Math.max(shoulder*.42,sheltered*.32)*grain;
   }else if(biome==='snow'){
    // Two broad, interrupted runner depressions read at the joined map's
    // coarser texel size; a faint packed bed keeps them from looking painted.
    const runner=(1-smooth(Math.abs(d-.68),.13,.60))*end*(.34+.66*patch);
    wear=Math.max(runner*.74,lane*.24,branch*.40);deposit=Math.max(shoulder*.52,sheltered*.44)*grain;
   }else if(biome==='ash'){
    wear=Math.max(lane*.69,branch*.62)*(.55+.45*patch);deposit=Math.max(shoulder*.24,sheltered*.40)*grain;
   }else if(biome==='sand'){
    // Wind deposits a wider tongue on one side; the broken darker centre is
    // compacted mineral ground, not another continuous paved road.
    wear=Math.max(lane*.54,branch*.58)*grain;deposit=Math.max(shoulder*(u>axis?.56:.22),sheltered*.56)*grain;
   }else{
    wear=Math.max(lane*.61,branch*.52)*grain;deposit=-Math.max(shoulder*.42,sheltered*.50)*grain;
   }
   const beforeA=data[k+3],b=Math.round(255*wear*border),a=Math.round(128+127*deposit*border);
   data[k+2]=b;data[k+3]=deposit<0?Math.min(beforeA,a):Math.max(beforeA,a);
   if(b||data[k+3]!==beforeA){record.pixels++;if(b)record.wearPixels++;if(data[k+3]!==beforeA)record.sedimentPixels++;}
  }
  records.push(record);
 }
 return records;
}

// Static contact staining joins the existing ground pass. R retains the scenery
// shadow; G softens local plant/stone contacts; B/A join paths, duff and wet banks.
// This is a bounded build-time mask, not screen-space or real-time AO.
export function installEnvironmentGrounding(world){
 const ground=world.ground;
 if(!ground?.userData.ownedGeometry||!ground.material?.isMeshStandardMaterial)return null;
 if(world.environmentGrounding&&!world.environmentGrounding.disposed)return world.environmentGrounding;
 // Ruin columns reuse tree colliders rather than place/cluster records. Their
 // permanent plinths need the same ground contact; falling timber still does not.
 const sources=(world.obstacles||[]).filter(o=>(o.place||o.environmentCluster||o.climateLandform||o.mesh?.userData.forestVistaTrunk&&!world.breakables?.includes(o))&&!o.tactic&&Number.isFinite(o.x+o.z+o.r)&&o.r>0);
 const plants=[];
 for(const group of [world.adventureGroundDetail,world.habitatDetail])for(const p of group?.userData.records||[]){
  if(plants.length>=4096)break;
  if(['forest','snow','ash','sand','coast'].includes(p.biome)&&['tuft','fern','shrub','reed','stone'].includes(p.kind)&&Number.isFinite(p.x+p.z))plants.push(p);
 }
 if(!sources.length&&!plants.length&&!world.forestHabitats&&!world.biomePlaces?.length)return null;
 const size=512,extent=world.half+8,pixel=2*extent/size,data=new Uint8Array(size*size*4);
 for(let i=3;i<data.length;i+=4)data[i]=128;
 for(const o of sources){
  const radius=o.r+.72,inner=o.r*.64;
  const minX=Math.max(0,Math.floor((o.x-radius+extent)/pixel)),maxX=Math.min(size-1,Math.ceil((o.x+radius+extent)/pixel));
  const minZ=Math.max(0,Math.floor((o.z-radius+extent)/pixel)),maxZ=Math.min(size-1,Math.ceil((o.z+radius+extent)/pixel));
  for(let z=minZ;z<=maxZ;z++)for(let x=minX;x<=maxX;x++){
   const wx=(x+.5)*pixel-extent,wz=(z+.5)*pixel-extent,d=Math.hypot(wx-o.x,wz-o.z);
   const fade=1-T.MathUtils.smoothstep(d,inner,radius),grain=.92+.08*Math.sin(wx*2.7+wz*1.8)*Math.sin(wz*3.2-wx*.9);
   const k=(z*size+x)*4;data[k]=Math.max(data[k],Math.round(255*fade*fade*grain));
  }
 }
 const forestPixels=bakeForestFloor(world,data,size,extent),rootCounts={forest:0,snow:0,ash:0,sand:0,coast:0};
 const roots=plants.length?new Uint8Array(size*size):null,horizontal=plants.length?new Float32Array(size*size):null;
 for(const biome of Object.keys(rootCounts)){
  const local=plants.filter(p=>p.biome===biome);rootCounts[biome]=local.length;if(!local.length)continue;
  roots.fill(0);const region=world.regions?.find(r=>r.id===biome)||(biome==='forest'?world.forestHabitats?.region:null),bounds={minX:size,minZ:size,maxX:-1,maxZ:-1};
 for(const p of local){
  const width=Number.isFinite(p.width??p.size)?p.width??p.size:1;
  const stone=p.kind==='stone',radius=T.MathUtils.clamp((stone?.66:p.kind==='tuft'?.62:p.kind==='reed'?.78:.90)*width,stone?.30:.38,stone?.85:1.25),strength=stone?184:biome==='forest'?220:200;
  const angle=Number.isFinite(p.angle)?p.angle:0,c=Math.cos(angle),s=Math.sin(angle),outer=radius*1.28;
  const minX=Math.max(0,Math.floor((p.x-outer+extent)/pixel)),maxX=Math.min(size-1,Math.ceil((p.x+outer+extent)/pixel));
  const minZ=Math.max(0,Math.floor((p.z-outer+extent)/pixel)),maxZ=Math.min(size-1,Math.ceil((p.z+outer+extent)/pixel));
  if(minX>maxX||minZ>maxZ)continue;
  bounds.minX=Math.min(bounds.minX,minX);bounds.maxX=Math.max(bounds.maxX,maxX);bounds.minZ=Math.min(bounds.minZ,minZ);bounds.maxZ=Math.max(bounds.maxZ,maxZ);
  for(let z=minZ;z<=maxZ;z++)for(let x=minX;x<=maxX;x++){
   const wx=(x+.5)*pixel-extent,wz=(z+.5)*pixel-extent,dx=wx-p.x,dz=wz-p.z;
   if(region&&!region.contains(wx,wz))continue;
   const u=(c*dx-s*dz)/(radius*1.10),v=(s*dx+c*dz)/(radius*.78);
   const edge=1+.12*Math.sin(wx*5.1+wz*2.7)+.07*Math.sin(wz*7.3-wx*3.1);
   const fade=1-T.MathUtils.smoothstep(Math.hypot(u,v)/edge,0,1);
   const grain=.86+.14*Math.sin(wx*3.7+wz*1.9)**2,k=z*size+x;
   // Overlapping roots share the strongest soft stain; dense tufts never add up
   // to a black disc. Slightly elongated, ragged edges avoid isolated circles.
   roots[k]=Math.max(roots[k],Math.round(strength*fade*fade*grain));
  }
 }
  if(bounds.maxX>=bounds.minX)blendRoots(data,roots,horizontal,size,pixel,extent,region,bounds);
 }
 const placeFloors=bakePlaceFloors(world,data,size,pixel,extent);
 const texture=new T.DataTexture(data,size,size,T.RGBAFormat);texture.name='TX_Scenery_GroundContact_A';
 texture.magFilter=T.LinearFilter;texture.minFilter=T.LinearMipmapLinearFilter;texture.generateMipmaps=true;texture.needsUpdate=true;
 // Ground materials are shared by the original world builders. Keep their
 // shader and textures intact, but give this run its own mask and material.
 const source=ground.material,material=source.clone(),compile=source.onBeforeCompile,baseKey=source.customProgramCacheKey();
 const plainBiome=Object.keys(rootCounts).filter(id=>rootCounts[id]>0),rootClimate=id=>source.userData.groundSurface?'soil'+id[0].toUpperCase()+id.slice(1):plainBiome.length===1&&plainBiome[0]===id?'1.0':'0.0';
 material.onBeforeCompile=(shader,renderer)=>{
  compile.call(material,shader,renderer);
  shader.uniforms.sceneryContact={value:texture};shader.uniforms.sceneryExtent={value:extent};
  shader.vertexShader='varying vec2 sceneryGround;\n'+shader.vertexShader;
  shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nsceneryGround=(modelMatrix*vec4(position,1.0)).xz;');
  shader.fragmentShader='uniform sampler2D sceneryContact; uniform float sceneryExtent; varying vec2 sceneryGround;\n'+shader.fragmentShader;
  shader.fragmentShader=shader.fragmentShader.replace('#include <roughnessmap_fragment>',`#include <roughnessmap_fragment>
   vec4 groundContacts=texture2D(sceneryContact,sceneryGround/(sceneryExtent*2.0)+.5);
   float groundContact=groundContacts.r;
   float forestTrack=smoothstep(.25,.87,groundContacts.b);
   float forestFloor=(groundContacts.a-(128.0/255.0))*(255.0/127.0);
   float forestDuff=max(0.0,forestFloor),forestDamp=max(0.0,-forestFloor);
   vec3 floorWearTone=vec3(1.13,.84,.67),floorDepositTone=vec3(1.05,.83,.64),floorDampTone=vec3(.67,.73,.69);
   ${source.userData.groundSurface?`// Climate-specific compaction and deposits share the existing mask sample.
   // Forest defaults remain the same; joined-map climate colors blend softly.
   floorWearTone=mix(floorWearTone,vec3(.76,.86,.93),soilSnow);
   floorWearTone=mix(floorWearTone,vec3(.65,.67,.65),soilAsh);
   floorWearTone=mix(floorWearTone,vec3(.87,.80,.68),soilSand);
   floorWearTone=mix(floorWearTone,vec3(.63,.77,.75),soilCoast);
   floorDepositTone=mix(floorDepositTone,vec3(1.12,1.11,1.08),soilSnow);
   floorDepositTone=mix(floorDepositTone,vec3(1.15,1.12,1.06),soilAsh);
   floorDepositTone=mix(floorDepositTone,vec3(1.13,1.08,.98),soilSand);
   floorDampTone=mix(floorDampTone,vec3(.64,.79,.79),soilCoast);`:''}
   diffuseColor.rgb=mix(diffuseColor.rgb,diffuseColor.rgb*floorWearTone+vec3(.010,.008,.004),forestTrack*.58);
   diffuseColor.rgb*=mix(vec3(1.0),floorDepositTone,forestDuff*.52);
   diffuseColor.rgb*=mix(vec3(1.0),floorDampTone,forestDamp*.65);
   diffuseColor.rgb*=1.0-groundContact*.22;
   ${source.userData.groundSurface?`// The outer contact fringe deposits the local ground material; the inner
   // contact remains darker. Reuse the existing mask and terrain samples so
   // stones do not sit inside a new circular decal or a second render pass.
   float contactFringe=4.0*groundContact*(1.0-groundContact);
   float contactGrain=mix(.55,1.0,smoothstep(.25,.76,soilClump+soilFine.g*.20));
   float contactDeposit=contactFringe*contactGrain;
   vec3 contactTone=vec3(1.0);
   contactTone=mix(contactTone,vec3(.94,.78,.57),soilOrganic*(1.0-soilCoast)*.68);
   contactTone=mix(contactTone,vec3(.94,1.04,1.13),soilSnow*.74);
   contactTone=mix(contactTone,vec3(1.14,1.03,.79),soilSand*.64);
   contactTone=mix(contactTone,vec3(.74,.71,.70),soilAsh*.76);
   contactTone=mix(contactTone,vec3(.65,.78,.77),soilCoast*.80);
   diffuseColor.rgb*=mix(vec3(1.0),contactTone,contactDeposit);
   diffuseColor.rgb+=vec3(.020,.024,.028)*contactDeposit*soilSnow;
   if(contactDeposit>0.0)roughnessFactor=clamp(roughnessFactor+contactDeposit*(soilSnow*.07+soilSand*.05+soilAsh*.08-soilCoast*.19),.62,1.0);`:''}
   float forestRootGrain=${source.userData.groundSurface?'smoothstep(.28,.70,soilFine.g)*soilGrainDetail':'.5'};
   float rootContact=groundContacts.g*(1.0-forestTrack);
   vec3 forestRootTone=mix(vec3(.84,.96,.78),vec3(1.04,.91,.76),forestRootGrain);
   // Root and scree contacts borrow the local mineral colour. The same fine
   // sample breaks their edges; no forest-green or leaf litter is added to sand.
   forestRootTone=mix(forestRootTone,mix(vec3(.80,.88,.92),vec3(1.02,1.04,1.05),forestRootGrain),${rootClimate('snow')});
   forestRootTone=mix(forestRootTone,mix(vec3(.88,.84,.80),vec3(1.08,1.02,.94),forestRootGrain),${rootClimate('ash')});
   forestRootTone=mix(forestRootTone,mix(vec3(.91,.86,.76),vec3(1.05,.97,.83),forestRootGrain),${rootClimate('sand')});
   forestRootTone=mix(forestRootTone,mix(vec3(.79,.86,.82),vec3(.93,.98,.93),forestRootGrain),${rootClimate('coast')});
   diffuseColor.rgb*=mix(vec3(1.0),forestRootTone,rootContact*.62);
   ${source.userData.groundSurface?`float forestRootLitter=smoothstep(.14,.50,soilFine.a)*(1.0-smoothstep(.025,.09,soilPixel));
   diffuseColor.rgb*=mix(vec3(1.0),vec3(1.10,.87,.65),rootContact*forestRootLitter*.13*soilOrganic*(1.0-soilCoast));`:''}
  `);
  shader.fragmentShader=shader.fragmentShader.replace('#include <metalnessmap_fragment>','if(max(forestTrack,max(forestDuff,forestDamp))>0.0){\nroughnessFactor=clamp(roughnessFactor+forestDuff*.07-forestTrack*.025-forestDamp*.21,.66,1.0);\n}\n#include <metalnessmap_fragment>');
  shader.fragmentShader=shader.fragmentShader.replace('#include <aomap_fragment>','#include <aomap_fragment>\nreflectedLight.indirectDiffuse*=1.0-groundContact*.16;\nreflectedLight.indirectDiffuse*=1.0-rootContact*.06;');
 };
 material.customProgramCacheKey=()=>baseKey+'|scenery-ground-contact-biome-roots'+(source.userData.groundSurface?'':'|'+plainBiome.join(','));ground.material=material;
 const state={texture,material,sources:sources.length,plants:plants.length,rootCounts,forestPixels,placeFloors,disposed:false};world.environmentGrounding=state;
 const release=()=>{if(state.disposed)return;state.disposed=true;texture.dispose();material.dispose();ground.material=source;ground.geometry.removeEventListener('dispose',release);};
 ground.geometry.addEventListener('dispose',release);
 return state;
}
