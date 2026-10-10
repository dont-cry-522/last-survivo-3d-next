import{onIce,onFord}from'./map-tactics.js?v=114';
import{onBridge}from'./coast.js?v=114';
import{MAP_SCALE}from'./map-layout.js?v=114';
import{coastLayout}from'./coast-layout.js?v=114';
import{swimStroke,swimLimb,HERO_SWIM,heroSwimPose,swimTravel}from'./swim-motion.js?v=114';
import{newHeroAttack}from'./new-hero-motion.js?v=114';
import{naturalRockGeometry,environmentDetailTexture}from'./biome-scenery.js?v=131';
import{CLIMATE_LIGHT}from'./environment-lighting.js?v=124';
import * as T from './vendor/three.module.js';
const clamp=T.MathUtils.clamp;
const shore=a=>1+.07*Math.sin(a*3)+.045*Math.cos(a*5);
export function waterDepth(p,x,z){
 const dx=x-p.x,dz=z-p.z;if(Math.abs(dx)>(p.r||Math.max(p.rx,p.rz)*1.12)||Math.abs(dz)>(p.r||Math.max(p.rx,p.rz)*1.12))return 0;const c=Math.cos(p.angle||0),s=Math.sin(p.angle||0),u=(c*dx-s*dz)/p.rx,v=(s*dx+c*dz)/p.rz;
 return clamp((1-Math.hypot(u,v)/shore(Math.atan2(v,u)))/.48,0,1);
}
export function terrainAt(world,x,z,kind='hero'){
 if(onBridge(world,x,z))return{kind:'bridge',depth:0,floating:false,speed:1};
 if(onFord(world,x,z))return{kind:'ford',depth:.12,floating:false,speed:.94};
 if(onIce(world,x,z))return{kind:'ice',depth:0,floating:false,speed:1.04};
 let depth=0;for(const p of world.patches)if(p.kind==='water')depth=Math.max(depth,waterDepth(p,x,z));
 const floating=['snowtotem','cinderwisp','jellyseer'].includes(kind),heavy=['golem','yeti','lavabrute','boss','frostking','cinderlord','reefturtle','wreckwarden'].includes(kind);
 const tidal=!world.regions||world.patches.some(p=>p.kind==='water'&&p.baseRx!==undefined&&waterDepth(p,x,z)>0);
 if(depth>0)return{kind:'water',depth,floating,speed:floating?1:(1-depth*(heavy?.24:.52))*(world.tide?.high&&tidal?1-.18*depth:1)};
 const slow=world.patches.find(p=>p.kind==='slow'&&Math.hypot(p.x-x,p.z-z)<p.r);return{kind:slow?'slow':'land',depth:0,floating,speed:slow?(kind==='hero'?.72:.75)*(world.sandstorm?.active&&(!slow.biome||slow.biome==='sand')?.72:1):1};
}
let surfaceGeometry;const stoneGeometry=naturalRockGeometry,surfaces=new Map();
// Two bent leaves retain each existing reed's anchor, height and instanced draw.
const reedGeometry=(()=>{
 const positions=[],colors=[],indices=[];
 for(let leaf=0;leaf<2;leaf++){
  const offset=positions.length/3,angle=leaf*1.9,c=Math.cos(angle),s=Math.sin(angle);
  for(let row=0;row<4;row++){
   const t=row/3,width=[.16,.60,.39,.018][row],bend=t*t*(leaf?1.8:1.3),height=t*(leaf?.78:1)-.5;
   for(const side of[-1,1]){
    const x=bend+side*width;positions.push(c*x,height,s*x+Math.sin(t*Math.PI)*.18);
    colors.push(.65+t*.35,.72+t*.25,.60+t*.18);
   }
   if(row<3){const a=offset+row*2;indices.push(a,a+1,a+2,a+1,a+3,a+2);}
  }
 }
 const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));geometry.setAttribute('color',new T.Float32BufferAttribute(colors,3));geometry.setIndex(indices);geometry.computeVertexNormals();return geometry;
})();
// Adjacent reaches shade as one body of water; their internal shores must not
// fade independently into bright crossing bands.
// ponytail: eight reaches cover this harbor; expand the uniform arrays and loop together if more are added.
const coastUnionShader=`uniform vec4 coastPonds[8];uniform vec2 coastTurns[8];uniform int coastCount;
float coastRadial(vec2 point,float scale,float nearest){
 for(int i=0;i<8;i++){
  if(i>=coastCount)break;
  vec2 d=point-coastPonds[i].xy,t=coastTurns[i];
  vec2 uv=vec2(t.x*d.x-t.y*d.y,t.y*d.x+t.x*d.y)/(coastPonds[i].zw*scale);
  float radius=length(uv);if(radius>nearest*1.115)continue;
  float a=atan(uv.y,uv.x);nearest=min(nearest,radius/(1.0+.07*sin(a*3.0)+.045*cos(a*5.0)));
 }
 return nearest;
}`;
function waterSurface(id){
 if(!surfaceGeometry){
  const points=[],colors=[],indices=[],n=48,rings=[0,.52,.82,1];
  for(const r of rings)for(let i=0;i<n;i++){const a=i/n*Math.PI*2,k=shore(a)*r;points.push(Math.cos(a)*k,0,Math.sin(a)*k);const tint=new T.Color().setRGB(.36+r*.36,.65+r*.24,.68+r*.23);colors.push(tint.r,tint.g,tint.b);}
  for(let ring=0;ring<rings.length-1;ring++)for(let i=0;i<n;i++){const a=ring*n+i,b=ring*n+(i+1)%n,c=a+n,d=b+n;indices.push(a,b,c,b,d,c);}
  surfaceGeometry=new T.BufferGeometry();surfaceGeometry.setAttribute('position',new T.Float32BufferAttribute(points,3));surfaceGeometry.setAttribute('color',new T.Float32BufferAttribute(colors,3));surfaceGeometry.setIndex(indices);surfaceGeometry.computeVertexNormals();
 }
 if(!surfaces.has(id)){
  const clock={value:0},detail={value:environmentDetailTexture()},climate=CLIMATE_LIGHT[id]||CLIMATE_LIGHT.forest,reflection={waterSky:{value:new T.Color(climate.sky)},waterHorizon:{value:new T.Color(climate.fog)}},coast=id==='coast'?{coastPonds:{value:Array.from({length:8},()=>new T.Vector4())},coastTurns:{value:Array.from({length:8},()=>new T.Vector2())},coastCount:{value:0}}:null,material=new T.MeshStandardMaterial({color:id==='snow'?0x71bdcf:0x398f91,vertexColors:true,roughness:.38,metalness:0,side:T.DoubleSide,transparent:true,depthWrite:false});
  material.forceSinglePass=true;
  material.onBeforeCompile=shader=>{shader.uniforms.waterTime=clock;shader.uniforms.waterDetail=detail;Object.assign(shader.uniforms,reflection);if(coast)Object.assign(shader.uniforms,coast);shader.vertexShader='varying vec3 waterWorld; varying vec2 waterLocal;\n'+shader.vertexShader;shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nwaterWorld=(modelMatrix*vec4(position,1.0)).xyz;waterLocal=position.xz;');shader.fragmentShader=(coast?coastUnionShader:'')+'\nuniform float waterTime; uniform sampler2D waterDetail; uniform vec3 waterSky; uniform vec3 waterHorizon; varying vec3 waterWorld; varying vec2 waterLocal;\n'+shader.fragmentShader;shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
    float angle=atan(waterLocal.y,waterLocal.x);
    float radial=length(waterLocal)/(1.0+.07*sin(angle*3.0)+.045*cos(angle*5.0));
    ${coast?'float ownRadial=radial;radial=coastRadial(waterWorld.xz,1.0,radial);':''}
    float depth=clamp((1.0-radial)/.48,0.0,1.0),edge=1.0-smoothstep(.0,1.0,depth);
    // A slowly advecting field bends and breaks crests across intersecting reaches.
    vec2 waterFlow=texture2D(waterDetail,waterWorld.xz*.035+vec2(waterTime*.0012,-waterTime*.0008)).rg;
    vec3 shoreGrain=texture2D(waterDetail,waterWorld.xz*.065).rgb;
    float shoreBreak=smoothstep(.23,.76,shoreGrain.y);
    float waterPixel=max(length(dFdx(waterWorld.xz)),length(dFdy(waterWorld.xz)));
    float rippleDetail=1.0-smoothstep(.09,.36,waterPixel);
    float swellA=waterWorld.x*.65+waterWorld.z*.95-waterTime*.55+waterFlow.x*2.6;
    float swellB=waterWorld.x*-1.25+waterWorld.z*.48-waterTime*.41+waterFlow.x*1.7-waterFlow.y*.7;
    float rippleA=sin(waterWorld.x*2.8+waterWorld.z*3.9+sin(swellA)*1.5+sin(swellB)*.8-waterTime*.83);
    float rippleB=sin(waterWorld.x*-3.5+waterWorld.z*2.1+sin(swellB)*1.1+waterFlow.y*2.2-waterTime*.62);
    float light=pow(max(0.0,rippleA),10.0)*smoothstep(.48,.87,rippleB)*(.3+waterFlow.y*.7)*.038*rippleDetail;
    // Wind crosses the bank in short fragments, never in radial foam rings.
    float lapPhase=swellA*1.35+waterFlow.y*2.0;
    float shoreLap=pow(max(0.0,sin(lapPhase)),5.0)*smoothstep(.72,.88,radial)*(1.0-smoothstep(.95,1.0,radial))*(.3+waterFlow.y*.7)*shoreBreak;
    float waveHeight=(sin(swellA)*${id==='coast'?'.045':'.033'}+sin(swellB)*${id==='coast'?'.026':'.020'}+(rippleA+rippleB)*.0025*rippleDetail)*(1.0-edge*.72)+shoreLap*.003;
    vec3 deepWater=vec3(${id==='coast'?'.021,.098,.129':id==='snow'?'.029,.086,.126':'.012,.050,.048'});
    vec3 shallowWater=vec3(${id==='coast'?'.080,.170,.170':id==='snow'?'.090,.170,.200':id==='forest'?'.021,.064,.055':'.071,.132,.112'});
    vec3 sediment=vec3(${id==='coast'?'.160,.135,.085':id==='snow'?'.115,.137,.125':id==='sand'?'.290,.220,.120':'.043,.052,.038'});
    float bedDetail=mix(.5,shoreGrain.b,rippleDetail);
    // Stationary sediment shelves break the radial color bands without changing water depth.
    float bedDepth=clamp(depth+(shoreGrain.x-.5)*.28+(shoreGrain.y-.5)*.12,0.0,1.0);
    float bedVisibility=(1.0-smoothstep(.04,${id==='forest'?'.30':'.66'},bedDepth))*${id==='forest'?'.42*(.18+.82*smoothstep(.38,.72,shoreGrain.y+shoreGrain.x*.10))':'.66'};
    vec3 riverbed=sediment*(.76+shoreGrain.x*.22+bedDetail*.25);
    float caustic=smoothstep(.80,1.02,rippleA*.55+rippleB*.45+waterFlow.y*.12)*bedVisibility*rippleDetail;
    diffuseColor.rgb=mix(deepWater*(.90+shoreGrain.x*.10+waterFlow.y*.06),shallowWater,1.0-smoothstep(.07,.92,bedDepth));
    diffuseColor.rgb=mix(diffuseColor.rgb,riverbed,bedVisibility)+vec3(.48,.68,.61)*caustic*.06;
    diffuseColor.rgb+=vec3(.56,.73,.70)*light*(1.0-edge*.35)+vec3(.017,.023,.018)*shoreLap;
    // Lapping shifts only the inner fade: the visible shore never exceeds the gameplay boundary.
    // Forest shallows use the shaded bed above, not a broad window onto sunlit yellow ground.
    diffuseColor.a*=(${id==='forest'?'.92+depth*.04':'.64+depth*.30'})*(1.0-smoothstep(${id==='forest'?'.92+shoreGrain.y*.04':'.80+shoreGrain.y*.12'}+shoreLap*.012,1.0,radial));
`);
   shader.fragmentShader=shader.fragmentShader.replace('#include <roughnessmap_fragment>','#include <roughnessmap_fragment>\nroughnessFactor=.23+edge*.29+(.5-waterFlow.y)*.065;');
   shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
    vec3 waveDx=dFdx(-vViewPosition),waveDy=dFdy(-vViewPosition);
    vec3 waveRx=cross(waveDy,normal),waveRy=cross(normal,waveDx);
    float waveDet=dot(waveDx,waveRx);
    normal=normalize(abs(waveDet)*normal-sign(waveDet)*(dFdx(waveHeight)*waveRx+dFdy(waveHeight)*waveRy));
   `);
   shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>',`
    // A view-dependent sky tint gives the low camera a readable water plane.
    // This is an inexpensive sky approximation, not a second reflection render.
    vec3 waterView=normalize(cameraPosition-waterWorld);
    vec3 waterNormal=inverseTransformDirection(normal,viewMatrix);
    vec3 waterReflection=reflect(-waterView,waterNormal);
    float waterFresnel=pow(1.0-clamp(dot(normal,normalize(vViewPosition)),0.0,1.0),4.0);
    vec3 reflectedSky=mix(waterHorizon,waterSky,smoothstep(.02,.72,waterReflection.y));
    reflectedSky*=.88+waterFlow.y*.12+shoreGrain.x*.05;
    float reflectionBreak=.78+waterFlow.x*.22;
    ${id==='forest'?'outgoingLight-=totalSpecular*(1.0-smoothstep(.16,.70,depth))*.55;':''}
    outgoingLight=mix(outgoingLight,reflectedSky,(.035+waterFresnel*.43)*${id==='forest'?'smoothstep(.30,.95,depth)':'(.48+depth*.52)'}*reflectionBreak);
    #include <opaque_fragment>
   `);
   // Keep derivative helpers alive through the normal calculation at overlap boundaries.
   if(coast)shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>','if(ownRadial>radial+.0001)discard;\n#include <opaque_fragment>');
  };
  material.customProgramCacheKey=()=> 'pond-depth-reflection-'+id+(coast?'-union':'');
  // Matte sediment receives the existing lights/shadows instead of sitting above them as a dark decal.
  const bank=new T.MeshLambertMaterial({color:id==='snow'?0x798480:id==='coast'?0x82785d:id==='sand'?0x97845e:0x414c43,transparent:true,opacity:id==='coast'?.23:id==='forest'?.25:.34,depthWrite:false});
  bank.onBeforeCompile=shader=>{shader.uniforms.waterTime=clock;shader.uniforms.waterDetail=detail;if(coast)Object.assign(shader.uniforms,coast);shader.vertexShader='varying vec2 bankLocal;varying vec2 bankWorld;\n'+shader.vertexShader;shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nbankLocal=position.xz;bankWorld=(modelMatrix*vec4(position,1.0)).xz;');shader.fragmentShader=(coast?coastUnionShader:'')+'\nuniform float waterTime; uniform sampler2D waterDetail; varying vec2 bankLocal;varying vec2 bankWorld;\n'+shader.fragmentShader;shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
   float a=atan(bankLocal.y,bankLocal.x);float r=length(bankLocal)/(1.0+.07*sin(a*3.0)+.045*cos(a*5.0));${coast?'float ownRadial=r;r=coastRadial(bankWorld,1.12,r);':''}
   vec2 bankGrain=texture2D(waterDetail,bankWorld*.035+vec2(waterTime*.0012,-waterTime*.0008)).rg;
   vec3 shoreGrain=texture2D(waterDetail,bankWorld*.065).rgb;
   float wetContact=smoothstep(.77,.85,r)*(1.0-smoothstep(.88,.98,r));
   float wetSwell=bankWorld.x*.65+bankWorld.y*.95-waterTime*.55+bankGrain.x*2.6;
   float wetLap=pow(max(0.0,sin(wetSwell*1.35+bankGrain.y*2.0)),5.0);
   float sedimentPatch=smoothstep(${id==='forest'?'.38,.72,shoreGrain.y+shoreGrain.x*.10':'.24,.78,shoreGrain.y+shoreGrain.x*.18'});
   diffuseColor.rgb*=(.72+shoreGrain.x*.22+shoreGrain.b*.09)*mix(.73,1.0,smoothstep(.72,.98,r));
   diffuseColor.a*=${id==='forest'?'(1.0-smoothstep(.84+shoreGrain.x*.035,.945,r))*(.12+sedimentPatch*.88)+wetContact*wetLap*.04*smoothstep(.38,.72,shoreGrain.y)':'(1.0-smoothstep(.72+shoreGrain.x*.16,1.0,r))*(.34+sedimentPatch*.66)+wetContact*wetLap*.07*smoothstep(.23,.76,shoreGrain.y)'};
   ${coast?'if(ownRadial>r+.0001)discard;':''}
  `);};
  bank.customProgramCacheKey=()=> 'pond-broken-wet-bank-'+id+(coast?'-union':'');
  const reeds=new T.MeshStandardMaterial({color:id==='snow'?0x94a599:id==='coast'?0x7b8657:0x7e8954,roughness:1,vertexColors:true,side:T.DoubleSide}),stones=new T.MeshStandardMaterial({color:id==='snow'?0x9aaeb0:0x6c7a68,roughness:.94,vertexColors:true});
  reeds.forceSinglePass=true;
  surfaces.set(id,{material,bank,reeds,stones,clock,coast});
 }
 return surfaces.get(id);
}
export function buildPonds(group,id,rnd,spawn,sites,locations=null){
 if(id==='coast'&&!locations)locations=coastLayout(rnd).ponds;
 if(id==='ash'||locations?.length===0)return[];const ponds=[],surface=waterSurface(id);
 for(let i=0;i<(locations?.length||180)&&ponds.length<(locations?.length||6);i++){
  const a=rnd()*Math.PI*2,d=18+rnd()*8,rx=locations?.[i]?.rx??((id==='coast'?9:4.7)+rnd()*2.2),rz=locations?.[i]?.rz??((id==='coast'?16:3.7)+rnd()*1.6);
  let x=ponds.length? (rnd()-.5)*96*MAP_SCALE:spawn.x+Math.sin(a)*d,z=ponds.length?(rnd()-.5)*96*MAP_SCALE:spawn.z+Math.cos(a)*d,r=Math.max(rx,rz)*1.12;
  if(locations){x=locations[i].x;z=locations[i].z;}
  if(!locations&&id!=='coast'&&(Math.hypot(x-spawn.x,z-spawn.z)<r+6||Math.hypot(x,z)<r+9||sites.some(s=>Math.hypot(x-s.x,z-s.z)<r+8)||ponds.some(p=>Math.hypot(x-p.x,z-p.z)<r+p.r+4)))continue;
  const p={kind:'water',x,z,rx,rz,r,biome:id,angle:locations?.[i]?.angle??(id==='coast'?0:rnd()*Math.PI*2)},bank=new T.Mesh(surfaceGeometry,surface.bank);bank.position.set(x,.045,z);bank.rotation.y=p.angle;bank.scale.set(rx*1.12,1,rz*1.12);bank.receiveShadow=true;group.add(bank);const m=new T.Mesh(surfaceGeometry,surface.material);m.position.set(x,.075,z);m.rotation.y=p.angle;m.scale.set(rx,1,rz);m.receiveShadow=true;group.add(m);p.mesh=m;p.bank=bank;ponds.push(p);
 }
 if(surface.coast){
  // Bind on render, not generation: lobby previews and the active map share
  // these materials but have different coastlines and tidal radii.
  const bind=()=>{surface.coast.coastCount.value=Math.min(8,ponds.length);for(let i=0;i<Math.min(8,ponds.length);i++){const p=ponds[i];surface.coast.coastPonds.value[i].set(p.x,p.z,p.rx,p.rz);surface.coast.coastTurns.value[i].set(Math.cos(p.angle),Math.sin(p.angle));}};
  for(const p of ponds){p.mesh.onBeforeRender=p.bank.onBeforeRender=bind;p.bank.renderOrder=-2;p.mesh.renderOrder=-1;}
 }
 const reeds=new T.InstancedMesh(reedGeometry,surface.reeds,ponds.length*24),stones=new T.InstancedMesh(stoneGeometry,surface.stones,ponds.length*6),dummy=new T.Object3D();let ri=0,si=0;
 reeds.name='pond-reeds';stones.name='pond-shore-stones';
 for(const pond of ponds){const c=Math.cos(pond.angle),s=Math.sin(pond.angle),at=(a,r)=>{const k=shore(a)*r,lx=Math.cos(a)*pond.rx*k,lz=Math.sin(a)*pond.rz*k;return{x:pond.x+c*lx+s*lz,z:pond.z-s*lx+c*lz};};
  const submerged=point=>id==='coast'&&ponds.some(p=>p!==pond&&waterDepth(p,point.x,point.z)>.03);
  for(let i=0;i<8;i++){const a=rnd()*Math.PI*2,point=at(a,1.015+rnd()*.05);if(submerged(point))continue;for(let j=0;j<3;j++){const h=.3+rnd()*.6;dummy.position.set(point.x+(rnd()-.5)*.3,h*.5,point.z+(rnd()-.5)*.3);dummy.rotation.set((rnd()-.5)*.4,rnd()*6,(rnd()-.5)*.4);dummy.scale.set(.035+rnd()*.025,h,.035);dummy.updateMatrix();reeds.setMatrixAt(ri++,dummy.matrix);}}
  for(let i=0;i<6;i++){const point=at(rnd()*Math.PI*2,1.06),r=.16+rnd()*.3;if(submerged(point))continue;dummy.position.set(point.x,r*.25,point.z);dummy.rotation.set(rnd()*.3,rnd()*6,rnd()*.3);dummy.scale.set(r,.15+rnd()*.12,r*.8);dummy.updateMatrix();stones.setMatrixAt(si++,dummy.matrix);}
 }
 reeds.count=ri;stones.count=si;
 reeds.instanceMatrix.needsUpdate=true;stones.instanceMatrix.needsUpdate=true;reeds.receiveShadow=stones.receiveShadow=true;group.add(reeds,stones);
 return ponds;
}
export function animateWater(id,t){if(surfaces.has(id))surfaces.get(id).clock.value=t;}

