import * as T from './vendor/three.module.js';

// Surface marks follow the existing palette and articulated pieces. They do not
// add geometry, texture downloads, lights or a second render pass.
const strength=[0,.42,.36,.34,.28,.34,.26,.18,.36,.16,.20];
export function creatureFinish(species='',part=''){
 const key=(species+'_'+part).toLowerCase();
 const wing=/wing|membrane/.test(part.toLowerCase().replace(species.toLowerCase(),''));
 if(/eyelid|eye|pupil|iris|teeth|tooth|fang/.test(part.toLowerCase()))return 0;
 if(/nose/.test(part.toLowerCase()))return 9;
 if(/staff|bark|root|branch/.test(part.toLowerCase()))return 8;
 if(/snowtotem|crystal|icecore/.test(key))return 10;
 if(/golem|lavabrute|stone|rock/.test(key))return 2;
 if(/sandguard|sandspitter|sandcaster|duneoracle|icewitch|ashseer/.test(key))return 4;
 if(/shaman/.test(key))return /head|mask|face/.test(key)?8:4;
 if(/mushroom/.test(key))return 5;
 if(/jelly|foam|tidestar|skyray/.test(key))return 7;
 if(/turtle|crab|beetle|scarab/.test(key))return wing?7:3;
 if(/wolf|hare|yeti|duskbat|frostwing/.test(key))return wing?7:1;
 if(/stalker|emberling|sandworm|cinderwing|spitter/.test(key))return wing?7:6;
 return 0;
}
export function prepareCreatureSurface(geometry,species,part=''){
 if(geometry.hasAttribute('creatureFinish'))return geometry;
 const style=creatureFinish(species,part),p=geometry.attributes.position,c=geometry.attributes.color,a=new Float32Array(p.count*2);
 for(let i=0;i<p.count;i++){
  // Leave recessed eyes, mouths and dark line work legible. A nose is allowed
  // a wet highlight even when its pigment is very dark.
  const luminance=c?Math.max(c.getX(i),c.getY(i),c.getZ(i)):1;
  a[i*2]=style;a[i*2+1]=strength[style]*(style===9?1:T.MathUtils.smoothstep(luminance,.008,.09));
 }
 geometry.setAttribute('creatureFinish',new T.Float32BufferAttribute(a,2));return geometry;
}

