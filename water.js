import{onIce,onFord}from'./map-tactics.js?v=211';
import{onBridge}from'./coast.js?v=211';
import{MAP_SCALE}from'./map-layout.js?v=211';
import{coastLayout}from'./coast-layout.js?v=211';
import{swimStroke,swimLimb,HERO_SWIM,heroSwimPose,swimTravel}from'./swim-motion.js?v=211';
import{newHeroAttack}from'./new-hero-motion.js?v=211';
import{naturalRockGeometry,environmentDetailTexture}from'./biome-scenery.js?v=211';
import{CLIMATE_LIGHT}from'./environment-lighting.js?v=211';
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
let bedTexture;
// One small, tiled gravel bed, generated once without consuming map randomness.
// RGB is linear reflectance; alpha is the rounded pebble height. Mips keep it quiet at distance.
function pondBedTexture(){
 if(bedTexture)return bedTexture;
 const size=256,cells=20,data=new Uint8Array(size*size*4),hash=(x,y,k)=>{const n=Math.sin(((x+cells)%cells)*127.1+((y+cells)%cells)*311.7+k*74.7)*43758.5453;return n-Math.floor(n);};
 const sites=Array.from({length:cells*cells},(_,i)=>{const x=i%cells,y=Math.floor(i/cells);return{x:.08+hash(x,y,0)*.84,y:.08+hash(x,y,1)*.84,rx:.39+hash(x,y,2)*.24,ry:.32+hash(x,y,3)*.24,tone:hash(x,y,4),phase:hash(x,y,5)*Math.PI*2};});
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  const u=x/size*cells,v=y/size*cells,cx=Math.floor(u),cy=Math.floor(v);let nearest=2,px=0,py=0,tone=0;
  for(let j=-1;j<=1;j++)for(let i=-1;i<=1;i++){
   const gx=cx+i,gy=cy+j,site=sites[((gy+cells)%cells)*cells+(gx+cells)%cells],dx=(u-gx-site.x)/site.rx,dy=(v-gy-site.y)/site.ry,a=Math.atan2(dy,dx),d=Math.hypot(dx,dy)*(1+Math.sin(a*3+site.phase)*.065+Math.cos(a*5+site.phase)*.045);
   if(d<nearest){nearest=d;px=dx;py=dy;tone=site.tone;}
  }
  const round=Math.sqrt(Math.max(0,1-nearest*nearest)),edge=T.MathUtils.smoothstep(nearest,.86,1),grain=(Math.sin(x*73.3+y*37.9)*43758.5)%1;
  const shade=.70+round*.26-px*.12-py*.16,stone=(.065+tone*.075)*shade+grain*.007,silt=.057+grain*.008,light=T.MathUtils.lerp(stone,silt,edge),index=(y*size+x)*4;
  data[index]=Math.round(clamp(light*(1.03+tone*.12),0,1)*255);data[index+1]=Math.round(light*255);data[index+2]=Math.round(light*(.90+tone*.04)*255);data[index+3]=Math.round(round*255);
 }
 bedTexture=new T.DataTexture(data,size,size);bedTexture.name='T_Pond_Gravel_A';bedTexture.wrapS=bedTexture.wrapT=T.RepeatWrapping;bedTexture.generateMipmaps=true;bedTexture.minFilter=T.LinearMipmapLinearFilter;bedTexture.magFilter=T.LinearFilter;bedTexture.anisotropy=4;bedTexture.needsUpdate=true;return bedTexture;
}
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
// Eight reaches bound both the harbor and forest creek; shared uniforms bind per world.
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
  const clock={value:0},detail={value:environmentDetailTexture()},climate=CLIMATE_LIGHT[id]||CLIMATE_LIGHT.forest,reflection={waterSky:{value:new T.Color(climate.sky)},waterHorizon:{value:new T.Color(climate.fog)}},coast=['coast','forest'].includes(id)?{coastPonds:{value:Array.from({length:8},()=>new T.Vector4())},coastTurns:{value:Array.from({length:8},()=>new T.Vector2())},coastCount:{value:0}}:null,material=new T.MeshStandardMaterial({color:id==='snow'?0x71bdcf:0x398f91,vertexColors:true,roughness:.38,metalness:0,side:T.DoubleSide,transparent:true,depthWrite:false});
  material.forceSinglePass=true;
  // One direction per connected body, rebound alongside its existing shore
  // uniforms. No moving geometry or extra texture/render pass is needed.
  const current={value:new T.Vector2(-.644,.765)},flow=id==='forest'?{speed:'.34',medium:'2.05',fine:'8.4',swell:'.023',ripple:'.008',drift:'.70'}:id==='coast'?{speed:'.24',medium:'.95',fine:'5.2',swell:'.040',ripple:'.006',drift:'.55'}:id==='snow'?{speed:'.065',medium:'1.35',fine:'6.4',swell:'.010',ripple:'.0025',drift:'.18'}:{speed:'.10',medium:'1.5',fine:'6.4',swell:'.018',ripple:'.004',drift:'.30'};
  // One stationary bed continues through each wet shoreline. Each climate tints
  // the same small texture; sand exposes less gravel than the colder rocky banks.
  const bed={value:pondBedTexture()},bedStyle={
   forest:{sediment:'.043,.052,.038',dry:'.057,.055,.040',tint:'.72,.91,.88',mix:'.28+.56',scale:'.36'},
   snow:{sediment:'.115,.145,.162',dry:'.36,.44,.47',tint:'1.04,1.24,1.36',mix:'.32+.42',scale:'.32'},
   sand:{sediment:'.20,.153,.083',dry:'.32,.254,.16',tint:'1.70,1.45,.92',mix:'.12+.25',scale:'.31'},
   coast:{sediment:'.085,.113,.114',dry:'.14,.18,.173',tint:'.88,1.12,1.20',mix:'.24+.44',scale:'.30'}
  }[id]||{sediment:'.043,.052,.038',dry:'.057,.055,.040',tint:'.72,.91,.88',mix:'.28+.56',scale:'.36'};
  material.onBeforeCompile=shader=>{shader.uniforms.waterTime=clock;shader.uniforms.waterDetail=detail;shader.uniforms.waterCurrent=current;Object.assign(shader.uniforms,reflection);if(coast)Object.assign(shader.uniforms,coast);shader.vertexShader='varying vec3 waterWorld; varying vec2 waterLocal;\n'+shader.vertexShader;shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nwaterWorld=(modelMatrix*vec4(position,1.0)).xyz;waterLocal=position.xz;');shader.fragmentShader=(coast?coastUnionShader:'')+'\nuniform float waterTime; uniform vec2 waterCurrent; uniform sampler2D waterDetail; uniform vec3 waterSky; uniform vec3 waterHorizon; varying vec3 waterWorld; varying vec2 waterLocal;\n'+shader.fragmentShader;shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
    float angle=atan(waterLocal.y,waterLocal.x);
    float radial=length(waterLocal)/(1.0+.07*sin(angle*3.0)+.045*cos(angle*5.0));
    ${coast?'float ownRadial=radial;radial=coastRadial(waterWorld.xz,1.0,radial);':''}
    float depth=clamp((1.0-radial)/.48,0.0,1.0),edge=1.0-smoothstep(.0,1.0,depth);
    // The whole creek shares a continuous world-space phase at reach joins.
    vec2 flowUV=vec2(dot(waterWorld.xz,waterCurrent),dot(waterWorld.xz,vec2(-waterCurrent.y,waterCurrent.x)));
    vec3 waterFlow=texture2D(waterDetail,(waterWorld.xz-waterCurrent*waterTime*${flow.speed})*.035).rgb;
    vec3 shoreGrain=texture2D(waterDetail,waterWorld.xz*.065).rgb;
    float shoreBreak=smoothstep(.36,.72,shoreGrain.y+shoreGrain.x*.12);
    float waterPixel=max(length(dFdx(waterWorld.xz)),length(dFdy(waterWorld.xz)));
    float rippleDetail=1.0-smoothstep(.09,.36,waterPixel);
    float forestBreeze=.65+.35*(.5+.5*sin(waterTime*.42+waterWorld.x*.08+waterWorld.z*.06));
    float swellA=flowUV.x*${flow.medium}+flowUV.y*.24-waterTime*${flow.drift}+waterFlow.x*10.0+waterFlow.y*3.0;
    float swellB=flowUV.x*.81-flowUV.y*.63-waterTime*${flow.drift}*.61+waterFlow.x*7.0-waterFlow.y*4.0;
    float rippleA=sin(flowUV.x*${flow.fine}+flowUV.y*1.8+sin(swellA)*1.25+waterFlow.z*5.0-waterTime*${flow.fine}*${flow.speed});
    float rippleB=sin(flowUV.x*${flow.fine}*.73-flowUV.y*2.3+sin(swellB)*1.1+waterFlow.y*8.0-waterTime*${flow.fine}*${flow.speed}*.83);
    float light=pow(max(0.0,rippleA),8.0)*smoothstep(.48,.87,rippleB)*(.3+waterFlow.y*.7)*${id==='snow'?'.010':id==='forest'?'.023*forestBreeze':'.032'}*rippleDetail;
    // Wind crosses the bank in short fragments, never in radial foam rings.
    float lapPhase=swellA*1.35+waterFlow.y*2.0;
    float shoreLap=pow(max(0.0,sin(lapPhase)),5.0)*smoothstep(.72,.88,radial)*(1.0-smoothstep(.95,1.0,radial))*(.3+waterFlow.y*.7)*shoreBreak;
    // Filtered noise directly carries a continuous normal slope. Differentiating
    // its 8-bit bilinear height made texture-cell edges visible in sun highlights.
    // Local wavelets are gated, so no crest spans the creek as a straight stripe.
    float wavePatch=smoothstep(.24,.75,waterFlow.y)*(.35+.65*shoreBreak);
    vec2 waveSlope=((waterFlow.xy-.5)*${flow.swell}*4.0+vec2(sin(swellA),sin(swellB))*.24*${flow.swell}*wavePatch+vec2(rippleA,rippleB)*${flow.ripple}*.30*rippleDetail)*${id==='forest'?'forestBreeze*smoothstep(.015,.24,depth)':'(1.0-edge*.72)'};
    vec3 deepWater=vec3(${id==='coast'?'.021,.098,.129':id==='snow'?'.029,.086,.126':id==='sand'?'.035,.076,.086':'.012,.050,.048'});
    vec3 shallowWater=vec3(${id==='coast'?'.070,.139,.153':id==='snow'?'.090,.170,.200':id==='forest'?'.027,.077,.062':'.126,.143,.106'});
    vec3 sediment=vec3(${bedStyle.sediment});
    float bedDetail=mix(.5,shoreGrain.b,rippleDetail);
    // Stationary sediment shelves break the radial color bands without changing water depth.
    float bedDepth=clamp(depth+(shoreGrain.x-.5)*.28+(shoreGrain.y-.5)*.12,0.0,1.0);
    float bedVisibility=exp(-bedDepth*${id==='forest'?'2.35':id==='coast'?'4.1':id==='snow'?'3.2':'4.6'})*(.82+shoreGrain.y*.18);
    vec3 riverbed=sediment*(.76+shoreGrain.x*.22+bedDetail*.25);
    // The bed stays in world space; only a centimetre-scale refraction sways it.
    vec2 bedUV=(waterWorld.xz+vec2(rippleA,rippleB)*.018*rippleDetail)*${bedStyle.scale};
    vec4 bedGravel=texture2D(waterBed,bedUV);
    riverbed=mix(sediment*.90,bedGravel.rgb*vec3(${bedStyle.tint}),${bedStyle.mix}*smoothstep(.30,.68,shoreGrain.y))*(.82+shoreGrain.x*.18)*(.88+bedGravel.a*.12);
    float caustic=smoothstep(.80,1.02,rippleA*.55+rippleB*.45+waterFlow.y*.12)*bedVisibility*rippleDetail;
    diffuseColor.rgb=mix(deepWater*(.90+shoreGrain.x*.10+waterFlow.y*.06),shallowWater,1.0-smoothstep(.07,.92,bedDepth));
    diffuseColor.rgb=mix(diffuseColor.rgb,riverbed,bedVisibility)+vec3(.48,.68,.61)*caustic*.06;
    diffuseColor.rgb+=vec3(.56,.73,.70)*light*(1.0-edge*.35)+vec3(.017,.023,.018)*shoreLap;
    // Lapping shifts only the inner fade: the visible shore never exceeds the gameplay boundary.
    // Partly transparent shallows reveal the same continuous damp bed below.
    diffuseColor.a*=(${id==='forest'?'.94+depth*.04':'.84+depth*.12'})*(1.0-smoothstep(${id==='forest'?'.75+shoreGrain.y*.055':id==='snow'?'.83+shoreGrain.y*.035':id==='coast'?'.84+shoreGrain.y*.04':'.85+shoreGrain.y*.04'}+shoreLap*.012,1.0,radial));
`);
   if(bed){shader.uniforms.waterBed=bed;shader.fragmentShader='uniform sampler2D waterBed;\n'+shader.fragmentShader;}
   shader.fragmentShader=shader.fragmentShader.replace('#include <roughnessmap_fragment>',`#include <roughnessmap_fragment>\nroughnessFactor=${id==='forest'?'.18+edge*.08':id==='snow'?'.17+edge*.095':id==='sand'?'.19+edge*.13':'.17+edge*.14'}+(.5-waterFlow.y)*.065;`);
   shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
    vec2 worldSlope=waterCurrent*waveSlope.x+vec2(-waterCurrent.y,waterCurrent.x)*waveSlope.y;
    normal=normalize(normal+mat3(viewMatrix)*vec3(-worldSlope.x,0.0,-worldSlope.y)*faceDirection);
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
    float reflectionBreak=.58+waterFlow.x*.27+shoreGrain.x*.15;
    ${id==='forest'?'outgoingLight-=totalSpecular*edge*.24;':''}
    outgoingLight=mix(outgoingLight,reflectedSky,${id==='forest'?'(.022+waterFresnel*.53)':id==='snow'?'(.032+waterFresnel*.61)':id==='sand'?'(.026+waterFresnel*.56)':'(.035+waterFresnel*.58)'}*reflectionBreak);
    #include <opaque_fragment>
   `);
   // Keep derivative helpers alive through the normal calculation at overlap boundaries.
   if(coast)shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>','if(ownRadial>radial+.0001)discard;\n#include <opaque_fragment>');
  };
  material.customProgramCacheKey=()=> 'pond-depth-reflection-'+id+(coast?'-union':'');
  // Matte sediment receives the existing lights/shadows instead of sitting above them as a dark decal.
  const bank=new T.MeshLambertMaterial({color:id==='snow'?0x9daeb5:id==='coast'?0x667d80:id==='sand'?0xa8956b:0x414c43,transparent:true,opacity:id==='coast'?.62:id==='snow'?.66:id==='sand'?.70:.82,depthWrite:false});
  bank.onBeforeCompile=shader=>{shader.uniforms.waterTime=clock;shader.uniforms.waterDetail=detail;if(coast)Object.assign(shader.uniforms,coast);shader.vertexShader='varying vec2 bankLocal;varying vec2 bankWorld;\n'+shader.vertexShader;shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nbankLocal=position.xz;bankWorld=(modelMatrix*vec4(position,1.0)).xz;');shader.fragmentShader=(coast?coastUnionShader:'')+'\nuniform float waterTime; uniform sampler2D waterDetail; varying vec2 bankLocal;varying vec2 bankWorld;\n'+shader.fragmentShader;shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
   float a=atan(bankLocal.y,bankLocal.x);float r=length(bankLocal)/(1.0+.07*sin(a*3.0)+.045*cos(a*5.0));${coast?'float ownRadial=r;r=coastRadial(bankWorld,1.12,r);':''}
   vec2 bankGrain=texture2D(waterDetail,bankWorld*.035+vec2(waterTime*.0012,-waterTime*.0008)).rg;
   vec3 shoreGrain=texture2D(waterDetail,bankWorld*.065).rgb;
   float wetContact=smoothstep(.77,.85,r)*(1.0-smoothstep(.88,.98,r));
   float wetSwell=bankWorld.x*.65+bankWorld.y*.95-waterTime*.55+bankGrain.x*2.6;
   float wetLap=pow(max(0.0,sin(wetSwell*1.35+bankGrain.y*2.0)),5.0);
   float sedimentPatch=smoothstep(${id==='forest'?'.38,.72,shoreGrain.y+shoreGrain.x*.10':'.24,.78,shoreGrain.y+shoreGrain.x*.18'});
   // Water ends at bank radius 1/1.12. The same gravel continues through it.
   // Irregular wet soil gives way to dry ground outside; no full circular outline.
   vec4 bankGravel=texture2D(waterBed,bankWorld*${bedStyle.scale});
   float dryEdge=r+(shoreGrain.x-.5)*.065+(shoreGrain.z-.5)*.022;
   float damp=1.0-smoothstep(.887,.960,dryEdge);
   vec3 gravel=mix(vec3(${bedStyle.sediment})*.90,bankGravel.rgb*vec3(${bedStyle.tint}),${bedStyle.mix}*smoothstep(.30,.68,shoreGrain.y))*(.82+shoreGrain.x*.18)*(.88+bankGravel.a*.12);
   diffuseColor.rgb=mix(vec3(${bedStyle.dry})*(.85+shoreGrain.b*.3),gravel,damp);
   diffuseColor.a*=(1.0-smoothstep(.89,.998,dryEdge))*(.55+sedimentPatch*.45);
   ${coast?'if(ownRadial>r+.0001)discard;':''}
  `);if(bed){shader.uniforms.waterBed=bed;shader.fragmentShader='uniform sampler2D waterBed;\n'+shader.fragmentShader;}};
  bank.customProgramCacheKey=()=> 'pond-broken-wet-bank-'+id+(coast?'-union':'');
  const reeds=new T.MeshStandardMaterial({color:id==='snow'?0x94a599:id==='coast'?0x7b8657:id==='forest'?0x526b48:0x7e8954,roughness:1,vertexColors:true,side:T.DoubleSide}),stones=new T.MeshStandardMaterial({color:id==='snow'?0x9aaeb0:0x6c7a68,roughness:.94,vertexColors:true});
  reeds.forceSinglePass=true;
  if(id==='forest'){
   // Existing water game-time clock: roots stay fixed, tips bend in world wind.
   // All reeds still draw in one instanced pass, with no per-plant CPU update.
   reeds.onBeforeCompile=shader=>{
    shader.uniforms.reedTime=clock;shader.vertexShader='uniform float reedTime;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
     #ifdef USE_INSTANCING
      vec3 reedAnchor=(modelMatrix*instanceMatrix*vec4(0.,0.,0.,1.)).xyz;
      float reedPhase=dot(reedAnchor.xz,vec2(.51,.37));
      float reedFlex=clamp(position.y+.5,0.,1.);
      float reedWave=sin(reedTime*1.15+reedPhase)*.7+sin(reedTime*2.1+reedPhase*.6)*.3;
      float reedBreeze=.65+.35*(.5+.5*sin(reedTime*.42+reedAnchor.x*.08+reedAnchor.z*.06));
      vec3 reedBend=vec3(-.644,0.,.765)*reedWave*reedBreeze*reedFlex*reedFlex*.055;
      mat3 reedBasis=mat3(modelMatrix*instanceMatrix);
      transformed+=vec3(dot(reedBend,reedBasis[0])/dot(reedBasis[0],reedBasis[0]),dot(reedBend,reedBasis[1])/dot(reedBasis[1],reedBasis[1]),dot(reedBend,reedBasis[2])/dot(reedBasis[2],reedBasis[2]));
     #endif
    `);
   };
   reeds.customProgramCacheKey=()=> 'forest-bank-reed-wind';
  }
  surfaces.set(id,{material,bank,reeds,stones,clock,coast,reflection,current});
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
 if(ponds.length){
  // Bind on render: menu and combat share materials, but retain their own
  // continuous shorelines. No internal bank or reed stripes across a join.
  const first=ponds[0],last=ponds.at(-1),axis=first.rx>first.rz?new T.Vector2(Math.cos(first.angle),-Math.sin(first.angle)):new T.Vector2(Math.sin(first.angle),Math.cos(first.angle)),direction=id==='forest'&&ponds.length>1?new T.Vector2(last.x-first.x,last.z-first.z):axis.clone();
  if(direction.lengthSq()<1e-8)direction.copy(axis);direction.normalize();
  const bind=()=>{surface.current.value.copy(direction);if(surface.coast){surface.coast.coastCount.value=Math.min(8,ponds.length);for(let i=0;i<Math.min(8,ponds.length);i++){const p=ponds[i];surface.coast.coastPonds.value[i].set(p.x,p.z,p.rx,p.rz);surface.coast.coastTurns.value[i].set(Math.cos(p.angle),Math.sin(p.angle));}}};
  for(const p of ponds){p.mesh.onBeforeRender=p.bank.onBeforeRender=bind;if(surface.coast){p.bank.renderOrder=-2;p.mesh.renderOrder=-1;}}
 }
 const reeds=new T.InstancedMesh(reedGeometry,surface.reeds,ponds.length*24),stones=new T.InstancedMesh(stoneGeometry,surface.stones,ponds.length*6),dummy=new T.Object3D();let ri=0,si=0;
 reeds.name='pond-reeds';stones.name='pond-shore-stones';
 for(const pond of ponds){const c=Math.cos(pond.angle),s=Math.sin(pond.angle),at=(a,r)=>{const k=shore(a)*r,lx=Math.cos(a)*pond.rx*k,lz=Math.sin(a)*pond.rz*k;return{x:pond.x+c*lx+s*lz,z:pond.z-s*lx+c*lz};};
  const submerged=point=>['coast','forest'].includes(id)&&ponds.some(p=>p!==pond&&waterDepth(p,point.x,point.z)>.03);
  // Keep the same random draws and instance counts: only forest shore dressing
  // groups into four uneven reed patches and three stone clusters.
  const forest=id==='forest';let reedAnchor=0,stoneAnchor=0;
  for(let i=0;i<8;i++){
   let a=rnd()*Math.PI*2;const radial=1.015+rnd()*.05;
   if(forest){if(i%2===0)reedAnchor=a;else a=reedAnchor+Math.sin(a)*.14;}
   const point=at(a,radial);if(submerged(point))continue;
   for(let j=0;j<3;j++){
    const h=(.3+rnd()*.6)*(forest?(i%2===0?1.1:.68):1),spread=forest?.5:.3;
    dummy.position.set(point.x+(rnd()-.5)*spread,h*.5,point.z+(rnd()-.5)*spread);
    dummy.rotation.set((rnd()-.5)*.4,rnd()*6,(rnd()-.5)*.4);
    dummy.scale.set((.035+rnd()*.025)*(forest?1.55:1),h,forest?.047:.035);dummy.updateMatrix();reeds.setMatrixAt(ri++,dummy.matrix);
   }
  }
  for(let i=0;i<6;i++){
   let a=rnd()*Math.PI*2;const r=.16+rnd()*.3;
   if(forest){if(i%2===0)stoneAnchor=a;else a=stoneAnchor+.075+Math.sin(a)*.025;}
   const point=at(a,forest?(i%2===0?.985:1.055):1.06);if(submerged(point))continue;
   dummy.position.set(point.x,r*.25,point.z);dummy.rotation.set(rnd()*.3,rnd()*6,rnd()*.3);
   const scale=forest&&i%2?.55:1;dummy.scale.set(r*scale,(.15+rnd()*.12)*scale,r*.8*scale);dummy.updateMatrix();
   if(forest){
    // Seat the rotated/scaled rock itself, not its unscaled center, into the bank.
    const positions=stoneGeometry.attributes.position,e=dummy.matrix.elements;let bottom=Infinity;
    for(let k=0;k<positions.count;k++)bottom=Math.min(bottom,e[1]*positions.getX(k)+e[5]*positions.getY(k)+e[9]*positions.getZ(k)+e[13]);
    dummy.position.y-=bottom+.035;dummy.updateMatrix();
   }
   stones.setMatrixAt(si++,dummy.matrix);
  }
 }
 reeds.count=ri;stones.count=si;
 reeds.instanceMatrix.needsUpdate=true;stones.instanceMatrix.needsUpdate=true;reeds.receiveShadow=stones.receiveShadow=true;group.add(reeds,stones);
 if(id==='forest'){reeds.computeBoundingSphere();reeds.boundingSphere.radius+=.06;}
 return ponds;
}
export function animateWater(id,t){if(surfaces.has(id))surfaces.get(id).clock.value=t;}
// The forest's existing day/night lighting also drives its sky approximation.
// Shared uniforms are copied in place; no second scene render or per-pond work.
export function updateWaterLighting(id,lighting){
 if(id!=='forest'&&id!=='confluence')return;
 const reflection=surfaces.get('forest')?.reflection;if(!reflection)return;
 const strength=.55+.45*lighting.day;
 reflection.waterSky.value.copy(lighting.hemi.color).multiplyScalar(strength);
 reflection.waterHorizon.value.copy(lighting.scene.fog.color).multiplyScalar(strength);
}


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