// Restore the unmodified pose before the next mixer update, so paddling never accumulates.
export function restoreWaterPose(g){for(const p of g.userData.waterPose||[]){p.node.quaternion.copy(p.q);p.node.position.copy(p.p);}g.userData.waterPose=[];}
export function animateWaterPose(g,t,speed){
 const d=g.userData,dt=d.waterTime===undefined?1/60:clamp(t-d.waterTime,0,HERO_SWIM[d.kind]?.1:.05);d.waterTime=t;
 d.waterBlend=(d.waterBlend||0)+((d.waterDepth||0)-(d.waterBlend||0))*(1-Math.exp(-dt*7));
 if(!d.waterDepth&&d.waterBlend<.002){d.waterBlend=0;d.swimJoints?.clear();}
 const depth=d.waterBlend;if(depth<.001||d.waterFloating||!d.rig)return;
 const save=node=>{if(node&&!d.waterPose.some(p=>p.node===node))d.waterPose.push({node,q:node.quaternion.clone(),p:node.position.clone()});};
 const hero=d.skinned||d.leftKnee,profile=d.skinned&&HERO_SWIM[d.kind],heavy=['golem','boss','reefturtle','wreckwarden'].includes(d.kind),swim=T.MathUtils.smoothstep(depth,.42,.85);
 const ease=(a,b,k)=>a+(b-a)*(1-Math.exp(-dt*k));
 d.swimMove=ease(d.swimMove||0,clamp(speed/2.8,0,1),6);
 const attack=profile&&d.shotSerial?(d.kind==='guardian'?T.MathUtils.smoothstep(d.reloadPhase??1,0,.12)*(1-T.MathUtils.smoothstep(d.reloadPhase??1,.76,1)):newHeroAttack(d.kind,d.reloadDuration?(d.reloadPhase??1)*d.reloadDuration:d.attackAge,d.reloadDuration||1).weight):0;
 const engaged=profile?clamp(attack*2.5+Number((d.dashTime||0)>0)+Number(d.kind==='lingya')*(d.catchReady||0),0,1):d.aimActive||(d.shoot||0)>0?1:0;
 d.swimAim=ease(d.swimAim||0,engaged,profile?18:6);
 d.swimPace=ease(d.swimPace||.5,profile?.38+(profile.pace-.38)*d.swimMove:.48+d.swimMove*.32+(d.waterDash?.42:0),5);
 d.swimPhase=((d.swimPhase||0)+dt*d.swimPace)%1;
 d.swimBank=ease(d.swimBank||0,clamp(-(d.turnRate||0)*.012,-.1,.1),5);
 const phase=d.swimPhase*Math.PI*2,stroke=Math.sin(phase),moving=d.swimMove,aim=d.swimAim,pose=profile?heroSwimPose(d.kind,d.swimPhase,moving,aim):null,travel=swimTravel(g.rotation.y,d.travelAngle);
 d.swimTravelBank=ease(d.swimTravelBank||0,profile?travel.bank*moving*(1-aim):0,5);
 save(d.rig);d.rig.position.y-=depth*(profile?profile.sink+moving*.035:hero?.38+moving*.06:heavy?.22:.24);d.rig.position.y+=(pose?pose.bob:Math.sin(phase*2-.5)*.025)*depth;
 if(hero){
  const held=d.hammer||d.gun||d.book||d.weapon,heldWorld=held?.getWorldQuaternion(new T.Quaternion()),shieldWorld=d.shield?.getWorldQuaternion(new T.Quaternion()),robeWorld=d.shadowRobe?.map(panel=>panel.getWorldQuaternion(new T.Quaternion()));
  const leanTarget=swim*(pose?pose.lean*travel.lean:.08+.82*moving)*(1-aim*.86);d.swimLean=ease(d.swimLean||0,leanTarget,8);const lean=profile||d.kind==='wraith'?d.swimLean:leanTarget;d.rig.rotation.x+=lean;d.rig.rotation.z+=swim*((pose?pose.bank:stroke*.045*moving)*(1-aim)+d.swimBank+d.swimTravelBank);
  const head=d.swimHead||d.head;if(head){save(head);head.rotateX(-lean*(profile?.72:.5));head.rotateZ(-d.swimBank*.6);}
  g.updateMatrixWorld(true);
  const left=d.skinned?[d.offArm,d.offForearm,d.support?.hand]:[d.leftArm,d.leftElbow,d.leftHand];
  const right=d.skinned?[d.aimArm,d.firingForearm,d.support?.rightHand]:[d.rightArm,d.rightElbow,d.rightHand||d.weapon];
  const book=d.weaponId==='grimoire'&&!d.skinned,free=book?right:left,grip=book?left:right,side=book?-1:1;
  const reach=swimStroke(d.swimPhase),idle={x:.40+stroke*.12,y:-.60,z:.20+Math.cos(phase)*.14};
  const target=pose?pose.left:{x:side*T.MathUtils.lerp(idle.x,reach.x,moving),y:T.MathUtils.lerp(idle.y,reach.y,moving),z:T.MathUtils.lerp(idle.z,reach.z,moving)};
  swimLimb(g,...free,target,[side,-.25,-.45],swim*(1-aim),save);
  const emptyStroke=d.kind==='lingya'&&d.boomerangAway?swimStroke(d.swimPhase+.5):null;
  swimLimb(g,...grip,emptyStroke?{x:-emptyStroke.x*.78,y:emptyStroke.y*.85,z:emptyStroke.z*.78}:pose?pose.right:{x:side*.14,y:-.30,z:.43},[-side,-.6,-.15],swim*(1-aim),save);
  for(const [leg,knee,foot,sign]of d.skinned?[[d.swimLeftLeg,d.swimLeftKnee,d.swimLeftFoot,1],[d.swimRightLeg,d.swimRightKnee,d.swimRightFoot,-1]]:[[d.leftLeg,d.leftKnee,d.leftFoot,1],[d.rightLeg,d.rightKnee,d.rightFoot,-1]]){
   const kick=Math.sin(phase*2+sign*Math.PI/2),target=pose?pose.legs[sign===1?0:1]:{x:sign*(.06+.06*(1-moving)),y:-.86+Math.max(0,kick)*.08,z:-.35*moving+kick*(.11+.09*moving)};
   if(pose)target.z*=travel.kick;
   swimLimb(g,leg,knee,foot,target,[0,.1,1],swim,save);if(foot){save(foot);foot.rotateX((pose?pose.foot:.18+kick*.12)*swim);}
  }
  // Rate-limit joint changes at aim/recovery boundaries, independently of frame rate.
  d.swimJoints??=new Map();const joints=[...left.slice(0,2),...right.slice(0,2),d.swimLeftLeg||d.leftLeg,d.swimRightLeg||d.rightLeg,d.swimLeftKnee||d.leftKnee,d.swimRightKnee||d.rightKnee];
  if(depth>.002)for(const joint of joints){if(!joint)continue;save(joint);let previous=d.swimJoints.get(joint);if(previous){previous.rotateTowards(joint.quaternion,dt*8);joint.quaternion.copy(previous);}else d.swimJoints.set(joint,joint.quaternion.clone());}else d.swimJoints.clear();
  if(held&&heldWorld){save(held);g.updateMatrixWorld(true);const parent=held.parent.getWorldQuaternion(new T.Quaternion()).invert();if(d.gun&&!d.hammer){const carry=new T.Quaternion().setFromAxisAngle(new T.Vector3(0,1,0),g.rotation.y);if(profile)carry.multiply(new T.Quaternion().setFromEuler(new T.Euler(d.kind==='tide'?-.10:.10,0,-.12)));heldWorld.slerp(carry,swim*(1-aim));}held.quaternion.copy(parent.multiply(heldWorld));}
  if(shieldWorld){save(d.shield);g.updateMatrixWorld(true);d.shield.quaternion.copy(d.shield.parent.getWorldQuaternion(new T.Quaternion()).invert().multiply(shieldWorld));}
  if(d.cape){save(d.cape);d.cape.rotateX(-.20*swim+Math.sin(phase-.6)*.035*depth);d.cape.rotateZ(Math.sin(phase-.9)*.025*swim);}
  // Long front cloth keeps its gravity after the swimming rig tilts; waist anchors still follow the body.
  if(robeWorld){g.updateMatrixWorld(true);for(const [i,panel]of d.shadowRobe.entries()){save(panel);panel.quaternion.copy(panel.parent.getWorldQuaternion(new T.Quaternion()).invert().multiply(robeWorld[i]));}}
 }else if(!heavy){d.rig.rotation.x+=swim*.10*moving;for(const [i,l]of(d.legs||[]).entries()){const joint=l.joint||l;save(joint);joint.rotateX(Math.sin(phase+(l.phase??i*Math.PI/3))*.25*swim);}}
}