const fragmentHeader=`varying vec3 vCreaturePoint;
varying vec2 vCreatureFinish;
float creatureGrain;
float creatureRelief;
float creatureCoverage;
float creatureRoughness;
`;
const pigment=`
vec3 cp=vCreaturePoint;
float footprint=max(length(dFdx(cp)),length(dFdy(cp)));
creatureCoverage=vCreatureFinish.y*(1.-smoothstep(.012,.055,footprint));
float ck=vCreatureFinish.x;
vec3 faceAxis=abs(cross(dFdx(cp),dFdy(cp)));
vec2 cq=faceAxis.y>max(faceAxis.x,faceAxis.z)?cp.xz:(faceAxis.x>faceAxis.z?cp.zy:cp.xy);
float mottled=sin(dot(cp,vec3(13.,9.,17.)))*sin(dot(cp,vec3(-7.,19.,11.)));
creatureGrain=0.;creatureRelief=0.;creatureRoughness=roughness;
if(ck>.5&&ck<1.5){
 // Overlapping short fur clumps, with a fine strand inside each clump.
 float flow=cq.x*315.+sin(cq.y*112.+sin(cq.x*38.))*2.5+sin(cp.z*82.)*1.5;
 float strand=sin(flow)*smoothstep(-.4,.45,sin(cq.y*113.+sin(cq.x*39.)*2.));
 float clump=sin(cq.x*53.+sin(cq.y*15.))*sin(cq.y*21.+cq.x*7.);
 float strandFade=1.-smoothstep(.002,.010,footprint);
 creatureGrain=strand*.17*strandFade+clump*.055+mottled*.08;
 creatureRelief=strand*.00022*strandFade+clump*.00016;creatureRoughness=.88;
}else if(ck<2.5&&ck>1.5){
 float seam=abs(sin(cq.x*13.+sin(cq.y*7.))*sin(cq.y*17.+cq.x*4.));
 float crack=1.-smoothstep(.012,.070,seam);
 creatureGrain=mottled*.19-crack*.52;
 creatureRelief=-crack*.004+mottled*.0015;creatureRoughness=.91;
}else if(ck<3.5&&ck>2.5){
 float ribs=sin(cq.y*43.+sin(cq.x*11.)*.8);
 float pits=pow(max(0.,mottled),5.);
 creatureGrain=ribs*.17-pits*.36;
 creatureRelief=ribs*.0019-pits*.003;creatureRoughness=.57;
}else if(ck<4.5&&ck>3.5){
 float weave=sin(cq.x*145.)*sin(cq.y*135.);
 float threadFade=1.-smoothstep(.004,.018,footprint);
 creatureGrain=weave*.20*threadFade+mottled*.12;
 creatureRelief=weave*.0007*threadFade;creatureRoughness=.93;
}else if(ck<5.5&&ck>4.5){
 float marbling=sin(cq.x*21.+sin(cq.y*12.)*2.)*sin(cq.y*15.-cq.x*5.);
 creatureGrain=marbling*.32+mottled*.12;
 creatureRelief=marbling*.002;creatureRoughness=.73;
}else if(ck<6.5&&ck>5.5){
 float scales=sin(cq.x*52.+sin(cq.y*30.)*1.4)*sin(cq.y*44.);
 creatureGrain=scales*.22+mottled*.13;
 creatureRelief=scales*.0016;creatureRoughness=.71;
}else if(ck<7.5&&ck>6.5){
 float veins=sin(cq.x*19.+sin(cq.y*8.)*2.);
 creatureGrain=veins*.11+mottled*.12;
 creatureRelief=mottled*.0006;creatureRoughness=.39;
}else if(ck<8.5&&ck>7.5){
 float grain=sin(cq.x*32.+sin(cq.y*9.)*2.);
 creatureGrain=grain*.32+mottled*.15;
 creatureRelief=grain*.003;creatureRoughness=.89;
}else if(ck<9.5&&ck>8.5){
 creatureGrain=mottled*.12;creatureRelief=mottled*.0005;creatureRoughness=.28;
}else if(ck>9.5){
 creatureGrain=mottled*.12;creatureRelief=mottled*.0008;creatureRoughness=.35;
}
diffuseColor.rgb*=1.+creatureGrain*creatureCoverage;
`;
const relief=`
// Millimetre-scale surface relief only. The silhouette, shadow geometry and
// collision remain exactly the authored mesh; distant detail fades to flat.
float ch=creatureRelief*creatureCoverage;
vec3 ca=dFdx(-vViewPosition),cb=dFdy(-vViewPosition);
vec3 cr1=cross(cb,normal),cr2=cross(normal,ca);
float cd=dot(ca,cr1)*faceDirection;
vec3 cn=abs(cd)*normal-sign(cd)*(dFdx(ch)*cr1+dFdy(ch)*cr2);
if(dot(cn,cn)>1.e-18)normal=normalize(cn);
`;
export function installCreatureSurface(material){
 if(material.userData.creatureSurfaceFinish)return material;
 material.userData.creatureSurfaceFinish=true;
 const before=material.onBeforeCompile,baseKey=material.customProgramCacheKey();
 material.onBeforeCompile=function(shader,renderer){
  before.call(this,shader,renderer);
  shader.vertexShader='attribute vec2 creatureFinish; varying vec2 vCreatureFinish; varying vec3 vCreaturePoint;\n'+shader.vertexShader;
  shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvCreaturePoint=position;vCreatureFinish=creatureFinish;');
  shader.fragmentShader=fragmentHeader+shader.fragmentShader;
  shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\n'+pigment);
  shader.fragmentShader=shader.fragmentShader.replace('#include <roughnessmap_fragment>','#include <roughnessmap_fragment>\nroughnessFactor=mix(roughnessFactor,creatureRoughness,step(.5,vCreatureFinish.x)*.82);');
  shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_maps>','#include <normal_fragment_maps>\n'+relief);
 };
 material.customProgramCacheKey=()=>baseKey+'|creature-surface-v2';
 return material;
}
