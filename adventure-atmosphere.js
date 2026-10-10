import * as T from './vendor/three.module.js';
import {CLIMATE_LIGHT} from './environment-lighting.js?v=133';

const cloudStrength={forest:.46,snow:.54,ash:.32,sand:.24,coast:.52};
const vertexShader=`
varying vec3 skyDirection;
void main(){
 skyDirection=position;
 gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);
}`;
const fragmentShader=`
uniform vec3 skyColor;
uniform vec3 fogColor;
uniform vec3 sunColor;
uniform vec3 sunDirection;
uniform float sunStrength;
uniform float skyTime;
uniform float cloudAmount;
varying vec3 skyDirection;
float hash(vec2 p){
 p=fract(p*vec2(123.34,456.21));p+=dot(p,p+34.345);
 return fract(p.x*p.y);
}
float cloudNoise(vec2 p){
 vec2 cell=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);
 return mix(mix(hash(cell),hash(cell+vec2(1.,0.)),f.x),mix(hash(cell+vec2(0.,1.)),hash(cell+vec2(1.,1.)),f.x),f.y);
}
void main(){
 vec3 direction=normalize(skyDirection);
 float height=smoothstep(.015,.46,direction.y);
 float zenith=smoothstep(.18,1.0,direction.y);
 vec3 color=skyColor*mix(vec3(1.04),vec3(.64,.76,.91),zenith);
 float facingSun=dot(direction.xz,sunDirection.xz)/max(.001,length(direction.xz)*length(sunDirection.xz));
 float warmHaze=pow(max(0.,facingSun),3.)*(1.-smoothstep(.16,.65,direction.y));
 color=mix(color,mix(skyColor,sunColor,.36),warmHaze*.28);
 // Three smooth scales give clouds broad bodies and softly eroded edges. They fade before the horizon,
 // leaving the existing terrain fog and combat silhouettes uninterrupted.
 vec2 p=direction.xz/max(.20,direction.y+.30)*vec2(4.3,2.7);
 p+=vec2(skyTime*.006,skyTime*.002);
 float body=cloudNoise(p)*.60+cloudNoise(p*2.17+vec2(8.3,2.7))*.28+cloudNoise(p*4.31-vec2(skyTime*.004,2.1))*.12;
 float cloud=smoothstep(.47,.73,body)*smoothstep(.06,.23,direction.y)*(1.-smoothstep(.75,.98,direction.y));
 float sunward=cloudNoise(p+sunDirection.xz*.32);
 float litEdge=clamp(.5+(body-sunward)*3.5,0.,1.);
 vec3 cloudColor=mix(skyColor*.60,mix(skyColor*1.18,sunColor,.58),litEdge);
 color=mix(color,cloudColor,cloud*cloudAmount);
 float sun=max(0.,dot(direction,sunDirection));
 float halo=pow(sun,32.)*.10+pow(sun,256.)*.035;
 float disc=smoothstep(.9994,.9999,sun)*.26;
 color+=sunColor*(halo+disc)*sunStrength*smoothstep(.02,.20,direction.y);
 gl_FragColor=vec4(color,1.);
 #include <tonemapping_fragment>
 #include <colorspace_fragment>
 // Match Three's post-output fog blend in both HDR and direct rendering.
 // Tone-mapping fog here would produce a seam on the low-cost direct path.
 vec3 horizon=linearToOutputTexel(vec4(fogColor,1.)).rgb;
 gl_FragColor.rgb=mix(horizon,gl_FragColor.rgb,height);
}`;

/** One camera-centered background draw. Pass current lighting colors to preserve
 * mixed-biome transitions; mapId is only the fallback palette/cloud density.
 */
export class AdventureAtmosphere{
 constructor(scene){
  this.scene=scene;this.disposed=false;
  const climate=CLIMATE_LIGHT.forest;
  const material=new T.ShaderMaterial({vertexShader,fragmentShader,side:T.BackSide,depthWrite:false,depthTest:false,fog:false,uniforms:{
   skyColor:{value:new T.Color(climate.sky)},fogColor:{value:new T.Color(climate.fog)},sunColor:{value:new T.Color(climate.sun)},
   sunDirection:{value:new T.Vector3(-18,30,14).normalize()},sunStrength:{value:1},skyTime:{value:0},cloudAmount:{value:cloudStrength.forest}
  }});
  this.mesh=new T.Mesh(new T.SphereGeometry(160,24,12),material);
  this.mesh.name='adventure-atmosphere';this.mesh.renderOrder=-1000;this.mesh.frustumCulled=false;this.mesh.visible=false;
  scene.add(this.mesh);
 }
 update(time,camera,{mapId='forest',visible=true,skyColor,fogColor,sunColor,sunDirection,sunStrength=1,skyStrength=1}={}){
  if(this.disposed)return;
  this.mesh.visible=!!visible;if(!visible)return;
  camera.getWorldPosition(this.mesh.position);this.scene.worldToLocal(this.mesh.position);
  const climate=CLIMATE_LIGHT[mapId]||CLIMATE_LIGHT.forest,u=this.mesh.material.uniforms;
  u.skyColor.value.set(skyColor??climate.sky).multiplyScalar(skyStrength);u.fogColor.value.set(fogColor??climate.fog);u.sunColor.value.set(sunColor??climate.sun);
  if(sunDirection)u.sunDirection.value.copy(sunDirection).normalize();
  u.sunStrength.value=Math.max(0,Math.min(1,sunStrength));
  u.cloudAmount.value=cloudStrength[mapId]??cloudStrength.forest;
  if(Number.isFinite(time))u.skyTime.value=time;
 }
 dispose(){
  if(this.disposed)return;this.disposed=true;
  this.mesh.visible=false;this.mesh.removeFromParent();this.mesh.geometry.dispose();this.mesh.material.dispose();
 }
}
