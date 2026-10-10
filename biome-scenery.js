import * as T from './vendor/three.module.js';
import{MAP_HALF}from'./map-layout.js?v=114';
import{bridgeContains}from'./coast.js?v=114';
import{seeded}from'./rules.js?v=125';
import{surfaceUniforms}from'./surface-textures.js?v=120';
// One worn silhouette is shared by boulders, bank stones and instanced scree.
function rockGeometry(width=10,height=7){
 const g=new T.SphereGeometry(1,width,height),p=g.attributes.position,colors=[];
 for(let i=0;i<p.count;i++){
  const x=p.getX(i),y=p.getY(i),z=p.getZ(i),wear=1+Math.sin(x*3.6+z*2.2+y)*.105+Math.sin(z*4.3-y*2.6)*.065;
  p.setXYZ(i,x*wear*(1-y*.08)+y*.09,Math.max(-.73,y*wear*.91),z*wear*(1+y*.08));
  const mineral=.88+Math.sin(y*11+x*3+z*2)*.045+Math.max(0,y)*.10;colors.push(mineral*1.025,mineral,mineral*.965);
 }
 g.setAttribute('color',new T.Float32BufferAttribute(colors,3));g.computeVertexNormals();
 // Average the duplicated seam and pole normals without splitting material groups.
 const n=g.attributes.normal,welded=new Map(),key=i=>[p.getX(i),p.getY(i),p.getZ(i)].map(v=>Math.round(v*1e5)).join(',');
 for(let i=0;i<p.count;i++){const k=key(i);if(!welded.has(k))welded.set(k,new T.Vector3());welded.get(k).add(new T.Vector3().fromBufferAttribute(n,i));}
 for(let i=0;i<p.count;i++){const v=welded.get(key(i)).normalize();n.setXYZ(i,v.x,v.y,v.z);}return g;
}
export const naturalRockGeometry=rockGeometry();
export const boulderRockGeometry=rockGeometry(20,13);
const rockMaterials=new Map();
export function finishRock(rock){
 if(rock.geometry===boulderRockGeometry)return rock;
 const radius=rock.geometry.parameters?.radius||1,source=rock.material,key=source.uuid;
 if(!rockMaterials.has(key)){const m=source.clone();m.vertexColors=true;m.roughness=.94;m.flatShading=false;rockMaterials.set(key,m);}
 rock.geometry=boulderRockGeometry;rock.material=rockMaterials.get(key);rock.scale.multiplyScalar(radius);return rock;
}
let groundDetailTexture;
export function environmentDetailTexture(){
 if(!groundDetailTexture){
  const size=128,pixels=new Uint8Array(size*size*4),random=seeded(5629),layers=[4,16,64].map(n=>({n,values:Float32Array.from({length:n*n},()=>random())}));
  const sample=(layer,x,y)=>{const u=x/size*layer.n,v=y/size*layer.n,ix=Math.floor(u),iy=Math.floor(v),fx=u-ix,fy=v-iy,s=fx*fx*(3-2*fx),t=fy*fy*(3-2*fy),at=(a,b)=>layer.values[(b%layer.n)*layer.n+a%layer.n];return T.MathUtils.lerp(T.MathUtils.lerp(at(ix,iy),at(ix+1,iy),s),T.MathUtils.lerp(at(ix,iy+1),at(ix+1,iy+1),s),t);};
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){const k=(y*size+x)*4;for(let channel=0;channel<3;channel++)pixels[k+channel]=Math.round(sample(layers[channel],x,y)*255);}
  // The unused alpha channel holds small, pointed fallen leaves. RGB stays shared with water.
  const litterRandom=seeded(1489);
  for(let i=0;i<26;i++){
   const cx=litterRandom()*size,cy=litterRandom()*size,angle=litterRandom()*Math.PI*2,c=Math.cos(angle),s=Math.sin(angle),length=4+litterRandom()*3,width=1.3+litterRandom()*1.2;
   for(let y=Math.floor(cy-length);y<=cy+length;y++)for(let x=Math.floor(cx-length);x<=cx+length;x++){
    const dx=x+.5-cx,dy=y+.5-cy,u=(dx*c+dy*s)/length,v=(-dx*s+dy*c)/width,edge=1-u*u-Math.abs(v),mask=T.MathUtils.smoothstep(edge,0,.24);
    if(!mask)continue;
    const fold=.70+.23*Math.abs(v)-.19*Math.exp(-Math.abs(v)*18),k=(((y+size)%size)*size+(x+size)%size)*4+3;
    pixels[k]=Math.max(pixels[k],Math.round(mask*fold*255));
   }
  }
  groundDetailTexture=new T.DataTexture(pixels,size,size);groundDetailTexture.wrapS=groundDetailTexture.wrapT=T.RepeatWrapping;groundDetailTexture.magFilter=T.LinearFilter;groundDetailTexture.minFilter=T.LinearMipmapLinearFilter;groundDetailTexture.generateMipmaps=true;groundDetailTexture.anisotropy=4;groundDetailTexture.needsUpdate=true;
 }
 return groundDetailTexture;
}
export function installGroundSurface(ground,id='confluence'){
 const material=ground.material;if(material.userData.groundSurface===id)return;
 const detail=environmentDetailTexture();
 material.userData.groundSurface=id;
 material.onBeforeCompile=shader=>{
  shader.uniforms.groundDetail={value:detail};
  Object.assign(shader.uniforms,{soilColor:surfaceUniforms.soilColor,soilHeight:surfaceUniforms.soilHeight,soilReady:surfaceUniforms.soilReady});
  shader.vertexShader='varying vec3 groundWorld;\n'+shader.vertexShader;
  shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\ngroundWorld=(modelMatrix*vec4(position,1.0)).xyz;');
  shader.fragmentShader='uniform sampler2D groundDetail,soilColor,soilHeight; uniform float soilReady; varying vec3 groundWorld;\n'+shader.fragmentShader;
  shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
   vec2 soilPoint=groundWorld.xz;
   float soilField=texture2D(groundDetail,soilPoint*.013).r;
   float soilClump=texture2D(groundDetail,soilPoint*.046+vec2(.23,.61)).g;
   // Mipmaps filter the texture; this also fades its tiny normal slopes before they become subpixel.
   float soilPixel=max(length(dFdx(soilPoint)),length(dFdy(soilPoint)));
   float soilGrainDetail=1.0-smoothstep(.015,.07,soilPixel);
   vec4 soilFine=texture2D(groundDetail,soilPoint*.62+vec2(soilClump*.11,soilField*.09));
   float soilGrain=mix(.5,soilFine.b,soilGrainDetail);
   float soilPatch=smoothstep(.43,.73,soilField+soilClump*.13);
   float soilSnow=${id==='snow'?'1.0':id==='confluence'?'smoothstep(.23,.48,min(diffuseColor.r,min(diffuseColor.g,diffuseColor.b)))':'0.0'};
   float soilSand=${id==='sand'?'1.0':id==='confluence'?'smoothstep(.025,.10,diffuseColor.r-diffuseColor.b)*smoothstep(.14,.30,diffuseColor.r)*(1.0-soilSnow)':'0.0'};
   float soilOrganic=${id==='forest'?'1.0':id==='coast'?'.55':id==='confluence'?'smoothstep(.01,.06,diffuseColor.g-diffuseColor.r)*(1.0-soilSnow)':'0.0'};
   diffuseColor.rgb*=.94+soilClump*.10+(soilGrain-.5)*.14;
   ${id==='forest'?`diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.073,.057,.031),soilPatch*.62);`
    :id==='ash'?`diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.075,.071,.075),soilPatch*.40);diffuseColor.rgb*=1.0-smoothstep(.62,.85,soilFine.g)*.12*soilGrainDetail;`
    :id==='coast'?`diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.094,.102,.068),soilPatch*.40);`
    :id==='confluence'?`diffuseColor.rgb=mix(diffuseColor.rgb,diffuseColor.rgb*vec3(1.10,.86,.67),soilPatch*soilOrganic*.30);`:''}
   float moss=smoothstep(.40,.75,soilClump+soilFine.g*.13)*(1.0-soilPatch)*soilOrganic;
   diffuseColor.rgb=mix(diffuseColor.rgb,diffuseColor.rgb*vec3(.82,1.13,.72),moss*.48);
   float litter=smoothstep(.12,.48,soilFine.a)*(1.0-smoothstep(.045,.18,soilPixel))*soilOrganic*(.45+soilPatch*.55);
   diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.105,.069,.028)*(.75+soilFine.a*.65),litter*.68);
   float snowPacked=smoothstep(.32,.76,soilClump+soilPatch*.17)*soilSnow;
   diffuseColor.rgb=mix(diffuseColor.rgb,diffuseColor.rgb*vec3(.83,.91,.98),snowPacked*.42);
   // Wind ripples are about 45 cm apart; only their few-millimetre relief catches light.
   float sandRidge=sin((soilPoint.x*.765+soilPoint.y*.644)*14.0+soilField*8.0+soilClump*2.0)*(1.0-smoothstep(.03,.18,soilPixel))*soilSand;
   diffuseColor.rgb*=1.0+sandRidge*.035;
   diffuseColor.rgb=mix(diffuseColor.rgb,diffuseColor.rgb*vec3(.94,.88,.77),soilPatch*soilSand*.23);
   // Millimetre grain replaces the coarse pebble bumps; no specular glitter is added.
   // No displaced terrain: feet, swimming, collision and hazards keep their baseline.
   float soilRelief=soilClump*.014+(soilGrain-.5)*mix(.0018,.0010,soilSnow)+litter*.0012+sandRidge*.003;
   ${['forest','coast','confluence'].includes(id)?`vec2 litterUV=soilPoint/2.1;
    vec3 photographedSoil=texture2D(soilColor,litterUV).rgb;
    float photographedHeight=texture2D(soilHeight,litterUV).r;
    float soilLuma=dot(photographedSoil,vec3(.2126,.7152,.0722));
    // Retain the biome's moss/soil palette while exposing real leaf edges and fine gravel.
    photographedSoil=mix(vec3(soilLuma),photographedSoil,.52)*.46;
    photographedSoil=mix(photographedSoil,soilLuma*vec3(.25,.37,.19),moss*.82);
    float realSoilMix=soilReady*soilOrganic*(.56+soilPatch*.22)*(1.0-moss*.32);
    diffuseColor.rgb=mix(diffuseColor.rgb,photographedSoil,realSoilMix);
    soilRelief+=(photographedHeight-.5)*.018*realSoilMix*soilGrainDetail;`:''}
  `);
  shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
   vec3 soilDx=dFdx(-vViewPosition),soilDy=dFdy(-vViewPosition);
   vec3 soilRx=cross(soilDy,normal),soilRy=cross(normal,soilDx);
   float soilDet=dot(soilDx,soilRx);
   normal=normalize(abs(soilDet)*normal-sign(soilDet)*(dFdx(soilRelief)*soilRx+dFdy(soilRelief)*soilRy));
  `);
 };
 material.customProgramCacheKey=()=> 'ground-natural-detail-'+id;material.needsUpdate=true;
}
// Shared geometry and instanced details: decoration stays low, leaving combat and collision legible.
const geometries={stone:naturalRockGeometry,snow:null,chip:new T.OctahedronGeometry(1,0),wood:new T.CylinderGeometry(.10,.15,1,7),leaf:null,ice:new T.ConeGeometry(1,1,5),frond:null},materials=new Map();
const windAngle=-.7,windX=Math.sin(windAngle),windZ=Math.cos(windAngle);
// The low cap ends below the terrain, so no underside or hard raised rim is exposed.
function snowGeometry(){
 const positions=[0,.4775,.2],colors=[1.025,1.025,1.025],indices=[],segments=10;
 for(const[ring,radius]of[.36,.7,1].entries())for(let i=0;i<segments;i++){
  const a=i/segments*Math.PI*2,x=Math.sin(a)*radius,z=Math.cos(a)*radius,tail=(z+1)*.5,shade=1.025-radius*.045;
  positions.push(x*(1-tail*.28)*(1+Math.sin(z*5+x*3)*.08),.95*(1-radius*radius)*(.85-z*.2)-.33,z+(1-z*z)*.2);colors.push(shade,shade,shade);
  const here=1+ring*segments+i,next=1+ring*segments+(i+1)%segments;
  if(!ring)indices.push(0,here,next);else indices.push(here-segments,here,next,here-segments,next,next-segments);
 }
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setAttribute('color',new T.Float32BufferAttribute(colors,3));g.setIndex(indices);g.computeVertexNormals();return g;
}geometries.snow=snowGeometry();
function leafGeometry(){
 const pos=[],colors=[],idx=[];
 // A folded midrib catches light; the arcing tip is softer than a flat upright ribbon.
 for(let i=0;i<=4;i++){
  const t=i/4,w=Math.sin(Math.PI*t)*.125,y=Math.sin(t*Math.PI*.72)*.43,z=t*t*.72,shade=.72+t*.27;
  for(const side of[-1,0,1]){pos.push(side*w+t*t*.035,y-Math.abs(side)*w*.25,z);colors.push(shade*.98,shade,shade*.94);}
  if(i<4){const a=i*3;for(let strip=0;strip<2;strip++)idx.push(a+strip,a+strip+1,a+strip+3,a+strip+1,a+strip+4,a+strip+3);}
 }
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pos,3));g.setAttribute('color',new T.Float32BufferAttribute(colors,3));g.setIndex(idx);g.computeVertexNormals();return g;
}geometries.leaf=leafGeometry();
function frondGeometry(){
 const p=[],colors=[],ix=[],height=t=>Math.sin(t*Math.PI*.82)*.34,vertex=(x,y,z,shade)=>{p.push(x,y,z);colors.push(shade*.96,shade,shade*.91);};
 for(let i=0;i<=5;i++){const t=i/5;vertex(-.008,height(t),t*.92,.69+t*.27);vertex(.008,height(t),t*.92,.69+t*.27);if(i<5){const n=i*2;ix.push(n,n+1,n+2,n+1,n+3,n+2);}}
 for(let i=0;i<5;i++){
  const t=.13+i*.16,y=height(t),z=t*.92,w=Math.sin(Math.PI*t)*.29,shade=.77+t*.20;
  for(const side of[-1,1]){const n=p.length/3,reach=w*(side<0?.95:1.04);vertex(0,y,z,shade*.85);vertex(side*reach*.43,y-.020,z+.025,shade*.91);vertex(side*reach,y+.012-i*.005,z+.15,shade*1.06);vertex(side*reach*.40,y-.043,z+.105,shade);ix.push(n,n+1,n+2,n,n+2,n+3);}
 }
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setAttribute('color',new T.Float32BufferAttribute(colors,3));g.setIndex(ix);g.computeVertexNormals();return g;
}geometries.frond=frondGeometry();
function material(kind,id){const key=['leaf','frond','ice'].includes(kind)?kind+':'+id:kind;if(!materials.has(key)){
 const m=new T.MeshStandardMaterial({color:0xffffff,roughness:1,vertexColors:['snow','stone','leaf','frond'].includes(kind),side:['leaf','frond'].includes(kind)?T.DoubleSide:T.FrontSide});
 if(['leaf','frond','ice'].includes(kind)){
  const clock={value:0},gust={value:1},focus={value:new T.Vector2()};m.userData.motion={clock,gust,focus};
  m.onBeforeCompile=s=>{Object.assign(s.uniforms,{sceneryTime:clock,sceneryGust:gust,sceneryFocus:focus});
   s.vertexShader='uniform float sceneryTime; uniform float sceneryGust; uniform vec2 sceneryFocus; varying vec3 sceneryWorld;\n'+s.vertexShader;
   s.vertexShader=s.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
    vec4 sceneryPoint=vec4(position,1.0);
    #ifdef USE_INSTANCING
     sceneryPoint=instanceMatrix*sceneryPoint;
    #endif
    sceneryWorld=(modelMatrix*sceneryPoint).xyz;
    ${kind==='ice'?'':`float rooted=pow(clamp(position.y/.5,0.0,1.0),2.0);float wind=sin(sceneryTime*1.6+sceneryWorld.x*.63+sceneryWorld.z*.44)*.055*sceneryGust;vec2 away=sceneryWorld.xz-sceneryFocus;float brush=1.0-smoothstep(.25,1.25,length(away));vec2 motion=vec2(-.6442,.7648)*wind+normalize(away+vec2(.001))*.11*brush;vec3 bend=vec3(motion.x,0.0,motion.y);
    #ifdef USE_INSTANCING
     mat3 plant=mat3(modelMatrix*instanceMatrix);bend=vec3(dot(bend,plant[0])/dot(plant[0],plant[0]),dot(bend,plant[1])/dot(plant[1],plant[1]),dot(bend,plant[2])/dot(plant[2],plant[2]));
    #endif
    transformed.xz+=bend.xz*rooted;`}
   `);
   if(kind==='ice'){s.fragmentShader='uniform float sceneryTime; varying vec3 sceneryWorld;\n'+s.fragmentShader;s.fragmentShader=s.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\nfloat glint=pow(max(0.0,sin(sceneryTime*.65+sceneryWorld.x*.7+sceneryWorld.z*.3)),18.0);diffuseColor.rgb+=vec3(.045,.065,.075)*glint;');}
  };m.customProgramCacheKey=()=> 'scenery-motion-'+kind;
 }
 materials.set(key,m);
}return materials.get(key);}
export function animateScenery(w,t,x,z){for(const m of w.scenery?.batches||[]){const p=m.material.userData.motion,id=m.userData.sceneryBiome;if(!p)continue;p.clock.value=t;p.gust.value=1+(id==='sand'?(w.sandstorm?.strength||0)*1.8:0)+(id==='coast'&&w.tide?.high?.3:0);p.focus.value.set(x,z);}}
export function groveCenters(spawn,rnd,half=MAP_HALF){return Array.from({length:22},(_,i)=>i<4?{x:spawn.x+Math.sin(i*1.9+.4)*16,z:spawn.z+Math.cos(i*1.9+.4)*16}:{x:(rnd()-.5)*(half-10)*2,z:(rnd()-.5)*(half-10)*2});}
export function sceneryAllowed(w,x,z){return (!w.contains||w.contains(x,z))&&Math.abs(x)<(w.half||MAP_HALF)-2&&Math.abs(z)<(w.half||MAP_HALF)-2&&Math.hypot(x-w.spawn.x,z-w.spawn.z)>3.5&&!w.sites.some(s=>Math.hypot(x-s.x,z-s.z)<4.8)&&!w.bridges?.some(b=>bridgeContains(b,x,z,.9))&&!w.patches.some(p=>p.kind==='vent'&&Math.hypot(x-p.x,z-p.z)<p.r+1)&&!w.ponds.some(p=>{const a=p.angle||0,dx=x-p.x,dz=z-p.z,rx=p.baseRx===undefined?p.rx*1.11:p.baseRx*1.19+.85,rz=p.baseRz===undefined?p.rz*1.11:p.baseRz*1.19+.85;return Math.hypot((Math.cos(a)*dx-Math.sin(a)*dz)/rx,(Math.sin(a)*dx+Math.cos(a)*dz)/rz)<1;});}
function bankFrame(w,x,z){let distance=Infinity,angle=windAngle;for(const p of w.ponds){const a=p.angle||0,c=Math.cos(a),s=Math.sin(a),dx=x-p.x,dz=z-p.z,rx=p.baseRx||p.rx,rz=p.baseRz||p.rz,u=c*dx-s*dz,v=s*dx+c*dz,d=Math.abs(Math.hypot(u/rx,v/rz)-1)*Math.min(rx,rz);if(d<distance){distance=d;const nx=c*u/(rx*rx)+s*v/(rz*rz),nz=-s*u/(rx*rx)+c*v/(rz*rz);angle=Math.atan2(nz,-nx);}}return{distance,angle:distance<10?angle:windAngle};}
function groundColors(w,id){
 const ground=w.ground,half=w.half||MAP_HALF,g=new T.PlaneGeometry((half+8)*2,(half+8)*2,72,72),p=g.attributes.position,colors=[];
 for(let i=0;i<p.count;i++){const x=p.getX(i),z=-p.getY(i),n=Math.sin(x*.087+Math.sin(z*.05)*2)*Math.cos(z*.065-x*.025),fine=Math.sin(x*.31+z*.13)*.025;let r=1+n*.08+fine,b=r,c=r,foot=0,lee=0;
  for(const o of w.obstacles){const dx=x-o.x,dz=z-o.z,d=dx*dx+dz*dz;if(d>36)continue;foot=Math.max(foot,Math.max(0,1-d/16)**2);const along=dx*windX+dz*windZ-1.2,across=dx*windZ-dz*windX;lee=Math.max(lee,Math.max(0,1-along*along/20-across*across/5)**2);}
  if(id==='forest'){let under=0;for(const g of w.groves)under=Math.max(under,Math.max(0,1-Math.hypot(x-g.x,z-g.z)/9));const moss=(1+n)*.5;r*=(.86+moss*.16)*(1-under*.24);c*=(.92+moss*.10)*(1-under*.12);b*=(.79+moss*.10)*(1-under*.05);}
  if(id==='forest'){r*=1+foot*.035;c*=1-foot*.12;b*=1-foot*.18;}
  if(id==='snow'){const drift=Math.sin(x*.20+z*.14+Math.sin(z*.045)*2)*.025;r*=(.93+n*.035+drift)*(1-foot*.13+lee*.055);c*=(.98+drift)*(1-foot*.075+lee*.04);b*=(1.04+drift*.3)*(1-foot*.025+lee*.02);}
  if(id==='ash'){const cooled=(1+Math.sin(x*.16-z*.11))*.5;let char=0;for(const v of w.patches)if(v.kind==='vent')char=Math.max(char,Math.max(0,1-((x-v.x)**2+(z-v.z)**2)/(v.r+5)**2));r*=(.80+cooled*.06)*(1-foot*.18-char*.14);c*=(.81+cooled*.025)*(1-foot*.1-char*.22);b*=(.86+cooled*.04)*(1-foot*.04-char*.19);}
  if(id==='sand'){const ridge=Math.sin((x*windZ-z*windX)*.85+Math.sin(z*.055)*3)*.035;r=(r+ridge)*(1-lee*.065);c=(c+ridge)*(1-lee*.075);b=(b+ridge*.7)*(1-lee*.1);}
  if(id==='coast'){r*=1-foot*.12;c*=1-foot*.055;b*=1-foot*.055;}
  for(const pond of w.ponds){const a=pond.angle||0,dx=x-pond.x,dz=z-pond.z,d=Math.hypot((Math.cos(a)*dx-Math.sin(a)*dz)/pond.rx,(Math.sin(a)*dx+Math.cos(a)*dz)/pond.rz),shore=Math.max(0,1-Math.abs(d-1.08)/.32);if(shore){r*=1-shore*(id==='coast'?.27:.12);c*=1-shore*.13;b*=1-shore*.08;}}
  colors.push(r,c,b);
 }g.setAttribute('color',new T.Float32BufferAttribute(colors,3));ground.geometry=g;ground.userData.ownedGeometry=true;ground.material.vertexColors=true;installGroundSurface(ground,id);
}
export function installScenery(w,id,rnd){
 if(!w.regional)groundColors(w,id);const batches=new Map(),dummy=new T.Object3D(),records=[];
 // Reuse the rendered routes. This is a build-time visual filter, never a new collider.
 const routes=w.road?[w.road]:w.sites.filter(s=>s.trail).map(s=>{const p=s.trail.geometry.attributes.position,path=[];for(let i=0;i<p.count;i+=4)path.push({x:(p.getX(i+1)+p.getX(i+2))*.5,z:(p.getZ(i+1)+p.getZ(i+2))*.5});return path;});
 const onRoute=(x,z)=>routes.some(path=>{for(let i=1;i<path.length;i++){const a=path[i-1],b=path[i],dx=b.x-a.x,dz=b.z-a.z,t=T.MathUtils.clamp(((x-a.x)*dx+(z-a.z)*dz)/(dx*dx+dz*dz||1),0,1);if((x-a.x-dx*t)**2+(z-a.z-dz*t)**2<1.45**2)return true;}return false;});
 const add=(kind,color,x,y,z,sx,sy,sz,angle=0,tilt=0)=>{if(!sceneryAllowed(w,x,z)||onRoute(x,z))return;dummy.position.set(x,y,z);dummy.scale.set(sx,sy,sz);dummy.rotation.set(0,angle,0);dummy.rotateX(tilt);dummy.updateMatrix();const key=w.regional?kind+':'+Math.floor(x/32)+','+Math.floor(z/32):kind;if(!batches.has(key))batches.set(key,[]);batches.get(key).push({matrix:dummy.matrix.clone(),color:new T.Color(color)});};
 const palette={forest:[0x40664c,0x71904e,0x2f5d50],snow:[0xd8e6e5,0xa6c3cb,0x7d9ea9],ash:[0x383b40,0x69574f,0x89715b],sand:[0x9b895d,0xb6a275,0x857654],coast:[0x627b60,0x899c6c,0x49685c]}[id];
 const snowColor=w.regional?0xacbfc1:0x96b7bd;
 // Most plants grow around existing trees/rocks or along the banks; open areas stay sparse.
 for(let i=0;i<235;i++){
  const o=w.obstacles.length?w.obstacles[Math.floor(rnd()*w.obstacles.length)]:w.spawn,a=rnd()*Math.PI*2,r=1.1+rnd()*3;let x=o.x+Math.sin(a)*r,z=o.z+Math.cos(a)*r,drift=a;
  if(id==='coast'&&i%2===0&&w.ponds.length){const p=w.ponds[Math.floor(rnd()*w.ponds.length)],t=rnd()*Math.PI*2,pa=p.angle||0,rx=(p.baseRx||p.rx)*1.19+1.8,rz=(p.baseRz||p.rz)*1.19+1.8,dx=Math.sin(t)*rx,dz=Math.cos(t)*rz;x=p.x+Math.cos(pa)*dx+Math.sin(pa)*dz;z=p.z-Math.sin(pa)*dx+Math.cos(pa)*dz;}
  if(i%5===0){const span=((w.half||MAP_HALF)-4)*2;x=w.regional?w.spawn.x+(rnd()-.5)*110:(rnd()-.5)*span;z=w.regional?w.spawn.z+(rnd()-.5)*110:(rnd()-.5)*span;}if(!sceneryAllowed(w,x,z))continue;
  const scale=.7+rnd()*.7;records.push({x,z,kind:id});
  if(id==='forest'||id==='coast'||id==='sand'){
   const patch=Math.sin(x*.13+Math.cos(z*.11))*Math.cos(z*.09),shade=Math.hypot(x-o.x,z-o.z)<2.6,bank=bankFrame(w,x,z),lush=shade||bank.distance<4;
   if(id==='coast')drift=bank.angle;
   const count=id==='forest'?2+Number(lush)+Number(patch>.25):id==='sand'?2+Number(shade)+Number(patch>.3):3+Number(bank.distance<6)*2+Number(patch>.3);
   for(let j=0;j<(id==='sand'?4:7);j++){
    const h=scale*(.65+rnd()*.55),px=x+(rnd()-.5)*.3,pz=z+(rnd()-.5)*.3;
    // Consume the same random stream: richer fronds replace fine blades without moving the map.
    if(j>=count)continue;
    if(id==='forest'){const turn=a+(j-(count-1)/2)*1.15+patch*.25,reach=h*(lush?1.12:.8)*(j===0?.72:1);add('frond',palette[shade?2:patch>.15?1:0],px+Math.sin(turn)*.10,.015,pz+Math.cos(turn)*.10,reach*1.18,h*(lush?.95:.65),reach*1.15,turn);}
    else{const turn=(id==='sand'?windAngle:drift)+(j-(count-1)/2)*.48+patch*.2,growth=h*(j%3===0?.68:1);add('leaf',palette[j%3],px,.015,pz,id==='sand'?.22:growth*.52,id==='coast'?growth*1.2:growth,id==='sand'?growth*.75:growth,turn,id==='sand'?.18:0);}
   }
   if(id==='forest'&&i%2===0){add('wood',0x5a5542,x-Math.sin(a)*.24,.045,z-Math.cos(a)*.24,.8,.8+rnd(),.45,a,Math.PI/2);for(let j=0;j<9;j++){const along=(rnd()-.6)*2.2,across=(rnd()-.5)*.85,turn=rnd()*6;if(j<(lush?9:5))add('chip',j%3===0?0x927448:j%3===1?0x637248:0x6d5941,x+Math.sin(a)*along+Math.cos(a)*across,.023,z+Math.cos(a)*along-Math.sin(a)*across,.10+j%3*.025,.018,.17+j%2*.06,a+turn*.18);}}
   if(id==='sand'&&i%3===0)for(let j=0;j<3;j++)add('chip',j===0?0xc5ae80:0xa89169,x+windX*(j*.3-.2)+windZ*(j-1)*.13,.026,z+windZ*(j*.3-.2)-windX*(j-1)*.13,.20-j*.035,.04-j*.009,.34-j*.055,windAngle+j*.2);
   if(id==='coast'&&i%3===0){add('wood',0x9b957a,x,.06,z,.9,1.3+patch*.45,.5,drift,Math.PI/2);for(let j=0;j<3;j++){const along=(rnd()-.5)*1.6,across=(rnd()-.5)*.35;add('stone',j===0?0xd1c6a5:0xadb2a0,x+Math.sin(drift)*along+Math.cos(drift)*across,.03,z+Math.cos(drift)*along-Math.sin(drift)*across,.13,.04,.09,drift);}}
  }else if(id==='snow'){
   add('snow',snowColor,x+windX*.3,0,z+windZ*.3,scale*(.5+Math.sin(a)*.12),.19,scale*(1.35+Math.cos(a)*.3),windAngle);if(i%4===0)for(let j=0;j<3;j++)add('ice',0x7fabbf,x-windX*.32+j*.16,.12+j*.035,z-windZ*.32,.10,.24+j*.07,.12,windAngle+j*.3,.15);for(let j=0;j<3;j++)add('stone',palette[2],x+(rnd()-.5)*.9-windX*.5,.035,z+(rnd()-.5)*.7-windZ*.5,.26-j*.055,.12-j*.025,.36-j*.07,windAngle);
  }else{
   for(let j=0;j<5;j++){const along=(rnd()-.7)*1.8,across=(rnd()-.5)*.7;add('chip',palette[j%3],x+Math.sin(a)*along+Math.cos(a)*across,.04,z+Math.cos(a)*along-Math.sin(a)*across,.12+rnd()*.25,j%2?.055:.10,.14+rnd()*.25,a+j*.18);}
   if(i%4===0)add('wood',0x302d2e,x,.06,z,.9,1.3,.45,a,Math.PI/2);
  }
 }
 // Sparse shoulders frame the first steps out of camp, never a ring around the player.
 // Use the existing exit direction and no randomness, preserving all later world generation.
 const exit=w.sites.find(s=>s.type==='relic')||w.sites[0],dx=(exit?.x??w.spawn.x+1)-w.spawn.x,dz=(exit?.z??w.spawn.z)-w.spawn.z,length=Math.hypot(dx,dz)||1,forwardX=dx/length,forwardZ=dz/length;
 for(const [i,[along,side]]of[[4.8,-4.1],[8.1,-4.5],[5.6,5.2],[9,4.8]].entries()){
  const x=w.spawn.x+forwardX*along+forwardZ*side,z=w.spawn.z+forwardZ*along-forwardX*side,angle=Math.atan2(forwardX,forwardZ)+i*.61;
  if(id==='forest'){
   for(let j=0;j<3;j++){const turn=angle+j*1.73,size=.55+j*.09;add('frond',palette[(i+j)%3],x+Math.sin(turn)*.14,.015,z+Math.cos(turn)*.14,size,size*.72,size,turn);}
   for(let j=0;j<2;j++)add('chip',j?0x6d5941:0x927448,x+(j-.5)*.36,.023,z+(j-.5)*.21,.13,.016,.19,angle+j*.8);
  }else if(id==='snow'){
   add('snow',snowColor,x,0,z,.47,.15,.98,windAngle);
   for(let j=0;j<2;j++)add('stone',palette[2],x-windX*(.3+j*.19),.023,z-windZ*(.3+j*.19),.16-j*.04,.055-j*.01,.22-j*.05,windAngle);
  }else if(id==='ash'){
   for(let j=0;j<4;j++)add('chip',palette[(i+j)%3],x+Math.sin(angle)*j*.21,.025,z+Math.cos(angle)*j*.21,.18-j*.025,.055-j*.009,.24-j*.035,angle+j*.2);
  }else{
   for(let j=0;j<2;j++)add('leaf',palette[(i+j)%3],x+j*.18,.015,z+j*.11,id==='sand'?.2:.33,.56+j*.13,.51+j*.12,id==='sand'?windAngle:angle+j*.6);
   if(id==='sand')add('chip',0xb6a275,x-windX*.32,.025,z-windZ*.32,.15,.035,.27,windAngle);
   else add('stone',0xadb2a0,x+.35,.025,z-.23,.14,.045,.19,angle);
  }
 }
 // Tie the foot of each obstacle to the terrain instead of leaving a bare cylinder on a flat plane.
 for(const o of w.obstacles){if(!sceneryAllowed(w,o.x,o.z))continue;const a=rnd()*6;
  if(id==='snow')add('snow',snowColor,o.x+windX*.45,0,o.z+windZ*.45,.7+Math.sin(a)*.12,.27,1.6+Math.cos(a)*.25,windAngle);
  else if(id==='forest'){if(o.mesh.userData.treeBiome)for(let j=0;j<3;j++){const turn=a+j*1.47+Math.sin(a+j)*.35,reach=.63+Math.sin(a*2+j)*.23;add('wood',0x595c43,o.x+Math.sin(turn)*.35,.035,o.z+Math.cos(turn)*.35,1.12,reach,.25,turn,Math.PI/2);add('wood',0x4c5942,o.x+Math.sin(turn)*(.55+reach*.25),.016,o.z+Math.cos(turn)*(.55+reach*.25),.52,reach*.54,.12,turn+.32,Math.PI/2);}}
  else{const direction=id==='coast'?bankFrame(w,o.x,o.z).angle:id==='sand'?windAngle:a;for(let j=0;j<3;j++){const turn=direction+(j-1)*.72,reach=.45+j*.25;add('stone',id==='ash'?0x463e40:id==='sand'?0xa89773:0x7d918a,o.x+Math.sin(turn)*reach,.035,o.z+Math.cos(turn)*reach,.42-j*.11,.17-j*.045,.54-j*.12,turn);}}
 }
 w.scenery={records,batches:[]};for(const[key,parts]of batches){const kind=key.split(':')[0],m=new T.InstancedMesh(geometries[kind],material(kind,id),parts.length);parts.forEach((p,i)=>{m.setMatrixAt(i,p.matrix);m.setColorAt(i,p.color);});m.receiveShadow=true;m.castShadow=false;m.userData.biomeDetail=kind;m.userData.sceneryBiome=id;w.group.add(m);w.scenery.batches.push(m);}
}
