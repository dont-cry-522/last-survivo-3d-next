import * as T from './vendor/three.module.js';
import {forestHabitatAt} from './forest-habitats.js?v=198';

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

// A one-time separable tent filter joins nearby roots into a faint shared bed.
// Only G changes: solids, tracks and wet-bank data remain byte-for-byte intact.
function blendForestRoots(world,data,size,pixel,extent){
 const radius=T.MathUtils.clamp(Math.round(.65/pixel),1,7),weight=(radius+1)**2,horizontal=new Float32Array(size*size);
 const region=world.forestHabitats?.region||world.regions?.find(r=>r.id==='forest');
 for(let z=0;z<size;z++)for(let x=0;x<size;x++){
  let sum=0;for(let dx=-radius;dx<=radius;dx++){const sx=x+dx;if(sx>=0&&sx<size)sum+=data[(z*size+sx)*4+1]*(radius+1-Math.abs(dx));}
  horizontal[z*size+x]=sum/weight;
 }
 for(let z=0;z<size;z++)for(let x=0;x<size;x++){
  let sum=0;for(let dz=-radius;dz<=radius;dz++){const sz=z+dz;if(sz>=0&&sz<size)sum+=horizontal[sz*size+x]*(radius+1-Math.abs(dz));}
  if(!sum)continue;
  const k=(z*size+x)*4,wx=(x+.5)*pixel-extent,wz=(z+.5)*pixel-extent;
  if(region&&!region.contains(wx,wz)){data[k+1]=0;continue;}
  const grain=.89+.11*Math.sin(wx*3.7+wz*1.9)*Math.sin(wz*2.6-wx*.7),track=1-T.MathUtils.smoothstep(data[k+2]/255,.30,.85);
  // Keep stronger irregular root centres; never sum overlapping plants. The
  // softer low contribution between them follows the scanned floor grain.
  data[k+1]=Math.round(Math.min(220,Math.max(data[k+1]*.80,sum/weight*1.65))*grain*track);
 }
}

// Static contact staining joins the existing ground pass. R retains the scenery
// shadow; G softens forest plant roots; B/A join paths, duff and wet banks.
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
  if(p.biome==='forest'&&['tuft','fern','shrub'].includes(p.kind)&&Number.isFinite(p.x+p.z))plants.push(p);
 }
 if(!sources.length&&!plants.length&&!world.forestHabitats)return null;
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
 for(const p of plants){
  const width=Number.isFinite(p.width??p.size)?p.width??p.size:1;
  const radius=T.MathUtils.clamp((p.kind==='tuft'?.62:.90)*width,.38,1.25);
  const angle=Number.isFinite(p.angle)?p.angle:0,c=Math.cos(angle),s=Math.sin(angle),outer=radius*1.28;
  const minX=Math.max(0,Math.floor((p.x-outer+extent)/pixel)),maxX=Math.min(size-1,Math.ceil((p.x+outer+extent)/pixel));
  const minZ=Math.max(0,Math.floor((p.z-outer+extent)/pixel)),maxZ=Math.min(size-1,Math.ceil((p.z+outer+extent)/pixel));
  for(let z=minZ;z<=maxZ;z++)for(let x=minX;x<=maxX;x++){
   const wx=(x+.5)*pixel-extent,wz=(z+.5)*pixel-extent,dx=wx-p.x,dz=wz-p.z;
   const u=(c*dx-s*dz)/(radius*1.10),v=(s*dx+c*dz)/(radius*.78);
   const edge=1+.12*Math.sin(wx*5.1+wz*2.7)+.07*Math.sin(wz*7.3-wx*3.1);
   const fade=1-T.MathUtils.smoothstep(Math.hypot(u,v)/edge,0,1);
   const grain=.86+.14*Math.sin(wx*3.7+wz*1.9)**2,k=(z*size+x)*4+1;
   // Overlapping roots share the strongest soft stain; dense tufts never add up
   // to a black disc. Slightly elongated, ragged edges avoid isolated circles.
   data[k]=Math.max(data[k],Math.round(220*fade*fade*grain));
  }
 }
 const forestPixels=bakeForestFloor(world,data,size,extent);
 if(plants.length)blendForestRoots(world,data,size,pixel,extent);
 const texture=new T.DataTexture(data,size,size,T.RGBAFormat);texture.name='TX_Scenery_GroundContact_A';
 texture.magFilter=T.LinearFilter;texture.minFilter=T.LinearMipmapLinearFilter;texture.generateMipmaps=true;texture.needsUpdate=true;
 // Ground materials are shared by the original world builders. Keep their
 // shader and textures intact, but give this run its own mask and material.
 const source=ground.material,material=source.clone(),compile=source.onBeforeCompile,baseKey=source.customProgramCacheKey();
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
   diffuseColor.rgb=mix(diffuseColor.rgb,diffuseColor.rgb*vec3(1.13,.84,.67)+vec3(.010,.008,.004),forestTrack*.58);
   diffuseColor.rgb*=mix(vec3(1.0),vec3(1.05,.83,.64),forestDuff*.52);
   diffuseColor.rgb*=mix(vec3(1.0),vec3(.67,.73,.69),forestDamp*.65);
   diffuseColor.rgb*=1.0-groundContact*.22;
   float forestRootGrain=${source.userData.groundSurface?'smoothstep(.28,.70,soilFine.g)*soilGrainDetail':'.5'};
   vec3 forestRootTone=mix(vec3(.84,.96,.78),vec3(1.04,.91,.76),forestRootGrain);
   diffuseColor.rgb*=mix(vec3(1.0),forestRootTone,groundContacts.g*.62);
   ${source.userData.groundSurface?`float forestRootLitter=smoothstep(.14,.50,soilFine.a)*(1.0-smoothstep(.025,.09,soilPixel));
   diffuseColor.rgb*=mix(vec3(1.0),vec3(1.10,.87,.65),groundContacts.g*forestRootLitter*.13);`:''}
  `);
  shader.fragmentShader=shader.fragmentShader.replace('#include <metalnessmap_fragment>','if(max(forestTrack,max(forestDuff,forestDamp))>0.0){\nroughnessFactor=clamp(roughnessFactor+forestDuff*.07-forestTrack*.025-forestDamp*.21,.66,1.0);\n}\n#include <metalnessmap_fragment>');
  shader.fragmentShader=shader.fragmentShader.replace('#include <aomap_fragment>','#include <aomap_fragment>\nreflectedLight.indirectDiffuse*=1.0-groundContact*.16;\nreflectedLight.indirectDiffuse*=1.0-groundContacts.g*.06;');
 };
 material.customProgramCacheKey=()=>baseKey+'|scenery-ground-contact-forest-root-bed';ground.material=material;
 const state={texture,material,sources:sources.length,plants:plants.length,forestPixels,disposed:false};world.environmentGrounding=state;
 const release=()=>{if(state.disposed)return;state.disposed=true;texture.dispose();material.dispose();ground.material=source;ground.geometry.removeEventListener('dispose',release);};
 ground.geometry.addEventListener('dispose',release);
 return state;
}
